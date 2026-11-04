import {
  PlantOEE,
  Station,
  FaultType,
  DailyPerformanceRecord,
} from '../types/factory';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  Zap,
  Gauge,
  Cpu,
  BarChart2,
  Settings,
} from 'lucide-react';
import { PerformanceTrendsCard } from './PerformanceTrendsCard';

interface OptimizationDashboardProps {
  oee: PlantOEE;
  stations: Record<string, Station>;
  completedCount: number;
  rejectedCount: number;
  wipCount: number;
  timeSeconds: number;
  bottleneckStationId: string | null;
  lineBalanceScore: number;
  onSelectStation: (stationId: string) => void;
  onAutoBalance: () => void;
  performanceHistory?: DailyPerformanceRecord[];
  dailyTargetUnits?: number;
  currentArrearsUnits?: number;
  currentDayCount?: number;
  simulatedDate?: string;
  onAdvanceDay?: () => void;
}

export const OptimizationDashboard: React.FC<OptimizationDashboardProps> = ({
  oee,
  stations,
  completedCount,
  rejectedCount,
  wipCount,
  timeSeconds,
  bottleneckStationId,
  lineBalanceScore,
  onSelectStation,
  onAutoBalance,
  performanceHistory,
  dailyTargetUnits = 120,
  currentArrearsUnits = 0,
  currentDayCount = 1,
  simulatedDate,
  onAdvanceDay,
}) => {
  const stationList = Object.values(stations).filter(
    s => !s.isQueue && s.type !== 'truck_source' && s.type !== 'sink_dispatch'
  );

  const activeFaults = Object.values(stations).filter(s => s.activeFault !== 'NONE');
  const bottleneckStation = bottleneckStationId ? stations[bottleneckStationId] : null;

  // Calculate hourly throughput rate
  const simulatedHours = Math.max(0.01, timeSeconds / 3600);
  const throughputPerHour = Math.round(completedCount / simulatedHours);

  return (
    <div className="space-y-4 text-slate-100">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* OEE Metric */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Overall OEE
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              oee.overallOEE >= 85 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
              oee.overallOEE >= 70 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
              'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}>
              {oee.overallOEE >= 85 ? 'World Class' : oee.overallOEE >= 70 ? 'Acceptable' : 'Deficit'}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white flex items-baseline gap-2">
            {oee.overallOEE}%
            <span className="text-xs font-normal text-slate-400">Target: 85%</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1 text-[11px] text-center pt-2 border-t border-slate-800/80">
            <div>
              <div className="text-slate-400 text-[10px]">Avail.</div>
              <div className="font-semibold text-cyan-300">{oee.availability}%</div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px]">Perf.</div>
              <div className="font-semibold text-blue-300">{oee.performance}%</div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px]">Quality</div>
              <div className="font-semibold text-emerald-300">{oee.quality}%</div>
            </div>
          </div>
        </div>

        {/* Throughput & Yield */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Finished Goods
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
              Yield {(100 - (rejectedCount / Math.max(1, completedCount + rejectedCount)) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white flex items-baseline gap-2">
            {completedCount} <span className="text-xs font-normal text-slate-400">units</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80 text-slate-400">
            <span>Scrap: <strong className="text-rose-400">{rejectedCount}</strong></span>
            <span>Rate: <strong className="text-emerald-400">{throughputPerHour} u/h</strong></span>
          </div>
        </div>

        {/* WIP & Flow Balance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              Work In Progress (WIP)
            </span>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">
              Balance {lineBalanceScore}%
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white flex items-baseline gap-2">
            {wipCount} <span className="text-xs font-normal text-slate-400">entities active</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
            <span className="text-slate-400">Sim. Time:</span>
            <span className="font-mono text-cyan-300 text-xs">
              {Math.floor(timeSeconds / 60)}m {Math.floor(timeSeconds % 60)}s
            </span>
          </div>
        </div>

        {/* Bottleneck & Predictive Alert */}
        <div className={`rounded-xl p-3.5 shadow-sm border ${
          activeFaults.length > 0
            ? 'bg-rose-950/40 border-rose-800/80 text-rose-100'
            : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium flex items-center gap-1.5">
              {activeFaults.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              {activeFaults.length > 0 ? 'Equipment Anomaly' : 'Operational Status'}
            </span>
            {bottleneckStation && (
              <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                Bottleneck
              </span>
            )}
          </div>
          {activeFaults.length > 0 ? (
            <div>
              <div className="text-sm font-bold text-rose-300 truncate">
                {activeFaults[0].name}
              </div>
              <div className="text-[11px] text-rose-200/90 mt-1 line-clamp-1">
                {activeFaults[0].mlResult.predictedFailureClass}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-lg font-bold text-emerald-300">All Stations Nominal</div>
              <div className="text-[11px] text-slate-400 mt-1 truncate">
                Bottleneck: {bottleneckStation?.name ?? 'Balanced'}
              </div>
            </div>
          )}
          <div className="mt-2 pt-1 border-t border-slate-800/80 text-[11px]">
            {activeFaults.length > 0 ? (
              <button
                onClick={() => onSelectStation(activeFaults[0].id)}
                className="text-cyan-400 hover:text-cyan-300 font-semibold underline text-[11px] transition"
              >
                Inspect Telemetry & ML Diagnosis →
              </button>
            ) : (
              <span className="text-slate-400 text-[11px]">0 active critical alarms</span>
            )}
          </div>
        </div>
      </div>

      {/* 7-Day Performance Trends Card (Recharts) */}
      <PerformanceTrendsCard
        performanceHistory={performanceHistory}
        currentCompletedCount={completedCount}
        dailyTargetUnits={dailyTargetUnits}
        currentArrearsUnits={currentArrearsUnits}
        currentDayCount={currentDayCount}
        simulatedDate={simulatedDate}
        onAdvanceDay={onAdvanceDay}
      />

      {/* Utilization & Balancing Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Station Utilization Bars */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                Line Station Utilization & Capacity Balance
              </h3>
              <p className="text-xs text-slate-400">
                SimEvents server block utilization rates. Stations exceeding 85% constitute system bottlenecks.
              </p>
            </div>
            <button
              onClick={onAutoBalance}
              className="text-xs px-2.5 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 rounded-lg font-medium transition flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Rebalance Speeds
            </button>
          </div>

          <div className="space-y-2.5">
            {stationList.map(station => {
              const isBottleneck = station.id === bottleneckStationId;
              const hasFault = station.activeFault !== 'NONE';

              return (
                <div
                  key={station.id}
                  onClick={() => onSelectStation(station.id)}
                  className="group cursor-pointer hover:bg-slate-800/40 p-1.5 rounded-lg transition"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 group-hover:text-cyan-300 transition">
                        {station.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.2 rounded">
                        {station.simulinkTag}
                      </span>
                      {isBottleneck && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-bold">
                          CRITICAL PATH
                        </span>
                      )}
                      {hasFault && (
                        <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1 rounded font-bold animate-pulse">
                          FAULT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {station.itemsProcessed} parts
                      </span>
                      <span className={`font-mono font-bold text-xs ${
                        station.utilization >= 85 ? 'text-amber-400' :
                        station.utilization >= 40 ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {station.utilization}%
                      </span>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        hasFault
                          ? 'bg-rose-500'
                          : isBottleneck
                          ? 'bg-amber-400'
                          : station.utilization > 75
                          ? 'bg-cyan-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.max(4, station.utilization)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Optimization Advisor */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Digital Twin Prescriptive Advisor
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Automated heuristics for line balancing and predictive error reduction.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/60">
                <div className="font-semibold text-cyan-300 mb-0.5 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Line Balancing Recommendation
                </div>
                <div className="text-slate-300 text-[11px] leading-relaxed">
                  {bottleneckStation ? (
                    <>
                      <strong>{bottleneckStation.name}</strong> is currently on the critical path ({bottleneckStation.utilization}% load).
                      Consider tuning nominal cycle time from {bottleneckStation.nominalProcessingTime}s or pre-buffering in upstream queue.
                    </>
                  ) : (
                    'Plant line stages are evenly balanced within optimal 65-80% utilization envelopes.'
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/60">
                <div className="font-semibold text-indigo-300 mb-0.5 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  Conveyor Transport Optimization
                </div>
                <div className="text-slate-300 text-[11px] leading-relaxed">
                  Transporters RM1, RM2, RM3 are configured with 5-second delays per your SimEvents model.
                  Belt drive tension sensors show healthy traction at ~450 N.
                </div>
              </div>

              <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/60">
                <div className="font-semibold text-emerald-300 mb-0.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ISO 10816 Vibration Compliance
                </div>
                <div className="text-slate-300 text-[11px] leading-relaxed">
                  Machines are continuously compared against ISO 10816-3 Class II (Rigid foundations, 15-75 kW motors).
                  Alarm threshold: 7.1 mm/s RMS.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Discrete Event Step: <strong>0.1s dt</strong></span>
            <span className="text-cyan-400 font-mono">SimEvents v2026.1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
