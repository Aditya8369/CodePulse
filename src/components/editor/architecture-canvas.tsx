"use client";

import React, { useState } from "react";
import {
  Boxes,
  Database,
  ArrowRight,
  Type,
  StickyNote,
  Download,
  Share2,
  Trash2,
  Code2,
} from "lucide-react";

export interface CanvasShape {
  id: string;
  type: "box" | "microservice" | "database" | "arrow" | "text" | "sticky_note";
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  fromNodeId?: string;
  toNodeId?: string;
}

export interface ArchitectureCanvasProps {
  battleId: string;
  initialShapes?: CanvasShape[];
  onShapeAdd?: (shape: CanvasShape) => void;
  onExport?: (format: "svg" | "mermaid") => void;
}

export const ArchitectureCanvas: React.FC<ArchitectureCanvasProps> = ({
  battleId,
  initialShapes = [],
  onShapeAdd,
  onExport,
}) => {
  const [shapes, setShapes] = useState<CanvasShape[]>(
    initialShapes.length > 0
      ? initialShapes
      : [
          {
            id: "s_gateway",
            type: "microservice",
            x: 80,
            y: 120,
            width: 150,
            height: 70,
            label: "API Gateway",
            color: "#38bdf8",
          },
          {
            id: "s_db",
            type: "database",
            x: 340,
            y: 120,
            width: 130,
            height: 80,
            label: "ScyllaDB Cluster",
            color: "#10b981",
          },
        ],
  );

  const [activeTool, setActiveTool] = useState<CanvasShape["type"]>("microservice");

  const addShape = (type: CanvasShape["type"]) => {
    const id = `s_${Date.now()}`;
    const newShape: CanvasShape = {
      id,
      type,
      x: 150 + Math.random() * 200,
      y: 100 + Math.random() * 150,
      width: type === "database" ? 130 : 140,
      height: 70,
      label: type === "database" ? "New Database" : "New Service",
      color: type === "database" ? "#10b981" : "#38bdf8",
    };

    setShapes((prev) => [...prev, newShape]);
    if (onShapeAdd) {
      onShapeAdd(newShape);
    }
  };

  const removeShape = (id: string) => {
    setShapes((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0d14] overflow-hidden flex flex-col shadow-2xl relative">
      {/* Top Whiteboard Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-white/80 flex items-center gap-2 mr-2">
            🏛️ Architecture Whiteboard
          </span>

          <button
            onClick={() => addShape("microservice")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs font-medium transition-colors"
          >
            <Boxes className="w-3.5 h-3.5" />
            + Service
          </button>

          <button
            onClick={() => addShape("database")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            + Database
          </button>

          <button
            onClick={() => addShape("sticky_note")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium transition-colors"
          >
            <StickyNote className="w-3.5 h-3.5" />
            + Sticky Note
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onExport && onExport("mermaid")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            Mermaid
          </button>

          <button
            onClick={() => onExport && onExport("svg")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs font-semibold shadow-md shadow-sky-500/20 hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            Export SVG
          </button>
        </div>
      </div>

      {/* Interactive Vector Canvas Area */}
      <div className="relative w-full h-[450px] bg-grid-pattern bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] overflow-hidden p-6 select-none">
        {shapes.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border-2 p-3 flex flex-col justify-between shadow-xl cursor-move group transition-shadow"
            style={{
              position: "absolute",
              borderColor: s.color,
              backgroundColor: s.type === "database" ? "#064e3b" : "#0f172a",
              left: `${s.x}px`,
              top: `${s.y}px`,
              width: `${s.width}px`,
              height: `${s.height}px`,
            }}
          >
            <div className="flex items-center justify-between text-[11px] font-bold text-white/90">
              <span>{s.type === "database" ? "🗄️ Database" : "⚙️ Service"}</span>
              <button
                onClick={() => removeShape(s.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-0.5 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="text-xs font-semibold text-white truncate">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
