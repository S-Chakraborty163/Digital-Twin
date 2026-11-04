/**
 * Machine Learning Models & Predictive Maintenance Engine
 * Tailored for discrete manufacturing plant equipment:
 * - CNC Machines (Lathe, Milling, Shaping)
 * - Conveyor Transporters & Material Handling
 * - Assembly & Packaging Motors
 */

import { FaultType, MLDetectionResult, StationSensors } from '../types/factory';

// Baseline nominal operating parameters for healthy equipment
export const NOMINAL_BASELINES: Record<string, StationSensors> = {
  cnc: {
    vibrationRms: 1.8, // mm/s
    vibrationPeak: 0.9, // g
    temperature: 42.0, // °C
    motorCurrent: 12.5, // A
    acousticEmission: 22.0, // kHz
    toolWearIndex: 0.05, // mm
    speedRpm: 3200,
  },
  transporter: {
    vibrationRms: 1.2,
    vibrationPeak: 0.4,
    temperature: 36.0,
    motorCurrent: 6.8,
    acousticEmission: 14.0,
    toolWearIndex: 0.0,
    conveyorTension: 450, // Newtons
    speedRpm: 120,
  },
  assembly: {
    vibrationRms: 1.5,
    vibrationPeak: 0.6,
    temperature: 38.5,
    motorCurrent: 9.2,
    acousticEmission: 18.0,
    toolWearIndex: 0.0,
    speedRpm: 1800,
  },
  general: {
    vibrationRms: 1.4,
    vibrationPeak: 0.5,
    temperature: 37.0,
    motorCurrent: 8.0,
    acousticEmission: 16.0,
    toolWearIndex: 0.0,
  },
};

/**
 * Calculate statistical features:
 * - Crest Factor = Peak / RMS
 * - Temperature deviation
 * - Current deviation
 * - Acoustic burst index
 */
export function extractFeatures(sensors: StationSensors, baseline: StationSensors) {
  const vibRatio = sensors.vibrationRms / Math.max(0.1, baseline.vibrationRms);
  const crestFactor = sensors.vibrationPeak / Math.max(0.1, sensors.vibrationRms);
  const tempDelta = sensors.temperature - baseline.temperature;
  const currentRatio = sensors.motorCurrent / Math.max(0.1, baseline.motorCurrent);
  const aeRatio = sensors.acousticEmission / Math.max(0.1, baseline.acousticEmission);
  const toolWear = sensors.toolWearIndex;
  const tensionDelta = (baseline.conveyorTension ?? 450) - (sensors.conveyorTension ?? 450);

  return {
    vibRatio,
    crestFactor,
    tempDelta,
    currentRatio,
    aeRatio,
    toolWear,
    tensionDelta,
  };
}

/**
 * Model 1: Isolation Forest & Mahalanobis Distance Emulator
 * Best suited for: Unsupervised anomaly detection when failure labeled data is scarce.
 * Outputs normalized anomaly score between 0.0 (strictly nominal) and 1.0 (severe outlier).
 */
export function calculateIsolationForestScore(
  sensors: StationSensors,
  baseline: StationSensors
): number {
  const feats = extractFeatures(sensors, baseline);

  // Multivariate squared normalized Mahalanobis distance proxy
  const vibZ = Math.max(0, (feats.vibRatio - 1.0) / 0.8);
  const tempZ = Math.max(0, feats.tempDelta / 12.0);
  const currZ = Math.max(0, Math.abs(feats.currentRatio - 1.0) / 0.35);
  const aeZ = Math.max(0, (feats.aeRatio - 1.0) / 1.1);
  const wearZ = Math.max(0, feats.toolWear / 0.25);
  const tensionZ = Math.max(0, Math.abs(feats.tensionDelta) / 80.0);

  const mahalanobisDist = Math.sqrt(
    vibZ * vibZ * 1.5 +
    tempZ * tempZ * 1.3 +
    currZ * currZ * 1.1 +
    aeZ * aeZ * 1.2 +
    wearZ * wearZ * 1.8 +
    tensionZ * tensionZ * 1.2
  );

  // Sigmoidal calibration to [0, 1] range: 0.5 threshold represents anomaly alert
  const score = 1 / (1 + Math.exp(-1.4 * (mahalanobisDist - 2.2)));
  return Math.min(1.0, Math.max(0.0, Number(score.toFixed(3))));
}

/**
 * Model 2: Deep Autoencoder Reconstruction Error Emulator
 * Best suited for: Multichannel temporal sensor stream validation.
 * Healthy operating patterns have low reconstruction MSE (<0.08). Unseen harmonics spike error.
 */
