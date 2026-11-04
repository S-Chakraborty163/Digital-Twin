import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialPlantState,
  tickSimulation,
  injectPlantFault,
  performStationMaintenance,
  updatePlantOperationalConfig,
  advanceToNextDay,
  INITIAL_STATION_METAS,
  DOWNSTREAM_FLOW,
} from './plantEngine';

test('Initial plant state creates all 28 stations with 4-metric tracking and subassembly removed', () => {
  const state = createInitialPlantState();
  assert.ok(state);
  assert.equal(Object.keys(state.stations).length, INITIAL_STATION_METAS.length);
  assert.equal(INITIAL_STATION_METAS.length, 28);
  
  // Verify key stations from user's Simulink diagram (subassembly removed)
  assert.ok(state.stations['truck_rm1']);
  assert.ok(state.stations['cnc_lathe']);
  assert.ok(state.stations['buffer_rm1']);
  assert.ok(state.stations['qc_rm1']);
  assert.equal(state.stations['subassembly_rm1'], undefined, 'Subassembly RM1 must be removed');
  assert.equal(state.stations['subassembly_rm2'], undefined, 'Subassembly RM2 must be removed');
  assert.equal(state.stations['subassembly_rm3'], undefined, 'Subassembly RM3 must be removed');
  assert.ok(state.stations['converge_join']);
  assert.ok(state.stations['final_assembly']);
  assert.ok(state.stations['packaging']);
  assert.ok(state.stations['sink_dispatch']);

  // Verify 4-metric real-time tracking fields on every single station
  for (const st of Object.values(state.stations)) {
    assert.ok(st.currentlyProcessingCount !== undefined, `Station ${st.id} missing currentlyProcessingCount`);
    assert.ok(st.currentQueueCount !== undefined, `Station ${st.id} missing currentQueueCount`);
    assert.ok(st.processedToday !== undefined, `Station ${st.id} missing processedToday`);
    assert.ok(st.processedCumulative !== undefined, `Station ${st.id} missing processedCumulative`);
  }
});

test('Downstream flow routes buffer directly to QC and converge into final assembly', () => {
  assert.equal(DOWNSTREAM_FLOW['truck_rm1'], 'unloading_rm1');
  assert.equal(DOWNSTREAM_FLOW['transporter_rm1'], 'cnc_lathe');
  assert.equal(DOWNSTREAM_FLOW['cnc_lathe'], 'buffer_rm1');
  assert.equal(DOWNSTREAM_FLOW['buffer_rm1'], 'qc_rm1'); // Direct to QC (subassembly removed)
  assert.equal(DOWNSTREAM_FLOW['buffer_rm2'], 'qc_rm2');
  assert.equal(DOWNSTREAM_FLOW['buffer_rm3'], 'qc_rm3');
  assert.equal(DOWNSTREAM_FLOW['qc_rm1'], 'converge_join');
  assert.equal(DOWNSTREAM_FLOW['qc_rm2'], 'converge_join');
  assert.equal(DOWNSTREAM_FLOW['qc_rm3'], 'converge_join');
  assert.equal(DOWNSTREAM_FLOW['converge_join'], 'final_assembly');
  assert.equal(DOWNSTREAM_FLOW['packaging'], 'transporter_out');
});

test('tickSimulation updates simulation time and advances items along transporters', () => {
  const initial = createInitialPlantState();
  const ticked = tickSimulation(initial, 1.0);
  assert.equal(ticked.timeSeconds, 1.0);
  assert.ok(ticked.entities.length >= initial.entities.length);
});

