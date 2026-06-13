import React, { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Target } from 'lucide-react';
import { getOrgBlastRadius } from '../lib/api';

interface Node {
  id: string;
  type: 'repo' | 'package';
  vulnerable: boolean;
  x?: number;
  y?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface BlastRadiusGraphProps {
  orgJobId: string;
}

export function BlastRadiusGraph({ orgJobId }: BlastRadiusGraphProps) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const settledRef = useRef(false);

  const [dimensions, setDimensions] = useState({ width: 0, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w > 0) setDimensions({ width: w, height: h || 600 });

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 50 && rect.height > 50) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    settledRef.current = false;
    setData(null);
    setError(null);
    setLoading(true);

    const fetchGraph = async () => {
      try {
        const result = await getOrgBlastRadius(orgJobId);
        setData({
          nodes: result.nodes.map((n: any) => ({ ...n })),
          links: result.links.map((l: any) => ({ ...l })),
        });
      } catch (err) {
        setError('Failed to load dependency graph.');
      } finally {
        setLoading(false);
      }
    };

    if (orgJobId) fetchGraph();
  }, [orgJobId]);

  const handleZoomIn = useCallback(() => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() * 1.5, 300);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() / 1.5, 300);
  }, []);

  const handleCenter = useCallback(() => {
    if (fgRef.current) fgRef.current.zoomToFit(400, 50);
  }, []);

  // Container ALWAYS renders so ref attaches and ResizeObserver measures correctly
  return (
    <div
      ref={containerRef}
      className="relative w-full h-[600px] rounded-lg border border-slate-800 overflow-hidden shadow-xl"
      style={{ backgroundColor: '#020617' }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500" />
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-rose-500 z-20">
          {error}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-slate-900/90 p-2 rounded-lg border border-slate-700 shadow-xl backdrop-blur-md">
        <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all" title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all" title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={handleCenter} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-all" title="Recenter">
          <Target className="w-4 h-4" />
        </button>
      </div>

      {/* Graph — renders once we have both data and a measured width */}
      {data && dimensions.width > 0 && (
        <div className="absolute inset-0">
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={data}
            nodeLabel="id"
            nodeRelSize={4}
            backgroundColor="rgba(0,0,0,0)"
            cooldownTicks={100}
            nodeCanvasObjectMode={() => 'replace'}
            onEngineStop={() => {
              if (fgRef.current && !settledRef.current) {
                settledRef.current = true;
                fgRef.current.zoomToFit(400, 50);
              }
            }}
            linkColor={(link: any) => {
              const isVuln = typeof link.target === 'object' ? link.target.vulnerable : false;
              return isVuln ? 'rgba(225, 29, 72, 0.6)' : 'rgba(71, 85, 105, 0.3)';
            }}
            linkWidth={(link: any) => {
              const isVuln = typeof link.target === 'object' ? link.target.vulnerable : false;
              return isVuln ? 1 : 0.5;
            }}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              if (node.x === undefined || node.y === undefined) return;

              const isRepo = node.type === 'repo';
              const isVuln = node.vulnerable;
              const NODE_R = isRepo ? 4.5 : isVuln ? 3 : 1.5;

              ctx.beginPath();
              ctx.arc(node.x, node.y, NODE_R, 0, 2 * Math.PI, false);

              if (isRepo) {
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1 / globalScale;
                ctx.stroke();
              } else if (isVuln) {
                ctx.fillStyle = '#e11d48';
                ctx.fill();
              } else {
                ctx.fillStyle = '#64748b';
                ctx.fill();
              }

              const showText = globalScale > 2.5 || (isRepo && globalScale > 1.2) || isVuln;

              if (showText && globalScale > 0.5) {
                const fontSize = Math.max(1, Math.min(20, (isRepo ? 10 : 8) / globalScale));
                ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.lineJoin = 'round';
                ctx.lineWidth = Math.max(0.5, 3 / globalScale);
                ctx.strokeStyle = '#020617';
                ctx.strokeText(node.id, node.x, node.y + NODE_R + 2 / globalScale);
                ctx.fillStyle = isRepo ? '#f8fafc' : isVuln ? '#fecdd3' : '#cbd5e1';
                ctx.fillText(node.id, node.x, node.y + NODE_R + 2 / globalScale);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}