import React, { useState } from 'react';
import { FaultType, PlantSimulationState, Station } from '../types/factory';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  Layers,
  Sparkles,
  Wrench,
  Zap,
  TrendingUp,
  BarChart3,
  Thermometer,
  ShieldAlert,
  ArrowUpRight,
  RefreshCw,
  Search,
  Truck,
  Flame,
  Info,
} from 'lucide-react';

interface ComponentDeepDiveViewProps {
  simulationState: PlantSimulationState;
  onSelectStation: (stationId: string) => void;
  onInjectFault: (stationId: string, fault: FaultType) => void;
  onPerformMaintenance: (stationId: string) => void;
  onOpenQCModal?: (stationId: string) => void;
}

export function ComponentDeepDiveView({
  simulationState,
  onSelectStation,
  onInjectFault,
  onPerformMaintenance,
  onOpenQCModal,
}: ComponentDeepDiveViewProps) {
  // Default to the CNC Lathe machine
  const [selectedId, setSelectedId] = useState<string>('cnc_lathe');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CNC' | 'TRANSPORTER' | 'QC' | 'LOGISTICS' | 'ASSEMBLY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const stations = simulationState.stations;
  const currentStation: Station = stations[selectedId] || stations['cnc_lathe'];

  const isCnc = currentStation.type.includes('cnc');
  const isConveyor = currentStation.type.includes('transporter');
  const isTruckOrUnload = currentStation.type.includes('truck');
  const isQueue = currentStation.type.includes('fifo') || currentStation.type.includes('queue');
  const isQc = currentStation.type === 'quality_control';
  const isAssembly = currentStation.type.includes('assembly') || currentStation.type.includes('converge');
  const isPackaging = currentStation.type.includes('packaging') || currentStation.type.includes('sink');

  const currentStationEntities = simulationState.entities?.filter(
    e => e.currentStationId === currentStation.id
  ) || [];

  const stationList = Object.values(stations).filter(st => {
    if (searchQuery) {
      const matchName = st.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTag = st.simulinkTag.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchName && !matchTag) return false;
    }

    if (categoryFilter === 'CNC') return st.type.includes('cnc');
    if (categoryFilter === 'TRANSPORTER') return st.type.includes('transporter');
    if (categoryFilter === 'QC') return st.type === 'quality_control';
    if (categoryFilter === 'LOGISTICS') return st.type.includes('truck') || st.type.includes('inventory') || st.type.includes('sink');
    if (categoryFilter === 'ASSEMBLY') return st.type.includes('assembly') || st.type.includes('packaging');
    return true;
  });

  // Calculate history points for SVG telemetry curves
  const history = currentStation.history || [];
  const maxVib = Math.max(8.0, ...history.map(h => h.vibrationRms));
  const maxTemp = Math.max(90, ...history.map(h => h.temperature));
  const maxCurrent = Math.max(30, ...history.map(h => h.motorCurrent));

  const formatPoints = (data: number[], maxVal: number) => {
    if (data.length < 2) return '';
    return data
      .map((val, idx) => {
        const x = (idx / (data.length - 1)) * 100;
        const y = 100 - (val / maxVal) * 90;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const vibPoints = formatPoints(history.map(h => h.vibrationRms), maxVib);
  const tempPoints = formatPoints(history.map(h => h.temperature), maxTemp);
  const currPoints = formatPoints(history.map(h => h.motorCurrent), maxCurrent);
  const anomalyPoints = formatPoints(history.map(h => h.anomalyScore), 1.0);

  // Wear progress calculation
  const wear = currentStation.wearPercentage ?? 35;
  const runHours = currentStation.cumulativeRunHours ?? 240;
  const todayParts = currentStation.processedToday ?? currentStation.itemsProcessed;

  // Status badge styling
  const getStatusBadge = (status: Station['status'], fault: FaultType) => {
    if (status === 'LUNCH_BREAK') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>LUNCH BREAK (Shift Rest)</span>
        </span>
      );
    }
    if (fault === 'TOOL_FLANK_WEAR' && status !== 'MAINTENANCE_REQUIRED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span>PREDICTIVE WEAR ADVISORY (VB: {(currentStation.sensors.toolWearIndex ?? 0).toFixed(3)}mm)</span>
        </span>
      );
    }
    if (status === 'MAINTENANCE_REQUIRED' || fault !== 'NONE') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>FAULT: {fault.replace(/_/g, ' ')}</span>
        </span>
      );
    }
    if (status === 'BUSY') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>OPERATIONAL / IN CYCLE</span>
        </span>
      );
    }
    if (status === 'IDLE' || status === 'STARVED') {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{status === 'STARVED' ? 'STARVED (Waiting Feed)' : 'IDLE / STANDBY'}</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Component Switcher */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>Plant Floor Component Deep-Dive & Telemetry Analytics</span>
            </h2>
            <p className="text-xs text-slate-400">
              In-depth statistical tracking, vibration spectrum, progressive machine wear, and real-time AI fault diagnostics for all 22 manufacturing elements
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', 'CNC', 'TRANSPORTER', 'QC', 'LOGISTICS', 'ASSEMBLY'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  categoryFilter === cat
                    ? 'bg-cyan-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Component Selector Pills */}
        <div className="pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search component by name or tag (e.g. lathe, milling, transporter, qc)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 w-full max-w-md focus:border-cyan-500 outline-none"
            />
            <span className="text-[11px] text-slate-500">
              Showing {stationList.length} of {Object.keys(stations).length} components
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {stationList.map(st => {
              const isSelected = st.id === selectedId;
              const hasFault = st.activeFault !== 'NONE';
              return (
                <button
                  key={st.id}
                  onClick={() => {
                    setSelectedId(st.id);
                    onSelectStation(st.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 border flex-shrink-0 ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-lg shadow-cyan-950/50'
                      : hasFault
                      ? 'bg-rose-950/40 text-rose-300 border-rose-800/80 animate-pulse'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasFault
                        ? 'bg-rose-500'
                        : st.status === 'BUSY'
                        ? 'bg-cyan-400'
                        : 'bg-slate-600'
                    }`}
                  />
                  <span>{st.name}</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-slate-900 border border-slate-800">
                    {st.simulinkTag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Component In-Depth Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT COLUMN: Hardware Specs & Real-Time Statistics */}
        <div className="space-y-4">
          {/* Main Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {currentStation.line} LINE • {currentStation.type.toUpperCase()}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">{currentStation.name}</h3>
                <p className="text-xs text-slate-400 font-mono">Simulink Tag: {currentStation.simulinkTag}</p>
              </div>

              {getStatusBadge(currentStation.status, currentStation.activeFault)}
            </div>

            {/* Quick KPI Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Today's Output</span>
                <span className="text-xl font-bold font-mono text-cyan-300">{todayParts}</span>
                <span className="text-[10px] text-slate-500 block">units processed</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Station Utilization</span>
                <span className="text-xl font-bold font-mono text-emerald-400">{currentStation.utilization}%</span>
                <span className="text-[10px] text-slate-500 block">shift duty cycle</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Operating Run-Hours</span>
                <span className="text-xl font-bold font-mono text-indigo-300">{runHours.toFixed(1)} h</span>
                <span className="text-[10px] text-slate-500 block">cumulative machine time</span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <span className="text-[11px] text-slate-400 block">Nominal Cycle Time</span>
                <span className="text-xl font-bold font-mono text-amber-300">
                  {currentStation.nominalProcessingTime >= 60
                    ? `${(currentStation.nominalProcessingTime / 60).toFixed(1)}m`
                    : `${currentStation.nominalProcessingTime}s`}
                </span>
                <span className="text-[10px] text-slate-500 block">per entity unit</span>
              </div>
            </div>

            {/* Wear & Degradation Progress */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Progressive Machine Wear
                </span>
                <span className={`font-mono font-bold ${wear > 75 ? 'text-rose-400' : wear > 45 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {wear.toFixed(1)}% Wear
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    wear > 75
                      ? 'bg-rose-500'
                      : wear > 45
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, wear))}%` }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0% (Brand New)</span>
                <span>50% (Recommended Inspection)</span>
                <span>100% (Critical Tool/Bearing Wear)</span>
              </div>

              {currentStation.type.includes('cnc') && currentStation.sensors.toolWearIndex !== undefined && (
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
                  <span>Flank Wear Width (VB):</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {currentStation.sensors.toolWearIndex.toFixed(3)} mm (ISO limit 0.30mm)
                  </span>
                </div>
              )}
            </div>

            {/* 4-Metric Real-time Entity Tracking Box */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Real-Time Entity Flow Metrics
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                  Station Live Counts
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">1. Currently Processing</span>
                  <span className="text-xl font-bold font-mono text-cyan-300">{currentStation.currentlyProcessingCount}</span>
                  <span className="text-[9px] text-slate-500 block">units in operation</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">2. Holding in Queue</span>
                  <span className="text-xl font-bold font-mono text-amber-300">{currentStation.currentQueueCount}</span>
                  <span className="text-[9px] text-slate-500 block">units awaiting intake</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">3. Processed Today (Shift)</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">{currentStation.processedToday}</span>
                  <span className="text-[9px] text-slate-500 block">completed this shift</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">4. Processed Cumulative</span>
                  <span className="text-xl font-bold font-mono text-purple-300">{currentStation.processedCumulative}</span>
                  <span className="text-[9px] text-slate-500 block">lifetime units processed</span>
                </div>
              </div>
            </div>

            {/* Active WIP Entities at Station */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Live WIP Units at Station ({currentStationEntities.length})
                </span>
                {currentStation.processingTimeRemaining > 0 && (
                  <span className="text-[10px] font-mono text-cyan-300">
                    Cycle Remaining: {currentStation.processingTimeRemaining.toFixed(1)}s
                  </span>
                )}
              </div>

              {currentStationEntities.length > 0 ? (
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {currentStationEntities.slice(0, 8).map(ent => (
                    <div
                      key={ent.id}
                      className="p-1.5 bg-slate-900 rounded border border-slate-800 text-[11px] flex items-center justify-between font-mono"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-cyan-300 font-bold">{ent.code}</span>
                        <span className="text-[9px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded">
                          {ent.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-300 font-sans">
                        {ent.isProcessing ? 'Machining / In-Cycle' : 'Queued'}
                      </span>
                    </div>
                  ))}
                  {currentStationEntities.length > 8 && (
                    <div className="text-[10px] text-slate-500 text-center">
                      +{currentStationEntities.length - 8} more units in queue
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-xs text-slate-500 py-1.5 italic">
                  No active entity currently held at this station
                </div>
              )}
            </div>

            {/* Fault Simulation & Maintenance Actions */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                  Station-Specific Failure Modes & Diagnostics
                </span>
                {currentStation.activeFault !== 'NONE' && (
                  <button
                    onClick={() => onPerformMaintenance(currentStation.id)}
                    className="text-[10px] px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {isCnc && (
                  <>
                    <button
                      onClick={() => onInjectFault(currentStation.id, 'TOOL_FLANK_WEAR')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'TOOL_FLANK_WEAR'
                          ? 'bg-amber-950/80 border-amber-600 text-amber-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                      title="Progressive cutting wear. Flags predictive advisory; stays operational until 0.35mm."
                    >
                      <div className="text-amber-300 font-bold text-[11px] flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-amber-400" />
                        +0.06mm Flank Wear (VB)
                      </div>
                      <div className="text-[9px] text-slate-400">Advisory: operational until 0.35mm</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'SPINDLE_BEARING_VIBRATION')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'SPINDLE_BEARING_VIBRATION'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-rose-300 font-bold text-[11px] flex items-center gap-1">
                        <Activity className="w-3 h-3 text-rose-400" />
                        Spindle Bearing Spall
                      </div>
                      <div className="text-[9px] text-slate-400">Zone C/D alarm (&gt;7.1 mm/s)</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'SPINDLE_THERMAL_EXPANSION')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'SPINDLE_THERMAL_EXPANSION'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-amber-300 font-bold text-[11px] flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        Thermal Drift
                      </div>
                      <div className="text-[9px] text-slate-400">Coolant starvation & heating</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'CHIP_CONVEYOR_CLOG')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'CHIP_CONVEYOR_CLOG'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-yellow-300 font-bold text-[11px] flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        Chip Conveyor Jam
                      </div>
                      <div className="text-[9px] text-slate-400">Swarf clog motor overload</div>
                    </button>
                  </>
                )}

                {isConveyor && (
                  <>
                    <button
                      onClick={() => onInjectFault(currentStation.id, 'BELT_SLIP_AND_TENSION_LOSS')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'BELT_SLIP_AND_TENSION_LOSS'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-blue-300 font-bold text-[11px] flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-blue-400" />
                        Belt Tension Loss
                      </div>
                      <div className="text-[9px] text-slate-400">Drops tension to 260N (slip)</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'ROLLER_BEARING_OVERHEAT')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'ROLLER_BEARING_OVERHEAT'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-amber-300 font-bold text-[11px] flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        Roller Overheat
                      </div>
                      <div className="text-[9px] text-slate-400">Pulley bearing lubrication loss</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'CONVEYOR_MOTOR_OVERLOAD')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'CONVEYOR_MOTOR_OVERLOAD'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-yellow-300 font-bold text-[11px] flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        Motor Overload
                      </div>
                      <div className="text-[9px] text-slate-400">Current surge &gt; 18.5A</div>
                    </button>
                  </>
                )}

                {isTruckOrUnload && (
                  <>
                    <button
                      onClick={() => onInjectFault(currentStation.id, 'TRUCK_ARRIVAL_DELAY')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'TRUCK_ARRIVAL_DELAY'
                          ? 'bg-amber-950 border-amber-600 text-amber-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-blue-300 font-bold text-[11px] flex items-center gap-1">
                        <Truck className="w-3 h-3 text-blue-400" />
                        Delivery Delay
                      </div>
                      <div className="text-[9px] text-slate-400">Logistics traffic congestion</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'PALLET_UNLOADING_JAM')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'PALLET_UNLOADING_JAM'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-amber-300 font-bold text-[11px] flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-amber-400" />
                        Hoist Jam
                      </div>
                      <div className="text-[9px] text-slate-400">Pallet entanglement at bay</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'WORKER_FATIGUE_DELAY')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'WORKER_FATIGUE_DELAY'
                          ? 'bg-amber-950 border-amber-600 text-amber-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-amber-300 font-bold text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        Crew Fatigue
                      </div>
                      <div className="text-[9px] text-slate-400">Barehand manual slowdown</div>
                    </button>
                  </>
                )}

                {isQueue && (
                  <>
                    <button
                      onClick={() => onInjectFault(currentStation.id, 'RACK_OVERFLOW_WARNING')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'RACK_OVERFLOW_WARNING'
                          ? 'bg-amber-950 border-amber-600 text-amber-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-cyan-300 font-bold text-[11px] flex items-center gap-1">
                        <Layers className="w-3 h-3 text-cyan-400" />
                        Buffer Overflow
                      </div>
                      <div className="text-[9px] text-slate-400">Staging queue limit warning</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'STORAGE_HUMIDITY_EXCURSION')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'STORAGE_HUMIDITY_EXCURSION'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-amber-300 font-bold text-[11px] flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-amber-400" />
                        Humidity Excursion
                      </div>
                      <div className="text-[9px] text-slate-400">Environmental rust alert</div>
                    </button>
                  </>
                )}

                {isQc && (
                  <>
                    <button
                      onClick={() => onInjectFault(currentStation.id, 'OPTICAL_LENS_FOULED')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'OPTICAL_LENS_FOULED'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                        <Activity className="w-3 h-3 text-emerald-400" />
                        Laser Lens Fouled
                      </div>
                      <div className="text-[9px] text-slate-400">Coolant mist false scrap spike</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'GAUGE_CALIBRATION_DRIFT')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'GAUGE_CALIBRATION_DRIFT'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-cyan-300 font-bold text-[11px] flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-cyan-400" />
                        Stylus Calibration Drift
                      </div>
                      <div className="text-[9px] text-slate-400">CMM zero-point offset error</div>
                    </button>
                  </>
                )}

                {isAssembly && (
                  <>
                    <button
                      onClick={() => onInjectFault(currentStation.id, 'TORQUE_DRIVER_OUT_OF_SPEC')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'TORQUE_DRIVER_OUT_OF_SPEC'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-amber-300 font-bold text-[11px] flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-amber-400" />
                        Torque Driver Drift
                      </div>
                      <div className="text-[9px] text-slate-400">Nutrunner calibration out of spec</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'PNEUMATIC_PRESSURE_DROP')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'PNEUMATIC_PRESSURE_DROP'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-blue-300 font-bold text-[11px] flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-blue-400" />
                        Gripper Pressure Drop
                      </div>
                      <div className="text-[9px] text-slate-400">Pneumatic supply &lt; 5.5 bar</div>
                    </button>
                  </>
                )}

                {isPackaging && (
                  <>
                    <button
                      onClick={() => onInjectFault(currentStation.id, 'SEALER_HEATER_ELEMENT_FAULT')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'SEALER_HEATER_ELEMENT_FAULT'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-amber-300 font-bold text-[11px] flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        Heat Sealer Fault
                      </div>
                      <div className="text-[9px] text-slate-400">Shrink-wrap element degradation</div>
                    </button>

                    <button
                      onClick={() => onInjectFault(currentStation.id, 'BARCODE_SCANNER_MISREAD')}
                      className={`px-2.5 py-1.5 rounded-lg border text-left transition ${
                        currentStation.activeFault === 'BARCODE_SCANNER_MISREAD'
                          ? 'bg-rose-950 border-rose-600 text-rose-200'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-cyan-300 font-bold text-[11px] flex items-center gap-1">
                        <Activity className="w-3 h-3 text-cyan-400" />
                        Barcode Misread
                      </div>
                      <div className="text-[9px] text-slate-400">Optical label verification drift</div>
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => onPerformMaintenance(currentStation.id)}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Perform Maintenance Calibration & Clear Fault</span>
              </button>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Real-Time Sensor Telemetry & Multi-Trace Oscilloscope */}
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Real-Time Sensor Telemetry Streams</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-500">
                100ms Ingestion • 30-sample rolling buffer
              </span>
            </div>

            {/* Sensor 1: Vibration RMS with ISO 10816 Thresholds */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Vibration RMS (Velocity mm/s)
                </span>
                <span className="font-mono text-cyan-300 font-bold">
                  {currentStation.sensors.vibrationRms.toFixed(2)} mm/s
                </span>
              </div>

              {/* Mini SVG Curve */}
              <div className="h-20 w-full bg-slate-900/90 rounded-lg p-1 border border-slate-800/80 relative overflow-hidden">
                {/* ISO 10816 Threshold Guide lines */}
                <div className="absolute top-[35%] left-0 right-0 border-b border-rose-500/30 border-dashed text-[8px] text-rose-400/80 text-right pr-1">
                  Alarm 7.1 mm/s
                </div>
                <div className="absolute top-[60%] left-0 right-0 border-b border-amber-500/30 border-dashed text-[8px] text-amber-400/80 text-right pr-1">
                  Warn 4.5 mm/s
                </div>

                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                  <polyline
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2.5"
                    points={vibPoints}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>

              <div className="flex justify-between text-[10px] text-slate-500">
                <span className="text-emerald-400">Zone A: Good &lt;2.8</span>
                <span className="text-amber-400">Zone B: Warn &lt;4.5</span>
                <span className="text-rose-400">Zone C/D: Alarm &gt;7.1</span>
              </div>
            </div>

            {/* Sensor 2: Temperature */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  Spindle / Motor Temperature
                </span>
                <span className="font-mono text-amber-300 font-bold">
                  {currentStation.sensors.temperature.toFixed(1)} °C
                </span>
              </div>

              <div className="h-16 w-full bg-slate-900/90 rounded-lg p-1 border border-slate-800/80 relative overflow-hidden">
                <div className="absolute top-[25%] left-0 right-0 border-b border-rose-500/30 border-dashed text-[8px] text-rose-400/80 text-right pr-1">
                  Trip 80°C
                </div>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    points={tempPoints}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            </div>

            {/* Sensor 3: Motor Current */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  Motor Electrical Current
                </span>
                <span className="font-mono text-indigo-300 font-bold">
                  {currentStation.sensors.motorCurrent.toFixed(1)} A
                </span>
              </div>

              <div className="h-16 w-full bg-slate-900/90 rounded-lg p-1 border border-slate-800/80 relative overflow-hidden">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                  <polyline
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2.5"
                    points={currPoints}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI Predictive Maintenance & Machine Learning Models */}
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span>AI Diagnostics & Failure Detection</span>
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                Random Forest + Autoencoder
              </span>
            </div>

            {/* Remaining Useful Life Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <span className="text-xs text-slate-400 block">Remaining Useful Life (RUL Estimation):</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono ${
                  currentStation.mlResult.remainingUsefulLifeHours < 20
                    ? 'text-rose-400'
                    : currentStation.mlResult.remainingUsefulLifeHours < 60
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {currentStation.mlResult.remainingUsefulLifeHours.toFixed(1)} Hours
                </span>
                <span className="text-xs text-slate-500">Weibull Hazard Model</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Calculated dynamically from vibration energy rate of change and cumulative operating cycles.
              </p>
            </div>

            {/* Model Inference Breakdown */}
            <div className="space-y-2.5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Isolation Forest Anomaly Score:</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {(currentStation.mlResult.isolationForestScore * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, currentStation.mlResult.isolationForestScore * 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Autoencoder Reconstruction MSE:</span>
                  <span className="font-mono text-indigo-300 font-bold">
                    {currentStation.mlResult.autoencoderReconstructionError.toFixed(4)}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, currentStation.mlResult.autoencoderReconstructionError * 200)}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Predicted Fault Classification:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {currentStation.mlResult.predictedFailureClass}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Classification Confidence:</span>
                  <span className="font-mono text-slate-200">
                    {currentStation.mlResult.modelConfidence}%
                  </span>
                </div>
              </div>
            </div>

            {/* Prescriptive Engineering Action */}
            <div className="bg-cyan-950/40 border border-cyan-800/80 rounded-xl p-3.5 space-y-1">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Prescriptive Engineering Action
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {currentStation.mlResult.prescriptiveAction}
              </p>
            </div>

            {/* If QC station, show quick button */}
            {currentStation.type === 'quality_control' && (
              <button
                onClick={() => onOpenQCModal && onOpenQCModal(currentStation.id)}
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Open Multi-Stage Quality Control Subsystem View</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