test('Tool flank wear degrades progressively and only triggers MAINTENANCE_REQUIRED at ISO 3685 limit (>= 0.30mm)', () => {
  let state = createInitialPlantState();
  
  // Normal wear injection increases VB by 0.06mm
  state = injectPlantFault(state, 'cnc_lathe', 'TOOL_FLANK_WEAR');
  assert.equal(state.stations['cnc_lathe'].activeFault, 'TOOL_FLANK_WEAR');
  const wear1 = state.stations['cnc_lathe'].sensors.toolWearIndex ?? 0;
  assert.ok(wear1 > 0.05);

  // If wear < 0.30mm, machine status stays operational (NOT immediately forced to MAINTENANCE_REQUIRED)
  if (wear1 < 0.30) {
    assert.notEqual(state.stations['cnc_lathe'].status, 'MAINTENANCE_REQUIRED');
  }

  // Inject critical bearing fault which does immediately require maintenance
  state = injectPlantFault(state, 'cnc_lathe', 'BEARING_INNER_RACE_FAULT');
  assert.equal(state.stations['cnc_lathe'].status, 'MAINTENANCE_REQUIRED');

  // Perform virtual maintenance calibration
  state = performStationMaintenance(state, 'cnc_lathe');
  assert.equal(state.stations['cnc_lathe'].activeFault, 'NONE');
  assert.ok(state.stations['cnc_lathe'].sensors.toolWearIndex! < 0.1);
});

test('Quality Control stations initialize and execute the 3-stage Check I -> Check II -> Rework -> Check III subsystem', () => {
  const state = createInitialPlantState();
  const qc1 = state.stations['qc_rm1'];
  assert.ok(qc1.qcSubsystem, 'Expected qcSubsystem metrics on qc_rm1');
  assert.ok(qc1.qcSubsystem.firstPassYield >= 70);
  assert.ok(qc1.qcSubsystem.rolledThroughputYield >= qc1.qcSubsystem.firstPassYield);
});

test('Simulated clock initializes 120 RM units per truck (360 total) and 4 min assembly', () => {
  const state = createInitialPlantState();
  assert.equal(state.config.shiftDurationHours, 8);
  assert.equal(state.config.shiftStartHour, 8);
  assert.equal(state.config.dailyTargetUnits, 120);
  assert.equal(state.config.dailyRmPerTruck, 120);
  assert.equal(state.config.trucks.rm1.unitsDelivered, 120);
  assert.equal(state.config.trucks.rm2.unitsDelivered, 120);
  assert.equal(state.config.trucks.rm3.unitsDelivered, 120);
  assert.equal(state.config.conveyorTransportTimeSeconds, 45);
  assert.equal(state.config.latheCycleTimeMinutes, 6.0);
  assert.equal(state.config.millingCycleTimeMinutes, 4.0);
  assert.equal(state.config.shapingCycleTimeMinutes, 3.5);
  assert.equal(state.config.assemblyCycleTimeMinutes, 4.0);
  assert.equal(state.config.packagingCycleTimeMinutes, 4.0);
  assert.equal(state.config.unloadingMode, 'MANUAL_HUMAN');
  assert.equal(state.config.bypassSubassemblyDirectToQC, true);
  assert.equal(state.completedCount, 0, 'Finished goods should start at 0 on fresh shift');
});

test('advanceToNextDay calculates arrears, advances date, resets 8:00 AM clock, and reloads trucks', () => {
  let state = createInitialPlantState();
  state.completedCount = 45; // Produced 45 out of 120 today
  
  const nextDayState = advanceToNextDay(state);
  assert.equal(nextDayState.config.simulatedDayCount, 2);
  assert.equal(nextDayState.config.simulatedSecondsOfDay, 8 * 3600); // 8:00 AM
  assert.equal(nextDayState.config.isShiftOpen, true);
  assert.equal(nextDayState.config.arrearsUnits, 120 - 45); // 75 units rolled into arrears backlog
  assert.equal(nextDayState.completedCount, 0); // Reset for new day
  assert.equal(nextDayState.config.trucks.rm1.unitsLeftToUnload, 120);
});

test('updatePlantOperationalConfig modifies machine durations and parameters dynamically', () => {
  let state = createInitialPlantState();
  state = updatePlantOperationalConfig(state, {
    shiftDurationHours: 10,
    conveyorTransportTimeSeconds: 30,
    latheCycleTimeMinutes: 5.0,
    packagingCycleTimeMinutes: 3.0,
  });

  assert.equal(state.config.shiftDurationHours, 10);
  assert.equal(state.stations['transporter_rm1'].nominalProcessingTime, 30);
  assert.equal(state.stations['cnc_lathe'].nominalProcessingTime, 300);
  assert.equal(state.stations['packaging'].nominalProcessingTime, 180);
});