export function calculateAutoencoderError(
  sensors: StationSensors,
  baseline: StationSensors
): number {
  const feats = extractFeatures(sensors, baseline);
  
  // Reconstruction error simulates non-linear bottleneck latent representation loss
  const vibLoss = Math.pow(Math.max(0, feats.vibRatio - 1.0), 2.2);
  const tempLoss = Math.pow(Math.max(0, feats.tempDelta / 15.0), 2.0);
  const currLoss = Math.pow(Math.abs(feats.currentRatio - 1.0), 2.1);
  const aeLoss = Math.pow(Math.max(0, feats.aeRatio - 1.0), 1.9);

  const mse = (vibLoss * 0.35 + tempLoss * 0.25 + currLoss * 0.2 + aeLoss * 0.2);
  return Math.min(2.5, Math.max(0.01, Number(mse.toFixed(3))));
}

/**
 * Model 3: Random Forest / Gradient Boosted Multi-Class Fault Classifier
 * Best suited for: Root-cause identification once an anomaly is triggered.
 */
export function classifyFailureMode(
  sensors: StationSensors,
  baseline: StationSensors,
  stationType: string
): {
  predictedClass: string;
  probability: number;
  contributingFeatures: { name: string; impact: number }[];
} {
  const feats = extractFeatures(sensors, baseline);

  // Specific heuristic scoring matching industrial physics
  const isConveyor = stationType.includes('transporter');
  const isCnc = stationType.includes('cnc');

  if (isConveyor && (feats.tensionDelta > 60 || sensors.conveyorTension! < 380)) {
    return {
      predictedClass: 'Belt Slippage & Tension Slack',
      probability: 0.94,
      contributingFeatures: [
        { name: 'Belt Tension Loss', impact: 0.65 },
        { name: 'Motor Drive Ripple', impact: 0.22 },
        { name: 'Roller Friction Temp', impact: 0.13 },
      ],
    };
  }

  if (isCnc && (feats.toolWear > 0.28 || (feats.aeRatio > 1.6 && feats.currentRatio > 1.3))) {
    return {
      predictedClass: 'Tool Flank Wear & Edge Chipping',
      probability: Math.min(0.98, 0.70 + feats.toolWear * 0.6),
      contributingFeatures: [
        { name: 'Acoustic Emission Burst', impact: 0.42 },
        { name: 'Spindle Cutting Torque', impact: 0.38 },
        { name: 'High-frequency Vibration', impact: 0.20 },
      ],
    };
  }

  if (feats.tempDelta > 20 && feats.currentRatio > 1.25) {
    return {
      predictedClass: 'Spindle Bearing Thermal Breakdown (Lubrication Starvation)',
      probability: 0.91,
      contributingFeatures: [
        { name: 'Spindle Temperature Rise', impact: 0.52 },
        { name: 'Frictional Motor Load', impact: 0.32 },
        { name: 'Viscosity Shearing', impact: 0.16 },
      ],
    };
  }

  if (sensors.vibrationRms > 4.5 || feats.crestFactor > 2.8) {
    return {
      predictedClass: 'Bearing Inner/Outer Race Spalling (ISO 10816 Alarm)',
      probability: 0.89,
      contributingFeatures: [
        { name: 'Vibration RMS Velocity', impact: 0.55 },
        { name: 'Impact Crest Factor', impact: 0.30 },
        { name: 'Bearing Pass Frequencies (BPFI)', impact: 0.15 },
      ],
    };
  }

  if (feats.currentRatio > 1.45) {
    return {
      predictedClass: 'Motor Stator Overcurrent & Phase Imbalance',
      probability: 0.86,
      contributingFeatures: [
        { name: 'Stator Phase Current', impact: 0.68 },
        { name: 'Thermal Dissipation Deficit', impact: 0.20 },
        { name: 'Torque Ripple', impact: 0.12 },
      ],
    };
  }

  return {
    predictedClass: 'Nominal Operating Condition',
    probability: 0.97,
    contributingFeatures: [
      { name: 'Vibration RMS within ISO 10816-3 Zone A', impact: 0.35 },
      { name: 'Operating Temperature Stable', impact: 0.35 },
      { name: 'Nominal Current Draw', impact: 0.30 },
    ],
  };
}

/**
 * Model 4: Weibull Hazard Rate & Remaining Useful Life (RUL) Regressor
 * Computes operating hours remaining before reaching catastrophic failure threshold.
 */
