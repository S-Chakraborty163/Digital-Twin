import React, { useState } from 'react';
import { PlantOperationalConfig } from '../types/factory';
import { parseTimeStringToHour } from '../simulation/plantEngine';
import {
  Clock,
  Truck,
  Users,
  Cog,
  ShieldCheck,
  Package,
  Wrench,
  X,
  RotateCcw,
  Sparkles,
  Sliders,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface PlantConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PlantOperationalConfig;
  onSaveConfig: (updated: Partial<PlantOperationalConfig>) => void;
}

export function PlantConfigModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}: PlantConfigModalProps) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<PlantOperationalConfig>({ ...config });

  const handleApply = () => {
    // Explicitly synchronize arrivalHour for all trucks with their arrivalTimeStr
    const syncedTrucks = {
      rm1: {
        ...formData.trucks.rm1,
        arrivalHour: parseTimeStringToHour(formData.trucks.rm1.arrivalTimeStr),
      },
      rm2: {
        ...formData.trucks.rm2,
        arrivalHour: parseTimeStringToHour(formData.trucks.rm2.arrivalTimeStr),
      },
      rm3: {
        ...formData.trucks.rm3,
        arrivalHour: parseTimeStringToHour(formData.trucks.rm3.arrivalTimeStr),
      },
    };
    onSaveConfig({ ...formData, trucks: syncedTrucks });
    onClose();
  };

  const handleApplyStandardDefaults = () => {
    const standardDefaults: Partial<PlantOperationalConfig> = {
      shiftDurationHours: 8,
      shiftStartHour: 8,
      trucks: {
        rm1: {
          arrivalTimeStr: '08:00 AM',
          arrivalHour: 8.0,
          unitsDelivered: 120,
          unitsLeftToUnload: 120,
          hasArrived: false,
          isUnloading: false,
        },
        rm2: {
          arrivalTimeStr: '08:15 AM',
          arrivalHour: 8.25,
          unitsDelivered: 120,
          unitsLeftToUnload: 120,
          hasArrived: false,
          isUnloading: false,
        },
        rm3: {
          arrivalTimeStr: '08:30 AM',
          arrivalHour: 8.5,
          unitsDelivered: 120,
          unitsLeftToUnload: 120,
          hasArrived: false,
          isUnloading: false,
        },
      },
      dailyTargetUnits: 120,
      dailyRmPerTruck: 120,
      lunchBreakEnabled: true,
      lunchBreakStartHour: 13.0,
      lunchBreakDurationMinutes: 60,
      unloadingMode: 'MANUAL_HUMAN',
      humanCrewSize: 3,
      conveyorTransportTimeSeconds: 45,
      latheCycleTimeMinutes: 6.0,
      millingCycleTimeMinutes: 4.0,
      shapingCycleTimeMinutes: 3.5,
      bypassSubassemblyDirectToQC: true,
      qualityParameters: {
        inspectionDurationSeconds: 30,
        reworkDurationSeconds: 180,
        dimensionalToleranceMm: 0.02,
        surfaceRoughnessRa: 0.8,
        hardnessHrcMin: 45,
        hardnessHrcMax: 50,
      },
      assemblyMode: 'SEMI_AUTOMATED',
      assemblyCycleTimeMinutes: 4.0,
      packagingCycleTimeMinutes: 4.0,
    };

    setFormData(prev => ({
      ...prev,
      ...standardDefaults,
      trucks: {
        ...prev.trucks,
        ...standardDefaults.trucks,
      },
      qualityParameters: {
        ...prev.qualityParameters,
        ...standardDefaults.qualityParameters,
      },
    }));
  };

  const handleRandomizeTrucks = () => {
    // Generate random arrival hours between 8.0 and 10.0
    const h1 = 8.0 + Math.random() * 1.8;
    const h2 = 8.0 + Math.random() * 1.8;
    const h3 = 8.0 + Math.random() * 1.8;

    const toTimeStr = (hourVal: number) => {
      const h = Math.floor(hourVal);
      const m = Math.floor((hourVal - h) * 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} AM`;
    };

    setFormData(prev => ({
      ...prev,
      trucks: {
        rm1: { ...prev.trucks.rm1, arrivalHour: Number(h1.toFixed(2)), arrivalTimeStr: toTimeStr(h1) },
        rm2: { ...prev.trucks.rm2, arrivalHour: Number(h2.toFixed(2)), arrivalTimeStr: toTimeStr(h2) },
        rm3: { ...prev.trucks.rm3, arrivalHour: Number(h3.toFixed(2)), arrivalTimeStr: toTimeStr(h3) },
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white rounded-xl shadow">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Plant Operational Configuration & Shift Parameters
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded-full">
                  Discrete SimEvents
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure 8-hour shift schedule, autonomous truck arrivals, manual barehand unloading, cycle times, and QC parameters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyStandardDefaults}
              className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              title="Reset to standard industrial specifications (120 units RM/truck, 4m assembly)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Factory Standards</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-200">
          {/* SECTION 1: Shift & Operating Time */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>1. Shift Duration & Machine Operating Hours</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Daily 8:00 AM Start • Machine Wear Tracking
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Daily Shift Duration: <span className="text-cyan-400 font-bold">{formData.shiftDurationHours} Hours</span>
                </label>
                <input
                  type="range"
                  min="4"
                  max="24"
                  step="1"
                  value={formData.shiftDurationHours}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, shiftDurationHours: Number(e.target.value) }))
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>4 Hours</span>
                  <span className="text-cyan-400 font-semibold">8h Default</span>
                  <span>16h (2 Shifts)</span>
                  <span>24h (3 Shifts)</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                <div className="text-slate-300 font-semibold flex items-center justify-between">
                  <span>Shift Window:</span>
                  <span className="font-mono text-cyan-300">
                    08:00 AM – {(8 + formData.shiftDurationHours) % 24}:00 {8 + formData.shiftDurationHours >= 12 ? 'PM' : 'AM'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Machines run for the full duration everyday. Machine wear (VB flank wear and bearing spalling) accumulates proportionally to operating run-hours.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 1B: Lunch Break Schedule */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>1B. Lunch Time Break Schedule (Factory Floor Rest Period)</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                <span>Enable Lunch Break</span>
                <input
                  type="checkbox"
                  checked={formData.lunchBreakEnabled}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, lunchBreakEnabled: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            {formData.lunchBreakEnabled ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Lunch Start Time:
                  </label>
                  <select
                    value={formData.lunchBreakStartHour}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        lunchBreakStartHour: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value={11.5}>11:30 AM</option>
                    <option value={12.0}>12:00 PM</option>
                    <option value={12.5}>12:30 PM</option>
                    <option value={13.0}>01:00 PM (Default)</option>
                    <option value={13.5}>01:30 PM</option>
                    <option value={14.0}>02:00 PM</option>
                  </select>
                  <span className="text-[10px] text-slate-500">Default: 1:00 PM (13:00)</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Lunch Duration:
                  </label>
                  <select
                    value={formData.lunchBreakDurationMinutes}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        lunchBreakDurationMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour - Default)</option>
                    <option value={90}>90 Minutes (1.5 Hours)</option>
                  </select>
                  <span className="text-[10px] text-slate-500">Default: 1 Hour (60 min)</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-xs space-y-1">
                  <div className="text-slate-300 font-semibold flex items-center justify-between">
                    <span>Active Lunch Window:</span>
                    <span className="font-mono text-amber-300 font-bold">
                      {Math.floor(formData.lunchBreakStartHour)}:{Math.round((formData.lunchBreakStartHour % 1) * 60).toString().padStart(2, '0')} – {Math.floor(formData.lunchBreakStartHour + formData.lunchBreakDurationMinutes / 60)}:{Math.round(((formData.lunchBreakStartHour + formData.lunchBreakDurationMinutes / 60) % 1) * 60).toString().padStart(2, '0')} PM
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    During lunch break, human operators pause unloading & assembly operations. Stations display status <span className="font-mono text-amber-300">LUNCH_BREAK</span> and machine wear is arrested.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 text-xs text-slate-400 italic bg-slate-900/40 rounded-lg border border-slate-800/60">
                Lunch break is disabled. Factory will operate continuously throughout the {formData.shiftDurationHours}-hour shift without operator meal pause.
              </div>
            )}
          </div>

          {/* SECTION 2: Autonomous Truck Logistics */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <Truck className="w-4 h-4 text-cyan-400" />
                <span>2. Raw Material Truck Delivery Schedule (8:00 AM – 10:00 AM)</span>
              </div>
              <button
                type="button"
                onClick={handleRandomizeTrucks}
                className="px-2 py-1 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/80 rounded text-[11px] font-semibold flex items-center gap-1 transition"
              >
                <Sparkles className="w-3 h-3" />
                Randomize Arrival Times (8-10 AM)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Truck RM1 */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Truck RM1 (Shaft Stock)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                    RM1
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Arrival Time (8-10 AM):</label>
                  <input
                    type="text"
                    value={formData.trucks.rm1.arrivalTimeStr}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        trucks: {
                          ...prev.trucks,
                          rm1: {
                            ...prev.trucks.rm1,
                            arrivalTimeStr: val,
                            arrivalHour: parseTimeStringToHour(val),
                          },
                        },
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Units Delivered:</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={formData.trucks.rm1.unitsDelivered}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        trucks: {
                          ...prev.trucks,
                          rm1: { ...prev.trucks.rm1, unitsDelivered: Number(e.target.value) },
                        },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-[10px] text-slate-500">Default: 120 units (Target: 120 finished goods)</span>
                </div>
              </div>

              {/* Truck RM2 */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Truck RM2 (Housing Castings)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                    RM2
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Arrival Time (8-10 AM):</label>
                  <input
                    type="text"
                    value={formData.trucks.rm2.arrivalTimeStr}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        trucks: {
                          ...prev.trucks,
                          rm2: {
                            ...prev.trucks.rm2,
                            arrivalTimeStr: val,
                            arrivalHour: parseTimeStringToHour(val),
                          },
                        },
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Units Delivered:</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={formData.trucks.rm2.unitsDelivered}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        trucks: {
                          ...prev.trucks,
                          rm2: { ...prev.trucks.rm2, unitsDelivered: Number(e.target.value) },
                        },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-[10px] text-slate-500">Default: 120 units (Target: 120 finished goods)</span>
                </div>
              </div>

              {/* Truck RM3 */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">Truck RM3 (Gear Blanks)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                    RM3
                  </span>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Arrival Time (8-10 AM):</label>
                  <input
                    type="text"
                    value={formData.trucks.rm3.arrivalTimeStr}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        trucks: {
                          ...prev.trucks,
                          rm3: {
                            ...prev.trucks.rm3,
                            arrivalTimeStr: val,
                            arrivalHour: parseTimeStringToHour(val),
                          },
                        },
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Units Delivered:</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={formData.trucks.rm3.unitsDelivered}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        trucks: {
                          ...prev.trucks,
                          rm3: { ...prev.trucks.rm3, unitsDelivered: Number(e.target.value) },
                        },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-[10px] text-slate-500">Default: 120 units (Target: 120 finished goods)</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Material Handling & Unloading Equipment */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>3. Unloading Equipment & Labor Autonomy</span>
              </div>
              <span className="text-xs text-slate-400">
                Barehand human by default (no forklifts/cranes)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, unloadingMode: 'MANUAL_HUMAN' }))}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  formData.unloadingMode === 'MANUAL_HUMAN'
                    ? 'border-cyan-500 bg-cyan-950/30 text-white shadow'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">Barehand Human</span>
                    {formData.unloadingMode === 'MANUAL_HUMAN' && (
                      <span className="p-0.5 bg-cyan-500 rounded-full text-black">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Default specification. Manual handling with worker fatigue factor over the 8-hour shift.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-cyan-300 font-mono">
                  Rate: ~18s / crew size (with fatigue drift)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, unloadingMode: 'FORKLIFT' }))}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  formData.unloadingMode === 'FORKLIFT'
                    ? 'border-cyan-500 bg-cyan-950/30 text-white shadow'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">Industrial Forklifts</span>
                    {formData.unloadingMode === 'FORKLIFT' && (
                      <span className="p-0.5 bg-cyan-500 rounded-full text-black">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Electrically powered pallet forklifts. Consistent handling speed, zero fatigue penalty.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-cyan-300 font-mono">
                  Rate: 4.5s / unit
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, unloadingMode: 'OVERHEAD_CRANE' }))}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  formData.unloadingMode === 'OVERHEAD_CRANE'
                    ? 'border-cyan-500 bg-cyan-950/30 text-white shadow'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">Overhead Crane Gantry</span>
                    {formData.unloadingMode === 'OVERHEAD_CRANE' && (
                      <span className="p-0.5 bg-cyan-500 rounded-full text-black">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Overhead bridge hoist for batch billet slings. Highest throughput, heavy-duty.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-cyan-300 font-mono">
                  Rate: 2.5s / unit
                </div>
              </button>
            </div>

            {formData.unloadingMode === 'MANUAL_HUMAN' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200">Human Unloading Crew Size:</span>
                  <p className="text-[11px] text-slate-400">More workers reduce handling cycle time per raw material unit.</p>
                </div>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 6].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, humanCrewSize: size }))}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                        formData.humanCrewSize === size
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {size} Workers {size === 3 ? '(Default)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: Transporters & Machining Cycle Times */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <Cog className="w-4 h-4 text-cyan-400" />
                <span>4. Conveyor Transport & Machining Cycle Times</span>
              </div>
              <span className="text-xs text-slate-400">Configured to exact prompt values</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Conveyor */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1">
                <label className="text-xs font-bold text-slate-200 block">
                  Conveyor Transport Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={formData.conveyorTransportTimeSeconds}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        conveyorTransportTimeSeconds: Number(e.target.value),
                      }))
                    }
                    className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">Seconds (45s default)</span>
                </div>
                <p className="text-[10px] text-slate-500">Transports RM one by one to workstation</p>
              </div>

              {/* Lathe */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1">
                <label className="text-xs font-bold text-slate-200 block">
                  CNC Lathe Cycle Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1.0"
                    max="30.0"
                    step="0.5"
                    value={formData.latheCycleTimeMinutes}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        latheCycleTimeMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">Minutes (6.0m default)</span>
                </div>
                <p className="text-[10px] text-slate-500">Turning & facing shaft components</p>
              </div>

              {/* Milling */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1">
                <label className="text-xs font-bold text-slate-200 block">
                  CNC Milling Cycle Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1.0"
                    max="30.0"
                    step="0.5"
                    value={formData.millingCycleTimeMinutes}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        millingCycleTimeMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">Minutes (4.0m default)</span>
                </div>
                <p className="text-[10px] text-slate-500">Boring & facing casting housings</p>
              </div>

              {/* Shaping */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1">
                <label className="text-xs font-bold text-slate-200 block">
                  CNC Shaping Cycle Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1.0"
                    max="30.0"
                    step="0.5"
                    value={formData.shapingCycleTimeMinutes}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        shapingCycleTimeMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">Minutes (3.5m default)</span>
                </div>
                <p className="text-[10px] text-slate-500">Gear tooth shaping & slot cutting</p>
              </div>
            </div>
          </div>

          {/* SECTION 5: Quality Control Parameters (Subassembly removed) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>5. Quality Control Parameters (Direct Routing from Buffer)</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400">Subassembly Block Bypassed / Removed</span>
            </div>

            <p className="text-xs text-slate-400">
              Machined components flow directly from line buffers into the 3-stage Quality Control subsystem (Check I → Check II → Rework → Check III) prior to converge assembly.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                <label className="text-[11px] text-slate-400 block font-semibold">Inspection Time:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={formData.qualityParameters.inspectionDurationSeconds}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        qualityParameters: {
                          ...prev.qualityParameters,
                          inspectionDurationSeconds: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">s (30s)</span>
                </div>
                <div className="flex gap-1 pt-0.5">
                  {[
                    { sec: 30, label: '30s' },
                    { sec: 90, label: '1m 30s' },
                    { sec: 45, label: '45s' },
                  ].map(opt => (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() =>
                        setFormData(prev => ({
                          ...prev,
                          qualityParameters: {
                            ...prev.qualityParameters,
                            inspectionDurationSeconds: opt.sec,
                          },
                        }))
                      }
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                        formData.qualityParameters.inspectionDurationSeconds === opt.sec
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                <label className="text-[11px] text-slate-400 block font-semibold">Rework Time:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="10"
                    max="600"
                    value={formData.qualityParameters.reworkDurationSeconds ?? 180}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        qualityParameters: {
                          ...prev.qualityParameters,
                          reworkDurationSeconds: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">s (3 min)</span>
                </div>
                <div className="flex gap-1 pt-0.5">
                  {[
                    { sec: 180, label: '3m' },
                    { sec: 120, label: '2m' },
                    { sec: 240, label: '4m' },
                  ].map(opt => (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() =>
                        setFormData(prev => ({
                          ...prev,
                          qualityParameters: {
                            ...prev.qualityParameters,
                            reworkDurationSeconds: opt.sec,
                          },
                        }))
                      }
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                        (formData.qualityParameters.reworkDurationSeconds ?? 180) === opt.sec
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <label className="text-[11px] text-slate-400 block">Dimensional Tolerance:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.005"
                    min="0.005"
                    max="0.1"
                    value={formData.qualityParameters.dimensionalToleranceMm}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        qualityParameters: {
                          ...prev.qualityParameters,
                          dimensionalToleranceMm: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">± mm (0.02mm)</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <label className="text-[11px] text-slate-400 block">Surface Roughness Ra:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0.2"
                    max="3.2"
                    value={formData.qualityParameters.surfaceRoughnessRa}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        qualityParameters: {
                          ...prev.qualityParameters,
                          surfaceRoughnessRa: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">µm (0.8µm)</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <label className="text-[11px] text-slate-400 block">Hardness Range (HRC):</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="20"
                    max="65"
                    value={formData.qualityParameters.hardnessHrcMin}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        qualityParameters: {
                          ...prev.qualityParameters,
                          hardnessHrcMin: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-500">–</span>
                  <input
                    type="number"
                    min="20"
                    max="65"
                    value={formData.qualityParameters.hardnessHrcMax}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        qualityParameters: {
                          ...prev.qualityParameters,
                          hardnessHrcMax: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-xs text-slate-400">HRC</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: Final Assembly & Packaging */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                <Package className="w-4 h-4 text-cyan-400" />
                <span>6. Final Assembly Mode (4 Min Average) & Packaging</span>
              </div>
              <span className="text-xs text-slate-400">Converged 3-line assembly</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  Final Assembly Automation Level:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="assemblyMode"
                      value="FULLY_AUTOMATED"
                      checked={formData.assemblyMode === 'FULLY_AUTOMATED'}
                      onChange={() =>
                        setFormData(prev => ({
                          ...prev,
                          assemblyMode: 'FULLY_AUTOMATED',
                          assemblyCycleTimeMinutes: 3.0,
                        }))
                      }
                      className="accent-cyan-500"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-bold text-slate-200">Fully Automated Robotic Cell</span>
                      <p className="text-[11px] text-slate-400">High speed articulated arms, ~3.0 min cycle time</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="assemblyMode"
                      value="SEMI_AUTOMATED"
                      checked={formData.assemblyMode === 'SEMI_AUTOMATED'}
                      onChange={() =>
                        setFormData(prev => ({
                          ...prev,
                          assemblyMode: 'SEMI_AUTOMATED',
                          assemblyCycleTimeMinutes: 4.0,
                        }))
                      }
                      className="accent-cyan-500"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-bold text-slate-200">Semi-Automated (Operator + Collaborative Cobot)</span>
                      <p className="text-[11px] text-slate-400">Standard balanced setup, 4.0 minutes on average</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="assemblyMode"
                      value="PURELY_MANUAL"
                      checked={formData.assemblyMode === 'PURELY_MANUAL'}
                      onChange={() =>
                        setFormData(prev => ({
                          ...prev,
                          assemblyMode: 'PURELY_MANUAL',
                          assemblyCycleTimeMinutes: 5.5,
                        }))
                      }
                      className="accent-cyan-500"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-bold text-slate-200">Purely Manual Human Assembly</span>
                      <p className="text-[11px] text-slate-400">Manual torque wrenching by technicians, ~5.5m</p>
                    </div>
                  </label>
                </div>

                <div className="mt-2 bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">Custom Assembly Cycle Time:</span>
                    <span className="font-mono text-cyan-300 font-bold">{formData.assemblyCycleTimeMinutes} min (Avg 4.0m)</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={formData.assemblyCycleTimeMinutes}
                    onChange={e => setFormData(prev => ({ ...prev, assemblyCycleTimeMinutes: Number(e.target.value) }))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  Packaging Station:
                </label>
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Packaging Cycle Time:</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {formData.packagingCycleTimeMinutes} Minutes (240s)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={formData.packagingCycleTimeMinutes}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        packagingCycleTimeMinutes: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1.0 min</span>
                    <span className="text-cyan-400 font-semibold">4.0 min Default</span>
                    <span>10.0 min</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    After packaging takes 4 minutes, completed units are moved via outfeed conveyor to the warehouse for dispatch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>All parameter updates reflect in real-time across simulation and telemetry streams.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/40 flex items-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              <span>Apply Operational Parameters</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
