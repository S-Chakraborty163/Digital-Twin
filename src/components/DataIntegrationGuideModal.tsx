import React, { useState } from 'react';
import {
  X,
  Code,
  Network,
  Cpu,
  BookOpen,
  Send,
  CheckCircle2,
  Copy,
  Terminal,
  Zap,
  Layers,
  ArrowRight,
  Database,
  Radio,
} from 'lucide-react';
import { ML_MODELS_GUIDE } from '../ml/predictiveModels';

interface DataIntegrationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectExternalTelemetry: (payload: any) => void;
}

export const DataIntegrationGuideModal: React.FC<DataIntegrationGuideModalProps> = ({
  isOpen,
  onClose,
  onInjectExternalTelemetry,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'matlab_code' | 'ml_models' | 'stream_tester' | 'defense_guide'>('architecture');
  const [copiedCode, setCopiedCode] = useState(false);
  const [testPayload, setTestPayload] = useState(
    JSON.stringify(
      {
        stationId: 'cnc_lathe',
        timestamp: Date.now(),
        sensors: {
          vibrationRms: 5.8,
          temperature: 68.5,
          motorCurrent: 18.2,
          acousticEmission: 42.0,
          toolWearIndex: 0.38,
        },
        event: 'ENTITY_ENTRY',
        entityId: 'SIM-9921',
      },
      null,
      2
    )
  );
  const [testStatus, setTestStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const matlabSimEventsCode = `% =========================================================================
% MATLAB / SimEvents Callback Code for AeroTwin Digital Twin Ingestion
% Add this inside your SimEvents Server block "Entry Action" or "Exit Action"
% =========================================================================

function onEntityEntry(entity, time, blockHandle)
    % 1. Extract SimEvents simulation metadata
    stationTag = get_param(blockHandle, 'Name'); % e.g. 'CNC LATHE'
    entityID   = entity.ID;
    
    % 2. Synthesize physical sensor readings from machine model or Scope
    % (In a Hardware-in-the-loop or Simscape environment, bind physical signals)
    vibSignal   = evalin('base', 'getVibrationReading()');   % mm/s RMS
    tempSignal  = evalin('base', 'getSpindleTemp()');         % Celsius
    currSignal  = evalin('base', 'getSpindleCurrent()');      % Amperes
    
    % 3. Assemble JSON Payload
    payload = struct();
    payload.stationId = sanitizeTag(stationTag);
    payload.timestamp = time;
    payload.sensors   = struct('vibrationRms', vibSignal, ...
                               'temperature',  tempSignal, ...
                               'motorCurrent', currSignal);
    payload.event     = 'ENTITY_ENTRY';
    payload.entityId  = num2str(entityID);
    
    jsonStr = jsonencode(payload);
    
    % 4. Stream to Digital Twin Dashboard via TCP Socket or HTTP REST
    try
        % Option A: Stream via WebSockets / HTTP
        options = weboptions('MediaType', 'application/json', 'Timeout', 0.05);
        webwrite('http://localhost:3000/api/telemetry/stream', jsonStr, options);
    catch ME
        % Non-blocking fallback to avoid stalling SimEvents solver
        disp(['Streaming packet sent: ', jsonStr]);
    end
end`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendTestPayload = () => {
    try {
      const parsed = JSON.parse(testPayload);
      onInjectExternalTelemetry(parsed);
      setTestStatus('Payload injected successfully into live Digital Twin state!');
      setTimeout(() => setTestStatus(null), 3500);
    } catch (e: any) {
      setTestStatus(`JSON parsing error: ${e.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Digital Twin Ingestion & Machine Learning Engineering Blueprint
              </h2>
              <p className="text-xs text-slate-400">
                End-to-end guidance for integrating MATLAB / SimEvents streams, ML model selection, and technical review.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close guide modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2">
          {[
            { id: 'architecture', label: 'Ingestion Architecture', icon: Network },
            { id: 'matlab_code', label: 'Simulink / MATLAB Code', icon: Code },
            { id: 'ml_models', label: 'ML Models Comparison', icon: Cpu },
            { id: 'stream_tester', label: 'Live Stream Ingestion Tester', icon: Radio },
            { id: 'defense_guide', label: 'Technical Review Q&A', icon: CheckCircle2 },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-slate-800/40'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-300 space-y-4">
          {/* TAB 1: ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="text-sm font-bold text-cyan-300 mb-2 flex items-center gap-2">
                  <Network className="w-4 h-4" />
                  How to Ingest Incoming Data Streams into Your Digital Twin
                </h3>
                <p className="leading-relaxed text-slate-300 mb-3">
                  In modern Industry 4.0 applications, discrete event simulation (Simulink SimEvents) or physical shop-floor IoT sensors transmit packets across four distinct operational layers:
                </p>

                {/* 4-Stage Pipeline Diagram */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-4">
                  <div className="bg-slate-900 p-3 rounded-lg border border-cyan-800/60 relative">
                    <div className="text-[10px] font-mono text-cyan-400 font-bold mb-1">STAGE 1: GENERATION</div>
                    <div className="font-bold text-white text-xs mb-1">Simulink / SimEvents</div>
                    <p className="text-[11px] text-slate-400">
                      Entity Generator & Server blocks produce discrete entity movement timestamps, queue counts, and scopes.
                    </p>
                    <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-cyan-400 w-4 h-4 z-10" />
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-indigo-800/60 relative">
                    <div className="text-[10px] font-mono text-indigo-400 font-bold mb-1">STAGE 2: PROTOCOL</div>
                    <div className="font-bold text-white text-xs mb-1">OPC-UA / MQTT / TCP</div>
                    <p className="text-[11px] text-slate-400">
                      Standard industrial publish-subscribe broker (Mosquitto or Eclipse Milo) multiplexes machine signals.
                    </p>
                    <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-indigo-400 w-4 h-4 z-10" />
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-emerald-800/60 relative">
                    <div className="text-[10px] font-mono text-emerald-400 font-bold mb-1">STAGE 3: FAST INGESTION</div>
                    <div className="font-bold text-white text-xs mb-1">Edge Stream Engine</div>
                    <p className="text-[11px] text-slate-400">
                      Lightweight WebSocket proxy parses JSON telemetry, updates moving feature window, and triggers ML inference.
                    </p>
                    <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-emerald-400 w-4 h-4 z-10" />
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-purple-800/60">
                    <div className="text-[10px] font-mono text-purple-400 font-bold mb-1">STAGE 4: VISUALIZATION</div>
                    <div className="font-bold text-white text-xs mb-1">Digital Twin UI</div>
                    <p className="text-[11px] text-slate-400">
                      Smooth 60fps canvas interpolates conveyor item positions, displays live scopes, and presents OEE & RUL.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-800/40 text-[11px] leading-relaxed text-cyan-200">
                  <strong>Key Industrial Architecture Takeaway:</strong> You do NOT poll the database; instead, the dashboard utilizes an event-driven pub/sub architecture. Discrete entity events update queue states instantly, while high-frequency continuous vibration and thermal signals stream into a rolling 30-sample ring buffer.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATLAB CODE */}
          {activeTab === 'matlab_code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    MATLAB / SimEvents Streaming S-Function Callback
                  </h3>
                  <p className="text-xs text-slate-400">
                    Place this code into the Block Properties → Event Actions tab of your SimEvents Server & Transporter blocks.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(matlabSimEventsCode)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedCode ? 'Copied to Clipboard!' : 'Copy MATLAB Script'}
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed">
                <pre>{matlabSimEventsCode}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: ML MODELS MATRIX */}
          {activeTab === 'ml_models' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-1">
                  Machine Learning Model Selection Matrix for Discrete Manufacturing
                </h3>
                <p className="text-slate-400 text-xs mb-3">
                  This comparison matrix directly addresses which machine learning models best suit failure detection and why:
                </p>

                <div className="space-y-3">
                  {ML_MODELS_GUIDE.map((model, idx) => (
                    <div key={idx} className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-300 text-sm">{model.name}</span>
                          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-medium">
                            {model.category}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          Suitability: {model.suitabilityScore} / 10
                        </span>
                      </div>

                      <p className="text-slate-300 text-xs mb-2">
                        <strong>Primary Role:</strong> {model.bestUsedFor}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] mt-2 pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-emerald-400 font-semibold block mb-0.5">Strengths:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                            {model.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-cyan-400 font-semibold block mb-0.5">Toolbox / Implementation:</span>
                          <div className="font-mono text-[10px] text-slate-300 bg-slate-950 p-1.5 rounded border border-slate-800">
                            {model.matlabToolboxEquivalent}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STREAM TESTER */}
          {activeTab === 'stream_tester' && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  Live Ingestion Payload Injector
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Simulate an external packet being streamed into the Digital Twin from your MATLAB script or IoT gateway.
                </p>

                <div className="mb-3">
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    JSON Telemetry Packet (editable):
                  </label>
                  <textarea
                    rows={8}
                    value={testPayload}
                    onChange={e => setTestPayload(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 font-mono text-[11px] text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={handleSendTestPayload}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Inject Packet into Live Digital Twin
                  </button>

                  {testStatus && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {testStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MENTOR DEFENSE Q&A */}
          {activeTab === 'defense_guide' && (
            <div className="space-y-3">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Key Answers for Technical Review & Plant Twin Defense
                </h3>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="font-bold text-cyan-300 text-xs mb-1">
                    Q1: "Why do we need Machine Learning for failure detection instead of simple high/low threshold alarms?"
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    Threshold alarms only ring when a machine has already sustained severe damage (e.g., vibration &gt; 7.1 mm/s after bearing race has cracked).
                    Machine Learning models like <strong>Isolation Forests</strong> and <strong>Autoencoders</strong> detect subtle multivariate correlations (e.g. slight spindle friction rise combined with 0.2A current increase) hours or days before failure occurs, enabling true <em>predictive</em> rather than <em>reactive</em> intervention.
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="font-bold text-indigo-300 text-xs mb-1">
                    Q2: "How does the Digital Twin handle the synchronization between SimEvents discrete steps and continuous conveyor animations?"
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    The engine decouples discrete event transitions (entity arrival, machine seizure, FIFO queue handoffs) from continuous frame interpolation.
                    Between discrete state changes, the rendering layer computes smooth position ratios p(t) = p0 + (t - t0) / T_nominal at 60 FPS, providing fluid conveyor belt animation without degrading simulation accuracy.
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="font-bold text-emerald-300 text-xs mb-1">
                    Q3: "How does the Digital Twin optimize operations on the factory floor?"
                  </div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    By calculating real-time <strong>Overall Equipment Effectiveness (OEE)</strong>, identifying dynamic bottleneck stations (utilization &gt; 85%), and recommending line balancing adjustments across the 3 raw material intake streams so that Final Assembly never starves or experiences excessive work-in-progress (WIP).
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>AeroTwin Industrial IoT Reference Architecture v2.4</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
