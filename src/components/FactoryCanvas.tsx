import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  ItemEntity,
  LineType,
  PlantSimulationState,
  Station,
} from '../types/factory';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Eye,
  Layers,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react';

interface FactoryCanvasProps {
  simulationState: PlantSimulationState;
  selectedStationId: string | null;
  onSelectStation: (stationId: string) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onStep: () => void;
  onReset: () => void;
  onOpenPlantConfigModal?: () => void;
}

export const FactoryCanvas: React.FC<FactoryCanvasProps> = ({
  simulationState,
  selectedStationId,
  onSelectStation,
  onTogglePlay,
  onSpeedChange,
  onStep,
  onReset,
  onOpenPlantConfigModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [viewMode, setViewMode] = useState<'physical' | 'simulink'>('physical');
  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('ALL');
  const [zoomLevel, setZoomLevel] = useState<number>(0.72);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 25, y: 15 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);

  const { stations, entities, timeSeconds, isRunning, simulationSpeed } = simulationState;

  // Station layout lookup
  const stationMap = useMemo(() => stations, [stations]);

  // Handle pan drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // Check hit test for hover
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
      const canvasY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

      let found: string | null = null;
      for (const st of Object.values(stations)) {
        if (
          canvasX >= st.x - 10 &&
          canvasX <= st.x + st.width + 10 &&
          canvasY >= st.y - 10 &&
          canvasY <= st.y + st.height + 10
        ) {
          found = st.id;
          break;
        }
      }
      setHoveredStationId(found);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoomLevel(prev => Math.min(2.0, Math.max(0.4, prev + zoomDelta)));
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hoveredStationId) {
      onSelectStation(hoveredStationId);
    }
  };

  // High performance 60fps canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Handle high-DPI scaling
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);

      // 1. Draw Factory Floor Grid / Blueprint lines
      drawGrid(ctx, viewMode);

      // 2. Draw Interconnecting Conveyor Paths & Event Routing
      drawConveyorsAndConnections(ctx, stations, viewMode, selectedLineFilter);

      // 3. Draw Stations & Machines
      for (const station of Object.values(stations)) {
        if (selectedLineFilter !== 'ALL' && station.line !== selectedLineFilter && station.line !== 'FINAL' && station.line !== 'MERGE') {
          // Dim non-selected lines
          ctx.globalAlpha = 0.25;
        } else {
          ctx.globalAlpha = 1.0;
        }

        if (viewMode === 'physical') {
          drawPhysicalStation(
            ctx,
            station,
            timeSeconds,
            station.id === selectedStationId,
            station.id === hoveredStationId
          );
        } else {
          drawSimulinkBlock(
            ctx,
            station,
            timeSeconds,
            station.id === selectedStationId,
            station.id === hoveredStationId
          );
        }
      }
      ctx.globalAlpha = 1.0;

      // 4. Draw Animated Moving Items / Workpieces on Conveyors
      drawAnimatedEntities(ctx, entities, stations, viewMode, selectedLineFilter, timeSeconds);

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    stations,
    entities,
    viewMode,
    zoomLevel,
    panOffset,
    selectedStationId,
    hoveredStationId,
    selectedLineFilter,
    timeSeconds,
  ]);

  return (
    <div className="relative w-full h-[580px] bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col select-none">
      {/* Top Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* View Mode & Filter Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('physical')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'physical'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Physical Plant Twin
            </button>
            <button
              onClick={() => setViewMode('simulink')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'simulink'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Simulink SimEvents View
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Line filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">Focus:</span>
            {(['ALL', 'RM1', 'RM2', 'RM3'] as const).map(line => (
              <button
                key={line}
                onClick={() => setSelectedLineFilter(line)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition ${
                  selectedLineFilter === line
                    ? 'bg-slate-700 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {line}
              </button>
            ))}
          </div>
        </div>

        {/* Simulation Playback & Speed Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <button
            onClick={onTogglePlay}
            className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition shadow-sm ${
              isRunning
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
            title={isRunning ? 'Pause Simulation' : 'Start Real-time Simulation'}
          >
            {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span className="hidden sm:inline">{isRunning ? 'Pause' : 'Simulate'}</span>
          </button>

          <button
            onClick={onStep}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Step forward +1s"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={onReset}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Reset Simulation Entities"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Speed Pills */}
          <div className="flex items-center gap-0.5 text-xs">
            {[0.5, 1, 5, 15, 60].map(spd => (
              <button
                key={spd}
                onClick={() => onSpeedChange(spd)}
                className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition ${
                  simulationSpeed === spd
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={spd === 60 ? 'Fast speed: 1s real = 1m simulated' : `${spd}x speed`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {onOpenPlantConfigModal && (
            <>
              <div className="h-4 w-px bg-slate-800 mx-0.5" />
              <button
                onClick={onOpenPlantConfigModal}
                className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/80 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                title="Configure 8-hour shift, truck arrival window, barehand unloading, and cycle times"
              >
                <span>Shift & Logistics</span>
              </button>
            </>
          )}

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setZoomLevel(z => Math.max(0.4, z - 0.1))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-slate-400 w-9 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(z => Math.min(2.0, z + 0.1))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoomLevel(0.72);
                setPanOffset({ x: 25, y: 15 });
              }}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Surface */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Shift Closed Banner */}
      {!simulationState.config.isShiftOpen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-amber-950/90 border border-amber-500/60 text-amber-200 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md text-xs font-semibold pointer-events-none">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span>FACTORY SHIFT CLOSED (8h shift elapsed) • Transporters & CNC Machines Powered Down • Unfinished Units in Arrears</span>
        </div>
      )}

      {/* Floating Status / Hover Information Pill */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-xs text-slate-300 pointer-events-none shadow-lg">
        {hoveredStationId && stationMap[hoveredStationId] ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <strong className="text-white font-bold">{stationMap[hoveredStationId].name}</strong>
            <span className="font-mono text-cyan-300">[{stationMap[hoveredStationId].simulinkTag}]</span>
            <span className="text-slate-400">
              Proc: <strong className="text-cyan-300">{stationMap[hoveredStationId].currentlyProcessingCount}</strong> | Queue:{' '}
              <strong className="text-amber-300">{stationMap[hoveredStationId].currentQueueCount}</strong> | Day:{' '}
              <strong className="text-emerald-400">{stationMap[hoveredStationId].processedToday}</strong> | Cum:{' '}
              <strong className="text-purple-300">{stationMap[hoveredStationId].processedCumulative}</strong>
            </span>
            <span className="text-[10px] text-cyan-400 font-semibold ml-1">(Click to open telemetry)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Click any machine or conveyor to inspect live sensor streams and predictive ML diagnosis</span>
          </div>
        )}
      </div>

      {/* Legend Indicator & 4-Metric Guide */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-300 pointer-events-none">
        <span className="font-mono text-[10px] text-slate-400 border-r border-slate-700 pr-2 mr-1">
          <span className="text-cyan-400 font-bold">P</span>:Proc{' '}
          <span className="text-amber-400 font-bold">Q</span>:Queue{' '}
          <span className="text-emerald-400 font-bold">D</span>:Day{' '}
          <span className="text-purple-400 font-bold">C</span>:Cum
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Nominal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Processing
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          High Load
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Fault / Maint
        </span>
      </div>
    </div>
  );
};

/* =========================================================================
   CANVAS RENDERING UTILITIES
   ========================================================================= */

function drawGrid(ctx: CanvasRenderingContext2D, viewMode: 'physical' | 'simulink') {
  ctx.strokeStyle = viewMode === 'physical' ? '#0f172a' : '#0a1122';
  ctx.lineWidth = 1;

  const gridSize = 40;
  const extent = 2500;

  ctx.beginPath();
  for (let x = 0; x <= extent; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 750);
  }
  for (let y = 0; y <= 750; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(extent, y);
  }
  ctx.stroke();

  // Lane separator guidelines for RM1, RM2, RM3
  if (viewMode === 'physical') {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);

    // Between RM1 & RM2
    ctx.beginPath();
    ctx.moveTo(30, 195);
    ctx.lineTo(1155, 195);
    ctx.stroke();

    // Between RM2 & RM3
    ctx.beginPath();
    ctx.moveTo(30, 365);
    ctx.lineTo(1155, 365);
    ctx.stroke();

    ctx.setLineDash([]);

    // Lane Labels
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('LINE 1 (RM1 - LATHE / SHAFT CELL)', 40, 40);
    ctx.fillText('LINE 2 (RM2 - MILLING / HOUSING CELL)', 40, 210);
    ctx.fillText('LINE 3 (RM3 - SHAPING / GEAR CELL)', 40, 380);

    // Dedicated enclosure card for Merge & Final Packaging System
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1160, 50, 1000, 485);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(1160, 50, 1000, 26);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('MERGE & FINAL PACKAGING SYSTEM (SYNCHRONOUS MERGE → ASSEMBLY → OUTBOUND)', 1175, 67);
  }
}

