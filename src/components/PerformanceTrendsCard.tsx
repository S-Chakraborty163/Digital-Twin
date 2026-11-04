import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  BarChart3,
  Flame,
  Info,
} from 'lucide-react';
import { DailyPerformanceRecord } from '../types/factory';

interface PerformanceTrendsCardProps {
  performanceHistory?: DailyPerformanceRecord[];
  currentCompletedCount: number;
  dailyTargetUnits?: number;
  currentArrearsUnits?: number;
  currentDayCount?: number;
  simulatedDate?: string;
  onAdvanceDay?: () => void;
}

export const PerformanceTrendsCard: React.FC<PerformanceTrendsCardProps> = ({
  performanceHistory = [],
  currentCompletedCount,
  dailyTargetUnits = 120,
  currentArrearsUnits = 0,
  currentDayCount = 1,
  simulatedDate = '2026-11-03',
  onAdvanceDay,
}) => {
  const [viewMode, setViewMode] = useState<'combined' | 'output' | 'backlog'>('combined');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Take strictly the last 7 days of simulation
  const last7DaysData = useMemo(() => {
    if (!performanceHistory || performanceHistory.length === 0) return [];
    const slice = performanceHistory.slice(-7);

    // Ensure the last record accurately reflects current live state
    return slice.map((rec, idx) => {
      const isLatest = idx === slice.length - 1;
      if (isLatest && rec.isCurrentDay) {
        return {
          ...rec,
          finishedGoods: currentCompletedCount,
          arrearsBacklog: currentArrearsUnits,
        };
      }
      return rec;
    });
  }, [performanceHistory, currentCompletedCount, currentArrearsUnits]);

  // Aggregate statistics for the 7-day period
  const stats = useMemo(() => {
    if (last7DaysData.length === 0) {
      return {
        totalFinished: 0,
        dailyAverage: 0,
        totalTarget: 7 * dailyTargetUnits,
        fulfillmentRate: 0,
        currentBacklog: currentArrearsUnits,
        peakDay: { day: 1, units: 0 },
        netVariance: 0,
      };
    }

    let totalFinished = 0;
    let peakUnits = -1;
    let peakDayNum = 1;
    let peakDayLabel = 'Day 1';

    last7DaysData.forEach(d => {
      totalFinished += d.finishedGoods;
      if (d.finishedGoods > peakUnits) {
        peakUnits = d.finishedGoods;
        peakDayNum = d.day;
        peakDayLabel = d.dayLabel;
      }
    });

    const totalTarget = last7DaysData.length * dailyTargetUnits;
    const dailyAverage = Number((totalFinished / Math.max(1, last7DaysData.length)).toFixed(1));
    const fulfillmentRate = Number(((totalFinished / Math.max(1, totalTarget)) * 100).toFixed(1));
    const netVariance = totalFinished - totalTarget;

    return {
      totalFinished,
      dailyAverage,
      totalTarget,
      fulfillmentRate,
      currentBacklog: currentArrearsUnits,
      peakDay: { day: peakDayNum, label: peakDayLabel, units: peakUnits },
      netVariance,
    };
  }, [last7DaysData, dailyTargetUnits, currentArrearsUnits]);

  // Selected day breakdown item
  const activeDetailRecord = useMemo(() => {
    if (selectedDayIndex !== null && last7DaysData[selectedDayIndex]) {
      return last7DaysData[selectedDayIndex];
    }
    // Default to the current day or latest day
    return last7DaysData[last7DaysData.length - 1] || null;
  }, [selectedDayIndex, last7DaysData]);

  // Custom high-contrast tooltip for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: DailyPerformanceRecord = payload[0].payload;
    const delta = data.finishedGoods - data.targetUnits;
    const isAboveTarget = delta >= 0;

    return (
      <div className="bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-2 min-w-[210px] pointer-events-none">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-white">{data.dayLabel}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">{data.dateStr}</span>
        </div>

        {data.isCurrentDay && (
          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            Active Shift in Progress
          </div>
        )}

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
              Finished Goods:
            </span>
            <span className="font-mono font-bold text-white text-sm">
              {data.finishedGoods} <span className="text-[10px] font-normal text-slate-400">units</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Target className="w-3 h-3 text-emerald-400" />
              Daily Target:
            </span>
            <span className="font-mono text-slate-300">{data.targetUnits} units</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Target Variance:</span>
            <span
              className={`font-mono font-semibold flex items-center gap-0.5 ${
                isAboveTarget ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isAboveTarget ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {isAboveTarget ? `+${delta}` : delta} units
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              Arrears Backlog:
            </span>
            <span className="font-mono font-bold text-amber-300">
              {data.arrearsBacklog} <span className="text-[10px] font-normal text-slate-400">units</span>
            </span>
          </div>

          {data.scrapCount !== undefined && (
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Scrap Rejects:</span>
              <span className="font-mono text-rose-400 font-semibold">{data.scrapCount} units</span>
            </div>
          )}

          {data.oee !== undefined && (
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Shift OEE:</span>
              <span className="font-mono text-cyan-400 font-semibold">{data.oee}%</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 md:p-5 shadow-xl relative overflow-hidden">
      {/* Decorative ambient background glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
              Performance Trends
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                Last 7 Days
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tracking Finished Goods output against 120-unit daily quota and cumulative arrears backlog carryover.
          </p>
        </div>

        {/* View Mode Pills & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('combined')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'combined'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Combined View
            </button>
            <button
              onClick={() => setViewMode('output')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'output'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Output vs Target
            </button>
            <button
              onClick={() => setViewMode('backlog')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'backlog'
                  ? 'bg-slate-800 text-amber-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Backlog Focus
            </button>
          </div>

          {onAdvanceDay && (
            <button
              onClick={onAdvanceDay}
              title="Advance to next shift day and record daily output"
              className="px-2.5 py-1 text-xs bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 rounded-lg font-semibold transition flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Next Day</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Metric 1: 7-Day Total Finished Goods */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-cyan-400" />
              7-Day Output
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Target {stats.totalTarget}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1.5">
            {stats.totalFinished}
            <span className="text-[11px] font-sans font-normal text-slate-400">units</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span className={stats.netVariance >= 0 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {stats.netVariance >= 0 ? `+${stats.netVariance}` : stats.netVariance} units
            </span>
            <span>vs 7-day target</span>
          </div>
        </div>

        {/* Metric 2: Daily Average Output */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-emerald-400" />
              Daily Average
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Quota: 120</span>
          </div>
          <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1.5">
            {stats.dailyAverage}
            <span className="text-[11px] font-sans font-normal text-slate-400">u/day</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">
              {stats.fulfillmentRate}%
            </span>
            <span>average fulfillment</span>
          </div>
        </div>

        {/* Metric 3: Arrears Backlog */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-400" />
              Arrears Backlog
            </span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
              stats.currentBacklog > 20
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : stats.currentBacklog > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {stats.currentBacklog > 20 ? 'Critical' : stats.currentBacklog > 0 ? 'Carried' : 'Clear'}
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-300 flex items-baseline gap-1.5">
            {stats.currentBacklog}
            <span className="text-[11px] font-sans font-normal text-slate-400">units</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 truncate">
            {stats.currentBacklog > 0 ? 'Pending downstream dispatch' : 'No backlog arrears pending'}
          </div>
        </div>

        {/* Metric 4: Peak Production Day */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-400" />
              Peak Output
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">{stats.peakDay.label || `Day ${stats.peakDay.day}`}</span>
          </div>
          <div className="text-xl font-bold font-mono text-white flex items-baseline gap-1.5">
            {stats.peakDay.units}
            <span className="text-[11px] font-sans font-normal text-slate-400">units</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Max single-shift output achieved
          </div>
        </div>
      </div>

      {/* Main Recharts Visualization Canvas */}
      <div className="h-72 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={last7DaysData}
            margin={{ top: 15, right: 15, bottom: 5, left: -10 }}
            onClick={(state: any) => {
              if (state && state.activeTooltipIndex !== undefined) {
                const idx = typeof state.activeTooltipIndex === 'number'
                  ? state.activeTooltipIndex
                  : parseInt(String(state.activeTooltipIndex), 10);
                if (!isNaN(idx)) {
                  setSelectedDayIndex(idx);
                }
              }
            }}
          >
            <defs>
              {/* Finished Goods Bar Gradient */}
              <linearGradient id="finishedGoodsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0284c7" stopOpacity={0.65} />
              </linearGradient>

              {/* Current Day Active Pulse Gradient */}
              <linearGradient id="currentDayGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={1} />
                <stop offset="100%" stopColor="#0369a1" stopOpacity={0.8} />
              </linearGradient>

              {/* Arrears Area Glow Gradient */}
              <linearGradient id="arrearsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.3} vertical={false} />

            <XAxis
              dataKey="dayLabel"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={{ stroke: '#334155' }}
              axisLine={{ stroke: '#334155' }}
            />

            {/* Left Y-Axis for Output & Daily Target */}
            <YAxis
              yAxisId="left"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={{ stroke: '#334155' }}
              axisLine={{ stroke: '#334155' }}
              domain={[0, (dataMax: number) => Math.max(140, Math.ceil((dataMax + 10) / 10) * 10)]}
              label={{
                value: 'Output / Target (units)',
                angle: -90,
                position: 'insideLeft',
                fill: '#64748b',
                fontSize: 10,
                offset: 15,
              }}
            />

            {/* Right Y-Axis for Arrears Backlog */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#f59e0b"
              tick={{ fill: '#f59e0b', fontSize: 10 }}
              tickLine={{ stroke: '#78350f' }}
              axisLine={{ stroke: '#78350f' }}
              domain={[0, (dataMax: number) => Math.max(30, Math.ceil((dataMax + 5) / 5) * 5)]}
              label={{
                value: 'Arrears Backlog (units)',
                angle: 90,
                position: 'insideRight',
                fill: '#f59e0b',
                fontSize: 10,
                offset: 15,
              }}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
              formatter={(value) => {
                if (value === 'finishedGoods') return <span className="text-cyan-300 font-semibold">Finished Goods Output</span>;
                if (value === 'arrearsBacklog') return <span className="text-amber-400 font-semibold">Arrears Backlog</span>;
                if (value === 'targetUnits') return <span className="text-emerald-400 font-semibold">Daily Target (120u)</span>;
                return value;
              }}
            />

            {/* Target 120 Units Reference Line */}
            <ReferenceLine
              yAxisId="left"
              y={dailyTargetUnits}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Target (${dailyTargetUnits} u)`,
                position: 'insideTopLeft',
                fill: '#10b981',
                fontSize: 10,
                fontWeight: 600,
              }}
            />

            {/* Arrears Backlog Area under line */}
            {(viewMode === 'combined' || viewMode === 'backlog') && (
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="arrearsBacklog"
                fill="url(#arrearsAreaGrad)"
                stroke="none"
              />
            )}

            {/* Finished Goods Bars */}
            {(viewMode === 'combined' || viewMode === 'output') && (
              <Bar
                yAxisId="left"
                dataKey="finishedGoods"
                name="finishedGoods"
                radius={[5, 5, 0, 0]}
                maxBarSize={44}
              >
                {last7DaysData.map((entry, index) => {
                  const isSelected = selectedDayIndex === index;
                  const isCurrent = entry.isCurrentDay;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isCurrent ? 'url(#currentDayGrad)' : 'url(#finishedGoodsGrad)'}
                      stroke={isSelected ? '#38bdf8' : isCurrent ? '#0284c7' : 'none'}
                      strokeWidth={isSelected ? 2 : 1}
                      className="transition-all duration-200 cursor-pointer hover:opacity-90"
                    />
                  );
                })}
              </Bar>
            )}

            {/* Arrears Backlog Trendline */}
            {(viewMode === 'combined' || viewMode === 'backlog') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="arrearsBacklog"
                name="arrearsBacklog"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 4, stroke: '#f59e0b', strokeWidth: 2, fill: '#0f172a' }}
                activeDot={{ r: 6, stroke: '#fbbf24', strokeWidth: 2, fill: '#f59e0b' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Selected / Active Day Quick Inspection Banner */}
      {activeDetailRecord && (
        <div className="mt-3 p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${
              activeDetailRecord.isCurrentDay
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}>
              <Info className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-white flex items-center gap-2">
                <span>{activeDetailRecord.dayLabel} Inspection Detail</span>
                <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                  {activeDetailRecord.dateStr}
                </span>
                {activeDetailRecord.isCurrentDay && (
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/90 border border-cyan-800 px-2 py-0.2 rounded-full">
                    LIVE SHIFT
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Output: <strong className="text-white">{activeDetailRecord.finishedGoods} units</strong> •
                Variance: <strong className={activeDetailRecord.finishedGoods >= activeDetailRecord.targetUnits ? 'text-emerald-400' : 'text-amber-400'}>
                  {activeDetailRecord.finishedGoods - activeDetailRecord.targetUnits >= 0
                    ? `+${activeDetailRecord.finishedGoods - activeDetailRecord.targetUnits}`
                    : activeDetailRecord.finishedGoods - activeDetailRecord.targetUnits} units
                </strong> •
                Backlog carried: <strong className="text-amber-300">{activeDetailRecord.arrearsBacklog} units</strong> •
                OEE: <strong className="text-cyan-300">{activeDetailRecord.oee}%</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="hidden sm:inline">Click any bar to inspect previous day details</span>
            {selectedDayIndex !== null && (
              <button
                onClick={() => setSelectedDayIndex(null)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-medium transition"
              >
                Reset to Today
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
