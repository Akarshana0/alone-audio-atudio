"use client";
// frontend/components/Equalizer.tsx
// 10-band parametric EQ with Tone.js integration.

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/useAudioStore";

const BANDS = [
  { label: "32",   freq: 32 },
  { label: "64",   freq: 64 },
  { label: "125",  freq: 125 },
  { label: "250",  freq: 250 },
  { label: "500",  freq: 500 },
  { label: "1K",   freq: 1000 },
  { label: "2K",   freq: 2000 },
  { label: "4K",   freq: 4000 },
  { label: "8K",   freq: 8000 },
  { label: "16K",  freq: 16000 },
];

const DB_MIN = -15;
const DB_MAX = 15;

const PRESETS: Record<string, number[]> = {
  FLAT:       [0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  BASS_BOOST: [8,  7,  5,  2,  0,  0,  0,  0,  0,  0],
  VOCAL_EQ:   [-2, -1, 0,  2,  4,  5,  4,  2,  0, -1],
  TREBLE:     [0,  0,  0,  0,  0,  2,  4,  6,  7,  8],
  V_SHAPE:    [6,  4,  2,  0, -3, -3,  0,  2,  4,  6],
  LOUDNESS:   [5,  3,  0,  0,  -1, -1, 0,  0,  3,  5],
};

export default function Equalizer() {
  const { eqBands, setEqBand } = useAudioStore();
  const [activePreset, setActivePreset] = useState<string>("FLAT");

  const applyPreset = useCallback((name: string) => {
    setActivePreset(name);
    PRESETS[name].forEach((gain, i) => setEqBand(i, gain));
  }, [setEqBand]);

  const resetAll = useCallback(() => applyPreset("FLAT"), [applyPreset]);

  // Normalize value for visual fill (0–100%)
  const fillPct = (db: number) =>
    Math.round(((db - DB_MIN) / (DB_MAX - DB_MIN)) * 100);

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>
            10-BAND EQUALIZER
          </h2>
          <p className="text-[10px] font-mono text-gray-500 mt-0.5">Parametric EQ · Real-time Tone.js</p>
        </div>
        <button onClick={resetAll} className="btn-cyber text-[9px] py-1 px-3">RESET</button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((preset) => (
          <button
            key={preset}
            onClick={() => applyPreset(preset)}
            className={`text-[9px] font-mono tracking-widest px-3 py-1.5 border transition-all duration-150 rounded ${
              activePreset === preset
                ? "border-cyan-400 text-cyan-400 bg-cyan-500/15 glow-cyan"
                : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
            }`}
          >
            {preset.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* EQ Bands */}
      <div className="panel flex-1 p-6">
        {/* Frequency response curve (decorative SVG) */}
        <EQCurve bands={eqBands} />

        {/* Vertical sliders */}
        <div className="flex items-end justify-around mt-6 gap-1">
          {BANDS.map((band, i) => (
            <div key={band.freq} className="eq-band flex flex-col items-center gap-2">
              {/* dB readout */}
              <motion.span
                className="text-[9px] font-mono text-cyan-400 w-8 text-center"
                animate={{ opacity: 1 }}
                key={eqBands[i]}
              >
                {eqBands[i] > 0 ? "+" : ""}{eqBands[i].toFixed(0)}
              </motion.span>

              {/* Vertical slider */}
              <div className="relative h-20 flex items-center justify-center">
                <input
                  type="range"
                  min={DB_MIN}
                  max={DB_MAX}
                  step={0.5}
                  value={eqBands[i]}
                  onChange={(e) => {
                    setEqBand(i, Number(e.target.value));
                    setActivePreset("CUSTOM");
                  }}
                  style={{
                    writingMode: "vertical-lr" as any,
                    direction: "rtl" as any,
                    width: "4px",
                    height: "80px",
                    "--value": `${fillPct(eqBands[i])}%`,
                  } as React.CSSProperties}
                />
                {/* Zero line indicator */}
                <div className="absolute left-0 right-0 h-px bg-gray-700 pointer-events-none"
                  style={{ top: "50%" }} />
              </div>

              {/* Frequency label */}
              <span className="text-[8px] font-mono text-gray-500 tracking-wider">{band.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick controls row */}
      <div className="grid grid-cols-3 gap-3">
        <QuickEQCard title="LOW SHELF" value={eqBands.slice(0,3).reduce((a,b)=>a+b,0)/3} />
        <QuickEQCard title="MID RANGE" value={eqBands.slice(3,7).reduce((a,b)=>a+b,0)/4} />
        <QuickEQCard title="HIGH SHELF" value={eqBands.slice(7).reduce((a,b)=>a+b,0)/3} />
      </div>
    </div>
  );
}

function QuickEQCard({ title, value }: { title: string; value: number }) {
  const hue = value > 0 ? 180 : value < 0 ? 0 : 180;
  const color = value > 0 ? "#00FFFF" : value < 0 ? "#FF003C" : "#444";
  return (
    <div className="panel p-3 flex flex-col gap-1">
      <p className="text-[8px] font-mono text-gray-500 tracking-widest">{title}</p>
      <p className="text-lg font-bold" style={{ color, fontFamily: "var(--font-mono)" }}>
        {value > 0 ? "+" : ""}{value.toFixed(1)} dB
      </p>
    </div>
  );
}

function EQCurve({ bands }: { bands: number[] }) {
  const W = 600;
  const H = 80;
  const padX = 20;
  const usableW = W - padX * 2;

  // Build SVG path from band values
  const pts = bands.map((db, i) => {
    const x = padX + (i / (bands.length - 1)) * usableW;
    const y = H / 2 - (db / 15) * (H / 2 - 8);
    return `${x},${y}`;
  });

  // Smooth path with cubic beziers
  const path = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt}`;
    const [px, py] = pts[i - 1].split(",").map(Number);
    const [cx, cy] = pt.split(",").map(Number);
    const mx = (px + cx) / 2;
    return acc + ` C ${mx},${py} ${mx},${cy} ${cx},${cy}`;
  }, "");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
      {/* Zero line */}
      <line x1={padX} y1={H / 2} x2={W - padX} y2={H / 2}
        stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Gradient fill */}
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,255,255,0.3)" />
          <stop offset="100%" stopColor="rgba(0,255,255,0)" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${W - padX},${H} L ${padX},${H} Z`}
        fill="url(#eq-fill)" />
      <path d={path} fill="none" stroke="#00FFFF" strokeWidth="2"
        style={{ filter: "drop-shadow(0 0 4px rgba(0,255,255,0.6))" }} />
    </svg>
  );
}