function drawConveyorsAndConnections(
  ctx: CanvasRenderingContext2D,
  stations: Record<string, Station>,
  viewMode: 'physical' | 'simulink',
  selectedLineFilter: string
) {
  // Define connections matching SimEvents model
  const links: [string, string][] = [
    // Line 1
    ['truck_rm1', 'unloading_rm1'],
    ['unloading_rm1', 'inventory_rm1'],
    ['inventory_rm1', 'transporter_rm1'],
    ['transporter_rm1', 'cnc_lathe'],
    ['cnc_lathe', 'buffer_rm1'],
    ['buffer_rm1', 'qc_rm1'],
    ['qc_rm1', 'converge_join'],

    // Line 2
    ['truck_rm2', 'unloading_rm2'],
    ['unloading_rm2', 'inventory_rm2'],
    ['inventory_rm2', 'transporter_rm2'],
    ['transporter_rm2', 'cnc_milling'],
    ['cnc_milling', 'buffer_rm2'],
    ['buffer_rm2', 'qc_rm2'],
    ['qc_rm2', 'converge_join'],

    // Line 3
    ['truck_rm3', 'unloading_rm3'],
    ['unloading_rm3', 'inventory_rm3'],
    ['inventory_rm3', 'transporter_rm3'],
    ['transporter_rm3', 'cnc_shaping'],
    ['cnc_shaping', 'buffer_rm3'],
    ['buffer_rm3', 'qc_rm3'],
    ['qc_rm3', 'converge_join'],

    // Final Assembly & Outfeed
    ['converge_join', 'final_assembly'],
    ['final_assembly', 'entity_queue'],
    ['entity_queue', 'packaging'],
    ['packaging', 'transporter_out'],
    ['transporter_out', 'entity_queue_out'],
    ['entity_queue_out', 'sink_dispatch'],
  ];

  for (const [fromId, toId] of links) {
    const s1 = stations[fromId];
    const s2 = stations[toId];
    if (!s1 || !s2) continue;

    const startX = s1.x + s1.width;
    let startY = s1.y + s1.height / 2;
    const endX = s2.x;
    let endY = s2.y + s2.height / 2;

    // Direct horizontal ports into and out of converge_join
    if (toId === 'converge_join') {
      endY = startY; // Line 1 (124), Line 2 (294), Line 3 (464) enter horizontally
    } else if (fromId === 'converge_join') {
      startY = endY; // Center output exits horizontally at 294 directly into final assembly
    }

    ctx.save();

    if (viewMode === 'physical') {
      // Draw conveyor belt body
      const isConveyorSection = s1.type.includes('transporter') || s2.type.includes('transporter');
      ctx.lineWidth = isConveyorSection ? 12 : 6;
      ctx.strokeStyle = '#1e293b';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      if (startY !== endY) {
        const midX = (startX + endX) / 2;
        ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
      } else {
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();

      // Conveyor belt tread center line
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
    } else {
      // Simulink SimEvents signal line (matching Simulink block diagram arrows)
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      if (startY !== endY) {
        const midX = (startX + endX) / 2;
        ctx.lineTo(midX, startY);
        ctx.lineTo(midX, endY);
        ctx.lineTo(endX, endY);
      } else {
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();

      // Draw arrow head
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 6, endY - 4);
      ctx.lineTo(endX - 6, endY + 4);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawPhysicalStation(
  ctx: CanvasRenderingContext2D,
  st: Station,
  timeSeconds: number,
  isSelected: boolean,
  isHovered: boolean
) {
  const { x, y, width, height, status, activeFault, type } = st;

  ctx.save();

  // Status glow if selected or faulted
  if (isSelected) {
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 18;
  } else if (activeFault !== 'NONE') {
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 20;
  } else if (isHovered) {
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
  }

  // Base background
  const hasFault = activeFault !== 'NONE';
  const isShiftClosed = status === 'SHIFT_CLOSED';
  ctx.fillStyle = isShiftClosed ? '#090d16' : hasFault ? '#4c0519' : isSelected ? '#0f172a' : '#090d16';
  ctx.strokeStyle = isShiftClosed ? '#334155' : hasFault ? '#f43f5e' : isSelected ? '#38bdf8' : isHovered ? '#64748b' : '#1e293b';
  ctx.lineWidth = isSelected ? 2.5 : 1.5;

  // Station box rounded rect
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0; // reset shadow

  // Specific visual icon/art based on machine type
  if (type === 'truck_source') {
    // Delivery Truck Graphic
    ctx.fillStyle = isShiftClosed ? '#475569' : '#3b82f6';
    ctx.fillRect(x + 8, y + 14, 30, 20);
    ctx.fillStyle = isShiftClosed ? '#64748b' : '#60a5fa';
    ctx.fillRect(x + 38, y + 18, 16, 16);
    // Wheels
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x + 18, y + 36, 5, 0, Math.PI * 2);
    ctx.arc(x + 46, y + 36, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type.includes('transporter')) {
    // Animated Conveyor Rollers (idle if shift closed)
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 4, y + 14, width - 8, height - 28);
    // Rotating rollers
    const rollerSpacing = 14;
    const phase = isShiftClosed ? 0 : (timeSeconds * 4) % rollerSpacing;
    ctx.fillStyle = isShiftClosed ? '#64748b' : '#94a3b8';
    for (let rx = x + 8 + phase; rx < x + width - 8; rx += rollerSpacing) {
      ctx.beginPath();
      ctx.arc(rx, y + height / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type.includes('cnc')) {
    // CNC Machine Spindle / Workhead
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 8, y + 8, width - 16, height - 16);
    // Rotating chuck or tool (idle if shift closed)
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    const rotationSpeed = !isShiftClosed && status === 'BUSY' ? timeSeconds * 12 : 0;
    ctx.rotate(rotationSpeed);
    ctx.strokeStyle = hasFault ? '#f43f5e' : isShiftClosed ? '#475569' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  } else if (st.isQueue) {
    // FIFO Queue Rack slots
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    const slots = 4;
    const slotW = (width - 12) / slots;
    for (let i = 0; i < slots; i++) {
      ctx.strokeRect(x + 6 + i * slotW, y + 8, slotW - 2, height - 16);
      if (i < st.currentQueueCount) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x + 7 + i * slotW, y + 10, slotW - 4, height - 20);
      }
    }
  } else if (type === 'quality_control') {
    // Laser QC scanner line (only active during open shift)
    if (!isShiftClosed) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, y + 6);
      ctx.lineTo(x + width / 2, y + height - 6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  } else if (type === 'packaging') {
    // Box / Carton graphic
    ctx.fillStyle = isShiftClosed ? '#78350f' : '#d97706';
    ctx.fillRect(x + 18, y + 12, 28, 24);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 18, y + 12, 28, 24);
  } else if (type === 'converge_join') {
    // 3-to-1 Industrial Synchronous Combiner Module
    const ports = [124, 294, 464];
    for (let i = 0; i < ports.length; i++) {
      const py = ports[i];
      // Intake port notch on left edge
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 2, py - 12, 14, 24);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, py - 12, 14, 24);

      // Port chevron indicator
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(x + 6, py - 5);
      ctx.lineTo(x + 12, py);
      ctx.lineTo(x + 6, py + 5);
      ctx.fill();

      // Convergence guide line into center output (294)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x + 16, py);
      ctx.lineTo(x + width - 6, 294);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Center output nozzle on right edge (at Final Assembly level: 294)
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(x + width - 12, 294 - 14, 10, 28);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(x + width - 12, 294 - 14, 10, 28);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + width - 9, 294 - 6);
    ctx.lineTo(x + width - 4, 294);
    ctx.lineTo(x + width - 9, 294 + 6);
    ctx.fill();

    // Central Combiner core badge
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 6, 294 - 24, width - 12, 48, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SYNC', x + width / 2, 294 - 7);
    ctx.fillText('3:1', x + width / 2, 294 + 4);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '7px monospace';
    ctx.fillText('MERGE', x + width / 2, 294 + 15);
  }

  // User Emergency Stop / Manual Component Halted Overlay
  if (st.isManuallyStopped) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, width - 2, height - 2, 6);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fee2e2';
    ctx.font = 'bold 8.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HALTED', x + width / 2, y + height / 2 + 3);
  } else if (isShiftClosed) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, width - 2, height - 2, 6);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 7.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OFF', x + width / 2, y + height / 2 + 3);
  } else if (status === 'LUNCH_BREAK') {
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, width - 2, height - 2, 6);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 7.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LUNCH', x + width / 2, y + height / 2 + 3);
  }

  // Label text
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(st.name, x + width / 2, y + height + 12);

  // Status Tag
  ctx.font = '8px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(st.simulinkTag, x + width / 2, y + height + 22);

  // 4-Metric Real-time Entity Tracking Badge
  const hudY = y + height + 26;
  const hudW = Math.max(width + 16, 116);
  const hudX = x + width / 2 - hudW / 2;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(hudX, hudY, hudW, 16, 4);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 7.5px monospace';
  ctx.textAlign = 'left';
  // P: Processing (Cyan)
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`P:${st.currentlyProcessingCount}`, hudX + 5, hudY + 11);
  // Q: In Queue (Amber)
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`Q:${st.currentQueueCount}`, hudX + hudW * 0.25, hudY + 11);
  // D: Today (Emerald)
  ctx.fillStyle = '#34d399';
  ctx.fillText(`D:${st.processedToday}`, hudX + hudW * 0.50, hudY + 11);
  // C: Cumulative (Purple)
  ctx.fillStyle = '#c084fc';
  ctx.fillText(`C:${st.processedCumulative}`, hudX + hudW * 0.75, hudY + 11);

  // Queue badge or utilization badge
  if (st.isQueue) {
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(x + width - 16, y - 6, 20, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${st.currentQueueCount}`, x + width - 6, y + 4);
  } else if (st.type !== 'truck_source' && st.type !== 'sink_dispatch') {
    // Utilization pill
    ctx.fillStyle = isShiftClosed ? '#1e293b' : st.utilization > 85 ? '#b45309' : '#1e293b';
    ctx.beginPath();
    ctx.roundRect(x + width - 24, y - 6, 28, 14, 4);
    ctx.fill();
    ctx.fillStyle = isShiftClosed ? '#64748b' : st.utilization > 85 ? '#fef3c7' : '#94a3b8';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(isShiftClosed ? '0%' : `${st.utilization}%`, x + width - 10, y + 4);
  }

  ctx.restore();
}

function drawSimulinkBlock(
  ctx: CanvasRenderingContext2D,
  st: Station,
  timeSeconds: number,
  isSelected: boolean,
  isHovered: boolean
) {
  const { x, y, width, height, isQueue, simulinkTag, activeFault, status } = st;
  const isShiftClosed = status === 'SHIFT_CLOSED';

  ctx.save();

  // Simulink exact style: crisp white/slate block with thin border, port arrows
  ctx.fillStyle = isShiftClosed ? '#090d16' : activeFault !== 'NONE' ? '#3b0714' : isSelected ? '#1e293b' : '#0f172a';
  ctx.strokeStyle = isShiftClosed ? '#334155' : activeFault !== 'NONE' ? '#f43f5e' : isSelected ? '#38bdf8' : '#cbd5e1';
  ctx.lineWidth = isSelected ? 2 : 1;

  if (isQueue) {
    // SimEvents FIFO Queue Block symbol
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();
    ctx.stroke();

    const slotW = width / 4;

    // Fill occupied sub-blocks with subtle status tint
    const occupiedSlots = Math.min(4, st.currentQueueCount);
    for (let i = 0; i < occupiedSlots; i++) {
      ctx.fillStyle = isSelected
        ? 'rgba(56, 189, 248, 0.18)'
        : 'rgba(148, 163, 184, 0.12)';
      ctx.fillRect(x + i * slotW + 1, y + 2, slotW - 2, height - 4);
    }

    // Internal queue dividers (SimEvents symbol: 3 lines creating exactly 4 sub-blocks)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const qx = x + slotW * i;
      ctx.beginPath();
      ctx.moveTo(qx, y + 6);
      ctx.lineTo(qx, y + height - 6);
      ctx.stroke();
    }

    // If queue count exceeds 4 sub-blocks, render neat overflow badge inside 4th sub-block
    if (st.currentQueueCount > 4) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`+${st.currentQueueCount - 3}`, x + 3.5 * slotW, y + height - 6);
    }
  } else if (st.type.includes('transporter')) {
    // SimEvents Delay / Transporter block
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();
    ctx.stroke();

    // Clock icon & "ti" parameter notation matching screenshot
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(x + width / 2 - 8, y + height / 2, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 10px serif';
  } else if (st.type === 'converge_join') {
    // Simulink / SimEvents Combiner MUX block matching screenshot
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();
    ctx.stroke();

    // 3 input port indicators on left at 124, 294, 464
    const portYs = [124, 294, 464];
    for (const py of portYs) {
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(x + 2, py - 4);
      ctx.lineTo(x + 7, py);
      ctx.lineTo(x + 2, py + 4);
      ctx.fill();
    }

    // Output port chevron on right at 294
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(x + width - 7, 294 - 4);
    ctx.lineTo(x + width - 2, 294);
    ctx.lineTo(x + width - 7, 294 + 4);
    ctx.fill();

    // Symbol & Text
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('3:1', x + width / 2, 294 - 4);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '7px monospace';
    ctx.fillText('JOIN', x + width / 2, 294 + 7);
  } else {
    // Standard SimEvents Single Server / Process Block
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();
    ctx.stroke();

    // Circle server symbol matching Simulink screenshot
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(x + width / 2, y + height / 2, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isShiftClosed ? '0' : '1', x + width / 2, y + height / 2 + 3);

    // Attached Simulink Scope block icon on top (as in screenshot!)
    ctx.strokeRect(x + width / 2 - 7, y - 24, 14, 14);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(x + width / 2 - 6, y - 23, 12, 12);
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(x + width / 2 - 4, y - 16);
    ctx.lineTo(x + width / 2 - 1, y - 20);
    ctx.lineTo(x + width / 2 + 2, y - 13);
    ctx.lineTo(x + width / 2 + 5, y - 17);
    ctx.stroke();
    // Scope wire
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y - 10);
    ctx.lineTo(x + width / 2, y);
    ctx.stroke();
  }

  // Exact Block Tag
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(simulinkTag, x + width / 2, y + height + 13);

  // 4-Metric Real-time Entity Tracking Badge in Simulink View
  const sHudY = y + height + 24;
  const sHudW = Math.max(width + 16, 116);
  const sHudX = x + width / 2 - sHudW / 2;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(sHudX, sHudY, sHudW, 14, 3);
  ctx.fill();
  ctx.stroke();

  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`P:${st.currentlyProcessingCount}`, sHudX + 4, sHudY + 10);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`Q:${st.currentQueueCount}`, sHudX + sHudW * 0.25, sHudY + 10);
  ctx.fillStyle = '#34d399';
  ctx.fillText(`D:${st.processedToday}`, sHudX + sHudW * 0.50, sHudY + 10);
  ctx.fillStyle = '#c084fc';
  ctx.fillText(`C:${st.processedCumulative}`, sHudX + sHudW * 0.75, sHudY + 10);

  ctx.restore();
}

function drawAnimatedEntities(
  ctx: CanvasRenderingContext2D,
  entities: ItemEntity[],
  stations: Record<string, Station>,
  viewMode: 'physical' | 'simulink',
  selectedLineFilter: string,
  timeSeconds: number
) {
  for (const entity of entities) {
    if (selectedLineFilter !== 'ALL' && entity.line !== selectedLineFilter && entity.line !== 'FINAL' && entity.line !== 'MERGE') {
      continue;
    }

    const currentStation = stations[entity.currentStationId];
    if (!currentStation) continue;

    let posX = currentStation.x + currentStation.width / 2;
    let posY = currentStation.y + currentStation.height / 2;

    // If moving on conveyor, interpolate between stations
    if (currentStation.type.includes('transporter')) {
      const nextId = entity.targetStationId;
      const nextStation = nextId ? stations[nextId] : null;
      if (nextStation) {
        const startX = currentStation.x + 8;
        const startY = currentStation.y + currentStation.height / 2;
        // If downstream station is already occupied, stop within conveyor boundary so it never overlaps the machine block edge
        const isNextOccupied = Boolean(nextStation.currentProcessingEntityId && nextStation.currentProcessingEntityId !== entity.id);
        const endX = isNextOccupied ? (currentStation.x + currentStation.width - 8) : nextStation.x;
        const endY = nextStation.y + nextStation.height / 2;

        const t = Math.min(1.0, Math.max(0.0, entity.positionRatio));
        posX = startX + (endX - startX) * t;
        posY = startY + (endY - startY) * t;
      }
    } else if (currentStation.isQueue) {
      // Find position of this entity inside the queue
      const qEntities = entities.filter(e => e.currentStationId === currentStation.id && !e.isProcessing);
      const qIndex = qEntities.indexOf(entity);

      // When the 4 sub-blocks inside the inventory/queue block get full, limit entity blocks inside the block!
      // Strictly prevent entities from getting onto other components!
      if (qIndex < 0 || qIndex >= 4) {
        continue;
      }

      const slotW = currentStation.width / 4;
      posX = currentStation.x + (qIndex + 0.5) * slotW;
      posY = currentStation.y + currentStation.height / 2;
    }

    // Render entity token
    ctx.save();
    ctx.translate(posX, posY);

    if (viewMode === 'physical') {
      // Detailed item graphic based on manufacturing stage
      if (entity.type === 'RM1_BILLET') {
        // Alloy bar cylinder
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-7, -4, 14, 8);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(-7, -4, 14, 8);
      } else if (entity.type === 'RM2_CASTING') {
        // Rough casting block
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.roundRect(-6, -6, 12, 12, 2);
        ctx.fill();
        ctx.stroke();
      } else if (entity.type === 'RM3_PLATE') {
        // Disc / Gear blank
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (entity.type.includes('MACHINED')) {
        // Machined precision metallic part
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(-6, -5, 12, 10, 2);
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.stroke();
      } else if (entity.type.includes('SUBASSEMBLY')) {
        // Subassembly unit
        ctx.fillStyle = '#818cf8';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4f46e5';
        ctx.stroke();
      } else if (entity.type === 'ASSEMBLED_UNIT') {
        // Completed assembled mechanism
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.roundRect(-8, -7, 16, 14, 3);
        ctx.fill();
        ctx.strokeStyle = '#059669';
        ctx.stroke();
      } else {
        // Packaged box
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-7, -7, 14, 14);
        ctx.strokeStyle = '#d97706';
        ctx.strokeRect(-7, -7, 14, 14);
      }
    } else {
      // SimEvents entity ball / packet symbol
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}