test('Continuous entity flow: truck unloads units into inventory and finished goods increments over shift', () => {
  let state = createInitialPlantState();
  // Fast simulation: truck already arrived at 8:00 AM
  state.config.trucks.rm1.arrivalHour = 8.0;
  state.config.trucks.rm2.arrivalHour = 8.0;
  state.config.trucks.rm3.arrivalHour = 8.0;
  state.simulationSpeed = 60; // 60x speed

  // Simulate multiple minutes of operation
  for (let step = 0; step < 80; step++) {
    state = tickSimulation(state, 1.0); // 1 real sec = 60 simulated secs
  }

  // Verify that truck unloading has taken place and units are in inventory & in transit
  assert.ok(state.stations['unloading_rm1'].processedToday > 1, 'Truck unloading should have processed multiple units');
  assert.ok(state.stations['inventory_rm1'].currentQueueCount > 0 || state.stations['inventory_rm1'].processedToday > 1, 'Inventory should have received units');
  assert.ok(state.entities.length > 3, 'New entities should have been spawned into the factory');

  // Verify C >= D on all stations
  for (const st of Object.values(state.stations)) {
    assert.ok(st.processedCumulative >= st.processedToday, `Station ${st.id} had C (${st.processedCumulative}) < D (${st.processedToday})`);
  }
});

test('Lunch break activates at 1:00 PM and sets station status to LUNCH_BREAK', () => {
  let state = createInitialPlantState();
  // Set simulated clock to 1:15 PM (13.25h)
  state.config.simulatedSecondsOfDay = 13.25 * 3600;
  state.config.lunchBreakEnabled = true;
  state.config.lunchBreakStartHour = 13.0;
  state.config.lunchBreakDurationMinutes = 60;

  state = tickSimulation(state, 0.5);

  assert.equal(state.stations['unloading_rm1'].status, 'LUNCH_BREAK', 'Unloading crew should be on lunch break');
  assert.equal(state.stations['truck_rm1'].status, 'LUNCH_BREAK', 'Truck inflow should be on lunch break');
});

test('Zero entities pass before truck arrives and undergoes unloading', () => {
  const state = createInitialPlantState();
  // Trucks RM2 and RM3 have not arrived yet at 8:00 AM
  assert.equal(state.entities.length, 0, 'Plant must start with 0 entities');
  assert.equal(state.stations['inventory_rm1'].currentQueueCount, 0);
  assert.equal(state.stations['inventory_rm2'].currentQueueCount, 0);
  assert.equal(state.stations['inventory_rm3'].currentQueueCount, 0);
  assert.equal(state.stations['cnc_lathe'].currentlyProcessingCount, 0);
  assert.equal(state.stations['packaging'].processedToday, 0);
  assert.equal(state.stations['sink_dispatch'].processedToday, 0);
});

