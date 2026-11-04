/**
 * Factory and Simulation Types for AeroTwin Digital Twin
 * Mirrors the Simulink SimEvents model:
 * 3 parallel intake lines (RM1, RM2, RM3) merging into Final Assembly, Packaging and Shipping.
 */

export type LineType = 'RM1' | 'RM2' | 'RM3' | 'MERGE' | 'FINAL';

export type StationType =
  | 'truck_source'
  | 'truck_unloading'
  | 'inventory_fifo'
  | 'transporter'
  | 'cnc_lathe'
  | 'cnc_milling'
  | 'cnc_shaping'
  | 'buffer_fifo'
  | 'quality_control'
  | 'converge_join'
  | 'final_assembly'
  | 'entity_queue'
  | 'packaging'
  | 'transporter_out'
  | 'entity_queue_out'
  | 'sink_dispatch';

export type FaultType =
  | 'NONE'
  // CNC Machining Center Faults
  | 'TOOL_FLANK_WEAR'
  | 'SPINDLE_BEARING_VIBRATION'
  | 'SPINDLE_THERMAL_EXPANSION'
  | 'CHIP_CONVEYOR_CLOG'
  // Conveyor / Transporter Faults
  | 'BELT_SLIP_AND_TENSION_LOSS'
  | 'ROLLER_BEARING_OVERHEAT'
  | 'CONVEYOR_MOTOR_OVERLOAD'
  // Logistics / Unloading Faults
  | 'TRUCK_ARRIVAL_DELAY'
  | 'PALLET_UNLOADING_JAM'
  | 'WORKER_FATIGUE_DELAY'
  | 'FORKLIFT_HYDRAULIC_LEAK'
  // Inventory / FIFO Queue Faults
  | 'RACK_OVERFLOW_WARNING'
  | 'STORAGE_HUMIDITY_EXCURSION'
  | 'FIFO_INDEXING_STALL'
  // Quality Control Faults
  | 'OPTICAL_LENS_FOULED'
  | 'GAUGE_CALIBRATION_DRIFT'
  | 'PROBE_ACTUATOR_RESPONSE_LAG'
  // Final Assembly Faults
  | 'TORQUE_DRIVER_OUT_OF_SPEC'
  | 'PNEUMATIC_PRESSURE_DROP'
  | 'OPERATOR_ASSEMBLY_BOTTLENECK'
  // Packaging / Outfeed Faults
  | 'SEALER_HEATER_ELEMENT_FAULT'
  | 'BARCODE_SCANNER_MISREAD'
  | 'STRAPPING_DISPENSER_JAM'
  // Legacy / General aliases
  | 'BEARING_INNER_RACE_FAULT'
  | 'SPINDLE_OVERHEAT_LUB_FAIL'
  | 'MOTOR_WINDING_OVERCURRENT'
  | 'QUALITY_CALIBRATION_DRIFT';

export interface StationSensors {
  vibrationRms: number; // mm/s (ISO 10816 normal < 2.8, warning 4.5, alarm 7.1)
  vibrationPeak: number; // g
  temperature: number; // °C (normal 35-50°C, warning >65°C, alarm >80°C)
  motorCurrent: number; // Amperes
  acousticEmission: number; // kHz (bursts during micro-cracks)
  toolWearIndex: number; // mm flank wear VB (0.0 to 0.6 mm, threshold 0.30mm)
  conveyorTension?: number; // N (for transporters)
  speedRpm?: number; // RPM (for CNC spindles / rollers)
  feedRate?: number; // mm/min
}

export interface TelemetryPoint {
  timestamp: number;
  vibrationRms: number;
  temperature: number;
  motorCurrent: number;
  acousticEmission: number;
  anomalyScore: number;
}

export interface MLDetectionResult {
  anomalyScore: number; // 0.0 (normal) to 1.0 (severe anomaly)
  isAnomaly: boolean;
  isolationForestScore: number;
  autoencoderReconstructionError: number;
  predictedFailureClass: string;
  predictedFailureProb: number;
  remainingUsefulLifeHours: number; // RUL countdown
  modelConfidence: number; // percentage
  prescriptiveAction: string;
  contributingFeatures: { name: string; impact: number }[];
}

export interface QCSubsystemMetrics {
  check1Inspected: number;
  check1Passed: number;
  check1Failed: number;
  check2Scrapped: number;
  check2SentToRework: number;
  reworkProcessed: number;
  check3Passed: number;
  check3Scrapped: number;
  firstPassYield: number; // percentage (e.g. 91.5%)
  rolledThroughputYield: number; // percentage (FPY + Rework Yield)
  activeInReworkEntityId: string | null;
  reworkTimeRemaining: number;
}

export interface PlantOperationalConfig {
  shiftDurationHours: number; // default 8 hours
  shiftStartHour: number; // default 8 (8:00 AM)
  simulatedSecondsOfDay: number; // starts at 8 * 3600 = 28800 (8:00 AM)
  simulatedDate: string; // e.g. "2026-11-03"
  simulatedDayCount: number; // e.g. Day 1
  timeScale: number; // 1x, 5x, 15x, 60x, 120x
  isShiftOpen: boolean; // True during working hours, false when unit closes for the day

  // Daily target and arrears
  dailyTargetUnits: number; // 120 finished products per day
  dailyRmPerTruck: number; // 120 units of RM per truck (360 total)
  arrearsUnits: number; // Unfinished products carried over to next day
  completedToday: number; // Finished products completed today
  completedCumulative: number; // All-time completed products
  shiftClosedForDayCount?: number; // Tracks day index when shift closure was booked
  
