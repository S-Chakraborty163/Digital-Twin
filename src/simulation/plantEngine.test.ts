import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialPlantState,
  tickSimulation,
  injectPlantFault,
  performStationMaintenance,
  toggleStationManualStop,
  updatePlantOperationalConfig,
  advanceToNextDay,
  triggerRandomMachineFailure,
  clearAllStationFaults,
  INITIAL_STATION_METAS,
  DOWNSTREAM_FLOW,
} from './plantEngine';
import {
  createDefaultItemLifecycleLedger,
  exportItemLifecycleToCSV,
} from '../utils/traceabilityExport';

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
  // Simulate previous run that accumulated 312 arrears over multiple days
  customState.config.arrearsUnits = 312;
  customState.config.simulatedDayCount = 4;
  customState.config.completedCumulative = 168;

  // Now simulate a reset while passing existing user configuration
  const resetState = createInitialPlantState(customState.config);
  
  // Custom operational settings must be preserved!
  assert.equal(resetState.config.shiftDurationHours, 10, 'Shift duration should persist on reset');
  assert.equal(resetState.config.shiftStartHour, 7.5, 'Shift start hour should persist on reset');
  assert.equal(resetState.config.humanCrewSize, 4, 'Crew size should persist on reset');
  assert.equal(resetState.config.trucks.rm1.arrivalHour, 8.75, 'Truck schedule should persist on reset');

  // Arrears backlog and runtime progress counters must be freshly reset to 0 and Day 1
  assert.equal(resetState.config.arrearsUnits, 0, 'Arrears backlog must reset to 0 on restart/reset, never stuck at 312');
  assert.equal(resetState.config.simulatedDayCount, 1, 'Simulated day count must reset to 1');
  assert.equal(resetState.config.completedCumulative, 0, 'Cumulative completed count must reset to 0');
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

test('Conveyor times default to lathe: 360s, milling: 240s, shaping: 210s and can be customized by the user', () => {
  const initial = createInitialPlantState();
  assert.equal(initial.stations['transporter_rm1'].nominalProcessingTime, 360, 'Conveyor for lathe must default to 360s');
  assert.equal(initial.stations['transporter_rm2'].nominalProcessingTime, 240, 'Conveyor for milling must default to 240s');
  assert.equal(initial.stations['transporter_rm3'].nominalProcessingTime, 210, 'Conveyor for shaping must default to 210s');
  assert.equal(initial.config.conveyorLatheTimeSeconds, 360);
  assert.equal(initial.config.conveyorMillingTimeSeconds, 240);
  assert.equal(initial.config.conveyorShapingTimeSeconds, 210);

  // User customizes conveyor times
  const custom = updatePlantOperationalConfig(initial, {
    conveyorLatheTimeSeconds: 400,
    conveyorMillingTimeSeconds: 260,
    conveyorShapingTimeSeconds: 180,
  });

  assert.equal(custom.stations['transporter_rm1'].nominalProcessingTime, 400);
  assert.equal(custom.stations['transporter_rm2'].nominalProcessingTime, 260);
  assert.equal(custom.stations['transporter_rm3'].nominalProcessingTime, 180);
});

test('No unnecessary entity block dispatched to conveyor while CNC machine is already processing an entity', () => {
  let state = createInitialPlantState();
  // Simulate entity already inside CNC lathe
  state.stations['cnc_lathe'].currentProcessingEntityId = 'ent_busy_1';
  state.stations['cnc_lathe'].processingTimeRemaining = 300;
  state.stations['cnc_lathe'].status = 'BUSY';
  state.stations['inventory_rm1'].currentQueueCount = 5;

  state.entities.push({
    id: 'ent_busy_1',
    code: 'RM1-busy',
    type: 'RM1_BILLET',
    line: 'RM1',
    currentStationId: 'cnc_lathe',
    targetStationId: 'buffer_rm1',
    positionRatio: 0,
    isProcessing: true,
    qualityPassed: true,
    creationTime: 0,
    totalCycleTime: 60,
  });

  state.entities.push({
    id: 'ent_inv_2',
    code: 'RM1-inv',
    type: 'RM1_BILLET',
    line: 'RM1',
    currentStationId: 'inventory_rm1',
    targetStationId: 'transporter_rm1',
    positionRatio: 0,
    isProcessing: false,
    qualityPassed: true,
    creationTime: 0,
    totalCycleTime: 0,
  });

  // Tick simulation
  state = tickSimulation(state, 1.0);

  // The queued item must remain in inventory and NOT be dispatched onto the conveyor while CNC is occupied
  const itemsOnConveyor = state.entities.filter(e => e.currentStationId === 'transporter_rm1');
  assert.equal(itemsOnConveyor.length, 0, 'No entity should be dispatched onto conveyor while CNC is busy');
});