test('Simulating bottleneck at QC causes upstream buffer to accumulate queue', () => {
  let state = createInitialPlantState();
  
  // Directly insert 3 machined units into buffer_rm1 and stall QC with a bottleneck fault
  state = injectPlantFault(state, 'qc_rm1', 'OPTICAL_LENS_FOULED');
  assert.equal(state.stations['qc_rm1'].status, 'MAINTENANCE_REQUIRED');

  // Push an item to buffer_rm1
  state.entities.push({
    id: 'test_machined_1',
    code: 'RM1-TEST1',
    type: 'MACHINED_RM1',
    line: 'RM1',
    currentStationId: 'buffer_rm1',
    targetStationId: 'qc_rm1',
    positionRatio: 0,
    isProcessing: false,
    qualityPassed: true,
    creationTime: 10,
    totalCycleTime: 100,
  });
  state.stations['buffer_rm1'].currentQueueCount = 1;

  // Tick simulation
  state = tickSimulation(state, 1.0);

  // The item must remain in buffer_rm1 because QC is in MAINTENANCE_REQUIRED (bottlenecked)
  assert.equal(state.stations['buffer_rm1'].currentQueueCount, 1, 'Buffer must hold queue when QC is bottlenecked');
  assert.equal(state.stations['qc_rm1'].currentlyProcessingCount, 0, 'Bottlenecked QC must not accept item');

  // Repair QC
  state = performStationMaintenance(state, 'qc_rm1');
  assert.equal(state.stations['qc_rm1'].activeFault, 'NONE');

  // Next tick, QC should accept the item from the buffer
  state = tickSimulation(state, 1.0);
  assert.equal(state.stations['qc_rm1'].currentlyProcessingCount, 1, 'QC should accept item from buffer once cleared');
  assert.equal(state.stations['buffer_rm1'].currentQueueCount, 0, 'Buffer queue should drain after dispatch to QC');
});

test('Packaging departure matches warehouse dispatch count 1:1 without double-counting', () => {
  let state = createInitialPlantState();
  
  // Create entity currently in packaging with 0.1s left
  state.entities.push({
    id: 'pack_test_1',
    code: 'ASY-PACK1',
    type: 'ASSEMBLED_UNIT',
    line: 'FINAL',
    currentStationId: 'packaging',
    targetStationId: 'transporter_out',
    positionRatio: 0,
    isProcessing: true,
    qualityPassed: true,
    creationTime: 10,
    totalCycleTime: 300,
  });
  state.stations['packaging'].currentProcessingEntityId = 'pack_test_1';
  state.stations['packaging'].processingTimeRemaining = 0.05;
  state.stations['packaging'].nominalProcessingTime = 1.0;

  // Complete packaging (takes 0.1s)
  state = tickSimulation(state, 0.1);
  assert.equal(state.stations['packaging'].processedToday, 1, 'Packaging processedToday must be exactly 1, not 2');

  // Allow outfeed transport along transporter_out (nominal duration 45.0s) into entity_queue_out and sink_dispatch
  for (let i = 0; i < 50; i++) {
    state = tickSimulation(state, 1.0);
  }

  assert.equal(state.stations['packaging'].processedToday, 1, 'Packaging must remain exactly 1');
  assert.equal(state.stations['sink_dispatch'].processedToday, 1, 'Sink dispatch must match packaging 1:1');
  assert.equal(state.completedCount, 1, 'Completed count must be exactly 1');
});

