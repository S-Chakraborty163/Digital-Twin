/**
 * Discrete Event Simulation Engine & Plant Layout for Industrial Digital Twin
 * Implements the discrete manufacturing layout:
 * 3 parallel intake lines (RM1, RM2, RM3) -> CNC machining -> Buffer -> Quality Control -> Converge Join -> Final Assembly -> Packaging -> Warehouse Dispatch
 */

import {
  DailyPerformanceRecord,
  FaultType,
  ItemEntity,
  ItemLifecycleRecord,
  ItemLifecycleStep,
  ItemType,
  LineType,
  PlantOEE,
  PlantOperationalConfig,
  PlantSimulationState,
  QCDefectAuditRecord,
  Station,
  StationSensors,
  StationType,
} from '../types/factory';
import { NOMINAL_BASELINES, runPredictivePipeline } from '../ml/predictiveModels';
import {
  createDefaultItemLifecycleLedger,
  recordItemLifecycleBirth,
  recordItemLifecycleStepTransition,
  recordItemLifecycleStepUpdate,
  recordItemLifecycleScrap,
  recordItemLifecycleDispatch,
  tickActiveLifecycleRecords,
} from '../utils/traceabilityExport';

// Layout coordinates for SVG / Canvas rendering (clean horizontal layout without subassembly)
export interface StationLayoutMeta {
  id: string;
  name: string;
  simulinkTag: string;
  line: LineType;
  type: StationType;
  x: number;
  y: number;
  width: number;
  height: number;
  nominalDuration: number; // in seconds
  isQueue: boolean;
  maxQueueCapacity?: number;
  description: string;
}

export const INITIAL_STATION_METAS: StationLayoutMeta[] = [
  // --- LINE 1: RM1 (LATHE / SHAFT PRODUCTION) ---
  {
    id: 'truck_rm1',
    name: 'Truck Inflow RM1',
    simulinkTag: 'TRUCK RM1',
    line: 'RM1',
    type: 'truck_source',
    x: 50,
    y: 100,
    width: 70,
    height: 48,
    nominalDuration: 8.0,
    isQueue: false,
    description: 'Raw material truck delivery (120 units Alloy Bar Stock)',
  },
  {
    id: 'unloading_rm1',
    name: 'Truck Unloading RM1',
    simulinkTag: 'TRUCK UNLOADING RM1',
    line: 'RM1',
    type: 'truck_unloading',
    x: 210,
    y: 100,
    width: 65,
    height: 48,
    nominalDuration: 3.5,
    isQueue: false,
    description: 'Overhead hoist gantry & bundle depalletizer',
  },
  {
    id: 'inventory_rm1',
    name: 'Inventory RM1 (FIFO)',
    simulinkTag: 'INVENTORY RM1',
    line: 'RM1',
    type: 'inventory_fifo',
    x: 370,
    y: 100,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: true,
    maxQueueCapacity: 120,
    description: 'Raw bar staging rack (FIFO)',
  },
  {
    id: 'transporter_rm1',
    name: 'Transporter RM1 (Lathe - 360s)',
    simulinkTag: 'TRANSPORTER RM1',
    line: 'RM1',
    type: 'transporter',
    x: 530,
    y: 100,
    width: 85,
    height: 48,
    nominalDuration: 360.0,
    isQueue: false,
    description: 'Roller conveyor transport to CNC lathe (360s)',
  },
  {
    id: 'cnc_lathe',
    name: 'CNC Lathe Machine',
    simulinkTag: 'CNC LATHE',
    line: 'RM1',
    type: 'cnc_lathe',
    x: 690,
    y: 100,
    width: 75,
    height: 48,
    nominalDuration: 360.0, // 6.0 minutes
    isQueue: false,
    description: 'Multi-axis CNC turning center (6.0m cycle)',
  },
  {
    id: 'buffer_rm1',
    name: 'Buffer RM1 (FIFO)',
    simulinkTag: 'BUFFER RM1',
    line: 'RM1',
    type: 'buffer_fifo',
    x: 850,
    y: 100,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: true,
    maxQueueCapacity: 60,
    description: 'Turned parts accumulation buffer',
  },
  {
    id: 'qc_rm1',
    name: 'Quality Control RM1 (30s)',
    simulinkTag: 'QUALITY CONTROL RM1',
    line: 'RM1',
    type: 'quality_control',
    x: 1010,
    y: 100,
    width: 70,
    height: 48,
    nominalDuration: 30.0,
    isQueue: false,
    description: 'Laser micrometer & runout inspection cell (30s)',
  },

  // --- LINE 2: RM2 (MILLING / HOUSING PRODUCTION) ---
  {
    id: 'truck_rm2',
    name: 'Truck Inflow RM2',
    simulinkTag: 'TRUCK RM2',
    line: 'RM2',
    type: 'truck_source',
    x: 50,
    y: 270,
    width: 70,
    height: 48,
    nominalDuration: 8.5,
    isQueue: false,
    description: 'Raw casting truck delivery (120 units Cast Housings)',
  },
  {
    id: 'unloading_rm2',
    name: 'Truck Unloading RM2',
    simulinkTag: 'TRUCK UNLOADING RM2',
    line: 'RM2',
    type: 'truck_unloading',
    x: 210,
    y: 270,
    width: 65,
    height: 48,
    nominalDuration: 3.5,
    isQueue: false,
    description: 'Cast pallet destacker & tilt-table unloader',
  },
  {
    id: 'inventory_rm2',
    name: 'Inventory RM2 (FIFO)',
    simulinkTag: 'INVENTORY RM2',
    line: 'RM2',
    type: 'inventory_fifo',
    x: 370,
    y: 270,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: true,
    maxQueueCapacity: 120,
    description: 'Casting staging queue (FIFO)',
  },
  {
    id: 'transporter_rm2',
    name: 'Transporter RM2 (Milling - 240s)',
    simulinkTag: 'TRANSPORTER RM2',
    line: 'RM2',
    type: 'transporter',
    x: 530,
    y: 270,
    width: 85,
    height: 48,
    nominalDuration: 240.0,
    isQueue: false,
    description: 'Heavy belt conveyor transport to CNC milling (240s)',
  },
  {
    id: 'cnc_milling',
    name: 'CNC Milling Machine',
    simulinkTag: 'CNC MILLING',
    line: 'RM2',
    type: 'cnc_milling',
    x: 690,
    y: 270,
    width: 75,
    height: 48,
    nominalDuration: 240.0, // 4.0 minutes
    isQueue: false,
    description: 'Vertical machining center (4.0m cycle)',
  },
  {
    id: 'buffer_rm2',
    name: 'Buffer RM2 (FIFO)',
    simulinkTag: 'BUFFER RM2',
    line: 'RM2',
    type: 'buffer_fifo',
    x: 850,
    y: 270,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: true,
    maxQueueCapacity: 60,
    description: 'Milled gearbox housing queue',
  },
  {
    id: 'qc_rm2',
    name: 'Quality Control RM2 (30s)',
    simulinkTag: 'QUALITY CONTROL RM2',
    line: 'RM2',
    type: 'quality_control',
    x: 1010,
    y: 270,
    width: 70,
    height: 48,
    nominalDuration: 30.0,
    isQueue: false,
    description: 'Pneumatic leak tester & coordinate probe (30s)',
  },

  // --- LINE 3: RM3 (SHAPING / GEAR PRODUCTION) ---
  {
    id: 'truck_rm3',
    name: 'Truck Inflow RM3',
    simulinkTag: 'TRUCK RM3',
    line: 'RM3',
    type: 'truck_source',
    x: 50,
    y: 440,
    width: 70,
    height: 48,
    nominalDuration: 9.0,
    isQueue: false,
    description: 'Raw forged disc delivery (120 units Alloy Blanks)',
  },
  {
    id: 'unloading_rm3',
    name: 'Truck Unloading RM3',
    simulinkTag: 'TRUCK UNLOADING RM3',
    line: 'RM3',
    type: 'truck_unloading',
    x: 210,
    y: 440,
    width: 65,
    height: 48,
    nominalDuration: 3.5,
    isQueue: false,
    description: 'Vacuum manipulator plate loader',
  },
  {
    id: 'inventory_rm3',
    name: 'Inventory RM3 (FIFO)',
    simulinkTag: 'INVENTORY RM3',
    line: 'RM3',
    type: 'inventory_fifo',
    x: 370,
    y: 440,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: true,
    maxQueueCapacity: 120,
    description: 'Gear blank staging queue (FIFO)',
  },
  {
    id: 'transporter_rm3',
    name: 'Transporter RM3 (Shaping - 210s)',
    simulinkTag: 'TRANSPORTER RM3',
    line: 'RM3',
    type: 'transporter',
    x: 530,
    y: 440,
    width: 85,
    height: 48,
    nominalDuration: 210.0,
    isQueue: false,
    description: 'Slat conveyor transport to CNC shaping (210s)',
  },
  {
    id: 'cnc_shaping',
    name: 'CNC Shaping Machine',
    simulinkTag: 'CNC SHAPING',
    line: 'RM3',
    type: 'cnc_shaping',
    x: 690,
    y: 440,
    width: 75,
    height: 48,
    nominalDuration: 210.0, // 3.5 minutes
    isQueue: false,
    description: 'High-speed gear shaper (3.5m cycle)',
  },
  {
    id: 'buffer_rm3',
    name: 'Buffer RM3 (FIFO)',
    simulinkTag: 'BUFFER RM3',
    line: 'RM3',
    type: 'buffer_fifo',
    x: 850,
    y: 440,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: true,
    maxQueueCapacity: 60,
    description: 'Finished gear accumulation buffer',
  },
  {
    id: 'qc_rm3',
    name: 'Quality Control RM3 (30s)',
    simulinkTag: 'QUALITY CONTROL RM3',
    line: 'RM3',
    type: 'quality_control',
    x: 1010,
    y: 440,
    width: 70,
    height: 48,
    nominalDuration: 30.0,
    isQueue: false,
    description: 'Gear tooth pitch & surface profile scanner (30s)',
  },

  // --- MERGE & FINAL PACKAGING SYSTEM ---
  {
    id: 'converge_join',
    name: 'Converge / Joiner',
    simulinkTag: 'CONVERGE JOIN',
    line: 'MERGE',
    type: 'converge_join',
    x: 1180,
    y: 100,
    width: 44,
    height: 388,
    nominalDuration: 1.0,
    isQueue: false,
    description: 'Synchronous 3-stream merger (1 RM1 + 1 RM2 + 1 RM3 -> 1 Product Kit)',
  },
  {
    id: 'final_assembly',
    name: 'Final Assembly Cell',
    simulinkTag: 'FINAL ASSEMBLY',
    line: 'FINAL',
    type: 'final_assembly',
    x: 1290,
    y: 270,
    width: 80,
    height: 48,
    nominalDuration: 240.0, // 4.0 minutes on average
    isQueue: false,
    description: 'Precision integration & torque fastening workstation (4.0m average)',
  },
  {
    id: 'entity_queue',
    name: 'Entity Queue (FIFO)',
    simulinkTag: 'Entity Queue',
    line: 'FINAL',
    type: 'entity_queue',
    x: 1450,
    y: 270,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: true,
    maxQueueCapacity: 50,
    description: 'Post-assembly intermediate queue (FIFO)',
  },
  {
    id: 'packaging',
    name: 'Packaging Station',
    simulinkTag: 'PACKAGING',
    line: 'FINAL',
    type: 'packaging',
    x: 1610,
    y: 270,
    width: 75,
    height: 48,
    nominalDuration: 240.0, // 4.0 minutes
    isQueue: false,
    description: 'Carton boxing, desiccant seal & barcode labeling (4.0m)',
  },
  {
    id: 'transporter_out',
    name: 'Transporter Out (45s)',
    simulinkTag: 'TRANSPORTER OUT',
    line: 'FINAL',
    type: 'transporter_out',
    x: 1770,
    y: 270,
    width: 85,
    height: 48,
    nominalDuration: 45.0,
    isQueue: false,
    description: 'Outfeed motorized roller conveyor (45s)',
  },
  {
    id: 'entity_queue_out',
    name: 'Entity Queue 1 (FIFO)',
    simulinkTag: 'Entity Queue1',
    line: 'FINAL',
    type: 'entity_queue_out',
    x: 1930,
    y: 270,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: true,
    maxQueueCapacity: 120,
    description: 'Finished goods pallet staging buffer',
  },
  {
    id: 'sink_dispatch',
    name: 'Sink / Dispatch Out',
    simulinkTag: 'SINK DISPATCH',
    line: 'FINAL',
    type: 'sink_dispatch',
    x: 2080,
    y: 270,
    width: 65,
    height: 48,
    nominalDuration: 0,
    isQueue: false,
    description: 'Warehouse customer shipment & entity exit sink',
  },
];

