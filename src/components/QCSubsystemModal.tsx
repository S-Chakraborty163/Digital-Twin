import React, { useState } from 'react';
import { Station, QCDefectAuditRecord } from '../types/factory';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Trash2,
  Wrench,
  Percent,
  Activity,
  Image as ImageIcon,
  FileSpreadsheet,
  Table,
  Filter,
} from 'lucide-react';

interface QCSubsystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  stations: Record<string, Station>;
  selectedQCId: string;
  onSelectQCId: (id: string) => void;
}

export const QCSubsystemModal: React.FC<QCSubsystemModalProps> = ({
  isOpen,
  onClose,
  stations,
  selectedQCId,
  onSelectQCId,
}) => {
  const [activeTab, setActiveTab] = useState<'interactive' | 'defect_audit' | 'reference_screenshot'>('interactive');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'SCRAPPED' | 'REWORKED'>('ALL');

  if (!isOpen) return null;

  const currentStation = stations[selectedQCId] || stations['qc_rm1'];
  const qc = currentStation?.qcSubsystem || {
    check1Inspected: 24,
    check1Passed: 21,
    check1Failed: 3,
    check2Scrapped: 1,
    check2SentToRework: 2,
    reworkProcessed: 2,
    check3Passed: 2,
    check3Scrapped: 0,
    firstPassYield: 87.5,
    rolledThroughputYield: 95.8,
    activeInReworkEntityId: null,
    reworkTimeRemaining: 0,
  };

  const reworkSavedCount = qc.check3Passed;
  const totalScrapped = qc.check2Scrapped + qc.check3Scrapped;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Quality Control Subsystem Digital Twin
                </h2>
                <span className="text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded">
                  Simulink Subsystem 1:1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-stage inspection: Check I (Gate) → Check II (Triage) → Rework Server → Check III → Scrap Sinks & Final Combiner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* QC Station Selector Pills */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
              {[
                { id: 'qc_rm1', label: 'QC RM1 (Lathe)' },
                { id: 'qc_rm2', label: 'QC RM2 (Milling)' },
                { id: 'qc_rm3', label: 'QC RM3 (Shaping)' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelectQCId(item.id)}
                  className={`px-2.5 py-1 rounded transition ${
                    selectedQCId === item.id
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ml-2"
              aria-label="Close QC Subsystem modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Switcher Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-6 py-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('interactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'interactive'
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Live Subsystem Schematic & Flow
            </button>
            <button
              onClick={() => setActiveTab('defect_audit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'defect_audit'
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-amber-400" />
              Scrap & Rework Audit Ledger ({qc.defectAuditLog?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('reference_screenshot')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'reference_screenshot'
                  ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Simulink Subsystem Screenshot Validation
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Active Line: <strong className="text-cyan-300">{currentStation.name}</strong> ({currentStation.simulinkTag})
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {activeTab === 'interactive' ? (
            <>
              {/* Top Subsystem KPI Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>First Pass Yield (FPY)</span>
                    <Percent className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-xl font-bold font-mono text-cyan-300">
                    {qc.firstPassYield}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {qc.check1Passed} passed / {qc.check1Inspected} tested in Check I
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Rolled Throughput Yield (RTY)</span>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-300">
                    {qc.rolledThroughputYield}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Includes {reworkSavedCount} units rescued by Rework
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Rework Loop Volume</span>
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-bold font-mono text-amber-300">
                    {qc.check2SentToRework} <span className="text-xs font-normal text-slate-400">units</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Success Rate: {qc.check2SentToRework > 0 ? ((qc.check3Passed / qc.check2SentToRework) * 100).toFixed(0) : 100}%
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                    <span>Fatal Scrap Losses</span>
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-xl font-bold font-mono text-rose-400">
                    {totalScrapped} <span className="text-xs font-normal text-slate-400">units</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Check II: {qc.check2Scrapped} • Check III: {qc.check3Scrapped}
                  </div>
                </div>
              </div>

              {/* Exact Visual Subsystem Canvas Schematic */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner relative overflow-x-auto">
                <div className="text-xs font-semibold text-slate-400 mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Exact SimEvents Block Topology (Subsystem Interior)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Matches attached Simulink subsystem diagram 1:1
                  </span>
                </div>

                {/* SVG Visual Diagram matching user's image */}
                <div className="w-full min-w-[780px] h-[310px] relative bg-slate-900/60 rounded-xl border border-slate-800/80 p-4">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 860 280">
                    {/* Connection Lines */}
                    {/* Port 1 to Check I */}
                    <line x1="60" y1="80" x2="130" y2="80" stroke="#94a3b8" strokeWidth="2" />
                    {/* Check I to Router 1 */}
                    <line x1="180" y1="80" x2="220" y2="80" stroke="#94a3b8" strokeWidth="2" />

                    {/* Router 1 Top Path: Directly to Output Combiner */}
                    <path
                      d="M 235 65 L 500 65 L 500 120 L 730 120"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                    />

                    {/* Router 1 Bottom Path: Down to Check II */}
                    <path
                      d="M 235 95 L 255 95 L 255 160 L 280 160"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />

                    {/* Check II Top Path: To Scrap Sink 1 */}
                    <path
                      d="M 295 145 L 340 145 L 340 125 L 380 125"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2"
                    />

                    {/* Check II Bottom Path: To REWORK server */}
                    <path
                      d="M 295 175 L 330 175 L 330 200 L 370 200"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />

                    {/* REWORK to Check III */}
                    <line x1="420" y1="200" x2="470" y2="200" stroke="#38bdf8" strokeWidth="2" />

                    {/* Check III to Router 3 */}
                    <line x1="520" y1="200" x2="550" y2="200" stroke="#94a3b8" strokeWidth="2" />

                    {/* Router 3 Top Path: To Scrap Sink 2 */}
                    <path
                      d="M 565 185 L 610 185 L 610 155 L 635 155"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2"
                    />

                    {/* Router 3 Bottom Path: Up to Output Combiner */}
                    <path
                      d="M 565 215 L 700 215 L 700 150 L 730 150"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                    />

                    {/* Combiner Out to Output Port 1 */}
                    <line x1="750" y1="135" x2="810" y2="135" stroke="#10b981" strokeWidth="2.5" />

                    {/* --- BLOCKS --- */}

                    {/* Input Port 1 */}
                    <g transform="translate(10, 65)">
                      <rect x="0" y="0" width="45" height="30" rx="15" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1.5" />
                      <text x="22" y="19" fill="#f8fafc" fontSize="12" fontWeight="bold" textAnchor="middle">1</text>
                    </g>

                    {/* CHECK I Block */}
                    <g transform="translate(130, 55)">
                      <circle cx="25" cy="25" r="25" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
                      <text x="25" y="29" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">{`{..1}`}</text>
                      <text x="25" y="65" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">CHECK I (30s)</text>
                    </g>

                    {/* Router 1 (Demux Switch) */}
                    <g transform="translate(220, 55)">
                      <polygon points="0,5 15,15 15,35 0,45" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
                    </g>

                    {/* CHECK II Block (Router / Demux) */}
                    <g transform="translate(280, 135)">
                      <polygon points="0,5 15,15 15,35 0,45" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
                      <text x="8" y="62" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">CHECK II</text>
                    </g>

                    {/* Scrap Sink 1 (Square with X) */}
                    <g transform="translate(380, 105)">
                      <rect x="0" y="0" width="34" height="34" fill="#4c0519" stroke="#f43f5e" strokeWidth="2" />
                      <line x1="5" y1="5" x2="29" y2="29" stroke="#f43f5e" strokeWidth="2.5" />
                      <line x1="29" y1="5" x2="5" y2="29" stroke="#f43f5e" strokeWidth="2.5" />
                      <text x="17" y="46" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle">Scrap Sink 1</text>
                    </g>

                    {/* REWORK Server Block */}
                    <g transform="translate(370, 175)">
                      <circle cx="25" cy="25" r="24" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                      <text x="25" y="29" fill="#f8fafc" fontSize="12" fontWeight="bold" textAnchor="middle">1</text>
                      <text x="25" y="62" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">REWORK (3m)</text>
                    </g>

                    {/* CHECK III Block */}
                    <g transform="translate(470, 175)">
                      <circle cx="25" cy="25" r="24" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
                      <text x="25" y="29" fill="#cbd5e1" fontSize="11" fontWeight="bold" textAnchor="middle">{`{..1}`}</text>
                      <text x="25" y="62" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">CHECK III</text>
                    </g>

                    {/* Router 3 (Demux Switch) */}
                    <g transform="translate(550, 175)">
                      <polygon points="0,5 15,15 15,35 0,45" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
                    </g>

                    {/* Scrap Sink 2 (Square with X) */}
                    <g transform="translate(635, 135)">
                      <rect x="0" y="0" width="34" height="34" fill="#4c0519" stroke="#f43f5e" strokeWidth="2" />
                      <line x1="5" y1="5" x2="29" y2="29" stroke="#f43f5e" strokeWidth="2.5" />
                      <line x1="29" y1="5" x2="5" y2="29" stroke="#f43f5e" strokeWidth="2.5" />
                      <text x="17" y="46" fill="#f43f5e" fontSize="9" fontWeight="bold" textAnchor="middle">Scrap Sink 2</text>
                    </g>

                    {/* Combiner / Join Router on Right */}
                    <g transform="translate(730, 110)">
                      <polygon points="0,10 15,20 15,40 0,50" fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
                    </g>

                    {/* Output Port 1 */}
                    <g transform="translate(810, 120)">
                      <rect x="0" y="0" width="45" height="30" rx="15" fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
                      <text x="22" y="19" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle">1</text>
                    </g>
                  </svg>

                  {/* Flow labels overlay */}
                  <div className="absolute top-3 left-4 text-[10px] text-slate-400">
                    <span className="text-emerald-400 font-bold">Top Green Line:</span> Direct First-Pass Approved Units
                  </div>
                  <div className="absolute bottom-2 left-4 text-[10px] text-slate-400">
                    <span className="text-cyan-400 font-bold">Bottom Blue Loop:</span> Recoverable Defects routed to REWORK Cell & CHECK III
                  </div>
                </div>
              </div>

              {/* Subsystem Engineering Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="font-bold text-cyan-300 text-xs mb-1">
                    Stage 1: CHECK I (First Pass)
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Evaluates incoming parts from Line Buffer. Parts meeting nominal tolerance bypass all rework steps and proceed straight to the Converge Combiner ({qc.check1Passed} passed).
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="font-bold text-amber-300 text-xs mb-1">
                    Stage 2: CHECK II & REWORK
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Triage classification: Irreparable defects are discarded to Scrap Sink 1 ({qc.check2Scrapped}). Minor dimensional variances are routed to the REWORK server for re-machining ({qc.check2SentToRework} units).
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="font-bold text-emerald-300 text-xs mb-1">
                    Stage 3: CHECK III & Output Join
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Post-rework verification: Restored parts join the main stream to downstream Final Assembly ({qc.check3Passed} rescued). Failed reworks are discarded to Scrap Sink 2 ({qc.check3Scrapped}).
                  </p>
                </div>
              </div>

              {/* Defect Scrap & Rework Audit Log (RM ID, Standard & Margin vs Standard) */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white text-xs">
                      QC Scrap & Rework Audit Log (RM ID, Standard Spec & Deviation Margin)
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('defect_audit')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline flex items-center gap-1"
                  >
                    View All Entries ({(qc.defectAuditLog || []).length}) →
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2 px-3">RM ID</th>
                        <th className="py-2 px-3">Disposition</th>
                        <th className="py-2 px-3">Stage</th>
                        <th className="py-2 px-3">Standard Set</th>
                        <th className="py-2 px-3">Measured Value</th>
                        <th className="py-2 px-3">Deviation Margin vs Standard</th>
                        <th className="py-2 px-3">Reason / Engineering Notes</th>
                        <th className="py-2 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {(qc.defectAuditLog || []).slice(0, 5).map(record => (
                        <tr key={record.id} className="hover:bg-slate-900/50">
                          <td className="py-2 px-3 font-bold text-cyan-300">{record.itemId}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                record.action === 'SCRAPPED'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {record.action}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">{record.stage}</td>
                          <td className="py-2 px-3 text-slate-400">{record.standardValue}</td>
                          <td className="py-2 px-3 text-slate-200">{record.measuredValue}</td>
                          <td className="py-2 px-3 font-semibold text-rose-300">{record.deviationMargin}</td>
                          <td className="py-2 px-3 font-sans text-slate-400 max-w-xs truncate">{record.reason}</td>
                          <td className="py-2 px-3 text-slate-500">{record.timestampStr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : activeTab === 'defect_audit' ? (
            /* Dedicated Tab: Full Defect Scrap & Rework Audit Ledger */
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Table className="w-4 h-4 text-cyan-400" />
                      Defect Scrap & Rework Audit Ledger (RM ID & Margin vs Standard)
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tracks every raw material workpiece scrapped or reworked, exact measurement deviation against quality standard, and corrective disposition.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setActionFilter('ALL')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                        actionFilter === 'ALL'
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({(qc.defectAuditLog || []).length})
                    </button>
                    <button
                      onClick={() => setActionFilter('SCRAPPED')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                        actionFilter === 'SCRAPPED'
                          ? 'bg-rose-700 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Scrapped ({((qc.defectAuditLog || []).filter(r => r.action === 'SCRAPPED')).length})
                    </button>
                    <button
                      onClick={() => setActionFilter('REWORKED')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                        actionFilter === 'REWORKED'
                          ? 'bg-amber-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Reworked ({((qc.defectAuditLog || []).filter(r => r.action === 'REWORKED')).length})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Material ID</th>
                        <th className="py-2.5 px-3">Part Type</th>
                        <th className="py-2.5 px-3">Disposition</th>
                        <th className="py-2.5 px-3">Inspection Stage</th>
                        <th className="py-2.5 px-3">Standard Spec</th>
                        <th className="py-2.5 px-3">Measured Value</th>
                        <th className="py-2.5 px-3">Deviation Margin</th>
                        <th className="py-2.5 px-3">Root Cause / Engineering Note</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {(qc.defectAuditLog || [])
                        .filter(r => actionFilter === 'ALL' || r.action === actionFilter)
                        .map(record => (
                          <tr key={record.id} className="hover:bg-slate-900/60 transition">
                            <td className="py-2.5 px-3 font-bold text-cyan-300">{record.itemId}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-300">
                              {record.rmType === 'RM1'
                                ? 'RM1 (Bar Stock)'
                                : record.rmType === 'RM2'
                                ? 'RM2 (Casting Housing)'
                                : 'RM3 (Gear Blank)'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                  record.action === 'SCRAPPED'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                                }`}
                              >
                                {record.action === 'SCRAPPED' ? (
                                  <Trash2 className="w-3 h-3 text-rose-400" />
                                ) : (
                                  <RotateCcw className="w-3 h-3 text-amber-400" />
                                )}
                                {record.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 font-sans">{record.stage}</td>
                            <td className="py-2.5 px-3 text-slate-400">{record.standardValue}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-200">{record.measuredValue}</td>
                            <td className="py-2.5 px-3 font-semibold text-rose-300">{record.deviationMargin}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-400 max-w-sm">{record.reason}</td>
                            <td className="py-2.5 px-3 text-slate-500">{record.timestampStr}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* Tab 3: Original Subsystem Screenshot Validation */
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                    Simulink Subsystem Architecture Reference (Provided Screenshot)
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    public/assets/aistudio/Screenshot_2026-11-03_2032002_16658021.png
                  </span>
                </div>
                <p className="text-slate-400 text-xs mb-3">
                  This image confirms the exact block wiring implemented inside AeroTwin's Quality Control digital twin:
                </p>

                <div className="bg-white/95 p-3 rounded-xl flex justify-center overflow-hidden border border-slate-700">
                  <img
                    src="/assets/aistudio/Screenshot_2026-11-03_2032002_16658021.png"
                    alt="Simulink Quality Control Subsystem"
                    className="max-h-72 object-contain rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Quality Control Subsystem • SimEvents v2026.1 Reference</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
          >
            Close Subsystem View
          </button>
        </div>
      </div>
    </div>
  );
};