export function estimateRUL(
  anomalyScore: number,
  toolWearIndex: number,
  vibrationRms: number,
  isConveyor: boolean
): number {
  // Catastrophic failure thresholds:
  // Tool flank wear >= 0.35mm (ISO 3685 limit), vibration >= 7.0 mm/s (ISO 10816 Zone D), or severe anomaly >= 0.92
  if (toolWearIndex >= 0.35 || vibrationRms >= 7.0 || anomalyScore >= 0.92) {
    return 0.0;
  }

  if (anomalyScore < 0.25 && toolWearIndex < 0.15 && vibrationRms < 3.0) {
    // Healthy equipment: standard maintenance cycle (e.g. 180 to 240 operating hours)
    return Math.round(195 - anomalyScore * 80);
  }

  // Active degradation: exponential hazard degradation curve
  // RUL = NominalLife * (1 - AnomalyScore)^beta
  const beta = isConveyor ? 1.8 : 2.2;
  const baseLife = 85.0; // hours once anomaly detected
  const degradation = Math.max(
    anomalyScore,
    toolWearIndex / 0.35, // 0.35mm is critical tool wear limit
    (vibrationRms - 2.0) / 5.0
  );

  if (degradation >= 1.0) {
    return 0.0;
  }
  
  const rawRul = baseLife * Math.pow(Math.max(0.0, 1.0 - degradation), beta);
  return Number(Math.max(0.0, rawRul).toFixed(1));
}

/**
 * Generates prescriptive maintenance instructions based on ML diagnosis
 */
export function getPrescriptiveAction(
  predictedClass: string,
  rulHours: number,
  stationName: string
): string {
  if (predictedClass.includes('Tool Flank')) {
    return `Schedule carbide insert replacement on ${stationName}. Flank wear exceeded tolerance. Estimated window: ${rulHours} hrs before dimensional scrap occurs.`;
  }
  if (predictedClass.includes('Bearing')) {
    return `Perform precision vibration FFT spectrum inspection on ${stationName}. Check ISO 10816 Zone C alarm. Re-grease or swap deep-groove ball bearings within ${rulHours} hrs.`;
  }
  if (predictedClass.includes('Belt Slippage')) {
    return `Inspect conveyor drive motor on ${stationName}. Check optical tachometer slip & adjust take-up pulley tension to 450N. Window: ${rulHours} hrs.`;
  }
  if (predictedClass.includes('Thermal')) {
    return `Emergency coolant purge & oil circulation check on ${stationName}. Spindle bearing lubrication starved. Shut down if temperature exceeds 75°C.`;
  }
  if (predictedClass.includes('Motor')) {
    return `Perform Megger insulation resistance test & verify drive inverter current limits on ${stationName}.`;
  }
  return `Station operating normally. Continue scheduled predictive monitoring. Next routine inspection in ${rulHours} hrs.`;
}

/**
 * Full Pipeline: Ingests raw sensors and outputs consolidated ML inference
 */
export function runPredictivePipeline(
  sensors: StationSensors,
  stationType: string,
  stationName: string
): MLDetectionResult {
  const category = stationType.includes('cnc')
    ? 'cnc'
    : stationType.includes('transporter')
    ? 'transporter'
    : stationType.includes('assembly') || stationType.includes('packaging')
    ? 'assembly'
    : 'general';

  const baseline = NOMINAL_BASELINES[category];
  const isoScore = calculateIsolationForestScore(sensors, baseline);
  const aeError = calculateAutoencoderError(sensors, baseline);
  
  // Combined calibrated anomaly score
  const combinedScore = Math.min(1.0, isoScore * 0.65 + Math.min(1.0, aeError / 1.2) * 0.35);
  const isAnomaly = combinedScore >= 0.45;

  const classification = classifyFailureMode(sensors, baseline, stationType);
  const isConveyor = stationType.includes('transporter');
  const rulHours = estimateRUL(combinedScore, sensors.toolWearIndex || 0, sensors.vibrationRms, isConveyor);
  const prescriptiveAction = getPrescriptiveAction(classification.predictedClass, rulHours, stationName);

  return {
    anomalyScore: Number(combinedScore.toFixed(3)),
    isAnomaly,
    isolationForestScore: isoScore,
    autoencoderReconstructionError: aeError,
    predictedFailureClass: classification.predictedClass,
    predictedFailureProb: Number((classification.probability * 100).toFixed(1)),
    remainingUsefulLifeHours: rulHours,
    modelConfidence: Number((Math.min(99.4, 88 + (1 - combinedScore) * 10)).toFixed(1)),
    prescriptiveAction,
    contributingFeatures: classification.contributingFeatures,
  };
}

/**
 * Model Comparison Matrix Guide for Student & Mentor Documentation
 */
export interface MLModelSpec {
  name: string;
  category: 'Anomaly Detection' | 'Fault Classification' | 'Remaining Useful Life (RUL)';
  algorithm: string;
  suitabilityScore: number; // 1-10
  bestUsedFor: string;
  strengths: string[];
  limitations: string[];
  inputFeatures: string[];
  matlabToolboxEquivalent: string;
  pythonImplementation: string;
}