export const DEFAULT_OPERATIONAL_CONFIG: PlantOperationalConfig = {
  shiftDurationHours: 8,
  shiftStartHour: 8,
  simulatedSecondsOfDay: 8 * 3600, // 8:00:00 AM
  simulatedDate: '2026-11-03',
  simulatedDayCount: 1,
  timeScale: 1,
  isShiftOpen: true,

  // Exactly 120 units per RM -> 360 total RM -> 120 finished products target
  dailyTargetUnits: 120,
  dailyRmPerTruck: 120,
  arrearsUnits: 0,
  completedToday: 0,
  completedCumulative: 0,

  trucks: {
    rm1: {
      arrivalTimeStr: '08:00 AM',
      arrivalHour: 8.0,
      unitsDelivered: 120,
      hasArrived: false,
      isUnloading: false,
      unitsLeftToUnload: 120,
    },
    rm2: {
      arrivalTimeStr: '08:15 AM',
      arrivalHour: 8.25,
      unitsDelivered: 120,
      hasArrived: false,
      isUnloading: false,
      unitsLeftToUnload: 120,
    },
    rm3: {
      arrivalTimeStr: '08:30 AM',
      arrivalHour: 8.5,
      unitsDelivered: 120,
      hasArrived: false,
      isUnloading: false,
      unitsLeftToUnload: 120,
    },
  },
  unloadingMode: 'MANUAL_HUMAN', // Default: humans barehand, no forklifts or cranes
  humanCrewSize: 3,
  workerFatiguePercentage: 5,
  conveyorTransportTimeSeconds: 45, // Default 45s outfeed conveyor
  conveyorLatheTimeSeconds: 360, // Conveyor time for Lathe line (360s)
  conveyorMillingTimeSeconds: 240, // Conveyor time for Milling line (240s)
  conveyorShapingTimeSeconds: 210, // Conveyor time for Shaping line (210s)
  latheCycleTimeMinutes: 6.0, // Default 6 minutes (360s)
  millingCycleTimeMinutes: 4.0, // Default 4 minutes (240s)
  shapingCycleTimeMinutes: 3.5, // Default 3.5 minutes (210s)
  qualityParameters: {
    inspectionDurationSeconds: 30, // 30s default
    reworkDurationSeconds: 180, // 3 minutes (180s) rework cycle
    dimensionalToleranceMm: 0.02,
    surfaceRoughnessRa: 0.8,
    hardnessHrcMin: 45,
    hardnessHrcMax: 50,
  },
  assemblyMode: 'SEMI_AUTOMATED',
  assemblyCycleTimeMinutes: 4.0, // Default 4.0 minutes (240s average)
  packagingCycleTimeMinutes: 4.0, // Default 4.0 minutes (240s)
  bypassSubassemblyDirectToQC: true, // Subassembly block bypassed / removed

  // Lunch Break: User configurable, default 1:00 PM (13.0) for 1 hour (60 min)
  lunchBreakEnabled: true,
  lunchBreakStartHour: 13.0,
  lunchBreakDurationMinutes: 60,

  // Equipment Reliability & Failure Simulation Controls (User Discretion)
  randomFailuresEnabled: true,
  failureFrequency: 'MEDIUM',
  mtbfHours: 16.0,
  toolWearRateMultiplier: 1.0,
};

export function formatSimulatedClock(secondsOfDay: number, dateStr: string, dayCount: number) {
  const totalSecs = Math.floor(secondsOfDay);
  const hours24 = Math.floor(totalSecs / 3600) % 24;
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const pad = (n: number) => n.toString().padStart(2, '0');

  const timeStr = `${pad(hours12)}:${pad(minutes)}:${pad(seconds)} ${ampm}`;
  return {
    timeStr,
    dateStr,
    dayCount,
    shiftHour: hours24 + minutes / 60,
    formattedFull: `Day ${dayCount} • ${dateStr} • ${timeStr}`,
  };
}

/**
 * Generates initial defect scrap & rework audit records for QC Subsystem.
 * Starts clean with an empty array so records only appear dynamically
 * when parts actually undergo QC and experience defects during simulation.
 */
export function createDefaultQCDefectAuditLog(_stationId?: string): QCDefectAuditRecord[] {
  return [];
}

/**
 * Creates initial baseline station object
 */
export function createStationFromMeta(
  meta: StationLayoutMeta,
  config: PlantOperationalConfig = DEFAULT_OPERATIONAL_CONFIG
): Station {
  const category = meta.type.includes('cnc')
    ? 'cnc'
    : meta.type.includes('transporter')
    ? 'transporter'
    : meta.type.includes('assembly') || meta.type.includes('packaging')
    ? 'assembly'
    : 'general';

  const base = NOMINAL_BASELINES[category];
  const initialSensors: StationSensors = {
    vibrationRms: base.vibrationRms + (Math.random() - 0.5) * 0.1,
    vibrationPeak: base.vibrationPeak + (Math.random() - 0.5) * 0.05,
    temperature: base.temperature + (Math.random() - 0.5) * 0.8,
    motorCurrent: base.motorCurrent + (Math.random() - 0.5) * 0.4,
    acousticEmission: base.acousticEmission + (Math.random() - 0.5) * 0.6,
    toolWearIndex: meta.type.includes('cnc') ? 0.04 : 0.0,
    conveyorTension: meta.type.includes('transporter') ? 450 + (Math.random() - 0.5) * 10 : undefined,
    speedRpm: base.speedRpm,
  };

  const initialMl = runPredictivePipeline(initialSensors, meta.type, meta.name);

  const initialQCSubsystem = meta.type === 'quality_control' ? {
    check1Inspected: 0,
    check1Passed: 0,
    check1Failed: 0,
    check2Scrapped: 0,
    check2SentToRework: 0,
    reworkProcessed: 0,
    check3Passed: 0,
    check3Scrapped: 0,
    firstPassYield: 100,
    rolledThroughputYield: 100,
    activeInReworkEntityId: null,
    reworkTimeRemaining: 0,
    defectAuditLog: createDefaultQCDefectAuditLog(meta.id),
  } : undefined;

  let nominalDuration = meta.nominalDuration;
  if (meta.type === 'transporter') {
    if (meta.id === 'transporter_rm1') {
      nominalDuration = config.conveyorLatheTimeSeconds ?? 360.0;
    } else if (meta.id === 'transporter_rm2') {
      nominalDuration = config.conveyorMillingTimeSeconds ?? 240.0;
    } else if (meta.id === 'transporter_rm3') {
      nominalDuration = config.conveyorShapingTimeSeconds ?? 210.0;
    } else {
      nominalDuration = config.conveyorTransportTimeSeconds ?? 45.0;
    }
  } else if (meta.type === 'transporter_out') {
    nominalDuration = config.conveyorTransportTimeSeconds ?? 45.0; // Outfeed packaging conveyor
  } else if (meta.type === 'cnc_lathe') {
    nominalDuration = config.latheCycleTimeMinutes * 60;
  } else if (meta.type === 'cnc_milling') {
    nominalDuration = config.millingCycleTimeMinutes * 60;
  } else if (meta.type === 'cnc_shaping') {
    nominalDuration = config.shapingCycleTimeMinutes * 60;
  } else if (meta.type === 'quality_control') {
    nominalDuration = config.qualityParameters.inspectionDurationSeconds || 30.0;
  } else if (meta.type === 'final_assembly') {
    nominalDuration = config.assemblyCycleTimeMinutes * 60;
  } else if (meta.type === 'packaging') {
    nominalDuration = config.packagingCycleTimeMinutes * 60;
  }

  const seedHours = Math.round(180 + Math.random() * 80);
  const seedWear = Math.min(100, Math.round((seedHours / 600) * 100));

  return {
    id: meta.id,
    name: meta.name,
    simulinkTag: meta.simulinkTag,
    line: meta.line,
    type: meta.type,
    x: meta.x,
    y: meta.y,
    width: meta.width,
    height: meta.height,
    isQueue: meta.isQueue,
    maxQueueCapacity: meta.maxQueueCapacity,

    // Entity counters requested
    currentlyProcessingCount: 0,
    currentQueueCount: 0,
    processedToday: 0,
    processedCumulative: 0,

    currentProcessingEntityId: null,
    processingTimeRemaining: 0,
    nominalProcessingTime: nominalDuration,
    utilization: 0,
    busyTimeAccumulated: 0,
    totalTimeAccumulated: 0.1,
    itemsProcessed: 0,
    itemsRejected: 0,
    status: meta.isQueue ? 'IDLE' : 'STARVED',
    activeFault: 'NONE',
    sensors: initialSensors,
    history: [
      {
        timestamp: 0,
        vibrationRms: initialSensors.vibrationRms,
        temperature: initialSensors.temperature,
        motorCurrent: initialSensors.motorCurrent,
        acousticEmission: initialSensors.acousticEmission,
        anomalyScore: initialMl.anomalyScore,
      },
    ],
    mlResult: initialMl,
    qcSubsystem: initialQCSubsystem,
    cumulativeRunHours: seedHours,
    wearPercentage: seedWear,
    lastMaintenanceOperatingHour: seedHours - 45,
  };
}

/**
 * Deep-clones operational config so mutations never contaminate defaults,
 * while preserving user-customized shift and logistics parameters across resets.
 */
export function deepCloneOperationalConfig(
  base: PlantOperationalConfig = DEFAULT_OPERATIONAL_CONFIG
): PlantOperationalConfig {
  const startHour = base.shiftStartHour ?? 8.0;
  const dailyRm = base.dailyRmPerTruck ?? 120;

  return {
    ...base,
    simulatedSecondsOfDay: startHour * 3600,
    simulatedDayCount: 1,
    simulatedDate: DEFAULT_OPERATIONAL_CONFIG.simulatedDate,
    completedToday: 0,
    arrearsUnits: 0,
    completedCumulative: 0,
    isShiftOpen: true,
    trucks: {
      rm1: {
        ...base.trucks.rm1,
        unitsDelivered: dailyRm,
        unitsLeftToUnload: dailyRm,
        hasArrived: false,
        isUnloading: false,
      },
      rm2: {
        ...base.trucks.rm2,
        unitsDelivered: dailyRm,
        unitsLeftToUnload: dailyRm,
        hasArrived: false,
        isUnloading: false,
      },
      rm3: {
        ...base.trucks.rm3,
        unitsDelivered: dailyRm,
        unitsLeftToUnload: dailyRm,
        hasArrived: false,
        isUnloading: false,
      },
    },
    qualityParameters: {
      ...base.qualityParameters,
    },
  };
}

/**
 * Generates initial 7 days of realistic simulation performance history leading up to the current day.
 * Ensures the 'Performance Trends' card immediately displays rich, realistic 7-day data.
 */
export function createDefaultPerformanceHistory(
  currentDay: number,
  currentDateStr: string,
  targetUnits: number = 120,
  currentArrears: number = 0,
  currentCompleted: number = 0
): DailyPerformanceRecord[] {
  const records: DailyPerformanceRecord[] = [];
  const baseDate = new Date(currentDateStr);

  // Preceding 6 days benchmark data reflecting real aerospace manufacturing dynamics
  // (minor tooling delays, catch-up shifts, steady output)
  const benchmarkDeltas = [
    { deltaFinished: -6, scrap: 3, fpy: 95.2, oee: 88.4 },  // Day -6: 114 units
    { deltaFinished: 2,  scrap: 1, fpy: 98.4, oee: 92.6 },  // Day -5: 122 units
    { deltaFinished: -2, scrap: 2, fpy: 96.5, oee: 90.3 },  // Day -4: 118 units
    { deltaFinished: -12, scrap: 4, fpy: 91.8, oee: 84.1 }, // Day -3: 108 units (minor tool wear inspection)
    { deltaFinished: 5,  scrap: 1, fpy: 97.8, oee: 93.9 },  // Day -2: 125 units (overtime catchup)
    { deltaFinished: 0,  scrap: 2, fpy: 97.1, oee: 91.8 },  // Day -1: 120 units (nominal delivery)
  ];

  let rollingBacklog = 8;
  for (let i = 6; i >= 1; i--) {
    const dayNumber = currentDay - i;
    const dayLabel = dayNumber < 0 ? `D${dayNumber}` : dayNumber === 0 ? 'Prev Day' : `Day ${dayNumber}`;
    const dayDate = new Date(baseDate);
    dayDate.setDate(dayDate.getDate() - i);
    const dayDateStr = dayDate.toISOString().split('T')[0];
    const benchmark = benchmarkDeltas[6 - i];
    const finished = Math.max(80, targetUnits + benchmark.deltaFinished);
    const dayDeficit = Math.max(0, targetUnits - finished);
    const daySurplus = Math.max(0, finished - targetUnits);
    rollingBacklog = Math.max(0, rollingBacklog + dayDeficit - daySurplus);

    records.push({
      day: dayNumber,
      dateStr: dayDateStr,
      dayLabel,
      finishedGoods: finished,
      targetUnits,
      arrearsBacklog: rollingBacklog,
      cumulativeBacklog: rollingBacklog,
      scrapCount: benchmark.scrap,
      fpy: benchmark.fpy,
      oee: benchmark.oee,
      isCurrentDay: false,
    });
  }

  // Active current day (Day currentDay)
  records.push({
    day: currentDay,
    dateStr: currentDateStr,
    dayLabel: `Day ${currentDay} (Today)`,
    finishedGoods: currentCompleted,
    targetUnits,
    arrearsBacklog: currentArrears,
    cumulativeBacklog: currentArrears,
    scrapCount: 0,
    fpy: 96.0,
    oee: 89.7,
    isCurrentDay: true,
  });

  return records;
}

