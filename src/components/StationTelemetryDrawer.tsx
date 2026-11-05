import React, { useState } from 'react';
import { Station, FaultType, ItemEntity } from '../types/factory';
import {
  X,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Thermometer,
  Zap,
  Gauge,
  Flame,
  Clock,
  Sparkles,
  RefreshCw,
  Layers,
  ShieldCheck,
  Package,
  Truck,
  TrendingUp,
  Cpu,
  Info,
  Square,
  Play,
  Users,
  HardHat,
  Anchor,
  FileText,
} from 'lucide-react';

interface StationTelemetryDrawerProps {
  station: Station | null;
  entities?: ItemEntity[];
  onClose: () => void;
  onInjectFault: (stationId: string, fault: FaultType) => void;
  onRepair: (stationId: string) => void;
  onToggleManualStop?: (stationId: string) => void;
  onOpenQCSubsystem?: (stationId: string) => void;
}

export const StationTelemetryDrawer: React.FC<StationTelemetryDrawerProps> = ({
  station,
  entities = [],
  onClose,
  onInjectFault,
  onRepair,
  onToggleManualStop,
  onOpenQCSubsystem,
}) => {
  const [selectedSensorTab, setSelectedSensorTab] = useState<'all' | 'vibration' | 'temperature' | 'current' | 'acoustic'>('all');

  if (!station) return null;

  const isCnc = station.type.includes('cnc');
  const isConveyor = station.type.includes('transporter');
  const isTruckOrUnload = station.type.includes('truck');
  const isQueue = station.isQueue;
  const isQc = station.type === 'quality_control';
  const isAssembly = station.type === 'final_assembly';
  const isPackaging = station.type === 'packaging' || station.type === 'sink_dispatch';

  const ml = station.mlResult;
  const history = station.history || [];

  // Entities currently located at or being handled by this station
  const stationEntities = entities.filter(
    e => e.currentStationId === station.id || (isConveyor && e.currentStationId === station.id)
  );

  // Sensor plot bounds helper
  const maxVib = Math.max(8.0, ...history.map(h => h.vibrationRms));
  const maxTemp = Math.max(85, ...history.map(h => h.temperature));
  const maxCurrent = Math.max(25, ...history.map(h => h.motorCurrent));

  // Determine whether this fault is a critical stoppage or early predictive advisory
  const isWearAdvisory =
    station.activeFault === 'TOOL_FLANK_WEAR' && (station.sensors.toolWearIndex ?? 0) < 0.35;
  const isMaintenanceRequired = station.status === 'MAINTENANCE_REQUIRED';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 shadow-2xl flex flex-col text-slate-100 animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              isMaintenanceRequired
                ? 'bg-rose-500 animate-ping'
                : isWearAdvisory
                ? 'bg-amber-400 animate-pulse'
                : station.status === 'LUNCH_BREAK'
                ? 'bg-amber-300'
                : station.status === 'BUSY'
                ? 'bg-cyan-400'
                : 'bg-emerald-400'
            }`}
          />
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              {station.name}
              <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                {station.simulinkTag}
              </span>
            </h2>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>
                Line: <strong className="text-slate-200">{station.line}</strong>
              </span>
              <span>•</span>
              <span>
                Status:{' '}
                <span
                  className={`font-semibold ${
                    isMaintenanceRequired
                      ? 'text-rose-400'
                      : isWearAdvisory
                      ? 'text-amber-300'
                      : station.status === 'LUNCH_BREAK'
                      ? 'text-amber-400'
                      : station.status === 'BUSY'
                      ? 'text-cyan-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {station.status === 'LUNCH_BREAK'
                    ? 'LUNCH BREAK (STANDBY)'
                    : isWearAdvisory
                    ? 'PREDICTIVE ADVISORY (MONITORED)'
                    : station.status}
                </span>
              </span>
            </div>
          </div>
        </div>

          <div className="flex items-center gap-2">
            {onToggleManualStop && (
              <button
                onClick={() => onToggleManualStop(station.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow ${
                  station.isManuallyStopped
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40'
                    : 'bg-rose-700 hover:bg-rose-600 text-white border border-rose-500/40'
                }`}
                title={
                  station.isManuallyStopped
                    ? 'Resume operation for this component'
                    : 'Stop this component immediately (Manual Operator E-Stop)'
                }
              >
                {station.isManuallyStopped ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume Component</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Component</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close telemetry drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Manually Stopped Notice */}
          {station.isManuallyStopped && (
            <div className="p-3 bg-rose-950/80 border border-rose-600 rounded-xl flex items-center justify-between text-xs text-rose-200 shadow-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
                <div>
                  <strong className="text-white block font-bold">COMPONENT MANUALLY STOPPED</strong>
                  <p className="text-[11px] text-rose-300">
                    Operation has been halted by the operator. Workpiece processing and conveyor transfer are frozen until resumed.
                  </p>
                </div>
              </div>
              {onToggleManualStop && (
                <button
                  onClick={() => onToggleManualStop(station.id)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs shrink-0 transition"
                >
                  Resume Now
                </button>
              )}
            </div>
          )}
        {/* ENTITY TELEMETRY & WORK-IN-PROGRESS TRACKER */}
        <div className="bg-slate-900/90 border border-cyan-900/50 rounded-xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wide">
              <Layers className="w-4 h-4 text-cyan-400" />
              Complete Entity Telemetry & Counts
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
              Live Station Flow
            </span>
          </div>

          {/* 4 Essential Entity Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400">P: Currently Processing</div>
              <div className="text-xl font-bold font-mono text-cyan-300">
                {station.currentlyProcessingCount}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">active in cycle</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400">Q: Holding in Queue</div>
              <div className="text-xl font-bold font-mono text-amber-300">
                {station.currentQueueCount}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">
                {station.maxQueueCapacity ? `cap: ${station.maxQueueCapacity}` : 'staging buffer'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400">D: Processed Today</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {station.processedToday}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">shift units</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400">C: Cumulative Count</div>
              <div className="text-xl font-bold font-mono text-purple-300">
                {station.processedCumulative}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">all-time processed</div>
            </div>
          </div>

          {/* Active Work-In-Progress Entity Detail */}
          <div className="pt-2">
            <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Active Entities at Station ({stationEntities.length}):</span>
              {station.processingTimeRemaining > 0 && (
                <span className="text-[10px] font-mono text-cyan-400">
                  Time Remaining: {station.processingTimeRemaining.toFixed(1)}s
                </span>
              )}
            </div>

            {stationEntities.length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {stationEntities.map(ent => (
                  <div
                    key={ent.id}
                    className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-cyan-300">{ent.code}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                        {ent.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      {isConveyor ? (
                        <span className="text-cyan-400 font-mono">
                          Conveyor Transit: {(ent.positionRatio * 100).toFixed(0)}%
                        </span>
                      ) : ent.isProcessing ? (
                        <span className="text-amber-300 flex items-center gap-1 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          Machining
                        </span>
                      ) : (
                        <span className="text-emerald-400">Queued in Buffer</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-950/50 rounded-lg border border-dashed border-slate-800 text-center text-xs text-slate-500">
                No raw materials or parts currently queued at this workstation
              </div>
            )}
          </div>
        </div>

        {/* TRUCK LOGISTICS & UNLOADING TELEMETRY (When clicked on Truck inflow or unloading block) */}
        {isTruckOrUnload && (
          <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-950 border border-blue-500/40 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-blue-900/50 pb-2.5">
              <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5 uppercase tracking-wide">
                <Truck className="w-4 h-4 text-blue-400" />
                Dock Logistics & Unloading Subsystem Telemetry
              </span>
              <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-mono font-bold">
                Berth Bay: {station.line === 'RM1' ? 'Bay 1 (Bar Stock)' : station.line === 'RM2' ? 'Bay 2 (Castings)' : 'Bay 3 (Gear Blanks)'}
              </span>
            </div>

            {/* 1. Unloading Handling Equipment (Forklift vs Crane Gantry) */}
            <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {station.line === 'RM1'
                      ? 'Overhead Gantry Hoist & Crane System (Class CMAA-D)'
                      : 'Electric Counterbalance Forklift (Toyota Traigo 48V #04)'}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                  Equipment Nominal
                </span>
              </div>

              {station.line === 'RM1' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Hoist Cable Tension</span>
                    <strong className="text-cyan-300 font-mono text-xs">2,450 kgf</strong>
                    <span className="text-[9px] text-slate-500 block">Rated: 5,000 kgf</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Gantry Traverse Speed</span>
                    <strong className="text-emerald-300 font-mono text-xs">0.75 m/s</strong>
                    <span className="text-[9px] text-slate-500 block">Variable VFD</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Motor Temp</span>
                    <strong className="text-amber-300 font-mono text-xs">48.2 °C</strong>
                    <span className="text-[9px] text-slate-500 block">Thermal limit 85°C</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Cable Fatigue Life</span>
                    <strong className="text-purple-300 font-mono text-xs">94.8%</strong>
                    <span className="text-[9px] text-slate-500 block">NDT Verified</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Hydraulic Pressure</span>
                    <strong className="text-cyan-300 font-mono text-xs">148 bar</strong>
                    <span className="text-[9px] text-slate-500 block">Spec: 140-160 bar</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Battery Charge</span>
                    <strong className="text-emerald-300 font-mono text-xs">88% Li-Ion</strong>
                    <span className="text-[9px] text-slate-500 block">Fast-charge dock</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Mast Tilt Angle</span>
                    <strong className="text-amber-300 font-mono text-xs">+2.4° Rake</strong>
                    <span className="text-[9px] text-slate-500 block">Pallet lock safe</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Dock Speed Telemetry</span>
                    <strong className="text-purple-300 font-mono text-xs">5.2 km/h</strong>
                    <span className="text-[9px] text-slate-500 block">Governed speed</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Dock Handling Personnel & Crew Details */}
            <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Dock Operations Crew & Rigging Personnel</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  Crew Size: 3 Personnel
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Shift Supervisor</div>
                  <div className="font-bold text-slate-200">Marcus Vance</div>
                  <div className="text-[9px] text-cyan-400 font-mono mt-0.5">Cert: OSHA #4088-A</div>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Lead Equipment Operator</div>
                  <div className="font-bold text-slate-200">
                    {station.line === 'RM1' ? 'Leo Sterling (Crane Lead)' : 'T. Henderson (Forklift #4)'}
                  </div>
                  <div className="text-[9px] text-emerald-400 font-mono mt-0.5">Lic: Heavy ISO Class 4</div>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Safety & PPE Compliance</div>
                  <div className="font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>100% Compliant</span>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">Steel-Toe, Hardhat, Vis</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Crew Fatigue Index: <strong className="text-slate-200">12% (Rest Satisfactory)</strong></span>
                <span>Active Shift Elapsed: <strong className="text-cyan-300">1.2h / 8.0h</strong></span>
              </div>
            </div>

            {/* 3. Cargo Manifest & Metallurgy Telemetry */}
            <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cargo Manifest & Metallurgical Lot Specification</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  BoL: #BOL-2026-AERO-772{station.line === 'RM1' ? '1' : station.line === 'RM2' ? '2' : '3'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Alloy Material Grade</span>
                  <strong className="text-white block font-sans">
                    {station.line === 'RM1'
                      ? 'Ti-6Al-4V Grade 5 (Aero Bar Stock)'
                      : station.line === 'RM2'
                      ? 'Cast A356-T6 Aluminum (Gearbox Housings)'
                      : 'AISI 9310 Carburizing Alloy (Gear Blanks)'}
                  </strong>
                  <span className="text-[9px] text-cyan-400 font-mono">
                    Heat Lot: #{station.line === 'RM1' ? 'TH-9021-B' : station.line === 'RM2' ? 'AL-4482-C' : 'ST-1189-X'}
                  </span>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Trailer Payload Balance</span>
                  <div className="flex justify-between items-baseline mt-0.5">
                    <span className="text-emerald-400 font-bold font-mono">
                      {station.processedToday} unloaded
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {Math.max(0, 120 - station.processedToday)} left
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (station.processedToday / 120) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <span>Arrival Adherence: <strong className="text-emerald-400">On-Time Berth (+8s variance)</strong></span>
                <span>Dock Restraint: <strong className="text-cyan-300">Hydraulic Lip & Wheel Chock Interlocked</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* QC Subsystem Drill-Down Card (Only for Quality Control stations) */}
        {station.type === 'quality_control' && (
          <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Simulink Subsystem Interior
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                FPY: {station.qcSubsystem?.firstPassYield ?? 87.5}%
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Internal 3-stage inspection subsystem: <strong>CHECK I (Gate)</strong>, <strong>CHECK II (Triage)</strong>, <strong>REWORK Server</strong>, and <strong>CHECK III</strong>.
            </p>
            <button
              onClick={() => onOpenQCSubsystem && onOpenQCSubsystem(station.id)}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition"
            >
              <span>View QC Subsystem & Rework Circuit (Check I - III)</span>
              <span className="text-emerald-200">→</span>
            </button>
          </div>
        )}

        {/* ML Predictive Maintenance Alert Card */}
        <div
          className={`rounded-xl p-4 border transition-all ${
            isMaintenanceRequired
              ? 'bg-rose-950/40 border-rose-800/80 text-rose-100 shadow-lg shadow-rose-950/30'
              : isWearAdvisory
              ? 'bg-amber-950/40 border-amber-800/80 text-amber-100 shadow-lg shadow-amber-950/20'
              : 'bg-slate-900/80 border-slate-800 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              {isMaintenanceRequired ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
              ) : isWearAdvisory ? (
                <Info className="w-4 h-4 text-amber-400 animate-pulse" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              {isMaintenanceRequired
                ? 'Equipment Maintenance Required'
                : isWearAdvisory
                ? 'Predictive Wear Advisory (Machine Monitored)'
                : 'ML Model Health Assessment'}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                isMaintenanceRequired
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : isWearAdvisory
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              Score: {(ml.anomalyScore * 100).toFixed(0)}% Anomaly Index
            </span>
          </div>

          <div className="text-base font-bold text-white mb-1">
            {ml.predictedFailureClass}
          </div>

          <div className="text-xs leading-relaxed text-slate-300 mb-3 bg-black/30 p-2.5 rounded-lg border border-white/5">
            <strong className="text-cyan-300">Prescriptive Action:</strong>{' '}
            {isWearAdvisory
              ? `Flank wear VB = ${(station.sensors.toolWearIndex ?? 0).toFixed(3)} mm detected by ML. Below ISO critical limit (0.35 mm). Machine remains in operation. Schedule carbide insert rotation at next shift lunch break.`
              : ml.prescriptiveAction}
          </div>

          {/* RUL & Confidence Row */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/10">
            <div>
              <div className="text-slate-400 text-[11px] flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Remaining Useful Life (RUL)
              </div>
              <div
                className={`text-lg font-bold font-mono ${
                  ml.remainingUsefulLifeHours < 24 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {ml.remainingUsefulLifeHours}{' '}
                <span className="text-xs font-normal text-slate-300">operating hrs</span>
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-[11px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Model Confidence (RF / XGB)
              </div>
              <div className="text-lg font-bold font-mono text-cyan-300">
                {ml.predictedFailureProb}%
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Oscilloscope Multi-Trace Sensor Stream */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Real-Time Telemetry Stream
              </h3>
              <p className="text-[11px] text-slate-400">
                Continuous high-frequency vibration, temperature, current, and acoustic sensor feed
              </p>
            </div>

            {/* Tab filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              {(['all', 'vibration', 'temperature', 'current'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedSensorTab(tab)}
                  className={`px-2 py-0.5 rounded capitalize transition ${
                    selectedSensorTab === tab
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Multi-Trace Graph */}
          <div className="h-36 w-full bg-slate-950 rounded-lg p-2 border border-slate-800/80 relative overflow-hidden">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              {/* Vibration line (cyan) */}
              {(selectedSensorTab === 'all' || selectedSensorTab === 'vibration') && history.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  points={history
                    .map((h, idx) => {
                      const x = Number(((idx / (history.length - 1)) * 100).toFixed(1));
                      const y = Number((100 - (h.vibrationRms / maxVib) * 90).toFixed(1));
                      return `${x},${Math.max(5, Math.min(95, y))}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Temperature line (amber) */}
              {(selectedSensorTab === 'all' || selectedSensorTab === 'temperature') && history.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  points={history
                    .map((h, idx) => {
                      const x = Number(((idx / (history.length - 1)) * 100).toFixed(1));
                      const y = Number((100 - ((h.temperature - 20) / (maxTemp - 20)) * 90).toFixed(1));
                      return `${x},${Math.max(5, Math.min(95, y))}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Motor Current line (indigo) */}
              {(selectedSensorTab === 'all' || selectedSensorTab === 'current') && history.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  points={history
                    .map((h, idx) => {
                      const x = Number(((idx / (history.length - 1)) * 100).toFixed(1));
                      const y = Number((100 - (h.motorCurrent / maxCurrent) * 90).toFixed(1));
                      return `${x},${Math.max(5, Math.min(95, y))}`;
                    })
                    .join(' ')}
                />
              )}
            </svg>

            {/* Live Values Legend Overlay */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 text-[10px] bg-slate-900/90 p-2 rounded border border-slate-800 shadow">
              <span className="flex items-center gap-1.5 text-cyan-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Vibration: {station.sensors.vibrationRms.toFixed(2)} mm/s
              </span>
              <span className="flex items-center gap-1.5 text-amber-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Temperature: {station.sensors.temperature.toFixed(1)} °C
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Current: {station.sensors.motorCurrent.toFixed(1)} A
              </span>
            </div>
          </div>

          {/* Current Values 4-Tile Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Vibration Velocity</div>
              <div className="text-base font-bold font-mono text-cyan-300">
                {station.sensors.vibrationRms.toFixed(2)} <span className="text-[10px] text-slate-400">mm/s</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">ISO 10816 Zone A/B</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Spindle/Bearing Temp</div>
              <div
                className={`text-base font-bold font-mono ${
                  station.sensors.temperature > 65 ? 'text-rose-400' : 'text-amber-300'
                }`}
              >
                {station.sensors.temperature.toFixed(1)} <span className="text-[10px] text-slate-400">°C</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Threshold: 75°C</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Motor Load Current</div>
              <div className="text-base font-bold font-mono text-indigo-300">
                {station.sensors.motorCurrent.toFixed(1)} <span className="text-[10px] text-slate-400">A</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Torque proportional</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
              <div className="text-[10px] text-slate-400">Acoustic Emission</div>
              <div className="text-base font-bold font-mono text-emerald-300">
                {station.sensors.acousticEmission.toFixed(1)} <span className="text-[10px] text-slate-400">kHz</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Micro-crack sensor</div>
            </div>
          </div>
        </div>

        {/* STATION-SPECIFIC REALISTIC FAULT INJECTION LABORATORY */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-amber-400" />
              Station-Relevant Failure Modes & Diagnostics
            </h3>
            {station.activeFault !== 'NONE' && (
              <button
                onClick={() => onRepair(station.id)}
                className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1.5 shadow transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Clear / Recalibrate
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Simulate realistic physical failure modes strictly specific to this component:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* CNC MACHINING WORKSTATIONS */}
            {isCnc && (
              <>
                <button
                  onClick={() => onInjectFault(station.id, 'TOOL_FLANK_WEAR')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'TOOL_FLANK_WEAR'
                      ? 'bg-amber-950/80 border-amber-600 text-amber-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    +0.06mm Tool Flank Wear (VB)
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Progressive cutting wear. Flags predictive advisory; stays operational until 0.35mm.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'SPINDLE_BEARING_VIBRATION')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'SPINDLE_BEARING_VIBRATION'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                    Spindle Bearing Spall
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Triggers ISO 10816 Zone C/D alarm (vibration &gt; 7 mm/s).
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'SPINDLE_THERMAL_EXPANSION')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'SPINDLE_THERMAL_EXPANSION'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    Coolant Starvation & Thermal Drift
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Frictional heating causes dimensional tolerance deviation.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'CHIP_CONVEYOR_CLOG')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'CHIP_CONVEYOR_CLOG'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    Chip Conveyor Jam
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Swarf build-up causing drive motor current spike.
                  </div>
                </button>
              </>
            )}

            {/* CONVEYORS / TRANSPORTERS */}
            {isConveyor && (
              <>
                <button
                  onClick={() => onInjectFault(station.id, 'BELT_SLIP_AND_TENSION_LOSS')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'BELT_SLIP_AND_TENSION_LOSS'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-blue-400" />
                    Conveyor Belt Slip (Slackness)
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Drops tension to 260N, slowing down unit transit pace.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'ROLLER_BEARING_OVERHEAT')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'ROLLER_BEARING_OVERHEAT'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    Roller Pillow-Block Heat
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Bearing lubrication starvation on head pulley roller.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'CONVEYOR_MOTOR_OVERLOAD')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'CONVEYOR_MOTOR_OVERLOAD'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-yellow-400" />
                    Conveyor Drive Motor Overload
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Mechanical jam spiking current to 18.5 Amperes.
                  </div>
                </button>
              </>
            )}

            {/* TRUCKS & UNLOADING */}
            {isTruckOrUnload && (
              <>
                <button
                  onClick={() => onInjectFault(station.id, 'TRUCK_ARRIVAL_DELAY')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'TRUCK_ARRIVAL_DELAY'
                      ? 'bg-amber-950 border-amber-600 text-amber-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-400" />
                    Delivery Traffic Congestion
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Highway delay setting back raw material arrival window.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'PALLET_UNLOADING_JAM')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'PALLET_UNLOADING_JAM'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    Gantry Hoist Mechanical Jam
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Pallet strapping entanglement on unloading bay.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'WORKER_FATIGUE_DELAY')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'WORKER_FATIGUE_DELAY'
                      ? 'bg-amber-950 border-amber-600 text-amber-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    Crew Fatigue Slowdown
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Barehand handling slowdown from ergonomic fatigue.
                  </div>
                </button>
              </>
            )}

            {/* INVENTORY & BUFFERS */}
            {isQueue && (
              <>
                <button
                  onClick={() => onInjectFault(station.id, 'RACK_OVERFLOW_WARNING')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'RACK_OVERFLOW_WARNING'
                      ? 'bg-amber-950 border-amber-600 text-amber-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    Buffer Capacity Warning
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Staging queue approaching maximum buffer threshold.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'STORAGE_HUMIDITY_EXCURSION')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'STORAGE_HUMIDITY_EXCURSION'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                    Humidity / Corrosion Alert
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Environmental sensor rust warning on exposed alloy steel stock.
                  </div>
                </button>
              </>
            )}

            {/* QUALITY CONTROL */}
            {isQc && (
              <>
                <button
                  onClick={() => onInjectFault(station.id, 'OPTICAL_LENS_FOULED')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'OPTICAL_LENS_FOULED'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Laser Micrometer Lens Fouled
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Coolant mist causes false dimensional rejection spikes.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'GAUGE_CALIBRATION_DRIFT')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'GAUGE_CALIBRATION_DRIFT'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    Stylus Calibration Offset
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Coordinate measuring zero-point offset error.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'PROBE_ACTUATOR_RESPONSE_LAG')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'PROBE_ACTUATOR_RESPONSE_LAG'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    CMM Probe Bottleneck Delay
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Actuator response lag halts gate; upstream buffer accumulates FIFO queue.
                  </div>
                </button>
              </>
            )}

            {/* FINAL ASSEMBLY */}
            {isAssembly && (
              <>
                <button
                  onClick={() => onInjectFault(station.id, 'TORQUE_DRIVER_OUT_OF_SPEC')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'TORQUE_DRIVER_OUT_OF_SPEC'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    Torque Driver Out of Spec
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Multi-spindle electric nutrunner torque drift.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'PNEUMATIC_PRESSURE_DROP')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'PNEUMATIC_PRESSURE_DROP'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-blue-400" />
                    Pneumatic Gripper Pressure Drop
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Air supply drops below 5.5 bar, causing part alignment pause.
                  </div>
                </button>
              </>
            )}

            {/* PACKAGING & DISPATCH */}
            {isPackaging && (
              <>
                <button
                  onClick={() => onInjectFault(station.id, 'SEALER_HEATER_ELEMENT_FAULT')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'SEALER_HEATER_ELEMENT_FAULT'
                      ? 'bg-rose-950 border-rose-600 text-rose-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    Carton Sealer Heating Element Fault
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Thermocouple failure causing adhesive temperature spike.
                  </div>
                </button>

                <button
                  onClick={() => onInjectFault(station.id, 'BARCODE_SCANNER_MISREAD')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    station.activeFault === 'BARCODE_SCANNER_MISREAD'
                      ? 'bg-amber-950 border-amber-600 text-amber-200'
                      : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Barcode Scanner Misread
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Carton serialization verification retry delay.
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
