import React, { useState, useEffect, useRef } from 'react';
import {
  createInitialPlantState,
  tickSimulation,
  injectPlantFault,
  performStationMaintenance,
  updatePlantOperationalConfig,
  formatSimulatedClock,
  advanceToNextDay,
} from './simulation/plantEngine';
import { FaultType, PlantSimulationState } from './types/factory';
import { FactoryCanvas } from './components/FactoryCanvas';
import { StationTelemetryDrawer } from './components/StationTelemetryDrawer';
import { OptimizationDashboard } from './components/OptimizationDashboard';
import { DataIntegrationGuideModal } from './components/DataIntegrationGuideModal';
import { QCSubsystemModal } from './components/QCSubsystemModal';
import { PlantConfigModal } from './components/PlantConfigModal';
import { ComponentDeepDiveView } from './components/ComponentDeepDiveView';
import { PerformanceTrendsCard } from './components/PerformanceTrendsCard';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Cpu,
  Layers,
  Sparkles,
  Wrench,
  Gauge,
  Zap,
  CheckCircle2,
  Clock,
  Truck,
  Users,
  Sliders,
  Calendar,
  RotateCcw,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export default function App() {
  const [simulationState, setSimulationState] = useState<PlantSimulationState>(() => {
    try {
      const saved = localStorage.getItem('aerotwin_plant_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return createInitialPlantState(parsed);
      }
    } catch {
      // ignore storage access errors
    }
    return createInitialPlantState();
  });
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isQCModalOpen, setIsQCModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedQCId, setSelectedQCId] = useState<string>('qc_rm1');
  const [activeMainTab, setActiveMainTab] = useState<
    'optimization' | 'performance_trends' | 'component_deep_dive' | 'leaderboard' | 'qc_subsystem'
  >('optimization');

  // Simulation timer loop
  const stateRef = useRef(simulationState);
  stateRef.current = simulationState;

  useEffect(() => {
    let lastTime = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Bound dt to prevent erratic jumps on background tab
      const safeDt = Math.min(0.2, Math.max(0.01, dt));

      setSimulationState(prev => tickSimulation(prev, safeDt));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleTogglePlay = () => {
    setSimulationState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const handleSpeedChange = (speed: number) => {
    setSimulationState(prev => ({ ...prev, simulationSpeed: speed }));
  };

  const handleStep = () => {
    setSimulationState(prev => tickSimulation({ ...prev, isRunning: true }, 1.0));
  };

  const handleReset = () => {
    // Preserve customized operational shift and logistics parameters across resets!
    setSimulationState(prev => createInitialPlantState(prev.config));
  };

  const handleInjectFault = (stationId: string, fault: FaultType) => {
    setSimulationState(prev => injectPlantFault(prev, stationId, fault));
  };

  const handleRepair = (stationId: string) => {
    setSimulationState(prev => performStationMaintenance(prev, stationId));
  };

  const handleAutoBalance = () => {
    // Balances cycle times by nudging bottleneck station speeds
    setSimulationState(prev => {
      const updated = { ...prev };
      for (const st of Object.values(updated.stations)) {
        if (st.type.includes('cnc')) {
          st.nominalProcessingTime = 5.2; // Optimized cycle time
        }
      }
      return updated;
    });
  };

  const handleInjectExternalTelemetry = (payload: any) => {
    if (!payload?.stationId || !simulationState.stations[payload.stationId]) return;
    setSimulationState(prev => {
      const st = prev.stations[payload.stationId];
      if (!st) return prev;
      return {
        ...prev,
        stations: {
          ...prev.stations,
          [payload.stationId]: {
            ...st,
            sensors: {
              ...st.sensors,
              ...(payload.sensors || {}),
            },
          },
        },
      };
    });
  };

  const activeFaultCount = Object.values(simulationState.stations).filter(
    s => s.activeFault !== 'NONE'
  ).length;

  const handleSaveConfig = (partial: any) => {
    setSimulationState(prev => {
      const next = updatePlantOperationalConfig(prev, partial);
      try {
        localStorage.setItem('aerotwin_plant_config', JSON.stringify(next.config));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const clockData = formatSimulatedClock(
    simulationState.config.simulatedSecondsOfDay,
    simulationState.config.simulatedDate,
    simulationState.config.simulatedDayCount
  );

  const currentHour = (simulationState.config.simulatedSecondsOfDay / 3600) % 24;
  const shiftStart = simulationState.config.shiftStartHour;
  const shiftDuration = simulationState.config.shiftDurationHours;
  const shiftElapsedHours = Math.max(0, currentHour - shiftStart);
  const isShiftActive = shiftElapsedHours >= 0 && shiftElapsedHours < shiftDuration;

  const formatShiftEndHour = (start: number, dur: number) => {
    const end = (start + dur) % 24;
    const ampm = end >= 12 ? 'PM' : 'AM';
    const h12 = end % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:00 ${ampm}`;
  };

  const selectedStation = selectedStationId ? simulationState.stations[selectedStationId] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl shadow-lg shadow-cyan-950/50 text-white">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">
                AeroTwin
              </h1>
              <span className="text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                SimEvents Discrete Twin + ML
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manufacturing Unit Digital Twin • Predictive Maintenance & Operational Optimization
            </p>
          </div>
        </div>

        {/* Global Live Indicators & Navigation Triggers */}
        <div className="flex items-center gap-2.5">
          {/* Active Alerts Pill */}
          {activeFaultCount > 0 ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/40 rounded-lg text-rose-300 text-xs font-semibold animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{activeFaultCount} Fault Detected</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Plant Nominal</span>
            </div>
          )}

          {/* Plant Operational Config Trigger */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
            title="Configure Shift Duration, Truck Delivery Schedule, Barehand Unloading, and Machining Times"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Shift & Logistics</span>
            <span className="md:hidden">Config</span>
          </button>

          {/* QC Subsystem Quick Trigger Button */}
          <button
            onClick={() => setIsQCModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
            title="Inspect Quality Control Multi-Stage Subsystem (Check I, II, Rework, III)"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">QC Subsystem & Rework</span>
            <span className="lg:hidden">QC Subsystem</span>
            <span className="text-[10px] bg-emerald-950 px-1.5 py-0.2 rounded font-mono text-emerald-400">
              FPY {simulationState.stations['qc_rm1']?.qcSubsystem?.firstPassYield ?? 88}%
            </span>
          </button>

          {/* Guide / Documentation Modal Trigger */}
          <button
            onClick={() => setIsGuideOpen(true)}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 transition border border-cyan-400/30"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Data Ingestion Guide</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-7xl w-full mx-auto space-y-4">
        {/* TIME & DATE STAMP BANNER - Real-Time Calendar, Clock, Shift Progress, and Backlog Arrears */}
        <section aria-label="Time and Date Stamp & Plant Operating Status">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            {/* Clock & Calendar Timestamp */}
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-cyan-950/60">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    Plant Real-Time Timestamp
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Day {simulationState.config.simulatedDayCount} • 8:00 AM Shift Start
                  </span>
                </div>
                <div className="flex items-baseline gap-3 mt-0.5">
                  <span className="text-2xl font-extrabold font-mono text-white tracking-tight">
                    {clockData.timeStr}
                  </span>
                  <span className="text-sm font-semibold text-slate-300">
                    {simulationState.config.simulatedDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Shift Context & Cumulative Machine Wear */}
            <div className="flex-1 max-w-xl bg-slate-950/70 border border-slate-800/80 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200">
                    {simulationState.config.shiftDurationHours}h Working Shift (08:00 AM – {formatShiftEndHour(shiftStart, shiftDuration)})
                  </span>
                  {simulationState.config.lunchBreakEnabled &&
                  isShiftActive &&
                  currentHour >= (simulationState.config.lunchBreakStartHour ?? 13.0) &&
                  currentHour < (simulationState.config.lunchBreakStartHour ?? 13.0) + (simulationState.config.lunchBreakDurationMinutes ?? 60) / 60 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 animate-pulse">
                      <span>☕ LUNCH BREAK (1:00 PM – 2:00 PM)</span>
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        simulationState.config.isShiftOpen
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {simulationState.config.isShiftOpen ? 'ACTIVE SHIFT' : 'SHIFT CLOSED (MACHINES OFF)'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {simulationState.config.lunchBreakEnabled &&
                  isShiftActive &&
                  currentHour >= (simulationState.config.lunchBreakStartHour ?? 13.0) &&
                  currentHour < (simulationState.config.lunchBreakStartHour ?? 13.0) + (simulationState.config.lunchBreakDurationMinutes ?? 60) / 60
                    ? 'Workers on lunch break (60m) • Unloading & Manual Assembly paused • Factory on standby'
                    : simulationState.config.isShiftOpen
                    ? `Machines active • Flank wear rate ~0.045mm/h • Worker fatigue ${simulationState.config.workerFatiguePercentage}%`
                    : 'Shift closed • Transporters & CNC spindles powered down • Backlog rolls to arrears'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="text-right sm:min-w-[120px]">
                <span className="text-[10px] text-slate-400 font-mono block">
                  {shiftElapsedHours.toFixed(1)}h / {shiftDuration}h ({Math.min(100, Math.round((shiftElapsedHours / shiftDuration) * 100))}%)
                </span>
                <div className="w-full bg-slate-800 rounded-full h-2 mt-1 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, (shiftElapsedHours / shiftDuration) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Daily Target & Arrears Tracker */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs space-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Today Finished Goods:</span>
                  <span className="font-mono text-emerald-400 font-extrabold text-sm">
                    {simulationState.completedCount} / {simulationState.config.dailyTargetUnits}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                  <span className="text-slate-400">Arrears Backlog:</span>
                  <span className={simulationState.config.arrearsUnits > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                    {simulationState.config.arrearsUnits} units
                  </span>
                </div>
                <div className="text-[9px] text-cyan-300 font-mono">
                  360 RM Delivered (120/line)
                </div>
              </div>

              {/* Advance to Next Day Button */}
              <button
                onClick={() => setSimulationState(prev => advanceToNextDay(prev))}
                className="px-3.5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950/50 transition hover:scale-[1.02] active:scale-[0.98]"
                title="Roll unfinished units into tomorrow's arrears, reset shift clock to 08:00 AM, and dispatch next truck delivery"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-200" />
                <span className="whitespace-nowrap">Advance to Next Day</span>
              </button>
            </div>
          </div>
        </section>

        {/* Real-Time Animated Factory Floor Canvas */}
        <section aria-label="Factory Floor Layout & Animation">
          <FactoryCanvas
            simulationState={simulationState}
            selectedStationId={selectedStationId}
            onSelectStation={id => setSelectedStationId(id)}
            onTogglePlay={handleTogglePlay}
            onSpeedChange={handleSpeedChange}
            onStep={handleStep}
            onReset={handleReset}
            onOpenPlantConfigModal={() => setIsConfigModalOpen(true)}
          />
        </section>

        {/* Secondary Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 rounded-xl p-1 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveMainTab('optimization')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap transition ${
              activeMainTab === 'optimization'
                ? 'bg-slate-800 text-cyan-300 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-4 h-4" />
            Operational Optimization & OEE
          </button>

          <button
            onClick={() => setActiveMainTab('performance_trends')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap transition ${
              activeMainTab === 'performance_trends'
                ? 'bg-slate-800 text-cyan-300 shadow border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Performance Trends (7 Days)
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono">
              Recharts
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('component_deep_dive')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap transition ${
              activeMainTab === 'component_deep_dive'
                ? 'bg-slate-800 text-cyan-300 shadow border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            Component Deep-Dive & Analytics
          </button>

          <button
            onClick={() => setActiveMainTab('leaderboard')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap transition ${
              activeMainTab === 'leaderboard'
                ? 'bg-slate-800 text-cyan-300 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Equipment Health & ML Matrix
          </button>

          <button
            onClick={() => setActiveMainTab('qc_subsystem')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap transition ${
              activeMainTab === 'qc_subsystem'
                ? 'bg-slate-800 text-emerald-300 shadow border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            QC Subsystem & Rework Circuit
          </button>
        </div>

        {/* TAB 1: Optimization Dashboard */}
        {activeMainTab === 'optimization' && (
          <OptimizationDashboard
            oee={simulationState.oee}
            stations={simulationState.stations}
            completedCount={simulationState.completedCount}
            rejectedCount={simulationState.rejectedCount}
            wipCount={simulationState.wipCount}
            timeSeconds={simulationState.timeSeconds}
            bottleneckStationId={simulationState.bottleneckStationId}
            lineBalanceScore={simulationState.lineBalanceScore}
            onSelectStation={id => setSelectedStationId(id)}
            onAutoBalance={handleAutoBalance}
            performanceHistory={simulationState.performanceHistory}
            dailyTargetUnits={simulationState.config.dailyTargetUnits}
            currentArrearsUnits={simulationState.config.arrearsUnits}
            currentDayCount={simulationState.config.simulatedDayCount}
            simulatedDate={simulationState.config.simulatedDate}
            onAdvanceDay={() => setSimulationState(prev => advanceToNextDay(prev))}
          />
        )}

        {/* TAB: Dedicated Performance Trends (7 Days) */}
        {activeMainTab === 'performance_trends' && (
          <div className="space-y-4">
            <PerformanceTrendsCard
              performanceHistory={simulationState.performanceHistory}
              currentCompletedCount={simulationState.completedCount}
              dailyTargetUnits={simulationState.config.dailyTargetUnits}
              currentArrearsUnits={simulationState.config.arrearsUnits}
              currentDayCount={simulationState.config.simulatedDayCount}
              simulatedDate={simulationState.config.simulatedDate}
              onAdvanceDay={() => setSimulationState(prev => advanceToNextDay(prev))}
            />

            {/* 7-Day Performance Log & Variance Ledger */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    7-Day Simulation Output & Arrears Backlog Ledger
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comprehensive daily shift reconciliation showing finished assemblies, target adherence, and arrears backlog carryover.
                  </p>
                </div>
                <button
                  onClick={() => setSimulationState(prev => advanceToNextDay(prev))}
                  className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Advance Shift to Day {simulationState.config.simulatedDayCount + 1}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Simulation Day</th>
                      <th className="py-2.5 px-3">Simulated Date</th>
                      <th className="py-2.5 px-3">Finished Goods</th>
                      <th className="py-2.5 px-3">Daily Target</th>
                      <th className="py-2.5 px-3">Variance</th>
                      <th className="py-2.5 px-3">Arrears Backlog</th>
                      <th className="py-2.5 px-3">First Pass Yield</th>
                      <th className="py-2.5 px-3">OEE</th>
                      <th className="py-2.5 px-3">Shift Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {(simulationState.performanceHistory?.slice(-7) || []).map((row, idx) => {
                      const delta = row.finishedGoods - row.targetUnits;
                      const isMet = delta >= 0;

                      return (
                        <tr
                          key={`${row.dateStr}-${row.day}-${idx}`}
                          className={`hover:bg-slate-800/40 transition ${
                            row.isCurrentDay ? 'bg-cyan-950/20 font-bold' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-white flex items-center gap-2 font-sans font-semibold">
                            {row.isCurrentDay && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                            )}
                            {row.dayLabel}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{row.dateStr}</td>
                          <td className="py-2.5 px-3 text-cyan-300 font-bold">
                            {row.finishedGoods} units
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {row.targetUnits} units
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] ${
                                isMet
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {isMet ? `+${delta}` : delta} u
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`font-semibold ${
                                row.arrearsBacklog > 20
                                  ? 'text-rose-400'
                                  : row.arrearsBacklog > 0
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {row.arrearsBacklog} units
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{row.fpy}%</td>
                          <td className="py-2.5 px-3 text-slate-300">{row.oee}%</td>
                          <td className="py-2.5 px-3 font-sans">
                            {row.isCurrentDay ? (
                              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold">
                                In Progress
                              </span>
                            ) : isMet ? (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-semibold">
                                Quota Fulfilled
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
                                Deficit Rolled Over
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: In-Depth Component Analysis & Telemetry */}
        {activeMainTab === 'component_deep_dive' && (
          <ComponentDeepDiveView
            simulationState={simulationState}
            onSelectStation={id => setSelectedStationId(id)}
            onInjectFault={handleInjectFault}
            onPerformMaintenance={handleRepair}
            onOpenQCModal={id => {
              setSelectedQCId(id);
              setIsQCModalOpen(true);
            }}
          />
        )}

        {/* TAB 2: Equipment Health & ML Anomaly Matrix */}
        {activeMainTab === 'leaderboard' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Machine Learning Equipment Diagnostics & Anomaly Scores
                </h2>
                <p className="text-xs text-slate-400">
                  Continuous inference using Isolation Forest, Deep Autoencoders, and Weibull Remaining Useful Life (RUL)
                </p>
              </div>
              <span className="text-xs text-slate-400">
                Click any row to open oscilloscope telemetry & fault simulator
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Equipment / Block</th>
                    <th className="py-2.5 px-3">SimEvents Tag</th>
                    <th className="py-2.5 px-3">Line</th>
                    <th className="py-2.5 px-3">Vibration (ISO 10816)</th>
                    <th className="py-2.5 px-3">Temp (°C)</th>
                    <th className="py-2.5 px-3">Anomaly Index</th>
                    <th className="py-2.5 px-3">ML Diagnostic Class</th>
                    <th className="py-2.5 px-3">RUL (Hours)</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Object.values(simulationState.stations)
                    .filter(s => !s.isQueue && s.type !== 'truck_source' && s.type !== 'sink_dispatch')
                    .map(station => {
                      const ml = station.mlResult;
                      const hasFault = station.activeFault !== 'NONE';

                      return (
                        <tr
                          key={station.id}
                          onClick={() => setSelectedStationId(station.id)}
                          className="hover:bg-slate-800/40 cursor-pointer transition"
                        >
                          <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              hasFault ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'
                            }`} />
                            {station.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400 text-[11px]">
                            {station.simulinkTag}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono">
                            {station.line}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className={`${
                              station.sensors.vibrationRms > 4.5 ? 'text-rose-400 font-bold' : 'text-slate-300'
                            }`}>
                              {station.sensors.vibrationRms.toFixed(2)} mm/s
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className={`${
                              station.sensors.temperature > 65 ? 'text-amber-400 font-bold' : 'text-slate-300'
                            }`}>
                              {station.sensors.temperature.toFixed(1)} °C
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    ml.anomalyScore > 0.45 ? 'bg-rose-500' : 'bg-cyan-500'
                                  }`}
                                  style={{ width: `${ml.anomalyScore * 100}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-bold">
                                {(ml.anomalyScore * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[11px] font-semibold ${
                              ml.isAnomaly ? 'text-rose-300' : 'text-slate-300'
                            }`}>
                              {ml.predictedFailureClass}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold">
                            <span className={ml.remainingUsefulLifeHours < 24 ? 'text-rose-400' : 'text-emerald-400'}>
                              {ml.remainingUsefulLifeHours} hrs
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedStationId(station.id);
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] rounded font-semibold transition"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: QC Subsystem & Rework Circuit */}
        {activeMainTab === 'qc_subsystem' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Quality Control Subsystem (Check I, Check II, Rework, Check III)
                </h2>
                <p className="text-xs text-slate-400">
                  Exact block wiring and routing matching your uploaded Quality Control subsystem diagram.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsQCModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <span>Open Fullscreen Subsystem Studio</span>
                  <span>↗</span>
                </button>
              </div>
            </div>

            {/* Side-by-side screenshot & live metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Screenshot Reference */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Simulink Subsystem Screenshot:</span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    public/assets/aistudio/Screenshot_2026-11-03_2032002_16658021.png
                  </span>
                </div>
                <div className="bg-white/95 p-2 rounded-lg flex justify-center overflow-hidden border border-slate-700">
                  <img
                    src="/assets/aistudio/Screenshot_2026-11-03_2032002_16658021.png"
                    alt="Simulink Quality Control Subsystem Diagram"
                    className="max-h-48 object-contain rounded"
                  />
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Notice the 3-stage flow: <strong>CHECK I</strong> passes directly to top outfeed or diverts to <strong>CHECK II</strong>. CHECK II splits fatal rejects to <strong>Scrap Sink 1</strong> or routes recoverable parts to <strong>REWORK</strong> $\rightarrow$ <strong>CHECK III</strong> $\rightarrow$ Output Join!
                </div>
              </div>

              {/* Live Yield & Flow State */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-300 mb-2">
                    Live Performance across 3 Intake Lines:
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { id: 'qc_rm1', label: 'QC Line 1 (Lathe Shafts)' },
                      { id: 'qc_rm2', label: 'QC Line 2 (Milled Housings)' },
                      { id: 'qc_rm3', label: 'QC Line 3 (Shaped Gears)' },
                    ].map(line => {
                      const st = simulationState.stations[line.id];
                      const qc = st?.qcSubsystem;
                      return (
                        <div key={line.id} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-white">{line.label}</span>
                            <span className="font-mono text-cyan-400 font-bold">
                              FPY: {qc?.firstPassYield ?? 88}% • RTY: {qc?.rolledThroughputYield ?? 94}%
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Check I Passed: <strong className="text-emerald-400">{qc?.check1Passed ?? 14}</strong></span>
                            <span>Reworked: <strong className="text-amber-400">{qc?.reworkProcessed ?? 2}</strong></span>
                            <span>Scrapped: <strong className="text-rose-400">{(qc?.check2Scrapped ?? 0) + (qc?.check3Scrapped ?? 0)}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
                  <span>Six Sigma DMAIC Integration</span>
                  <button
                    onClick={() => setIsQCModalOpen(true)}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold underline"
                  >
                    Launch Interactive Schematic →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Slide-out Station Telemetry Drawer */}
      <StationTelemetryDrawer
        station={selectedStation}
        entities={simulationState.entities}
        onClose={() => setSelectedStationId(null)}
        onInjectFault={handleInjectFault}
        onRepair={handleRepair}
        onOpenQCSubsystem={id => {
          setSelectedQCId(id);
          setIsQCModalOpen(true);
        }}
      />

      {/* Quality Control Subsystem Modal */}
      <QCSubsystemModal
        isOpen={isQCModalOpen}
        onClose={() => setIsQCModalOpen(false)}
        stations={simulationState.stations}
        selectedQCId={selectedQCId}
        onSelectQCId={id => setSelectedQCId(id)}
      />

      {/* Data Integration & ML Engineering Modal */}
      <DataIntegrationGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onInjectExternalTelemetry={handleInjectExternalTelemetry}
      />

      {/* Plant Operational Configuration Modal */}
      <PlantConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={simulationState.config}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}