  // Truck logistics (120 units each RM)
  trucks: {
    rm1: { arrivalTimeStr: string; arrivalHour: number; unitsDelivered: number; hasArrived: boolean; isUnloading: boolean; unitsLeftToUnload: number };
    rm2: { arrivalTimeStr: string; arrivalHour: number; unitsDelivered: number; hasArrived: boolean; isUnloading: boolean; unitsLeftToUnload: number };
    rm3: { arrivalTimeStr: string; arrivalHour: number; unitsDelivered: number; hasArrived: boolean; isUnloading: boolean; unitsLeftToUnload: number };
  };

  // Unloading equipment
  unloadingMode: 'MANUAL_HUMAN' | 'FORKLIFT' | 'OVERHEAD_CRANE';
  humanCrewSize: number; // default 3 workers
  workerFatiguePercentage: number; // 0 - 100%

  // Transporter conveyor
  conveyorTransportTimeSeconds: number; // default 45s

  // Machining cycle times (in minutes)
  latheCycleTimeMinutes: number; // default 6.0 min (360s)
  millingCycleTimeMinutes: number; // default 4.0 min (240s)
  shapingCycleTimeMinutes: number; // default 3.5 min (210s)

  // Quality Control parameters
  qualityParameters: {
    inspectionDurationSeconds: number; // default 30s
    reworkDurationSeconds?: number; // default 180s (3 minutes)
    dimensionalToleranceMm: number; // default 0.02 mm
    surfaceRoughnessRa: number; // default 0.8 um
    hardnessHrcMin: number; // default 45 HRC
    hardnessHrcMax: number; // default 50 HRC
  };

  // Final Assembly mode (takes 4 minutes on average, user selectable)
  assemblyMode: 'FULLY_AUTOMATED' | 'SEMI_AUTOMATED' | 'PURELY_MANUAL';
  assemblyCycleTimeMinutes: number; // default 4.0 min (240s)

  // Packaging
  packagingCycleTimeMinutes: number; // default 4.0 min (240s)

  // Subassembly abridging / bypass
  bypassSubassemblyDirectToQC?: boolean;

  // Lunch break options (user configurable, default 1:00 PM for 1 hour)
  lunchBreakEnabled: boolean;
  lunchBreakStartHour: number; // default 13.0 (1:00 PM)
  lunchBreakDurationMinutes: number; // default 60 minutes
}

export interface Station {
  id: string;
  name: string;
  simulinkTag: string; // Exact name in user's SimEvents diagram
  line: LineType;
  type: StationType;
  x: number; // 2D diagram coordinate X
  y: number; // 2D diagram coordinate Y
  width: number;
  height: number;
  isQueue: boolean;
  maxQueueCapacity?: number;
  
  // Entity metrics: Every block displays these 4 metrics
  currentlyProcessingCount: number; // 0 or 1 for machines, active items on conveyor
  currentQueueCount: number; // Items waiting in FIFO queue
  processedToday: number; // Units processed during current shift
  processedCumulative: number; // All-time units processed

  currentProcessingEntityId: string | null;
  processingTimeRemaining: number;
  nominalProcessingTime: number; // seconds
  utilization: number; // 0 - 100%
  busyTimeAccumulated: number;
  totalTimeAccumulated: number;
  itemsProcessed: number;
  itemsRejected: number;
  status: 'IDLE' | 'BUSY' | 'BLOCKED' | 'STARVED' | 'MAINTENANCE_REQUIRED' | 'SHIFT_CLOSED' | 'LUNCH_BREAK';
  activeFault: FaultType;
  sensors: StationSensors;
  history: TelemetryPoint[];
  mlResult: MLDetectionResult;
  qcSubsystem?: QCSubsystemMetrics;
  
  // Cumulative machine wear & operating metrics
  cumulativeRunHours: number;
  wearPercentage: number; // 0 - 100%
  lastMaintenanceOperatingHour: number;
}

export type ItemType =
  | 'RM1_BILLET'
  | 'RM2_CASTING'
  | 'RM3_PLATE'
  | 'MACHINED_RM1'
  | 'MACHINED_RM2'
  | 'MACHINED_RM3'
  | 'ASSEMBLED_UNIT'
  | 'PACKAGED_PRODUCT';

export interface ItemEntity {
  id: string;
  code: string;
  type: ItemType;
  line: LineType;
  currentStationId: string;
  targetStationId: string | null;
  positionRatio: number; // 0.0 to 1.0 along conveyor transport
  isProcessing: boolean;
  qualityPassed: boolean;
  creationTime: number;
  totalCycleTime: number;
}

export interface PlantOEE {
  availability: number; // percentage 0-100
  performance: number; // percentage 0-100
  quality: number; // percentage 0-100
  overallOEE: number; // A * P * Q
}

export interface DailyPerformanceRecord {
  day: number;
  dateStr: string;
  dayLabel: string;
  finishedGoods: number; // completed units produced that day
  targetUnits: number; // daily target (120 units)
  arrearsBacklog: number; // carryover arrears backlog units
  cumulativeBacklog: number; // cumulative unfulfilled units
  scrapCount: number; // rejected/scrapped units
  fpy: number; // First pass yield percentage
  oee: number; // Overall equipment effectiveness percentage
  isCurrentDay?: boolean;
}

export interface PlantSimulationState {
  timeSeconds: number;
  isRunning: boolean;
  simulationSpeed: number; // 0.5x, 1x, 2x, 5x, 15x, 60x, 120x
  stations: Record<string, Station>;
  entities: ItemEntity[];
  completedCount: number; // finished goods count today
  rejectedCount: number;
  wipCount: number;
  oee: PlantOEE;
  bottleneckStationId: string | null;
  lineBalanceScore: number; // 0-100%
  totalDowntimeSeconds: number;
  config: PlantOperationalConfig;
  performanceHistory: DailyPerformanceRecord[];
}