/**
 * Creates the complete initial plant state.
 * If existingConfig is passed (e.g. on reset), custom shift & logistics parameters are preserved!
 */
export function createInitialPlantState(
  existingConfig?: PlantOperationalConfig,
  initialRunning: boolean = true
): PlantSimulationState {
  const activeConfig = existingConfig
    ? deepCloneOperationalConfig(existingConfig)
    : deepCloneOperationalConfig(DEFAULT_OPERATIONAL_CONFIG);

  const stations: Record<string, Station> = {};
  for (const meta of INITIAL_STATION_METAS) {
    stations[meta.id] = createStationFromMeta(meta, activeConfig);
  }

  // Pre-load truck stations' initial queue counts with their loaded payload (120 units)
  // so that before arrival, Q shows the 120 units on the truck waiting to be unloaded,
  // and processedToday (D) is strictly 0!
  if (stations['truck_rm1']) {
    stations['truck_rm1'].currentQueueCount = activeConfig.trucks.rm1.unitsLeftToUnload;
    stations['truck_rm1'].processedToday = 0;
  }
  if (stations['truck_rm2']) {
    stations['truck_rm2'].currentQueueCount = activeConfig.trucks.rm2.unitsLeftToUnload;
    stations['truck_rm2'].processedToday = 0;
  }
  if (stations['truck_rm3']) {
    stations['truck_rm3'].currentQueueCount = activeConfig.trucks.rm3.unitsLeftToUnload;
    stations['truck_rm3'].processedToday = 0;
  }

  // No pre-seeded entities. Entities strictly spawn only after trucks arrive and undergo unloading!
  const entities: ItemEntity[] = [];

  if (stations['inventory_rm1']) stations['inventory_rm1'].currentQueueCount = 0;
  if (stations['inventory_rm2']) stations['inventory_rm2'].currentQueueCount = 0;
  if (stations['inventory_rm3']) stations['inventory_rm3'].currentQueueCount = 0;

  const initialHistory = createDefaultPerformanceHistory(
    activeConfig.simulatedDayCount,
    activeConfig.simulatedDate,
    activeConfig.dailyTargetUnits,
    activeConfig.arrearsUnits,
    0
  );

  return {
    timeSeconds: 0,
    isRunning: initialRunning,
    simulationSpeed: 1.0,
    stations,
    entities,
    completedCount: 0, // Starts at 0 for today's shift!
    rejectedCount: 0,
    wipCount: 0,
    oee: {
      availability: 98.0,
      performance: 92.5,
      quality: 99.0,
      overallOEE: 89.7,
    },
    bottleneckStationId: 'cnc_lathe',
    lineBalanceScore: 92.0,
    totalDowntimeSeconds: 0,
    config: activeConfig,
    performanceHistory: initialHistory,
    itemLifecycleLedger: createDefaultItemLifecycleLedger(),
  };
}

/**
 * Line step order map for entity routing without subassembly
 */
export function getDownstreamStationId(fromStationId: string): string {
  const directMap: Record<string, string> = {
    // Line 1
    truck_rm1: 'unloading_rm1',
    unloading_rm1: 'inventory_rm1',
    inventory_rm1: 'transporter_rm1',
    transporter_rm1: 'cnc_lathe',
    cnc_lathe: 'buffer_rm1',
    buffer_rm1: 'qc_rm1', // Directly to QC (subassembly removed)
    qc_rm1: 'converge_join',

    // Line 2
    truck_rm2: 'unloading_rm2',
    unloading_rm2: 'inventory_rm2',
    inventory_rm2: 'transporter_rm2',
    transporter_rm2: 'cnc_milling',
    cnc_milling: 'buffer_rm2',
    buffer_rm2: 'qc_rm2', // Directly to QC (subassembly removed)
    qc_rm2: 'converge_join',

    // Line 3
    truck_rm3: 'unloading_rm3',
    unloading_rm3: 'inventory_rm3',
    inventory_rm3: 'transporter_rm3',
    transporter_rm3: 'cnc_shaping',
    cnc_shaping: 'buffer_rm3',
    buffer_rm3: 'qc_rm3', // Directly to QC (subassembly removed)
    qc_rm3: 'converge_join',

    // Merged Final Assembly Line
    converge_join: 'final_assembly',
    final_assembly: 'entity_queue',
    entity_queue: 'packaging',
    packaging: 'transporter_out',
    transporter_out: 'entity_queue_out',
    entity_queue_out: 'sink_dispatch',
    sink_dispatch: '',
  };

  return directMap[fromStationId] || '';
}

export const DOWNSTREAM_FLOW = {
  truck_rm1: 'unloading_rm1',
  unloading_rm1: 'inventory_rm1',
  inventory_rm1: 'transporter_rm1',
  transporter_rm1: 'cnc_lathe',
  cnc_lathe: 'buffer_rm1',
  buffer_rm1: 'qc_rm1',
  qc_rm1: 'converge_join',

  truck_rm2: 'unloading_rm2',
  unloading_rm2: 'inventory_rm2',
  inventory_rm2: 'transporter_rm2',
  transporter_rm2: 'cnc_milling',
  cnc_milling: 'buffer_rm2',
  buffer_rm2: 'qc_rm2',
  qc_rm2: 'converge_join',

  truck_rm3: 'unloading_rm3',
  unloading_rm3: 'inventory_rm3',
  inventory_rm3: 'transporter_rm3',
  transporter_rm3: 'cnc_shaping',
  cnc_shaping: 'buffer_rm3',
  buffer_rm3: 'qc_rm3',
  qc_rm3: 'converge_join',

  converge_join: 'final_assembly',
  final_assembly: 'entity_queue',
  entity_queue: 'packaging',
  packaging: 'transporter_out',
  transporter_out: 'entity_queue_out',
  entity_queue_out: 'sink_dispatch',
};

let entityCounter = 1000;

/**
 * Generates dynamic sensor signals based on active machine state, shift status, and faults
 */
export function updateStationSensors(
  station: Station,
  dt: number,
  isWorking: boolean,
  isShiftOpen: boolean,
  wearMultiplier: number = 1.0
): StationSensors {
  const current = { ...station.sensors };
  const fault = station.activeFault;
  const isCnc = station.type.includes('cnc');
  const isConveyor = station.type.includes('transporter');

  // When factory is closed for the day, motors shutdown to ambient cold standby
  if (!isShiftOpen) {
    current.vibrationRms = Math.max(0.04, current.vibrationRms - dt * 0.2);
    current.vibrationPeak = current.vibrationRms * 1.2;
    current.temperature = Math.max(22.0, current.temperature - dt * 0.15); // ambient cool
    current.motorCurrent = Math.max(0.0, current.motorCurrent - dt * 1.0);
    current.acousticEmission = Math.max(2.0, current.acousticEmission - dt * 0.5);
    if (isConveyor) current.conveyorTension = 450;
    return current;
  }

  // Baseline Gaussian small perturbation
  const noise = (Math.random() - 0.5) * 0.08;

  switch (fault) {
    case 'TOOL_FLANK_WEAR': {
      // In industry (ISO 3685), tool wear progresses gradually through 3 stages:
      // Initial rapid break-in (0.04-0.08mm) -> Steady state wear (0.08-0.30mm) -> Tertiary rapid wear (>0.30mm)
      // Critical threshold is 0.35mm. Before 0.35mm, it is monitored, not an emergency stoppage.
      const currentWear = current.toolWearIndex ?? 0.05;
      if (currentWear >= 0.35) {
        current.vibrationRms = Math.min(6.8, 3.8 + noise * 1.5);
        current.vibrationPeak = current.vibrationRms * 1.5;
        current.motorCurrent = Math.min(22.0, 16.5 + noise * 1.5);
        current.acousticEmission = Math.min(54.0, 42.0 + noise * 2);
        current.temperature = Math.min(66.0, current.temperature + dt * 0.1);
      } else {
        // Progressive cutting tool wear under fault monitoring
        current.toolWearIndex = Math.min(0.65, currentWear + (dt / 3600) * 0.02);
        const w = current.toolWearIndex;
        current.vibrationRms = Math.min(3.4, 1.8 + w * 3.5 + noise * 0.1);
        current.vibrationPeak = current.vibrationRms * 1.35;
        current.motorCurrent = Math.min(16.5, 12.0 + w * 8.0 + noise * 0.3);
        current.acousticEmission = Math.min(36.0, 20.0 + w * 30.0 + noise * 0.5);
        current.temperature = Math.min(52.0, current.temperature + dt * 0.02);
      }
      break;
    }

    case 'SPINDLE_BEARING_VIBRATION':
    case 'BEARING_INNER_RACE_FAULT':
      current.vibrationRms = Math.min(7.8, Math.max(5.4, current.vibrationRms + dt * 0.3 + noise * 3));
      current.vibrationPeak = current.vibrationRms * (2.8 + Math.random() * 0.8);
      current.acousticEmission = Math.min(48.0, 32.0 + Math.random() * 12.0);
      current.temperature = Math.min(64.0, current.temperature + dt * 0.25);
      break;

    case 'SPINDLE_THERMAL_EXPANSION':
    case 'SPINDLE_OVERHEAT_LUB_FAIL':
      current.temperature = Math.min(84.0, current.temperature + dt * 0.8);
      current.motorCurrent = Math.min(22.0, current.motorCurrent + dt * 0.3);
      current.vibrationRms = Math.min(5.5, current.vibrationRms + dt * 0.15);
      break;

    case 'CHIP_CONVEYOR_CLOG':
      current.motorCurrent = Math.min(24.5, 18.0 + Math.random() * 4.0);
      current.vibrationRms = Math.min(4.5, 2.5 + Math.random() * 1.5);
      break;

    case 'BELT_SLIP_AND_TENSION_LOSS':
      if (isConveyor) {
        current.conveyorTension = Math.max(260, (current.conveyorTension ?? 450) - dt * 12.0);
        current.motorCurrent = 9.8 + Math.sin(Date.now() / 200) * 2.8;
        current.vibrationRms = 3.6 + Math.random() * 1.2;
      }
      break;

    case 'ROLLER_BEARING_OVERHEAT':
      if (isConveyor) {
        current.temperature = Math.min(72.0, current.temperature + dt * 0.4);
        current.vibrationRms = 4.2 + Math.random() * 1.2;
      }
      break;

    case 'CONVEYOR_MOTOR_OVERLOAD':
      if (isConveyor) {
        current.motorCurrent = Math.min(18.0, 12.0 + Math.random() * 3.5);
        current.temperature = Math.min(68.0, current.temperature + dt * 0.3);
      }
      break;

    case 'OPTICAL_LENS_FOULED':
    case 'GAUGE_CALIBRATION_DRIFT':
    case 'PROBE_ACTUATOR_RESPONSE_LAG':
      current.acousticEmission = Math.min(38.0, 25.0 + Math.random() * 8.0);
      break;

    case 'TORQUE_DRIVER_OUT_OF_SPEC':
    case 'PNEUMATIC_PRESSURE_DROP':
    case 'OPERATOR_ASSEMBLY_BOTTLENECK':
      // Stably elevated above 13.0A to prevent erratic shifting between 86% and 97% confidence
      current.motorCurrent = Math.min(18.5, 16.5 + (Math.random() - 0.5) * 0.4);
      current.vibrationRms = Math.min(4.8, 3.4 + (Math.random() - 0.5) * 0.3);
      current.acousticEmission = Math.min(36.0, 28.0 + (Math.random() - 0.5) * 0.5);
      current.temperature = Math.min(58.0, current.temperature + dt * 0.15);
      break;

    case 'SEALER_HEATER_ELEMENT_FAULT':
      current.temperature = Math.min(88.0, current.temperature + dt * 0.9);
      break;

    case 'MOTOR_WINDING_OVERCURRENT':
      current.motorCurrent = Math.min(26.5, 19.5 + Math.random() * 5.0);
      current.temperature = Math.min(72.0, current.temperature + dt * 0.5);
      break;

    case 'NONE':
    default: {
      const cat = isCnc ? 'cnc' : isConveyor ? 'transporter' : 'general';
      const nom = NOMINAL_BASELINES[cat];
      const targetVib = isWorking ? nom.vibrationRms : nom.vibrationRms * 0.5;
      const targetTemp = isWorking ? nom.temperature : nom.temperature * 0.9;
      const targetCurr = isWorking ? nom.motorCurrent : nom.motorCurrent * 0.3;

      current.vibrationRms += (targetVib - current.vibrationRms) * 0.1 + noise * 0.2;
      current.vibrationPeak = current.vibrationRms * 1.4 + noise * 0.1;
      current.temperature += (targetTemp - current.temperature) * 0.05 + noise * 0.1;
      current.motorCurrent += (targetCurr - current.motorCurrent) * 0.15 + noise * 0.2;
      current.acousticEmission += (nom.acousticEmission - current.acousticEmission) * 0.1 + noise * 0.3;
      if (isCnc && isWorking) {
        // Tool wear runs realistically based on operating hours (~0.0010 mm per hour of cutting, 250h cutting insert life)
        // Scaled by user-controlled toolWearRateMultiplier parameter
        current.toolWearIndex = Math.min(0.65, (current.toolWearIndex ?? 0.04) + (dt / 3600) * 0.0010 * wearMultiplier);
      }
      if (isConveyor) {
        current.conveyorTension = 450 + (Math.random() - 0.5) * 5;
      }
      break;
    }
  }

  return current;
}

