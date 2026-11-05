import React, { useState, useMemo } from 'react';
import { ItemLifecycleRecord } from '../types/factory';
import { exportItemLifecycleToCSV, downloadCSVFile } from '../utils/traceabilityExport';
import {
  X,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';

interface MaterialTraceabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: ItemLifecycleRecord[];
  currentDateStr: string;
}

export const MaterialTraceabilityModal: React.FC<MaterialTraceabilityModalProps> = ({
  isOpen,
  onClose,
  records,
  currentDateStr,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchSearch =
        r.itemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.lotBatchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.steps.some(s => s.stationName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchLine = selectedLine === 'ALL' || r.rmType === selectedLine;
      const matchStatus = selectedStatus === 'ALL' || r.status === selectedStatus;

      return matchSearch && matchLine && matchStatus;
    });
  }, [records, searchQuery, selectedLine, selectedStatus]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    const csvData = exportItemLifecycleToCSV(records);
    const filename = `aerotwin_manufacturing_traceability_${currentDateStr}.csv`;
    downloadCSVFile(csvData, filename);
  };

  const completedCount = records.filter(r => r.status === 'COMPLETED_DISPATCH').length;
  const scrapCount = records.filter(r => r.status === 'SCRAPPED_QC').length;
  const wipCount = records.filter(r => r.status === 'ACTIVE_WIP').length;
  const avgLeadTime = records.length
    ? Math.round(records.reduce((acc, r) => acc + r.totalLeadTimeSeconds, 0) / records.length)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-cyan-600 rounded-xl text-white shadow-lg shadow-emerald-950/50">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Material Step Traceability & Step Audit Ledger
                </h2>
                <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Excel / CSV Compatible
                </span>
              </div>
              <p className="text-xs text-slate-400">
                End-to-end discrete traceability tracking raw materials (RM1, RM2, RM3) and assemblies across each station step with precise timing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* 1-Click Export as CSV Button */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition active:scale-95"
              title="Download RFC 4180 compliant CSV file formatted with UTF-8 BOM for Microsoft Excel"
            >
              <Download className="w-4 h-4" />
              <span>Export as .CSV (Excel)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Items Logged</span>
            <span className="text-xl font-extrabold font-mono text-cyan-400">{records.length}</span>
            <span className="text-[10px] text-slate-500 block">Parts traced from truck entry</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Dispatched Finished Goods</span>
            <span className="text-xl font-extrabold font-mono text-emerald-400">{completedCount}</span>
            <span className="text-[10px] text-slate-500 block">100% Steps completed</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Active WIP in Factory</span>
            <span className="text-xl font-extrabold font-mono text-amber-400">{wipCount}</span>
            <span className="text-[10px] text-slate-500 block">Currently on conveyors or machines</span>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Average Total Lead Time</span>
            <span className="text-xl font-extrabold font-mono text-indigo-400">
              {Math.floor(avgLeadTime / 60)}m {avgLeadTime % 60}s
            </span>
            <span className="text-[10px] text-slate-500 block">Avg duration entry to exit</span>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Item ID (RM1-001), Lot, or Station..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Line Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 px-1 font-semibold">Line:</span>
              {(['ALL', 'RM1', 'RM2', 'RM3', 'FINAL'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setSelectedLine(l)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition ${
                    selectedLine === l ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 px-1 font-semibold">Status:</span>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'COMPLETED_DISPATCH', label: 'Dispatched' },
                { id: 'ACTIVE_WIP', label: 'Active WIP' },
                { id: 'SCRAPPED_QC', label: 'Scrapped' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStatus(s.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                    selectedStatus === s.id ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Showing <strong className="text-cyan-400">{filteredRecords.length}</strong> of {records.length} items
          </div>
        </div>

        {/* Traceability Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 shadow">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Material ID</th>
                  <th className="py-2.5 px-3">Lot / Batch</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Entry Clock</th>
                  <th className="py-2.5 px-3">Current Step / Station</th>
                  <th className="py-2.5 px-3">Lifecycle Status</th>
                  <th className="py-2.5 px-3">Lead Time</th>
                  <th className="py-2.5 px-3 text-center">Step Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                      {records.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                          <Package className="w-8 h-8 text-slate-500 stroke-[1.5]" />
                          <span className="font-semibold text-slate-300 text-sm">No Material Records Logged Yet</span>
                          <span className="text-xs text-slate-500">
                            The traceability ledger captures dynamic real-time data as workpieces flow through the plant. Start the simulation or step forward to watch delivery trucks unload and track materials across every station.
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="font-semibold text-slate-300">No matching records found</span>
                          <span className="text-xs text-slate-500">Try adjusting your search query, line filter, or status filter.</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(r => {
                    const isExpanded = expandedItemId === r.itemId;
                    const lastStep = r.steps[r.steps.length - 1];

                    return (
                      <React.Fragment key={r.itemId}>
                        <tr className="hover:bg-slate-900/60 transition group">
                          <td className="py-2 px-3 font-bold text-cyan-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            {r.itemId}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px]">{r.lotBatchId}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {r.rmType === 'FINAL' ? 'Finished Assembly' : r.rmType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">{r.creationClock}</td>
                          <td className="py-2 px-3 text-slate-200 font-medium font-sans">
                            {lastStep ? lastStep.stationName : 'In Transit'}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                r.status === 'COMPLETED_DISPATCH'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                  : r.status === 'SCRAPPED_QC'
                                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                                  : 'bg-amber-950 text-amber-300 border-amber-800'
                              }`}
                            >
                              {r.status === 'COMPLETED_DISPATCH'
                                ? 'DISPATCHED'
                                : r.status === 'SCRAPPED_QC'
                                ? 'SCRAPPED (QC)'
                                : 'IN WIP'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {Math.floor(r.totalLeadTimeSeconds / 60)}m {(r.totalLeadTimeSeconds % 60).toFixed(0)}s
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => setExpandedItemId(isExpanded ? null : r.itemId)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-sans font-semibold flex items-center gap-1 mx-auto transition"
                            >
                              <span>{r.steps.length} Steps</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>

                        {/* Step Breakdown Expansion Drawer */}
                        {isExpanded && (
                          <tr className="bg-slate-950/90">
                            <td colSpan={8} className="p-4 border-y border-slate-800">
                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                    Detailed Station-by-Station Journey Log for {r.itemId}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Total Steps: {r.steps.length} • Total Lead Time: {r.totalLeadTimeSeconds.toFixed(1)}s
                                  </span>
                                </div>

                                <div className="space-y-1.5">
                                  {r.steps.map((st, idx) => (
                                    <div
                                      key={idx}
                                      className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-[200px]">
                                        <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 flex items-center justify-center font-bold text-[10px]">
                                          {st.stepIndex}
                                        </span>
                                        <span className="font-bold text-white font-sans">{st.stationName}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">[{st.line}]</span>
                                      </div>

                                      <div className="flex items-center gap-4 text-slate-300 font-mono text-[11px]">
                                        <span>
                                          In: <strong className="text-cyan-400">{st.enteredAtClock}</strong>
                                        </span>
                                        <span>
                                          Out:{' '}
                                          <strong className="text-slate-300">
                                            {st.exitedAtClock || 'Active In-Progress'}
                                          </strong>
                                        </span>
                                        <span>
                                          Duration:{' '}
                                          <strong className="text-emerald-400">{st.durationSeconds.toFixed(1)}s</strong>
                                        </span>
                                      </div>

                                      <div className="text-[11px] text-slate-400 font-sans italic flex-1 max-w-sm text-right">
                                        {st.notes || (st.status === 'COMPLETED' ? 'Cycle finished nominal' : st.status)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