test('Tool wear and RUL run in operating hours and do not cause machines to get out of order in the same day', () => {
  let state = createInitialPlantState();
  const lathe = state.stations['cnc_lathe'];
  const initialWear = lathe.sensors.toolWearIndex ?? 0.04;

  // Simulate 3 hours of operation (10,800 simulated seconds)
  state.simulationSpeed = 60;
  for (let i = 0; i < 180; i++) {
    state = tickSimulation(state, 1.0); // 60s per tick
  }

  const currentLathe = state.stations['cnc_lathe'];
  const currentWear = currentLathe.sensors.toolWearIndex ?? 0.04;
  
  // Wear after 3 hours should only have increased by a tiny fraction of a millimeter (not hit 0.35mm failure!)
  assert.ok(currentWear < 0.10, `Tool wear should remain low under 0.10mm, but was ${currentWear}`);
  assert.notEqual(currentLathe.status, 'MAINTENANCE_REQUIRED', 'Machine must NOT get out of order in the same day under nominal operation');
  assert.ok(currentLathe.mlResult.remainingUsefulLifeHours > 100, `RUL should be >100 hours, was ${currentLathe.mlResult.remainingUsefulLifeHours}`);
});

test('advanceToNextDay preserves all backlog entities at exact positions, stations, and processing state', () => {
  let state = createInitialPlantState();

  // Create WIP entities at various stations
  state.entities = [
    {
      id: 'backlog_conveyor_1',
      code: 'RM1-CONV',
      type: 'RM1_BILLET',
      line: 'RM1',
      currentStationId: 'transporter_rm1',
      targetStationId: 'cnc_lathe',
      positionRatio: 0.65,
      isProcessing: false,
      qualityPassed: true,
      creationTime: 100,
      totalCycleTime: 200,
    },
    {
      id: 'backlog_chuck_1',
      code: 'RM2-CHUCK',
      type: 'RM2_CASTING',
      line: 'RM2',
      currentStationId: 'cnc_milling',
      targetStationId: 'buffer_rm2',
      positionRatio: 0.0,
      isProcessing: true,
      qualityPassed: true,
      creationTime: 120,
      totalCycleTime: 300,
    },
    {
      id: 'backlog_buffer_1',
      code: 'RM3-BUF',
      type: 'MACHINED_RM3',
      line: 'RM3',
      currentStationId: 'buffer_rm3',
      targetStationId: 'qc_rm3',
      positionRatio: 0.0,
      isProcessing: false,
      qualityPassed: true,
      creationTime: 140,
      totalCycleTime: 400,
    },
  ];

  // Configure station state corresponding to these entities
  state.stations['cnc_milling'].currentlyProcessingCount = 1;
  state.stations['cnc_milling'].currentProcessingEntityId = 'backlog_chuck_1';
  state.stations['cnc_milling'].processingTimeRemaining = 45.5;
  state.stations['cnc_milling'].processedToday = 12;

  state.stations['buffer_rm3'].currentQueueCount = 1;
  state.stations['buffer_rm3'].processedToday = 8;

  state.completedCount = 30;

  // Advance to next day
  const nextDay = advanceToNextDay(state);

  // Day count must increment
  assert.equal(nextDay.config.simulatedDayCount, 2);
  assert.equal(nextDay.config.simulatedSecondsOfDay, 8 * 3600, 'Next day must start at 8:00 AM shift start');

  // Completed count today resets, but daily target accounts for arrears
  assert.equal(nextDay.completedCount, 0, 'Today finished goods resets to 0 for new day');
  assert.equal(nextDay.config.arrearsUnits, state.config.dailyTargetUnits - 30, 'Unfinished target becomes arrears backlog (120 - 30 = 90)');

  // Backlog entities must be completely preserved!
  assert.equal(nextDay.entities.length, 3, 'All 3 WIP entities must be preserved into the new day');
  
  const convItem = nextDay.entities.find(e => e.id === 'backlog_conveyor_1');
  assert.ok(convItem, 'Conveyor backlog item must exist');
  assert.equal(convItem?.currentStationId, 'transporter_rm1');
  assert.equal(convItem?.targetStationId, 'cnc_lathe');
  assert.equal(convItem?.positionRatio, 0.65, 'Conveyor item must start exactly where left yesterday');

  const chuckItem = nextDay.entities.find(e => e.id === 'backlog_chuck_1');
  assert.ok(chuckItem, 'In-chuck item must exist');
  assert.equal(chuckItem?.currentStationId, 'cnc_milling');
  assert.equal(chuckItem?.isProcessing, true);

  // Machine state must retain processing entity and queue
  assert.equal(nextDay.stations['cnc_milling'].currentlyProcessingCount, 1);
  assert.equal(nextDay.stations['cnc_milling'].currentProcessingEntityId, 'backlog_chuck_1');
  assert.equal(nextDay.stations['cnc_milling'].processingTimeRemaining, 45.5);
  assert.equal(nextDay.stations['cnc_milling'].processedToday, 0, 'Processed today counter resets for new day');

  assert.equal(nextDay.stations['buffer_rm3'].currentQueueCount, 1);
  assert.equal(nextDay.stations['buffer_rm3'].processedToday, 0);
});