/**
 * Ticks the plant simulation forward by dtSeconds
 */
export function tickSimulation(
  state: PlantSimulationState,
  rawDtSeconds: number
): PlantSimulationState {
  if (!state.isRunning) return state;

  const dt = rawDtSeconds * state.simulationSpeed;
  const newTime = state.timeSeconds + dt;
  const stations = { ...state.stations };
  let entities = [...state.entities];
  let completedCount = state.completedCount;
  let rejectedCount = state.rejectedCount;
  let ledger = state.itemLifecycleLedger ? [...state.itemLifecycleLedger] : [];

  // Advance simulated clock
  const config = { ...state.config };
  config.simulatedSecondsOfDay += dt;

  const clockInfo = formatSimulatedClock(config.simulatedSecondsOfDay, config.simulatedDate, config.simulatedDayCount);

  // Check 8-hour shift status (8:00 AM to 4:00 PM by default)
  const shiftStartHour = config.shiftStartHour; // default 8
  const shiftDurationHours = config.shiftDurationHours; // default 8
  const shiftEndHour = shiftStartHour + shiftDurationHours; // e.g. 16.0
  const currentHourOfDay = (config.simulatedSecondsOfDay / 3600) % 24;

  const isShiftOpen = currentHourOfDay >= shiftStartHour && currentHourOfDay < shiftEndHour;
  config.isShiftOpen = isShiftOpen;

  // Lunch break detection (user configurable, default 1:00 PM for 1 hour)
  const lunchStart = config.lunchBreakStartHour ?? 13.0;
  const lunchDurHours = (config.lunchBreakDurationMinutes ?? 60) / 60;
  const lunchEnd = lunchStart + lunchDurHours;
  const isLunchBreak = config.lunchBreakEnabled && isShiftOpen && currentHourOfDay >= lunchStart && currentHourOfDay < lunchEnd;

  // Track worker fatigue during shift
  if (isShiftOpen) {
    if (isLunchBreak) {
      // Workers recuperate during lunch break
      config.workerFatiguePercentage = Math.max(5, Math.round(config.workerFatiguePercentage - dt * 0.05));
    } else if (config.unloadingMode === 'MANUAL_HUMAN') {
      const shiftElapsedHours = Math.max(0, currentHourOfDay - shiftStartHour);
      config.workerFatiguePercentage = Math.min(95, Math.round(5 + shiftElapsedHours * 7.5));
    } else {
      config.workerFatiguePercentage = 5;
    }
  }

  // If manufacturing unit is closed for the day:
  // Transporters and CNC machines shut down into standby!
  if (!isShiftOpen) {
    if (config.shiftClosedForDayCount !== config.simulatedDayCount) {
      const unfinishedToday = Math.max(0, config.dailyTargetUnits - completedCount);
      config.arrearsUnits = (config.arrearsUnits || 0) + unfinishedToday;
      config.shiftClosedForDayCount = config.simulatedDayCount;

      if (state.performanceHistory && state.performanceHistory.length > 0) {
        const last = state.performanceHistory[state.performanceHistory.length - 1];
        if (last && last.isCurrentDay) {
          last.arrearsBacklog = config.arrearsUnits;
          last.cumulativeBacklog = config.arrearsUnits;
          last.finishedGoods = completedCount;
        }
      }
    }

    for (const sId of Object.keys(stations)) {
      const st = stations[sId];
      st.status = 'SHIFT_CLOSED';
      st.currentlyProcessingCount = 0;
      st.sensors = updateStationSensors(st, dt, false, false);
      st.mlResult = runPredictivePipeline(st.sensors, st.type, st.name);
    }

    return {
      ...state,
      timeSeconds: newTime,
      stations,
      entities,
      completedCount,
      rejectedCount,
      wipCount: entities.length,
      config,
      itemLifecycleLedger: ledger,
    };
  }

  // --- FACTORY IS OPEN (Working Shift Active) ---

  // 1. Truck Inflow & Workstation Unloading (RM1, RM2, RM3)
  // Each truck brings 120 units. Workers unload entities and deposit them directly into Inventory FIFO.
  const truckLines: {
    truckId: string;
    unloadingId: string;
    inventoryId: string;
    line: LineType;
    itemType: ItemType;
    truckKey: 'rm1' | 'rm2' | 'rm3';
  }[] = [
    { truckId: 'truck_rm1', unloadingId: 'unloading_rm1', inventoryId: 'inventory_rm1', line: 'RM1', itemType: 'RM1_BILLET', truckKey: 'rm1' },
    { truckId: 'truck_rm2', unloadingId: 'unloading_rm2', inventoryId: 'inventory_rm2', line: 'RM2', itemType: 'RM2_CASTING', truckKey: 'rm2' },
    { truckId: 'truck_rm3', unloadingId: 'unloading_rm3', inventoryId: 'inventory_rm3', line: 'RM3', itemType: 'RM3_PLATE', truckKey: 'rm3' },
  ];

  for (const { truckId, unloadingId, inventoryId, line, itemType, truckKey } of truckLines) {
    const truckStation = stations[truckId];
    const unloadingStation = stations[unloadingId];
    const invStation = stations[inventoryId];
    const truckData = config.trucks[truckKey];

    // Check arrival window based on delivery schedule
    if (currentHourOfDay >= truckData.arrivalHour) {
      if (!truckData.hasArrived) {
        truckData.hasArrived = true;
        truckData.isUnloading = truckData.unitsLeftToUnload > 0;
      }
    } else {
      // Truck has not arrived yet today
      truckData.hasArrived = false;
      truckData.isUnloading = false;
    }

    // Unloading pace in seconds per unit
    let unloadPaceSeconds = 3.5;
    if (config.unloadingMode === 'MANUAL_HUMAN') {
      unloadPaceSeconds = (9.0 / Math.max(1, config.humanCrewSize)) * (1 + config.workerFatiguePercentage * 0.005);
    } else if (config.unloadingMode === 'FORKLIFT') {
      unloadPaceSeconds = 2.0;
    } else if (config.unloadingMode === 'OVERHEAD_CRANE') {
      unloadPaceSeconds = 1.2;
    }

    // Update Truck Inflow block metrics
    truckStation.currentQueueCount = truckData.unitsLeftToUnload;
    truckStation.processedToday = config.dailyRmPerTruck - truckData.unitsLeftToUnload;
    if (truckStation.processedCumulative < truckStation.processedToday) {
      truckStation.processedCumulative = truckStation.processedToday;
    }
    truckStation.currentlyProcessingCount = (truckData.hasArrived && truckData.unitsLeftToUnload > 0 && !isLunchBreak) ? 1 : 0;
    truckStation.status = isLunchBreak
      ? 'LUNCH_BREAK'
      : (truckData.hasArrived
        ? (truckData.unitsLeftToUnload > 0 ? 'BUSY' : 'IDLE')
        : 'STARVED');

    // Unloading workstation process: workers unload units from truck and deposit into Inventory FIFO
    if (isLunchBreak) {
      unloadingStation.status = 'LUNCH_BREAK';
      unloadingStation.currentlyProcessingCount = 0;
    } else if (truckData.hasArrived && truckData.unitsLeftToUnload > 0) {
      unloadingStation.status = 'BUSY';
      unloadingStation.currentlyProcessingCount = 1;
      unloadingStation.processingTimeRemaining -= dt;

      if (unloadingStation.processingTimeRemaining <= 0) {
        unloadingStation.processingTimeRemaining = unloadPaceSeconds;
        truckData.unitsLeftToUnload--;
        entityCounter++;

        const itemSeq = config.dailyRmPerTruck - truckData.unitsLeftToUnload;
        const itemCode = `${line}-${String(itemSeq).padStart(3, '0')}`;
        const lotBatchId = `LOT-${config.simulatedDate.replace(/-/g, '')}-${line}`;

        // Spawn raw material entity directly into Inventory FIFO queue ONLY after arrival & unloading!
        const newEntity: ItemEntity = {
          id: `entity_${entityCounter}`,
          code: itemCode,
          type: itemType,
          line,
          currentStationId: inventoryId,
          targetStationId: getDownstreamStationId(inventoryId),
          positionRatio: 0,
          isProcessing: false,
          qualityPassed: true,
          creationTime: newTime,
          totalCycleTime: 0,
        };

        entities.push(newEntity);

        // Record real-time arrival & inventory staging in Material Traceability Ledger
        ledger = recordItemLifecycleBirth(
          ledger,
          itemCode,
          line,
          lotBatchId,
          config.simulatedSecondsOfDay,
          clockInfo.timeStr,
          unloadingStation.id,
          unloadingStation.name,
          unloadPaceSeconds,
          invStation.id,
          invStation.name
        );

        invStation.currentQueueCount++;
        unloadingStation.itemsProcessed++;
        unloadingStation.processedToday++;
        unloadingStation.processedCumulative++;
        truckStation.itemsProcessed++;
        truckStation.processedToday = config.dailyRmPerTruck - truckData.unitsLeftToUnload;
        truckStation.processedCumulative++;

        if (truckData.unitsLeftToUnload <= 0) {
          truckData.isUnloading = false;
          unloadingStation.currentlyProcessingCount = 0;
          unloadingStation.status = 'IDLE';
        }
      }
    } else {
      unloadingStation.currentlyProcessingCount = 0;
      unloadingStation.status = truckData.hasArrived ? 'IDLE' : 'STARVED';
    }
  }

  // 2. Inventory FIFO to Transporter (Conveyor) Dispatch
  const lineTransporters: { invId: string; transId: string; cncId: string }[] = [
    { invId: 'inventory_rm1', transId: 'transporter_rm1', cncId: 'cnc_lathe' },
    { invId: 'inventory_rm2', transId: 'transporter_rm2', cncId: 'cnc_milling' },
    { invId: 'inventory_rm3', transId: 'transporter_rm3', cncId: 'cnc_shaping' },
  ];

  for (const { invId, transId, cncId } of lineTransporters) {
    const invStation = stations[invId];
    const transStation = stations[transId];
    const cncStation = stations[cncId];
    const itemsOnBelt = entities.filter(e => e.currentStationId === transId);

    // Only dispatch an entity from inventory onto the conveyor when:
    // 1) The conveyor is empty (itemsOnBelt.length === 0)
    // 2) AND the downstream machining component is free (!cncStation.currentProcessingEntityId)
    // 3) AND the conveyor is operational (no fault, not in maintenance, not manually stopped)
    const isTransporterBlocked =
      transStation.activeFault !== 'NONE' ||
      transStation.status === 'MAINTENANCE_REQUIRED' ||
      transStation.isManuallyStopped === true;
    const canAcceptOnBelt =
      itemsOnBelt.length === 0 &&
      !cncStation.currentProcessingEntityId &&
      !isTransporterBlocked;

    if (canAcceptOnBelt && invStation.currentQueueCount > 0) {
      const queuedItem = entities.find(e => e.currentStationId === invId && !e.isProcessing);
      if (queuedItem) {
        queuedItem.currentStationId = transId;
        queuedItem.targetStationId = cncId;
        queuedItem.positionRatio = 0;
        invStation.currentQueueCount = Math.max(0, invStation.currentQueueCount - 1);
        invStation.processedToday++;
        invStation.processedCumulative++;
        transStation.itemsProcessed++;

        ledger = recordItemLifecycleStepTransition(
          ledger,
          queuedItem.code,
          transStation.id,
          transStation.name,
          transStation.line,
          config.simulatedSecondsOfDay,
          clockInfo.timeStr,
          `Conveyor belt transport towards ${cncStation.name}`
        );
      }
    }
  }

  // 3. Entity Movements along Transporters (Conveyor animation to CNC)
  for (const entity of entities) {
    entity.totalCycleTime += dt;
    const currentStation = stations[entity.currentStationId];
    if (!currentStation) continue;

    if (currentStation.type.includes('transporter')) {
      const isConveyorHalted =
        currentStation.activeFault !== 'NONE' ||
        currentStation.status === 'MAINTENANCE_REQUIRED' ||
        currentStation.isManuallyStopped === true;

      // When the conveyor gets a fault or is manually stopped, operation strictly terminates!
      if (isConveyorHalted) {
        continue;
      }

      const slipFactor = currentStation.activeFault === 'BELT_SLIP_AND_TENSION_LOSS' ? 0.35 : 1.0;
      const speed = (1.0 / Math.max(1.0, currentStation.nominalProcessingTime)) * slipFactor;
      entity.positionRatio += speed * dt;

      if (entity.positionRatio >= 1.0) {
        const nextStationId = getDownstreamStationId(entity.currentStationId);
        const nextStation = stations[nextStationId];
        if (nextStation) {
          if (nextStation.isQueue) {
            entity.currentStationId = nextStationId;
            entity.positionRatio = 0;
            entity.targetStationId = getDownstreamStationId(nextStationId);
            nextStation.currentQueueCount++;
            currentStation.processedToday++;
            currentStation.processedCumulative++;

            ledger = recordItemLifecycleStepTransition(
              ledger,
              entity.code,
              nextStation.id,
              nextStation.name,
              nextStation.line,
              config.simulatedSecondsOfDay,
              clockInfo.timeStr,
              `Arrived and queued at ${nextStation.name}`
            );
          } else if (!nextStation.currentProcessingEntityId) {
            // Transfer into CNC machine chuck
            entity.currentStationId = nextStationId;
            entity.positionRatio = 0;
            entity.targetStationId = getDownstreamStationId(nextStationId);
            nextStation.currentProcessingEntityId = entity.id;
            nextStation.processingTimeRemaining = nextStation.nominalProcessingTime;
            entity.isProcessing = true;
            currentStation.processedToday++;
            currentStation.processedCumulative++;

            ledger = recordItemLifecycleStepTransition(
              ledger,
              entity.code,
              nextStation.id,
              nextStation.name,
              nextStation.line,
              config.simulatedSecondsOfDay,
              clockInfo.timeStr,
              `Loaded into ${nextStation.name} chuck for precision processing`
            );
          } else {
            // Keep safely back on conveyor belt before machine entrance until CNC chuck is free
            entity.positionRatio = 0.88;
          }
        }
      }
    }
  }

  // 4. Buffer to Quality Control Dispatching
  const bufferQcPairs: { bufId: string; qcId: string }[] = [
    { bufId: 'buffer_rm1', qcId: 'qc_rm1' },
    { bufId: 'buffer_rm2', qcId: 'qc_rm2' },
    { bufId: 'buffer_rm3', qcId: 'qc_rm3' },
  ];

  for (const { bufId, qcId } of bufferQcPairs) {
    const bufStation = stations[bufId];
    const qcStation = stations[qcId];

    // Check if QC is operational, not blocked, not manually stopped, and not in maintenance
    const isQcOperational = qcStation.status !== 'MAINTENANCE_REQUIRED' &&
                            qcStation.status !== 'BLOCKED' &&
                            qcStation.status !== 'SHIFT_CLOSED' &&
                            qcStation.status !== 'LUNCH_BREAK' &&
                            qcStation.activeFault === 'NONE' &&
                            !qcStation.isManuallyStopped;

    // When QC is in bottleneck (busy, slow, or fault/maintenance), items MUST stay in buffer queue!
    if (isQcOperational && !qcStation.currentProcessingEntityId && bufStation.currentQueueCount > 0) {
      const itemToInspect = entities.find(e => e.currentStationId === bufId && !e.isProcessing);
      if (itemToInspect) {
        itemToInspect.currentStationId = qcId;
        itemToInspect.targetStationId = 'converge_join';
        itemToInspect.isProcessing = true;
        qcStation.currentProcessingEntityId = itemToInspect.id;
        qcStation.processingTimeRemaining = qcStation.nominalProcessingTime;
        bufStation.currentQueueCount = Math.max(0, bufStation.currentQueueCount - 1);
        bufStation.processedToday++;
        bufStation.processedCumulative++;

        ledger = recordItemLifecycleStepTransition(
          ledger,
          itemToInspect.code,
          qcStation.id,
          qcStation.name,
          qcStation.line,
          config.simulatedSecondsOfDay,
          clockInfo.timeStr,
          'Transferred into Quality Control for multi-stage inspection'
        );
      }
    }
  }

  // 5. Converge / Joiner Synchronization logic
  // Requires 1 machined/QC passed RM1, 1 RM2, and 1 RM3 to release 1 unified product to Final Assembly
  const readyRm1 = entities.find(e => (e.currentStationId === 'qc_rm1' || e.currentStationId === 'converge_join') && !e.isProcessing && e.qualityPassed && e.line === 'RM1');
  const readyRm2 = entities.find(e => (e.currentStationId === 'qc_rm2' || e.currentStationId === 'converge_join') && !e.isProcessing && e.qualityPassed && e.line === 'RM2');
  const readyRm3 = entities.find(e => (e.currentStationId === 'qc_rm3' || e.currentStationId === 'converge_join') && !e.isProcessing && e.qualityPassed && e.line === 'RM3');
  const finalAssembly = stations['final_assembly'];
  const isAssemblyOperational = !finalAssembly.currentProcessingEntityId &&
                                !finalAssembly.isManuallyStopped &&
                                finalAssembly.activeFault === 'NONE' &&
                                finalAssembly.status !== 'MAINTENANCE_REQUIRED';

  if (readyRm1 && readyRm2 && readyRm3 && isAssemblyOperational) {
    if (isLunchBreak && config.assemblyMode !== 'FULLY_AUTOMATED') {
      finalAssembly.status = 'LUNCH_BREAK';
    } else {
      const oldRm1Code = readyRm1.code;
      const rawNum = readyRm1.id.replace('entity_', '').replace('ent_', '');
      const asyCode = `ASY-${String(rawNum).padStart(3, '0')}`;

      readyRm1.currentStationId = 'final_assembly';
      readyRm1.type = 'ASSEMBLED_UNIT';
      readyRm1.line = 'FINAL';
      readyRm1.code = asyCode;
      readyRm1.isProcessing = true;
      finalAssembly.currentProcessingEntityId = readyRm1.id;
      finalAssembly.processingTimeRemaining = finalAssembly.nominalProcessingTime;

      // Update RM2 and RM3 lifecycle records as integrated into this assembly
      ledger = recordItemLifecycleStepUpdate(
        ledger,
        readyRm2.code,
        'COMPLETED',
        `Integrated into Final Assembly ${asyCode}`,
        config.simulatedSecondsOfDay,
        clockInfo.timeStr
      );
      ledger = recordItemLifecycleStepUpdate(
        ledger,
        readyRm3.code,
        'COMPLETED',
        `Integrated into Final Assembly ${asyCode}`,
        config.simulatedSecondsOfDay,
        clockInfo.timeStr
      );

      // Transition the converged workpiece into final assembly
      ledger = recordItemLifecycleStepTransition(
        ledger,
        oldRm1Code,
        finalAssembly.id,
        finalAssembly.name,
        'FINAL',
        config.simulatedSecondsOfDay,
        clockInfo.timeStr,
        `Synchronous 3:1 merge completed (${oldRm1Code} + ${readyRm2.code} + ${readyRm3.code})`
      );
      ledger = ledger.map(r => r.code === oldRm1Code ? { ...r, code: asyCode, itemId: asyCode, rmType: 'FINAL' as const } : r);

      // Consume RM2 and RM3 items into the merged assembly
      entities = entities.filter(e => e.id !== readyRm2.id && e.id !== readyRm3.id);
      stations['converge_join'].itemsProcessed++;
      stations['converge_join'].processedToday++;
      stations['converge_join'].processedCumulative++;
      stations['converge_join'].currentQueueCount = Math.max(0, stations['converge_join'].currentQueueCount - 3);
    }
  }

  // 6. Post-Assembly Entity Queue to Packaging Dispatch
  const entityQueueStation = stations['entity_queue'];
  const packagingStation = stations['packaging'];
  const isPackagingOperational = !packagingStation.currentProcessingEntityId &&
                                 !packagingStation.isManuallyStopped &&
                                 packagingStation.activeFault === 'NONE' &&
                                 packagingStation.status !== 'MAINTENANCE_REQUIRED';

  if (isPackagingOperational && entityQueueStation.currentQueueCount > 0) {
    const itemToPack = entities.find(e => e.currentStationId === 'entity_queue' && !e.isProcessing);
    if (itemToPack) {
      itemToPack.currentStationId = 'packaging';
      itemToPack.targetStationId = 'transporter_out';
      itemToPack.isProcessing = true;
      packagingStation.currentProcessingEntityId = itemToPack.id;
      packagingStation.processingTimeRemaining = packagingStation.nominalProcessingTime;
      entityQueueStation.currentQueueCount = Math.max(0, entityQueueStation.currentQueueCount - 1);
      entityQueueStation.processedToday++;
      entityQueueStation.processedCumulative++;

      ledger = recordItemLifecycleStepTransition(
        ledger,
        itemToPack.code,
        packagingStation.id,
        packagingStation.name,
        'FINAL',
        config.simulatedSecondsOfDay,
        clockInfo.timeStr,
        'Packaging Station: protective foam wrapping & aerospace barcoding'
      );
    }
  }

  // 6b. Outfeed Conveyor / Entity Queue Out to Sink Dispatch
  const eqOutStation = stations['entity_queue_out'];
  const sinkStation = stations['sink_dispatch'];
  if (eqOutStation && sinkStation && eqOutStation.currentQueueCount > 0) {
    const itemToDispatch = entities.find(e => e.currentStationId === 'entity_queue_out' && !e.isProcessing);
    if (itemToDispatch) {
      eqOutStation.currentQueueCount = Math.max(0, eqOutStation.currentQueueCount - 1);
      eqOutStation.processedToday++;
      eqOutStation.processedCumulative++;

      completedCount++;
      config.completedToday = completedCount;
      config.completedCumulative = (config.completedCumulative || 0) + 1;

      sinkStation.itemsProcessed++;
      sinkStation.processedToday++;
      sinkStation.processedCumulative++;

      ledger = recordItemLifecycleDispatch(
        ledger,
        itemToDispatch.code,
        config.simulatedSecondsOfDay,
        clockInfo.timeStr
      );

      // Successfully dispatched out of plant to warehouse customer shipment
      entities = entities.filter(e => e.id !== itemToDispatch.id);
    }
  }

  // 7. Machine Processing Timers & Entity Transformation
  for (const sId of Object.keys(stations)) {
    const st = stations[sId];
    st.totalTimeAccumulated += dt;

    if (st.isQueue) {
      st.currentQueueCount = entities.filter(e => e.currentStationId === sId && !e.isProcessing).length;
      st.currentlyProcessingCount = 0;
      st.status = st.currentQueueCount > 0 ? 'BUSY' : 'IDLE';
      continue;
    }

    if (st.type === 'truck_source' || st.type === 'truck_unloading') {
      // Handled in step 1
      continue;
    }

    if (st.type.includes('transporter')) {
      const activeItems = entities.filter(e => e.currentStationId === sId);
      const isConveyorHalted = st.activeFault !== 'NONE' || st.status === 'MAINTENANCE_REQUIRED' || st.isManuallyStopped === true;
      const isWorking = activeItems.length > 0 && !isConveyorHalted;
      st.currentlyProcessingCount = activeItems.length;
      if (isWorking) st.busyTimeAccumulated += dt;
      st.status = isConveyorHalted ? 'MAINTENANCE_REQUIRED' : isWorking ? 'BUSY' : 'IDLE';
      st.sensors = updateStationSensors(st, dt, isWorking, true);
      continue;
    }

    // Explicit manual stop check: if operator manually halted this machine, stop processing immediately
    if (st.isManuallyStopped) {
      st.status = 'MAINTENANCE_REQUIRED';
      st.currentlyProcessingCount = st.currentProcessingEntityId ? 1 : 0;
      st.sensors = updateStationSensors(st, dt, false, true);
      st.mlResult = runPredictivePipeline(st.sensors, st.type, st.name);
      continue;
    }

    // Server / Process Stations (CNC, QC, Final Assembly, Packaging)
    const toolWear = st.sensors.toolWearIndex ?? 0;
    const isCriticalWear = toolWear >= 0.35 && st.activeFault !== 'NONE';
    const isCriticalVibration = st.sensors.vibrationRms >= 7.5;
    const isCriticalTemp = st.sensors.temperature >= 82.0;
    const isRulZero = st.activeFault !== 'NONE' && st.mlResult?.remainingUsefulLifeHours !== undefined && st.mlResult.remainingUsefulLifeHours <= 0;
    const isFatalFault = st.activeFault !== 'NONE' && (st.activeFault !== 'TOOL_FLANK_WEAR' || toolWear >= 0.35);
    const hasCatastrophicBreakdown = isCriticalWear || isCriticalVibration || isCriticalTemp || isRulZero || isFatalFault;

    if (hasCatastrophicBreakdown) {
      st.status = 'MAINTENANCE_REQUIRED';
      if (st.activeFault === 'NONE') {
        st.activeFault = isCriticalWear
          ? 'TOOL_FLANK_WEAR'
          : (isCriticalVibration ? 'SPINDLE_BEARING_VIBRATION' : 'SPINDLE_THERMAL_EXPANSION');
      }
      st.currentlyProcessingCount = 0;
      st.sensors = updateStationSensors(st, dt, false, true);
      st.mlResult = runPredictivePipeline(st.sensors, st.type, st.name);
      continue;
    }

    if (st.currentProcessingEntityId) {
      st.currentlyProcessingCount = 1;
      st.status = 'BUSY';

      st.busyTimeAccumulated += dt;
      st.processingTimeRemaining -= dt;
      st.cumulativeRunHours += dt / 3600;

      // Progressive wear
      const wearRatePerHour = st.activeFault !== 'NONE' ? 0.35 : 0.045;
      st.wearPercentage = Math.min(100, Number((st.wearPercentage + (dt / 3600) * wearRatePerHour).toFixed(4)));

      // Finish processing cycle
      if (st.processingTimeRemaining <= 0) {
        const processedEntity = entities.find(e => e.id === st.currentProcessingEntityId);
        st.currentProcessingEntityId = null;
        st.currentlyProcessingCount = 0;
        st.itemsProcessed++;
        st.processedToday++;
        st.processedCumulative++;

        if (processedEntity) {
          processedEntity.isProcessing = false;
          const partCode = processedEntity.code || `RM${st.line === 'RM1' ? 1 : st.line === 'RM2' ? 2 : 3}-${String(st.itemsProcessed + 1).padStart(3, '0')}`;
          const partLine = (st.line || 'RM1') as 'RM1' | 'RM2' | 'RM3';

          // Quality Control 3-stage subsystem
          if (st.type === 'quality_control') {
            const hasUpstreamFault = st.activeFault !== 'NONE';
            const qc = st.qcSubsystem || {
              check1Inspected: 0,
              check1Passed: 0,
              check1Failed: 0,
              check2Scrapped: 0,
              check2SentToRework: 0,
              reworkProcessed: 0,
              check3Passed: 0,
              check3Scrapped: 0,
              firstPassYield: 95,
              rolledThroughputYield: 98,
              activeInReworkEntityId: null,
              reworkTimeRemaining: 0,
              defectAuditLog: createDefaultQCDefectAuditLog(st.id),
            };

            const clockInfo = formatSimulatedClock(config.simulatedSecondsOfDay, config.simulatedDate, config.simulatedDayCount);

            qc.check1Inspected++;
            const check1PassThreshold = hasUpstreamFault ? 0.55 : 0.94;
            const check1Roll = Math.random();

            if (check1Roll < check1PassThreshold) {
              qc.check1Passed++;
              processedEntity.qualityPassed = true;
              ledger = recordItemLifecycleStepUpdate(
                ledger,
                partCode,
                'COMPLETED',
                'QC Check I Laser Runout: PASSED (First Pass Yield)',
                config.simulatedSecondsOfDay,
                clockInfo.timeStr
              );
            } else {
              qc.check1Failed++;
              const isFatalDefect = Math.random() < 0.25;

              if (isFatalDefect) {
                qc.check2Scrapped++;
                processedEntity.qualityPassed = false;
                st.itemsRejected++;
                rejectedCount++;
                entities = entities.filter(e => e.id !== processedEntity.id);

                const measured = partLine === 'RM1' ? 0.046 : partLine === 'RM2' ? 0.053 : 0.039;
                const standard = partLine === 'RM1' ? '±0.020 mm' : partLine === 'RM2' ? 'Flange Flatness ±0.025 mm' : 'Involute Pitch ±0.015 mm';
                const margin = partLine === 'RM1' ? '+0.026 mm out of tolerance' : partLine === 'RM2' ? '+0.028 mm out of tolerance' : '+0.024 mm pitch deviation';
                const defectRec: QCDefectAuditRecord = {
                  id: `qc-${st.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  itemId: partCode,
                  rmType: partLine,
                  stationId: st.id,
                  stationName: st.name,
                  timestampStr: clockInfo.timeStr,
                  stage: 'CHECK_II',
                  action: 'SCRAPPED',
                  metricTested: 'DIMENSIONAL_TOLERANCE',
                  measuredValue: measured,
                  standardValue: standard,
                  deviationMargin: margin,
                  reason: partLine === 'RM1' ? 'Severe shaft runout & concentricity loss' : partLine === 'RM2' ? 'Casting housing mounting flange warping' : 'Gear tooth profile angle error',
                };
                qc.defectAuditLog = [defectRec, ...(qc.defectAuditLog || [])];

                ledger = recordItemLifecycleScrap(
                  ledger,
                  partCode,
                  config.simulatedSecondsOfDay,
                  clockInfo.timeStr,
                  `QC Check II Scrapped: ${defectRec.reason} (${defectRec.deviationMargin})`
                );
              } else {
                qc.check2SentToRework++;
                qc.reworkProcessed++;

                const reworkRec: QCDefectAuditRecord = {
                  id: `qc-${st.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  itemId: partCode,
                  rmType: partLine,
                  stationId: st.id,
                  stationName: st.name,
                  timestampStr: clockInfo.timeStr,
                  stage: 'REWORK',
                  action: 'REWORKED',
                  metricTested: 'SURFACE_ROUGHNESS',
                  measuredValue: 1.25,
                  standardValue: 'Ra ≤ 0.80 µm',
                  deviationMargin: '+0.45 µm above Ra 0.80 µm threshold',
                  reason: 'Surface roughness out of tolerance; routed to precision hone rework server',
                };
                qc.defectAuditLog = [reworkRec, ...(qc.defectAuditLog || [])];

                ledger = recordItemLifecycleStepUpdate(
                  ledger,
                  partCode,
                  'REWORKED',
                  `QC Check II Rework: ${reworkRec.deviationMargin}`,
                  config.simulatedSecondsOfDay,
                  clockInfo.timeStr
                );

                const check3PassRoll = Math.random();
                if (check3PassRoll < 0.88) {
                  qc.check3Passed++;
                  processedEntity.qualityPassed = true;
                  ledger = recordItemLifecycleStepUpdate(
                    ledger,
                    partCode,
                    'COMPLETED',
                    'QC Check III Post-Rework Audit: PASSED (Salvaged to standard)',
                    config.simulatedSecondsOfDay,
                    clockInfo.timeStr
                  );
                } else {
                  qc.check3Scrapped++;
                  processedEntity.qualityPassed = false;
                  st.itemsRejected++;
                  rejectedCount++;
                  entities = entities.filter(e => e.id !== processedEntity.id);

                  const check3ScrapRec: QCDefectAuditRecord = {
                    id: `qc-${st.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    itemId: partCode,
                    rmType: partLine,
                    stationId: st.id,
                    stationName: st.name,
                    timestampStr: clockInfo.timeStr,
                    stage: 'CHECK_III',
                    action: 'SCRAPPED',
                    metricTested: 'HARDNESS_HRC',
                    measuredValue: 39.5,
                    standardValue: '45.0 - 50.0 HRC',
                    deviationMargin: '-5.5 HRC below 45.0 HRC minimum',
                    reason: 'Rework heat exposure degraded core material hardness; condemned to scrap',
                  };
                  qc.defectAuditLog = [check3ScrapRec, ...(qc.defectAuditLog || [])];

                  ledger = recordItemLifecycleScrap(
                    ledger,
                    partCode,
                    config.simulatedSecondsOfDay,
                    clockInfo.timeStr,
                    `QC Check III Scrapped: ${check3ScrapRec.reason} (${check3ScrapRec.deviationMargin})`
                  );
                }
              }
            }

            qc.firstPassYield = Math.round((qc.check1Passed / Math.max(1, qc.check1Inspected)) * 1000) / 10;
            qc.rolledThroughputYield = Math.round(((qc.check1Passed + qc.check3Passed) / Math.max(1, qc.check1Inspected)) * 1000) / 10;
            st.qcSubsystem = qc;
          }

          // Entity Transformation & Flow Routing
          if (processedEntity.qualityPassed) {
            if (st.type === 'cnc_lathe') {
              processedEntity.type = 'MACHINED_RM1';
              processedEntity.currentStationId = 'buffer_rm1';
              stations['buffer_rm1'].currentQueueCount++;
              ledger = recordItemLifecycleStepTransition(
                ledger,
                partCode,
                'buffer_rm1',
                stations['buffer_rm1'].name,
                'RM1',
                config.simulatedSecondsOfDay,
                clockInfo.timeStr,
                'CNC Turning complete; staging in intermediate WIP buffer'
              );
            } else if (st.type === 'cnc_milling') {
              processedEntity.type = 'MACHINED_RM2';
              processedEntity.currentStationId = 'buffer_rm2';
              stations['buffer_rm2'].currentQueueCount++;
              ledger = recordItemLifecycleStepTransition(
                ledger,
                partCode,
                'buffer_rm2',
                stations['buffer_rm2'].name,
                'RM2',
                config.simulatedSecondsOfDay,
                clockInfo.timeStr,
                'CNC Milling complete; staging in intermediate WIP buffer'
              );
            } else if (st.type === 'cnc_shaping') {
              processedEntity.type = 'MACHINED_RM3';
              processedEntity.currentStationId = 'buffer_rm3';
              stations['buffer_rm3'].currentQueueCount++;
              ledger = recordItemLifecycleStepTransition(
                ledger,
                partCode,
                'buffer_rm3',
                stations['buffer_rm3'].name,
                'RM3',
                config.simulatedSecondsOfDay,
                clockInfo.timeStr,
                'CNC Shaping complete; staging in intermediate WIP buffer'
              );
            } else if (st.type === 'quality_control') {
              // Inspected entity transfers into Converge Joiner intake buffer
              processedEntity.currentStationId = 'converge_join';
              processedEntity.targetStationId = 'final_assembly';
              stations['converge_join'].currentQueueCount++;
              ledger = recordItemLifecycleStepTransition(
                ledger,
                partCode,
                'converge_join',
                stations['converge_join'].name,
                partLine,
                config.simulatedSecondsOfDay,
                clockInfo.timeStr,
                'QC inspection passed; staged at 3:1 converge joiner'
              );
            } else if (st.type === 'final_assembly') {
              processedEntity.currentStationId = 'entity_queue';
              stations['entity_queue'].currentQueueCount++;
              ledger = recordItemLifecycleStepTransition(
                ledger,
                partCode,
                'entity_queue',
                stations['entity_queue'].name,
                'FINAL',
                config.simulatedSecondsOfDay,
                clockInfo.timeStr,
                'Robotic final assembly complete; staged in packaging infeed buffer'
              );
            } else if (st.type === 'packaging') {
              processedEntity.type = 'PACKAGED_PRODUCT';
              // Outfeed entity onto transporter_out to realistically travel to entity_queue_out and sink_dispatch
              processedEntity.currentStationId = 'transporter_out';
              processedEntity.targetStationId = 'entity_queue_out';
              processedEntity.positionRatio = 0;
              processedEntity.isProcessing = false;
              ledger = recordItemLifecycleStepTransition(
                ledger,
                partCode,
                'transporter_out',
                stations['transporter_out'].name,
                'FINAL',
                config.simulatedSecondsOfDay,
                clockInfo.timeStr,
                'Packaging completed; on outfeed belt toward dispatch'
              );
            }
          }
        }
      }
    } else {
      st.currentlyProcessingCount = 0;
      if (isLunchBreak && (st.type === 'final_assembly' && config.assemblyMode !== 'FULLY_AUTOMATED')) {
        st.status = 'LUNCH_BREAK';
      } else {
        st.status = 'STARVED';
      }
    }

    const isWorking = st.currentProcessingEntityId !== null || st.status === 'BUSY';
    st.sensors = updateStationSensors(st, dt, isWorking, true);
    st.utilization = Math.min(100, Math.round((st.busyTimeAccumulated / Math.max(1, st.totalTimeAccumulated)) * 100));
    st.mlResult = runPredictivePipeline(st.sensors, st.type, st.name);

    if (Math.floor(newTime * 2) > Math.floor(state.timeSeconds * 2)) {
      st.history.push({
        timestamp: Math.round(newTime * 10) / 10,
        vibrationRms: Number(st.sensors.vibrationRms.toFixed(2)),
        temperature: Number(st.sensors.temperature.toFixed(1)),
        motorCurrent: Number(st.sensors.motorCurrent.toFixed(1)),
        acousticEmission: Number(st.sensors.acousticEmission.toFixed(1)),
        anomalyScore: st.mlResult.anomalyScore,
      });
      if (st.history.length > 30) {
        st.history.shift();
      }
    }
  }

  // 7.5 Stochastic Equipment Failure Simulation (Configurable by user)
  if (config.randomFailuresEnabled && config.isShiftOpen && !isLunchBreak) {
    const mtbf = Math.max(0.0001, config.mtbfHours || 16.0);
    // Probability per dt that an unexpected equipment incident strikes an active machine
    const failureProb = (1.0 / (mtbf * 3600)) * dt;
    if (Math.random() < failureProb) {
      const activeCandidates = Object.values(stations).filter(
        st => st.activeFault === 'NONE' && !st.isQueue && st.type !== 'truck_source' && st.type !== 'sink_dispatch'
      );
      if (activeCandidates.length > 0) {
        const picked = activeCandidates[Math.floor(Math.random() * activeCandidates.length)];
        const fault = getRandomFaultForStation(picked.type);
        if (fault) {
          const injected = injectPlantFault({ ...state, stations }, picked.id, fault);
          stations[picked.id] = injected.stations[picked.id];
        }
      }
    }
  }

  // 8. Re-synchronize queue counts and guarantee C >= D
  for (const sId of Object.keys(stations)) {
    const st = stations[sId];
    if (st.isQueue) {
      st.currentQueueCount = entities.filter(e => e.currentStationId === sId && !e.isProcessing).length;
    }
    if (st.processedCumulative < st.processedToday) {
      st.processedCumulative = st.processedToday;
    }
  }

  // 9. Calculate Bottleneck and OEE
  let maxUtil = 0;
  let bottleneckId: string | null = null;
  for (const sId of Object.keys(stations)) {
    const s = stations[sId];
    if (!s.isQueue && s.type !== 'truck_source' && s.type !== 'sink_dispatch') {
      if (s.utilization > maxUtil) {
        maxUtil = s.utilization;
        bottleneckId = sId;
      }
    }
  }

  const hasFault = Object.values(stations).some(s => s.status === 'MAINTENANCE_REQUIRED');
  const availability = hasFault ? 84.5 : 98.2;
  const performance = Math.min(99, Math.max(72, Math.round(100 - (maxUtil > 88 ? (maxUtil - 88) * 1.5 : 0))));
  const totalChecked = completedCount + rejectedCount;
  const quality = totalChecked > 0 ? Math.round(((completedCount) / totalChecked) * 1000) / 10 : 99.2;
  const overallOEE = Math.round((availability * performance * quality) / 10000);

  // Update live metrics on current active day in performanceHistory
  let performanceHistory = state.performanceHistory;
  if (!performanceHistory || performanceHistory.length === 0) {
    performanceHistory = createDefaultPerformanceHistory(
      config.simulatedDayCount,
      config.simulatedDate,
      config.dailyTargetUnits,
      config.arrearsUnits,
      completedCount
    );
  } else {
    const lastIdx = performanceHistory.length - 1;
    const currentRec = performanceHistory[lastIdx];
    if (
      currentRec &&
      (currentRec.finishedGoods !== completedCount ||
        currentRec.scrapCount !== rejectedCount ||
        currentRec.oee !== overallOEE)
    ) {
      performanceHistory = [...performanceHistory];
      performanceHistory[lastIdx] = {
        ...currentRec,
        finishedGoods: completedCount,
        arrearsBacklog: config.arrearsUnits,
        cumulativeBacklog: config.arrearsUnits,
        scrapCount: rejectedCount,
        oee: overallOEE,
        fpy: quality,
      };
    }
  }

  ledger = tickActiveLifecycleRecords(ledger, config.simulatedSecondsOfDay);

  return {
    ...state,
    timeSeconds: newTime,
    stations,
    entities,
    completedCount,
    rejectedCount,
    wipCount: entities.length,
    bottleneckStationId: bottleneckId,
    lineBalanceScore: Math.round(100 - Math.abs(maxUtil - 65)),
    oee: {
      availability,
      performance,
      quality,
      overallOEE,
    },
    config,
    performanceHistory,
    itemLifecycleLedger: ledger,
  };
}

/**
 * Helper to randomize truck arrival time between 8:00 AM and 10:00 AM in 5-minute increments
 */
export function generateRandomTruckArrival8to10(): { hour: number; timeStr: string } {
  const minuteStep = Math.floor(Math.random() * 25) * 5; // 0, 5, 10, ... 120 min
  const hour = Number((8.0 + minuteStep / 60).toFixed(2));
  const h = 8 + Math.floor(minuteStep / 60);
  const m = minuteStep % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(h)}:${pad(m)} AM`;
  return { hour, timeStr };
}

/**
 * Advances the manufacturing unit to the next working day (rolls over uncompleted units as arrears)
 */
export function advanceToNextDay(state: PlantSimulationState): PlantSimulationState {
  const config = { ...state.config };

  // Calculate unfinished target and add to arrears
  const unfinishedToday = Math.max(0, config.dailyTargetUnits - state.completedCount);
  const newArrears = (config.arrearsUnits || 0) + unfinishedToday;
  config.arrearsUnits = newArrears;

  const prevDay = config.simulatedDayCount;
  const prevDate = config.simulatedDate;

  // Advance day count
  config.simulatedDayCount += 1;

  // Advance date
  const currDate = new Date(config.simulatedDate);
  currDate.setDate(currDate.getDate() + 1);
  config.simulatedDate = currDate.toISOString().split('T')[0];

  // Reset clock to shift start (8:00 AM sharp)
  config.simulatedSecondsOfDay = config.shiftStartHour * 3600;
  config.isShiftOpen = true;
  config.completedToday = 0;

  // Archive yesterday's completed day and append new active day to performance history
  const history = [
    ...(state.performanceHistory ||
      createDefaultPerformanceHistory(
        prevDay,
        prevDate,
        config.dailyTargetUnits,
        config.arrearsUnits,
        state.completedCount
      )),
  ];

  const lastIndex = history.length - 1;
  if (lastIndex >= 0) {
    history[lastIndex] = {
      ...history[lastIndex],
      finishedGoods: state.completedCount,
      arrearsBacklog: newArrears,
      cumulativeBacklog: newArrears,
      scrapCount: state.rejectedCount,
      oee: state.oee.overallOEE,
      isCurrentDay: false,
      dayLabel: `Day ${prevDay}`,
    };
  }

  // Push new day record
  history.push({
    day: config.simulatedDayCount,
    dateStr: config.simulatedDate,
    dayLabel: `Day ${config.simulatedDayCount} (Today)`,
    finishedGoods: 0,
    targetUnits: config.dailyTargetUnits,
    arrearsBacklog: newArrears,
    cumulativeBacklog: newArrears,
    scrapCount: 0,
    fpy: 96.0,
    oee: state.oee.overallOEE,
    isCurrentDay: true,
  });

  // Randomize arrival times for everyday reset strictly between 8:00 AM and 10:00 AM
  const arr1 = generateRandomTruckArrival8to10();
  const arr2 = generateRandomTruckArrival8to10();
  const arr3 = generateRandomTruckArrival8to10();

  // Reset trucks with fresh 120 units each and randomized 8am-10am arrival schedule
  config.trucks = {
    rm1: {
      ...config.trucks.rm1,
      arrivalTimeStr: arr1.timeStr,
      arrivalHour: arr1.hour,
      hasArrived: false,
      isUnloading: false,
      unitsLeftToUnload: config.dailyRmPerTruck,
    },
    rm2: {
      ...config.trucks.rm2,
      arrivalTimeStr: arr2.timeStr,
      arrivalHour: arr2.hour,
      hasArrived: false,
      isUnloading: false,
      unitsLeftToUnload: config.dailyRmPerTruck,
    },
    rm3: {
      ...config.trucks.rm3,
      arrivalTimeStr: arr3.timeStr,
      arrivalHour: arr3.hour,
      hasArrived: false,
      isUnloading: false,
      unitsLeftToUnload: config.dailyRmPerTruck,
    },
  };

  // PRESERVE BACKLOG ENTITIES: Entities start from the exact position they were left last day!
  const entities = state.entities.map(e => ({ ...e }));

  // Reset daily counters for all stations while PRESERVING backlog queues and in-process items
  const stations = { ...state.stations };
  for (const id of Object.keys(stations)) {
    const prevSt = stations[id];
    const stationEntities = entities.filter(e => e.currentStationId === id);
    const processingEntity = stationEntities.find(e => e.isProcessing);
    const queuedEntities = stationEntities.filter(e => !e.isProcessing);

    stations[id] = {
      ...prevSt,
      processedToday: 0, // Reset today's count for the new day
      // Backlog queue count and in-progress items resume seamlessly
      currentQueueCount: prevSt.isQueue ? queuedEntities.length : prevSt.currentQueueCount,
      currentlyProcessingCount: processingEntity ? 1 : (prevSt.type.includes('transporter') ? stationEntities.length : 0),
      currentProcessingEntityId: processingEntity ? processingEntity.id : prevSt.currentProcessingEntityId,
      processingTimeRemaining: processingEntity ? Math.max(1.0, prevSt.processingTimeRemaining) : 0,
      status: prevSt.activeFault !== 'NONE'
        ? 'MAINTENANCE_REQUIRED'
        : processingEntity
        ? 'BUSY'
        : prevSt.isQueue
        ? 'IDLE'
        : (stationEntities.length > 0 ? 'BUSY' : (id.startsWith('truck_') ? 'IDLE' : 'STARVED')),
    };
  }

  // Pre-load truck stations' initial queue counts with their loaded payload (120 units)
  if (stations['truck_rm1']) {
    stations['truck_rm1'].currentQueueCount = config.dailyRmPerTruck;
    stations['truck_rm1'].processedToday = 0;
  }
  if (stations['truck_rm2']) {
    stations['truck_rm2'].currentQueueCount = config.dailyRmPerTruck;
    stations['truck_rm2'].processedToday = 0;
  }
  if (stations['truck_rm3']) {
    stations['truck_rm3'].currentQueueCount = config.dailyRmPerTruck;
    stations['truck_rm3'].processedToday = 0;
  }

  return {
    ...state,
    completedCount: 0,
    entities, // Backlog entities start from the position they were left last day
    wipCount: entities.length,
    config,
    stations,
    performanceHistory: history,
  };
}

/**
 * Injects a physical equipment fault
 */
export function injectPlantFault(
  state: PlantSimulationState,
  stationId: string,
  fault: FaultType
): PlantSimulationState {
  const station = state.stations[stationId];
  if (!station) return state;

  const updatedSensors = { ...station.sensors };

  if (fault === 'TOOL_FLANK_WEAR') {
    // Normal progressive wear: advances VB by 0.06mm
    // E.g. from 0.05mm -> 0.11mm -> 0.17mm -> 0.23mm (advisory) -> 0.29mm -> 0.35mm (critical limit)
    const currentWear = updatedSensors.toolWearIndex ?? 0.05;
    const nextWear = currentWear >= 0.28 ? 0.36 : Number((currentWear + 0.06).toFixed(3));
    updatedSensors.toolWearIndex = nextWear;
    if (nextWear >= 0.35) {
      updatedSensors.vibrationRms = 6.4;
      updatedSensors.motorCurrent = 21.0;
      updatedSensors.acousticEmission = 52.0;
    } else {
      updatedSensors.vibrationRms = 2.0 + nextWear * 3.5;
      updatedSensors.motorCurrent = 12.5 + nextWear * 8.0;
      updatedSensors.acousticEmission = 22.0 + nextWear * 25.0;
    }
  } else if (fault === 'SPINDLE_BEARING_VIBRATION' || fault === 'BEARING_INNER_RACE_FAULT') {
    updatedSensors.vibrationRms = 7.4;
    updatedSensors.vibrationPeak = 12.5;
  } else if (fault === 'SPINDLE_THERMAL_EXPANSION' || fault === 'SPINDLE_OVERHEAT_LUB_FAIL') {
    updatedSensors.temperature = 78.5;
    updatedSensors.motorCurrent = 21.5;
  } else if (fault === 'CHIP_CONVEYOR_CLOG') {
    updatedSensors.motorCurrent = 24.0;
    updatedSensors.vibrationRms = 4.2;
  } else if (fault === 'BELT_SLIP_AND_TENSION_LOSS') {
    updatedSensors.conveyorTension = 260;
    updatedSensors.vibrationRms = 3.6;
  } else if (fault === 'ROLLER_BEARING_OVERHEAT') {
    updatedSensors.temperature = 72.0;
    updatedSensors.vibrationRms = 4.5;
  } else if (fault === 'CONVEYOR_MOTOR_OVERLOAD') {
    updatedSensors.motorCurrent = 18.5;
  } else if (fault === 'OPTICAL_LENS_FOULED' || fault === 'GAUGE_CALIBRATION_DRIFT') {
    updatedSensors.acousticEmission = 38.0;
  } else if (fault === 'TORQUE_DRIVER_OUT_OF_SPEC' || fault === 'PNEUMATIC_PRESSURE_DROP') {
    updatedSensors.motorCurrent = 17.5;
  } else if (fault === 'SEALER_HEATER_ELEMENT_FAULT') {
    updatedSensors.temperature = 88.0;
  } else if (fault === 'MOTOR_WINDING_OVERCURRENT') {
    updatedSensors.motorCurrent = 26.0;
    updatedSensors.temperature = 72.0;
  }

  // Critical failure classification:
  // Tool flank wear is considered MAINTENANCE_REQUIRED if VB >= 0.35mm (ISO 3685 failure threshold)
  // Below 0.35mm, it is an advisory condition (machine keeps working, status remains operational / busy)
  const isToolWearCritical = fault === 'TOOL_FLANK_WEAR' && (updatedSensors.toolWearIndex ?? 0) >= 0.35;
  const isFatalFault = fault !== 'NONE' && (
    fault === 'SPINDLE_BEARING_VIBRATION' ||
    fault === 'BEARING_INNER_RACE_FAULT' ||
    fault === 'SPINDLE_OVERHEAT_LUB_FAIL' ||
    fault === 'SPINDLE_THERMAL_EXPANSION' ||
    fault === 'CHIP_CONVEYOR_CLOG' ||
    fault === 'BELT_SLIP_AND_TENSION_LOSS' ||
    fault === 'MOTOR_WINDING_OVERCURRENT' ||
    fault === 'SEALER_HEATER_ELEMENT_FAULT' ||
    fault === 'BARCODE_SCANNER_MISREAD' ||
    fault === 'STRAPPING_DISPENSER_JAM' ||
    fault === 'OPTICAL_LENS_FOULED' ||
    fault === 'GAUGE_CALIBRATION_DRIFT' ||
    fault === 'PROBE_ACTUATOR_RESPONSE_LAG' ||
    fault === 'ROLLER_BEARING_OVERHEAT' ||
    fault === 'CONVEYOR_MOTOR_OVERLOAD' ||
    fault === 'TORQUE_DRIVER_OUT_OF_SPEC' ||
    fault === 'PNEUMATIC_PRESSURE_DROP' ||
    fault === 'OPERATOR_ASSEMBLY_BOTTLENECK' ||
    isToolWearCritical
  );

  const updatedStation: Station = {
    ...station,
    sensors: updatedSensors,
    activeFault: fault,
    status: isFatalFault ? ('MAINTENANCE_REQUIRED' as const) : (station.status === 'SHIFT_CLOSED' ? 'SHIFT_CLOSED' : 'BUSY'),
    mlResult: runPredictivePipeline(updatedSensors, station.type, station.name),
  };

  return {
    ...state,
    stations: {
      ...state.stations,
      [stationId]: updatedStation,
    },
  };
}

/**
 * Simulates progressive tool wear adjustment
 */
export function setStationToolWear(
  state: PlantSimulationState,
  stationId: string,
  flankWearMm: number
): PlantSimulationState {
  const station = state.stations[stationId];
  if (!station) return state;

  const updatedSensors: StationSensors = {
    ...station.sensors,
    toolWearIndex: flankWearMm,
  };

  const isCritical = flankWearMm >= 0.30;
  const updatedStation: Station = {
    ...station,
    sensors: updatedSensors,
    activeFault: flankWearMm > 0.15 ? 'TOOL_FLANK_WEAR' : 'NONE',
    status: isCritical ? 'MAINTENANCE_REQUIRED' : station.status,
    mlResult: runPredictivePipeline(updatedSensors, station.type, station.name),
  };

  return {
    ...state,
    stations: {
      ...state.stations,
      [stationId]: updatedStation,
    },
  };
}

/**
 * Clears fault and performs virtual maintenance repair
 */
export function performStationMaintenance(
  state: PlantSimulationState,
  stationId: string
): PlantSimulationState {
  const station = state.stations[stationId];
  if (!station) return state;

  const cat = station.type.includes('cnc')
    ? 'cnc'
    : station.type.includes('transporter')
    ? 'transporter'
    : 'general';
  const baseline = NOMINAL_BASELINES[cat];

  const resetSensors: StationSensors = {
    ...station.sensors,
    vibrationRms: baseline.vibrationRms,
    vibrationPeak: baseline.vibrationPeak,
    temperature: baseline.temperature,
    motorCurrent: baseline.motorCurrent,
    acousticEmission: baseline.acousticEmission,
    toolWearIndex: station.type.includes('cnc') ? 0.03 : 0.0,
    conveyorTension: station.type.includes('transporter') ? 450 : undefined,
  };

  const freshMl = runPredictivePipeline(resetSensors, station.type, station.name);

  const repairedStation: Station = {
    ...station,
    activeFault: 'NONE',
    isManuallyStopped: false,
    sensors: resetSensors,
    mlResult: freshMl,
    wearPercentage: 2.0,
    status: station.isQueue
      ? 'IDLE'
      : (station.currentProcessingEntityId ? 'BUSY' : 'STARVED'),
  };

  return {
    ...state,
    stations: {
      ...state.stations,
      [stationId]: repairedStation,
    },
  };
}

/**
 * Stops or resumes the operation of any individual plant component at operator discretion.
 */
export function toggleStationManualStop(
  state: PlantSimulationState,
  stationId: string
): PlantSimulationState {
  const station = state.stations[stationId];
  if (!station) return state;

  const nextStoppedState = !station.isManuallyStopped;
  const updatedStation: Station = {
    ...station,
    isManuallyStopped: nextStoppedState,
    status: nextStoppedState
      ? 'MAINTENANCE_REQUIRED'
      : (station.currentProcessingEntityId
          ? 'BUSY'
          : (station.isQueue
              ? (station.currentQueueCount > 0 ? 'BUSY' : 'IDLE')
              : 'IDLE')),
  };

  return {
    ...state,
    stations: {
      ...state.stations,
      [stationId]: updatedStation,
    },
  };
}

/**
 * Updates operational parameters (shift, trucks, cycle times, QC tolerances, unloading mode)
 */
export function parseTimeStringToHour(timeStr: string): number {
  if (!timeStr) return 8.0;
  const match = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return 8.0;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return Number((hours + minutes / 60).toFixed(2));
}

export type DeepPartialOperationalConfig = Omit<Partial<PlantOperationalConfig>, 'trucks' | 'qualityParameters'> & {
  trucks?: Partial<{
    [K in 'rm1' | 'rm2' | 'rm3']: Partial<PlantOperationalConfig['trucks'][K]>;
  }>;
  qualityParameters?: Partial<PlantOperationalConfig['qualityParameters']>;
};

export function updatePlantOperationalConfig(
  state: PlantSimulationState,
  partial: DeepPartialOperationalConfig
): PlantSimulationState {
  const currentHour = (state.config.simulatedSecondsOfDay / 3600) % 24;
  const trucks = { ...state.config.trucks };
  if (partial.trucks) {
    for (const key of ['rm1', 'rm2', 'rm3'] as const) {
      if (partial.trucks[key]) {
        const inputTruck = partial.trucks[key]!;
        const updatedTimeStr = inputTruck.arrivalTimeStr || trucks[key].arrivalTimeStr;
        const updatedHour = inputTruck.arrivalHour !== undefined
          ? inputTruck.arrivalHour
          : parseTimeStringToHour(updatedTimeStr);

        const hasArrived = currentHour >= updatedHour;
        const unitsLeft = inputTruck.unitsLeftToUnload !== undefined
          ? inputTruck.unitsLeftToUnload
          : trucks[key].unitsLeftToUnload;

        trucks[key] = {
          ...trucks[key],
          ...inputTruck,
          arrivalTimeStr: updatedTimeStr,
          arrivalHour: updatedHour,
          hasArrived,
          isUnloading: hasArrived && unitsLeft > 0,
        };
      }
    }
  }

  const newConfig = {
    ...state.config,
    ...partial,
    trucks,
    qualityParameters: {
      ...state.config.qualityParameters,
      ...(partial.qualityParameters || {}),
    },
  };

  // If partial updated generic conveyorTransportTimeSeconds without explicit line times, sync line times
  if (partial.conveyorTransportTimeSeconds !== undefined) {
    if (partial.conveyorLatheTimeSeconds === undefined) {
      newConfig.conveyorLatheTimeSeconds = partial.conveyorTransportTimeSeconds;
    }
    if (partial.conveyorMillingTimeSeconds === undefined) {
      newConfig.conveyorMillingTimeSeconds = partial.conveyorTransportTimeSeconds;
    }
    if (partial.conveyorShapingTimeSeconds === undefined) {
      newConfig.conveyorShapingTimeSeconds = partial.conveyorTransportTimeSeconds;
    }
  }

  const stations = { ...state.stations };
  for (const id of Object.keys(stations)) {
    const st = { ...stations[id] };
    if (st.type === 'transporter') {
      if (id === 'transporter_rm1') {
        st.nominalProcessingTime = newConfig.conveyorLatheTimeSeconds !== undefined ? newConfig.conveyorLatheTimeSeconds : (newConfig.conveyorTransportTimeSeconds ?? 360.0);
        st.name = `Transporter RM1 (Lathe - ${st.nominalProcessingTime}s)`;
      } else if (id === 'transporter_rm2') {
        st.nominalProcessingTime = newConfig.conveyorMillingTimeSeconds !== undefined ? newConfig.conveyorMillingTimeSeconds : (newConfig.conveyorTransportTimeSeconds ?? 240.0);
        st.name = `Transporter RM2 (Milling - ${st.nominalProcessingTime}s)`;
      } else if (id === 'transporter_rm3') {
        st.nominalProcessingTime = newConfig.conveyorShapingTimeSeconds !== undefined ? newConfig.conveyorShapingTimeSeconds : (newConfig.conveyorTransportTimeSeconds ?? 210.0);
        st.name = `Transporter RM3 (Shaping - ${st.nominalProcessingTime}s)`;
      } else {
        st.nominalProcessingTime = newConfig.conveyorTransportTimeSeconds ?? 45.0;
      }
    } else if (st.type === 'transporter_out') {
      st.nominalProcessingTime = newConfig.conveyorTransportTimeSeconds ?? 45.0;
    } else if (st.type === 'cnc_lathe') {
      st.nominalProcessingTime = newConfig.latheCycleTimeMinutes * 60;
    } else if (st.type === 'cnc_milling') {
      st.nominalProcessingTime = newConfig.millingCycleTimeMinutes * 60;
    } else if (st.type === 'cnc_shaping') {
      st.nominalProcessingTime = newConfig.shapingCycleTimeMinutes * 60;
    } else if (st.type === 'quality_control') {
      st.nominalProcessingTime = newConfig.qualityParameters.inspectionDurationSeconds || 30.0;
    } else if (st.type === 'final_assembly') {
      st.nominalProcessingTime = newConfig.assemblyCycleTimeMinutes * 60;
    } else if (st.type === 'packaging') {
      st.nominalProcessingTime = newConfig.packagingCycleTimeMinutes * 60;
    }
    stations[id] = st;
  }

  return {
    ...state,
    config: newConfig,
    stations,
  };
}

/**
 * Adjusts simulation speed (1x, 5x, 15x, 60x, 120x)
 */
export function setSimulationSpeed(
  state: PlantSimulationState,
  speed: number
): PlantSimulationState {
  return {
    ...state,
    simulationSpeed: speed,
    config: {
      ...state.config,
      timeScale: speed,
    },
  };
}

/**
 * Selects an appropriate realistic industrial fault mode for a given machine type
 */
export function getRandomFaultForStation(stationType: string): FaultType {
  if (stationType.includes('cnc')) {
    const cncFaults: FaultType[] = [
      'SPINDLE_BEARING_VIBRATION',
      'TOOL_FLANK_WEAR',
      'SPINDLE_THERMAL_EXPANSION',
      'CHIP_CONVEYOR_CLOG',
      'BEARING_INNER_RACE_FAULT',
    ];
    return cncFaults[Math.floor(Math.random() * cncFaults.length)];
  }
  if (stationType.includes('transporter')) {
    const conveyorFaults: FaultType[] = [
      'BELT_SLIP_AND_TENSION_LOSS',
      'ROLLER_BEARING_OVERHEAT',
      'CONVEYOR_MOTOR_OVERLOAD',
    ];
    return conveyorFaults[Math.floor(Math.random() * conveyorFaults.length)];
  }
  if (stationType.includes('quality')) {
    const qcFaults: FaultType[] = [
      'OPTICAL_LENS_FOULED',
      'GAUGE_CALIBRATION_DRIFT',
      'PROBE_ACTUATOR_RESPONSE_LAG',
    ];
    return qcFaults[Math.floor(Math.random() * qcFaults.length)];
  }
  if (stationType.includes('assembly')) {
    const asyFaults: FaultType[] = [
      'TORQUE_DRIVER_OUT_OF_SPEC',
      'PNEUMATIC_PRESSURE_DROP',
      'OPERATOR_ASSEMBLY_BOTTLENECK',
    ];
    return asyFaults[Math.floor(Math.random() * asyFaults.length)];
  }
  if (stationType.includes('packaging')) {
    const pkgFaults: FaultType[] = [
      'SEALER_HEATER_ELEMENT_FAULT',
      'BARCODE_SCANNER_MISREAD',
      'STRAPPING_DISPENSER_JAM',
    ];
    return pkgFaults[Math.floor(Math.random() * pkgFaults.length)];
  }
  return 'MOTOR_WINDING_OVERCURRENT';
}

/**
 * Randomly triggers a failure event on one of the operating machines (user discretion)
 */
export function triggerRandomMachineFailure(state: PlantSimulationState): {
  state: PlantSimulationState;
  stationId: string;
  stationName: string;
  fault: FaultType;
} | null {
  const candidateStations = Object.values(state.stations).filter(
    st => st.activeFault === 'NONE' && !st.isQueue && st.type !== 'truck_source' && st.type !== 'sink_dispatch'
  );
  if (candidateStations.length === 0) return null;

  const target = candidateStations[Math.floor(Math.random() * candidateStations.length)];
  const fault = getRandomFaultForStation(target.type);
  const updatedState = injectPlantFault(state, target.id, fault);
  return {
    state: updatedState,
    stationId: target.id,
    stationName: target.name,
    fault,
  };
}

/**
 * Repairs / restores all equipment across the plant to nominal operating state
 */
export function clearAllStationFaults(state: PlantSimulationState): PlantSimulationState {
  let updatedState = { ...state };
  for (const st of Object.values(state.stations)) {
    if (st.activeFault !== 'NONE' || st.status === 'MAINTENANCE_REQUIRED') {
      updatedState = performStationMaintenance(updatedState, st.id);
    }
  }
  return updatedState;
}
