"use client";
// frontend/app/page.tsx

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AudioEditor from "@/components/AudioEditor";
import Equalizer from "@/components/Equalizer";
import TrackMixer from "@/components/TrackMixer";
import EffectsRack from "@/components/EffectsRack";
import ExportPanel from "@/components/ExportPanel";
import { useAudioStore } from "@/store/useAudioStore";

type ActivePanel = "editor" | "eq" | "mixer" | "fx" | "export";

const NAV_ITEMS: { id: ActivePanel; label: string; icon: string }[] = [
  { id: "editor",  label: "WAVEFORM",  icon: "⊿" },
  { id: "mixer",   label: "MIXER",     icon: "⊞" },
  { id: "eq",      label: "EQ",        icon: "≋" },
  { id: "fx",      label: "FX RACK",   icon: "◈" },
  { id: "export",  label: "EXPORT",    icon: "⇡" },
];

export default function Home() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("editor");
  const { tracks, isProcessing, processingLabel } = useAudioStore();

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      useAudioStore.getState().loadTrack(file);
    },
    []
  );

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden select-none">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="relative flex items-center justify-between px-6 py-3 border-b border-cyan-500/20 z-20">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-cyan-400 flex items-center justify-center glow-cyan">
            <span className="text-cyan-400 text-xs font-mono font-bold">A</span>
          </div>
          <div>
            <h1
              className="text-xl font-bold tracking-[0.3em] text-cyan-400 glitch-text glow-text-cyan"
              data-text="ALONE"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ALONE
            </h1>
            <p className="text-[9px] tracking-[0.4em] text-gray-500 uppercase" style={{ fontFamily: "var(--font-mono)" }}>
              Audio Studio
            </p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${tracks.length > 0 ? "bg-cyan-400 glow-cyan" : "bg-gray-700"}`} />
            <span className="text-[10px] font-mono text-gray-400 tracking-widest">
              {tracks.length > 0 ? `${tracks.length} TRACK${tracks.length > 1 ? "S" : ""} LOADED` : "NO TRACKS"}
            </span>
          </div>
          <VUMeterMini />
          <div className="text-[10px] font-mono text-gray-600 tracking-widest">44.1KHZ · 32BIT</div>
        </div>

        {/* Upload CTA */}
        <label className="btn-cyber text-xs cursor-pointer">
          <span>⊕ LOAD TRACK</span>
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </header>

      {/* ── AI SEPARATOR BANNER (if processing) ────────────────── */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-center gap-4 bg-cyan-500/10 border-b border-cyan-500/30 py-2 px-6"
          >
            <div className="loader-cyber w-4 h-4" />
            <span className="text-xs font-mono text-cyan-400 tracking-widest uppercase animate-pulse">
              {processingLabel}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LAYOUT ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left nav rail */}
        <nav className="flex flex-col items-center gap-1 w-14 py-4 border-r border-cyan-500/10 bg-black/50">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`w-10 h-10 flex flex-col items-center justify-center gap-0.5 rounded transition-all duration-200 group ${
                activePanel === item.id
                  ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-400"
                  : "text-gray-600 hover:text-gray-300"
              }`}
              title={item.label}
            >
              <span className="text-sm leading-none">{item.icon}</span>
              <span className="text-[7px] font-mono tracking-wider leading-none">
                {item.label.split(" ")[0].slice(0, 3)}
              </span>
            </button>
          ))}
        </nav>

        {/* Center content */}
        <div className="flex-1 overflow-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePanel}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full"
            >
              {activePanel === "editor"  && <AudioEditor />}
              {activePanel === "eq"      && <Equalizer />}
              {activePanel === "mixer"   && <TrackMixer />}
              {activePanel === "fx"      && <EffectsRack />}
              {activePanel === "export"  && <ExportPanel />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right sidebar — quick controls */}
        <aside className="w-44 border-l border-cyan-500/10 bg-black/50 flex flex-col p-3 gap-4">
          <QuickControl label="MASTER VOL" defaultValue={80} unit="%" />
          <QuickControl label="BPM" defaultValue={128} min={60} max={200} unit="" />
          <QuickControl label="PITCH" defaultValue={0} min={-12} max={12} unit="st" />
          <QuickControl label="REVERB" defaultValue={20} unit="%" />
          <div className="mt-auto">
            <AIRemoverCard />
          </div>
        </aside>
      </div>

      {/* ── FOOTER TRANSPORT ────────────────────────────────────── */}
      <TransportBar />
    </div>
  );
}

/* ─── Sub-Components ────────────────────────────────────────── */

function VUMeterMini() {
  const bars = [6, 10, 14, 10, 8, 12, 9, 5];
  return (
    <div className="flex items-end gap-px h-5">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-1.5 bg-cyan-400 vu-bar"
          style={{ height: `${h}px`, animationDelay: `${i * 70}ms` }}
          animate={{ height: [`${h}px`, `${Math.random() * 16 + 2}px`, `${h}px`] }}
          transition={{ repeat: Infinity, duration: 0.5 + i * 0.1, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function QuickControl({
  label,
  defaultValue,
  min = 0,
  max = 100,
  unit,
}: {
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  unit: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const { setMasterVolume, setBpm, setPitch } = useAudioStore();

  const handleChange = (v: number) => {
    setValue(v);
    if (label === "MASTER VOL") setMasterVolume(v / 100);
    if (label === "BPM") setBpm(v);
    if (label === "PITCH") setPitch(v);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[9px] font-mono text-gray-500 tracking-widest">{label}</span>
        <span className="text-[10px] font-mono text-cyan-400">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => handleChange(Number(e.target.value))}
        style={{ "--value": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}
      />
    </div>
  );
}

function AIRemoverCard() {
  const { separateTrack, activeTrackId, isProcessing } = useAudioStore();

  return (
    <div className="panel p-3 flex flex-col gap-2">
      <p className="text-[9px] font-mono text-cyan-500 tracking-widest uppercase">AI Separator</p>
      <p className="text-[8px] text-gray-500">Demucs · 4-stem separation</p>
      <button
        onClick={() => activeTrackId && separateTrack(activeTrackId)}
        disabled={!activeTrackId || isProcessing}
        className="btn-cyber text-[9px] w-full py-2 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {isProcessing ? "PROCESSING..." : "SEPARATE"}
      </button>
    </div>
  );
}

function TransportBar() {
  const { isPlaying, togglePlayback, currentTime, duration } = useAudioStore();

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <footer className="flex items-center justify-between px-6 py-3 border-t border-cyan-500/20 bg-black/80 backdrop-blur z-20">
      {/* Left: timecode */}
      <div className="font-mono text-cyan-400 text-sm tracking-widest glow-text-cyan">
        {fmt(currentTime)} / {fmt(duration)}
      </div>

      {/* Center: transport controls */}
      <div className="flex items-center gap-3">
        <TransportBtn icon="⏮" onClick={() => useAudioStore.getState().seek(0)} />
        <TransportBtn
          icon={isPlaying ? "⏸" : "▶"}
          primary
          onClick={togglePlayback}
        />
        <TransportBtn icon="⏹" onClick={() => { useAudioStore.getState().stop(); }} />
        <TransportBtn icon="⏺" onClick={() => {}} label="REC" />
      </div>

      {/* Right: BPM display */}
      <div className="font-mono text-gray-500 text-xs tracking-widest">
        <span className="text-cyan-400">{useAudioStore.getState().bpm}</span> BPM
      </div>
    </footer>
  );
}

function TransportBtn({
  icon, onClick, primary = false, label,
}: {
  icon: string; onClick: () => void; primary?: boolean; label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 w-9 h-9 border transition-all duration-150 text-sm
        ${primary
          ? "border-cyan-400 bg-cyan-500/20 text-cyan-400 glow-cyan hover:bg-cyan-500/30"
          : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
        }`}
    >
      {icon}
      {label && <span className="text-[8px] font-mono">{label}</span>}
    </button>
  );
}
