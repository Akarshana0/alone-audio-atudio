"use client";
// frontend/components/TrackMixer.tsx
// Multi-track mixer with volume, mute, solo, and crossfade.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioStore } from "@/store/useAudioStore";

export default function TrackMixer() {
  const { tracks, activeTrackId, setActiveTrack, updateTrackVolume,
          toggleMute, toggleSolo, removeTrack } = useAudioStore();
  const [crossfade, setCrossfade] = useState(50);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>
            MULTI-TRACK MIXER
          </h2>
          <p className="text-[10px] font-mono text-gray-500 mt-0.5">
            {tracks.length} track{tracks.length !== 1 ? "s" : ""} loaded
          </p>
        </div>

        {/* Crossfade */}
        <div className="flex items-center gap-3 panel px-4 py-2">
          <span className="text-[9px] font-mono text-gray-500">A</span>
          <div className="flex flex-col gap-1 w-28">
            <input
              type="range"
              min={0}
              max={100}
              value={crossfade}
              onChange={(e) => setCrossfade(Number(e.target.value))}
              style={{ "--value": `${crossfade}%` } as React.CSSProperties}
            />
            <p className="text-[8px] font-mono text-center text-cyan-400">
              CROSSFADE {crossfade}%
            </p>
          </div>
          <span className="text-[9px] font-mono text-gray-500">B</span>
        </div>
      </div>

      {/* Empty state */}
      {tracks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl text-gray-800 mb-3">⊞</p>
            <p className="text-[10px] font-mono text-gray-600 tracking-widest">NO TRACKS — LOAD AUDIO TO BEGIN</p>
          </div>
        </div>
      )}

      {/* Track channels */}
      <div className="flex gap-3 flex-1 overflow-x-auto pb-2">
        <AnimatePresence>
          {tracks.map((track, idx) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setActiveTrack(track.id)}
              className={`flex flex-col items-center w-24 shrink-0 panel p-2 cursor-pointer transition-all duration-200 ${
                activeTrackId === track.id ? "border-cyan-400/60" : "hover:border-cyan-500/20"
              }`}
            >
              {/* Track name */}
              <div className="w-full text-center mb-2">
                <p className="text-[8px] font-mono text-gray-400 truncate w-full" title={track.name}>
                  {track.name.slice(0, 10)}
                </p>
                <div className="w-full h-0.5 mt-1 rounded" style={{ background: track.color }} />
              </div>

              {/* VU meter strip */}
              <VUStrip color={track.color} active={!track.muted} />

              {/* Vertical volume fader */}
              <div className="my-3 flex flex-col items-center gap-1 h-28 justify-center">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(track.volume * 100)}
                  onChange={(e) => updateTrackVolume(track.id, Number(e.target.value) / 100)}
                  style={{
                    writingMode: "vertical-lr" as any,
                    direction: "rtl" as any,
                    width: "4px",
                    height: "100px",
                    "--value": `${track.volume * 100}%`,
                  } as React.CSSProperties}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Volume readout */}
              <p className="text-[9px] font-mono text-cyan-400">{Math.round(track.volume * 100)}</p>

              {/* Mute / Solo */}
              <div className="flex gap-1 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                  className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border rounded transition-all ${
                    track.muted
                      ? "border-red-500 text-red-500 bg-red-500/15"
                      : "border-gray-700 text-gray-600"
                  }`}
                >
                  M
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
                  className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border rounded transition-all ${
                    track.solo
                      ? "border-yellow-400 text-yellow-400 bg-yellow-400/15"
                      : "border-gray-700 text-gray-600"
                  }`}
                >
                  S
                </button>
              </div>

              {/* Stems badge */}
              {track.stems && (
                <div className="mt-2 text-[7px] font-mono text-cyan-500 bg-cyan-500/10 border border-cyan-500/20 px-1 rounded">
                  {Object.keys(track.stems).length} STEMS
                </div>
              )}

              {/* Remove */}
              <button
                onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
                className="mt-2 text-gray-700 hover:text-red-500 text-[10px] transition-colors"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Master channel */}
        <div className="flex flex-col items-center w-24 shrink-0 border border-cyan-500/30 bg-cyan-500/5 p-2 rounded">
          <p className="text-[8px] font-mono text-cyan-500 tracking-widest mb-2">MASTER</p>
          <VUStrip color="#00FFFF" active />
          <div className="my-3 h-28 flex items-center">
            <MasterFader />
          </div>
          <p className="text-[9px] font-mono text-cyan-400">
            {Math.round(useAudioStore.getState().masterVolume * 100)}
          </p>
        </div>
      </div>
    </div>
  );
}

function VUStrip({ color, active }: { color: string; active: boolean }) {
  const bars = [8, 12, 16, 14, 10, 8, 6, 4];
  return (
    <div className="flex items-end gap-px h-8">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-sm"
          style={{ background: active ? color : "#333", opacity: active ? 0.8 : 0.2 }}
          animate={active ? { height: [`${h}px`, `${Math.random() * 20 + 4}px`, `${h}px`] } : { height: "4px" }}
          transition={{ repeat: Infinity, duration: 0.4 + i * 0.08, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function MasterFader() {
  const { masterVolume, setMasterVolume } = useAudioStore();
  return (
    <input
      type="range"
      min={0}
      max={100}
      value={Math.round(masterVolume * 100)}
      onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
      style={{
        writingMode: "vertical-lr" as any,
        direction: "rtl" as any,
        width: "4px",
        height: "100px",
        "--value": `${masterVolume * 100}%`,
      } as React.CSSProperties}
    />
  );
}