export const ML_MODELS_GUIDE: MLModelSpec[] = [
  {
    name: 'Isolation Forest (iForest)',
    category: 'Anomaly Detection',
    algorithm: 'Ensemble Partitioning Trees',
    suitabilityScore: 9.6,
    bestUsedFor: 'Unsupervised detection of rare anomalies across multi-sensor factory telemetry (vibration + current + temp).',
    strengths: [
      'Does not require labeled failure data (crucial in manufacturing where machines rarely break).',
      'Linear time complexity O(n); runs effortlessly on edge microcontrollers / Raspberry Pi / MATLAB.',
      'Handles multi-dimensional feature correlation without heavy normalization.',
    ],
    limitations: [
      'Cannot classify the exact failure root cause; only tells you an anomaly occurred.',
      'Sensitivity threshold must be tuned to avoid false alarms during normal load transitions.',
    ],
    inputFeatures: ['Vibration RMS', 'Spindle Temperature', 'Motor Current', 'Acoustic Emission'],
    matlabToolboxEquivalent: 'MATLAB Statistics and Machine Learning Toolbox: isolationForest()',
    pythonImplementation: 'sklearn.ensemble.IsolationForest(contamination=0.03, n_estimators=100)',
  },
  {
    name: 'Deep Autoencoders (Reconstruction Loss)',
    category: 'Anomaly Detection',
    algorithm: 'Deep Bottleneck Neural Network (MLP / Conv1D / LSTM)',
    suitabilityScore: 9.3,
    bestUsedFor: 'Continuous time-series sensor streams with complex cyclical vibrations and harmonic patterns.',
    strengths: [
      'Learns subtle non-linear physical interactions between feed rate, spindle RPM, and motor current.',
      'Reconstruction Mean Squared Error (MSE) provides a continuous, highly calibrated degradation index.',
      'Can process raw high-frequency accelerometer waveforms directly via 1D Convolutional Autoencoder.',
    ],
    limitations: [
      'Requires GPU or neural accelerator for training.',
      'Higher latency than tree-based models if deployed on low-cost microcontrollers.',
    ],
    inputFeatures: ['Vibration Time Series', 'Harmonic Fast Fourier Transform (FFT) Bins', 'Acoustic Emission Spectrogram'],
    matlabToolboxEquivalent: 'Deep Learning Toolbox: trainAutoencoder() or dlnetwork()',
    pythonImplementation: 'PyTorch / TensorFlow Keras: Sequential([Dense(32, activation="relu"), Dense(8), Dense(32), Dense(n)])',
  },
  {
    name: 'Random Forest & XGBoost Multi-Class',
    category: 'Fault Classification',
    algorithm: 'Gradient Boosted Decision Trees / Random Forest',
    suitabilityScore: 9.5,
    bestUsedFor: 'Pinpointing the exact physical defect (Bearing Spall vs Tool Wear vs Belt Slack vs Lubrication Loss).',
    strengths: [
      'Highest benchmark classification accuracy (>96%) on tabular sensor feature extractions.',
      'Feature importance ranking (SHAP values) explains why the model made a prediction (mentor requirement!).',
      'Extremely robust to outliers and missing sensor packets.',
    ],
    limitations: [
      'Requires historical training data containing labeled failure run-to-failure records (e.g. NASA C-MAPSS or IMS bearing dataset).',
    ],
    inputFeatures: ['Crest Factor', 'Kurtosis', 'Vibration RMS', 'Flank Wear Index', 'Belt Tension', 'Current THD'],
    matlabToolboxEquivalent: 'Statistics and Machine Learning Toolbox: TreeBagger() or fitcensemble()',
    pythonImplementation: 'xgboost.XGBClassifier(n_estimators=150, max_depth=6, learning_rate=0.05)',
  },
  {
    name: 'Weibull Proportional Hazards & Exponential RUL',
    category: 'Remaining Useful Life (RUL)',
    algorithm: 'Parametric Survival Analysis & Exponential Degradation Tracking',
    suitabilityScore: 9.1,
    bestUsedFor: 'Predicting hours/cycles until component reaches catastrophic failure boundary.',
    strengths: [
      'Gives maintenance teams a clear operational countdown (e.g., "14.2 hours remaining").',
      'Directly answers the fundamental question of predictive maintenance: "When should we shut down?"',
      'Provides confidence intervals (90% lower/upper bounds) for risk-averse aerospace/automotive parts.',
    ],
    limitations: [
      'Requires establishing critical safety thresholds (e.g. ISO 10816 Zone D threshold: 7.1 mm/s).',
    ],
    inputFeatures: ['Cumulative Operating Hours', 'Degradation Trajectory Slope', 'Temperature Stress Factor'],
    matlabToolboxEquivalent: 'Predictive Maintenance Toolbox: exponentialDegradationModel() & wblfit()',
    pythonImplementation: 'lifelines.WeibullFitter() or scipy.stats.weibull_min',
  },
];
