import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOMINAL_BASELINES,
  calculateIsolationForestScore,
  calculateAutoencoderError,
  classifyFailureMode,
  estimateRUL,
  runPredictivePipeline,
} from './predictiveModels';

test('Nominal sensor stream produces low anomaly score and normal classification', () => {
  const nominal = { ...NOMINAL_BASELINES.cnc };
  const ml = runPredictivePipeline(nominal, 'cnc_lathe', 'CNC Lathe Machine');

  assert.ok(ml.anomalyScore < 0.35, `Expected low anomaly score, got ${ml.anomalyScore}`);
  assert.equal(ml.isAnomaly, false);
  assert.equal(ml.predictedFailureClass, 'Nominal Operating Condition');
  assert.ok(ml.remainingUsefulLifeHours > 100);
});

test('High vibration and crest factor triggers Bearing Fault and ISO alert', () => {
  const faultyBearing = {
    ...NOMINAL_BASELINES.cnc,
    vibrationRms: 6.8, // Alarm level ISO 10816
    vibrationPeak: 20.4, // High crest factor > 3.0
    acousticEmission: 44.0,
  };
  const ml = runPredictivePipeline(faultyBearing, 'cnc_milling', 'CNC Milling Machine');

  assert.ok(ml.anomalyScore >= 0.45);
  assert.equal(ml.isAnomaly, true);
  assert.ok(ml.predictedFailureClass.includes('Bearing'));
  assert.ok(ml.remainingUsefulLifeHours < 40);
  assert.ok(ml.prescriptiveAction.includes('bearing'));
});

test('Conveyor tension loss classifies Belt Slippage', () => {
  const faultyBelt = {
    ...NOMINAL_BASELINES.transporter,
    conveyorTension: 270, // Dropped from 450
    vibrationRms: 3.8,
  };
  const ml = runPredictivePipeline(faultyBelt, 'transporter', 'Transporter RM2');

  assert.ok(ml.predictedFailureClass.includes('Belt Slippage'));
  assert.ok(ml.prescriptiveAction.includes('tension'));
});