test('Machine failure simulation can be randomized or repaired at user discretion', () => {
  let state = createInitialPlantState();

  // All machines initially nominal
  for (const st of Object.values(state.stations)) {
    assert.equal(st.activeFault, 'NONE');
    assert.notEqual(st.status, 'MAINTENANCE_REQUIRED');
  }

  // User triggers random machine failure
  const failRes = triggerRandomMachineFailure(state);
  assert.ok(failRes, 'Should successfully trigger a random machine fault');
  assert.ok(failRes?.stationId, 'Should return the afflicted station ID');
  assert.notEqual(failRes?.fault, 'NONE', 'Fault must not be NONE');

  const faultedStation = failRes!.state.stations[failRes!.stationId];
  assert.equal(faultedStation.status, 'MAINTENANCE_REQUIRED');
  assert.equal(faultedStation.activeFault, failRes!.fault);

  // User repairs all machines at will
  const repairedState = clearAllStationFaults(failRes!.state);
  const clearedStation = repairedState.stations[failRes!.stationId];
  assert.equal(clearedStation.activeFault, 'NONE');
  assert.ok(clearedStation.status === 'STARVED' || clearedStation.status === 'IDLE');
});

test('Stochastic failure simulation respects user enable/disable switch and MTBF parameter', () => {
  let state = createInitialPlantState();

  // Disable random failures
  state.config.randomFailuresEnabled = false;
  state.config.simulatedSecondsOfDay = 9 * 3600; // shift open

  // Advance many ticks; no machine should randomly fail
  for (let i = 0; i < 50; i++) {
    state = tickSimulation(state, 1.0);
  }
  const anyFault = Object.values(state.stations).some(s => s.activeFault !== 'NONE');
  assert.equal(anyFault, false, 'No fault should occur when randomFailuresEnabled is false');

  // Now enable random failures with aggressive MTBF (e.g. 0.001 hours)
  state.config.randomFailuresEnabled = true;
  state.config.mtbfHours = 0.001; // extremely low MTBF to guarantee stochastic trigger

  // Tick simulation once; machine should trip with active fault
  state = tickSimulation(state, 10.0);
  const faultedStation = Object.values(state.stations).find(s => s.activeFault !== 'NONE');
  assert.ok(faultedStation, 'Machine should fail stochastically with low MTBF');
  assert.notEqual(faultedStation?.activeFault, 'NONE');
});