test('Transporter out is 45s, QC is 30s/180s, settings persist on reset, and everyday truck arrivals stay in 8am-10am range', () => {
  const initial = createInitialPlantState();
  assert.equal(initial.stations['transporter_out'].nominalProcessingTime, 45.0, 'Transporter out must be 45s');
  assert.equal(initial.stations['qc_rm1'].nominalProcessingTime, 30.0, 'QC inspection duration must be 30s');
  assert.equal(initial.config.qualityParameters.inspectionDurationSeconds, 30);
  assert.equal(initial.config.qualityParameters.reworkDurationSeconds, 180);

  // Modify operational shift and logistics parameters
  const customState = updatePlantOperationalConfig(initial, {
    shiftDurationHours: 10,
    shiftStartHour: 7.5,
    conveyorTransportTimeSeconds: 50,
    latheCycleTimeMinutes: 7.0,
    humanCrewSize: 4,
    trucks: {
      rm1: {
        arrivalTimeStr: '08:45 AM',
        arrivalHour: 8.75,
        unitsDelivered: 120,
        hasArrived: false,
        isUnloading: false,
        unitsLeftToUnload: 120,
      },
    },
  });

  // Verify parameters took effect
  assert.equal(customState.config.shiftDurationHours, 10);
  assert.equal(customState.config.shiftStartHour, 7.5);
  assert.equal(customState.config.humanCrewSize, 4);
  assert.equal(customState.config.trucks.rm1.arrivalHour, 8.75);

  // Now simulate a reset while passing existing user configuration
  const resetState = createInitialPlantState(customState.config);
  
  // Custom settings must be preserved!
  assert.equal(resetState.config.shiftDurationHours, 10, 'Shift duration should persist on reset');
  assert.equal(resetState.config.shiftStartHour, 7.5, 'Shift start hour should persist on reset');
  assert.equal(resetState.config.humanCrewSize, 4, 'Crew size should persist on reset');
  assert.equal(resetState.config.trucks.rm1.arrivalHour, 8.75, 'Truck schedule should persist on reset');

  // Daily counters must be freshly reset
  assert.equal(resetState.completedCount, 0, 'Completed count must reset to 0');
  assert.equal(resetState.config.trucks.rm1.unitsLeftToUnload, 120, 'Units left to unload must reset to 120 on restart');
  assert.equal(resetState.config.trucks.rm1.hasArrived, false, 'hasArrived must reset to false on restart');
  assert.equal(resetState.stations['truck_rm1'].processedToday, 0, 'RM1 truck D must be 0 on restart');
  assert.equal(resetState.stations['truck_rm1'].currentQueueCount, 120, 'RM1 truck Q must show 120 payload');

  // Test everyday reset advances day and keeps truck timing strictly in 8am to 10am range
  for (let day = 0; day < 10; day++) {
    const nextDay = advanceToNextDay(resetState);
    for (const key of ['rm1', 'rm2', 'rm3'] as const) {
      const truck = nextDay.config.trucks[key];
      assert.ok(
        truck.arrivalHour >= 8.0 && truck.arrivalHour <= 10.0,
        `Truck ${key} arrival hour ${truck.arrivalHour} out of 8am-10am window`
      );
      assert.equal(truck.unitsLeftToUnload, 120);
      assert.equal(truck.hasArrived, false);
      assert.equal(nextDay.stations[`truck_${key}`].processedToday, 0, `Truck ${key} D must be 0 at start of day`);
    }
  }
});

test('7-Day Performance History initializes 7 days of simulation data and updates on day rollover and ticks', () => {
  const initial = createInitialPlantState();
  assert.ok(initial.performanceHistory);
  assert.equal(initial.performanceHistory.length, 7, 'Should initialize with 7 days of simulation history');
  
  // Last entry is the current active day
  const todayEntry = initial.performanceHistory[initial.performanceHistory.length - 1];
  assert.equal(todayEntry.isCurrentDay, true);
  assert.equal(todayEntry.finishedGoods, 0);
  assert.equal(todayEntry.targetUnits, 120);

  // Preceding 6 days have realistic finished goods and arrears backlog
  for (let i = 0; i < 6; i++) {
    const rec = initial.performanceHistory[i];
    assert.equal(rec.isCurrentDay, false);
    assert.ok(rec.finishedGoods >= 80 && rec.finishedGoods <= 140);
    assert.ok(rec.arrearsBacklog >= 0);
    assert.equal(rec.targetUnits, 120);
  }

  // Ticking simulation updates today's record
  initial.completedCount = 42;
  const ticked = tickSimulation(initial, 0.5);
  const updatedToday = ticked.performanceHistory[ticked.performanceHistory.length - 1];
  assert.equal(updatedToday.finishedGoods, 42);

  // Advancing to next day finalizes the day and creates a new Day 2 record
  const day2 = advanceToNextDay(ticked);
  assert.equal(day2.performanceHistory.length, 8);
  const prevFinalized = day2.performanceHistory[day2.performanceHistory.length - 2];
  assert.equal(prevFinalized.isCurrentDay, false);
  assert.equal(prevFinalized.finishedGoods, 42);
  const activeDay2 = day2.performanceHistory[day2.performanceHistory.length - 1];
  assert.equal(activeDay2.isCurrentDay, true);
  assert.equal(activeDay2.finishedGoods, 0);
  // Arrears should be (120 - 42) = 78 units
  assert.equal(activeDay2.arrearsBacklog, 78);
});