test('Conveyor operation terminates and entity movement halts when conveyor gets a fault', () => {
  let state = createInitialPlantState();
  const transId = 'transporter_rm1';

  // Seed an entity on transporter_rm1
  state.entities = [
    {
      id: 'entity_test_conveyor',
      code: 'RM1-001',
      type: 'RM1_BILLET',
      line: 'RM1',
      currentStationId: transId,
      targetStationId: 'cnc_lathe',
      positionRatio: 0.25,
      isProcessing: false,
      qualityPassed: true,
      creationTime: 0,
      totalCycleTime: 10,
    },
  ];

  // Tick nominal: positionRatio should advance
  state = tickSimulation(state, 2.0);
  const posAfterNominal = state.entities[0].positionRatio;
  assert.ok(posAfterNominal > 0.25, 'Entity should advance along conveyor when operating nominally');

  // Now inject a fault onto the conveyor
  state = injectPlantFault(state, transId, 'CONVEYOR_MOTOR_OVERLOAD');
  assert.equal(state.stations[transId].activeFault, 'CONVEYOR_MOTOR_OVERLOAD');
  assert.equal(state.stations[transId].status, 'MAINTENANCE_REQUIRED');

  // Tick faulted conveyor: entity movement MUST be halted (operation terminates)
  const posBeforeFaultTick = state.entities[0].positionRatio;
  state = tickSimulation(state, 5.0);
  const posAfterFaultTick = state.entities[0].positionRatio;
  assert.equal(
    posAfterFaultTick,
    posBeforeFaultTick,
    'Entity movement on conveyor must completely terminate when conveyor gets a fault'
  );

  // Upstream inventory should also NOT dispatch new entities onto the faulted conveyor
  const itemsOnBeltBefore = state.entities.filter(e => e.currentStationId === transId).length;
  state = tickSimulation(state, 1.0);
  const itemsOnBeltAfter = state.entities.filter(e => e.currentStationId === transId).length;
  assert.equal(
    itemsOnBeltAfter,
    itemsOnBeltBefore,
    'Inventory must not dispatch onto faulted conveyor'
  );

  // Once conveyor is repaired, movement resumes
  state = performStationMaintenance(state, transId);
  assert.equal(state.stations[transId].activeFault, 'NONE');
  state = tickSimulation(state, 2.0);
  assert.ok(
    state.entities[0].positionRatio > posAfterFaultTick,
    'Entity movement resumes after conveyor repair'
  );
});

test('User can manually stop and resume the operation of any component at discretion', () => {
  let state = createInitialPlantState();
  const latheId = 'cnc_lathe';

  // Component is initially nominal
  assert.equal(state.stations[latheId].isManuallyStopped, undefined);

  // User manually stops the component
  state = toggleStationManualStop(state, latheId);
  assert.equal(state.stations[latheId].isManuallyStopped, true);
  assert.equal(state.stations[latheId].status, 'MAINTENANCE_REQUIRED');

  // Place entity in machine chuck
  state.entities = [
    {
      id: 'entity_lathe_item',
      code: 'RM1-002',
      type: 'RM1_BILLET',
      line: 'RM1',
      currentStationId: latheId,
      targetStationId: 'buffer_rm1',
      positionRatio: 0,
      isProcessing: true,
      qualityPassed: true,
      creationTime: 0,
      totalCycleTime: 10,
    },
  ];
  state.stations[latheId].currentProcessingEntityId = 'entity_lathe_item';
  state.stations[latheId].processingTimeRemaining = 120.0;

  // Tick simulation: because lathe is manually stopped, processingTimeRemaining must NOT decrement
  state = tickSimulation(state, 5.0);
  assert.equal(
    state.stations[latheId].processingTimeRemaining,
    120.0,
    'Station processing must freeze when manually stopped'
  );

  // User resumes component
  state = toggleStationManualStop(state, latheId);
  assert.equal(state.stations[latheId].isManuallyStopped, false);
  assert.equal(state.stations[latheId].status, 'BUSY');

  // Tick simulation: processing resumes
  state = tickSimulation(state, 5.0);
  assert.ok(
    state.stations[latheId].processingTimeRemaining < 120.0,
    'Station processing resumes after being resumed'
  );
});

test('QC Subsystem tracks defect scrap and rework audit records with exact RM ID and deviation margin', () => {
  const state = createInitialPlantState();
  const qc1 = state.stations['qc_rm1'];
  assert.ok(qc1.qcSubsystem?.defectAuditLog, 'QC subsystem must have defectAuditLog');
  assert.ok(qc1.qcSubsystem.defectAuditLog.length > 0, 'Initial defect audit log should not be empty');

  // Verify fields on defect audit record
  const rec = qc1.qcSubsystem.defectAuditLog[0];
  assert.ok(rec.itemId.startsWith('RM1-'), `Expected RM1 item ID, got ${rec.itemId}`);
  assert.ok(rec.deviationMargin.length > 0, 'Expected deviationMargin');
  assert.ok(rec.standardValue.length > 0, 'Expected standardValue');
  assert.ok(rec.action === 'SCRAPPED' || rec.action === 'REWORKED');
});

test('Material Step and Traceability ledger starts clean with 0 preloaded fake records and captures real-time dynamic steps', () => {
  // 1. Initial plant state must start with an empty ledger (no fake preloaded RM1-001 or ASY-001)
  const initial = createInitialPlantState();
  assert.ok(Array.isArray(initial.itemLifecycleLedger), 'itemLifecycleLedger must be an array');
  assert.equal(initial.itemLifecycleLedger.length, 0, 'Must have 0 preloaded fake records on fresh initialization');

  // 2. Set truck arrival to 8.0 (8:00 AM) so trucks unload immediately
  const config = {
    ...initial.config,
    simulatedSecondsOfDay: 8 * 3600, // 8:00 AM
    trucks: {
      ...initial.config.trucks,
      rm1: { ...initial.config.trucks.rm1, arrivalHour: 8.0 },
      rm2: { ...initial.config.trucks.rm2, arrivalHour: 8.0 },
      rm3: { ...initial.config.trucks.rm3, arrivalHour: 8.0 },
    },
  };
  let state = { ...initial, config };

  // Step simulation forward through several seconds
  // Trucks should arrive, unload, and spawn real-time records into the ledger
  for (let i = 0; i < 20; i++) {
    state = tickSimulation(state, 1.0);
  }

  assert.ok(state.itemLifecycleLedger, 'Ledger must exist after simulation ticks');
  assert.ok(state.itemLifecycleLedger.length > 0, 'Ledger must dynamically capture real-time material records');

  // Inspect the first recorded item
  const firstItem = state.itemLifecycleLedger[state.itemLifecycleLedger.length - 1];
  assert.ok(firstItem.itemId.startsWith('RM'), `Expected RM prefix, got ${firstItem.itemId}`);
  assert.ok(firstItem.steps.length >= 2, 'Item must have unloading and inventory steps recorded');
  assert.equal(firstItem.steps[0].status, 'COMPLETED');
  assert.equal(firstItem.steps[firstItem.steps.length - 1].status, 'IN_PROGRESS');
  assert.ok(firstItem.lotBatchId.includes('LOT-'), 'Must have valid lot batch identifier');
});

test('Real-time material lifecycle ledger exports RFC 4180 CSV with UTF-8 BOM and step details', () => {
  const initial = createInitialPlantState();
  const config = {
    ...initial.config,
    simulatedSecondsOfDay: 8 * 3600,
    trucks: {
      ...initial.config.trucks,
      rm1: { ...initial.config.trucks.rm1, arrivalHour: 8.0 },
    },
  };
  let state = { ...initial, config };

  for (let i = 0; i < 15; i++) {
    state = tickSimulation(state, 1.0);
  }

  const csv = exportItemLifecycleToCSV(state.itemLifecycleLedger || []);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Microsoft Excel');
  assert.ok(csv.includes('"Material ID","Lot / Batch Number"'), 'CSV must include header row');
  assert.ok(csv.includes('RM1-001'), 'CSV must contain tracked item ID');
});




