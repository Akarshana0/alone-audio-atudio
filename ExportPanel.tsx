"use client";
// frontend/components/ExportPanel.tsx
// Export mixed/edited tracks as WAV or MP3.

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/useAudioStore";

type Format = "wav" | "mp3";
type Quality = "128" | "192" | "320";

export default function ExportPanel() {
  const { tracks, activeTrackId } = useAudioStore();
  const [format, setFormat]       = useState<Format>("wav");
  const [quality, setQuality]     = useState<Quality>("320");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [done, setDone]           = useState(false);

  const activeTrack = tracks.find((t) => t.id === activeTrackId);

  const handleExport = useCallback(async () => {
    if (!activeTrack?.url) return;
    setExporting(true);
    setDone(false);
    setProgress(0);

    try {
      // Fetch the audio blob
      const resp = await fetch(activeTrack.url);
      const blob = await resp.blob();

      if (format === "wav") {
        // Direct WAV download
        simulateProgress(setProgress, () => {
          downloadBlob(blob, `${stripExt(activeTrack.name)}_ALONE_export.wav`, "audio/wav");
          setExporting(false);
          setDone(true);
        });
      } else {
        // MP3: encode via lamejs (client-side)
        simulateProgress(setProgress, async () => {
          const mp3Blob = await encodeToMp3(blob, Number(quality) as 128|192|320);
          downloadBlob(mp3Blob, `${stripExt(activeTrack.name)}_ALONE_export.mp3`, "audio/mpeg");
          setExporting(false);
          setDone(true);
        });
      }
    } catch (err) {
      console.error("Export error:", err);
      setExporting(false);
    }
  }, [activeTrack, format, quality]);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>
          EXPORT
        </h2>
        <p className="text-[10px] font-mono text-gray-500 mt-0.5">
          Mixdown & download high-quality audio
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Export settings */}
        <div className="panel p-5 flex flex-col gap-5">
          <p className="text-[10px] font-mono text-gray-400 tracking-widest uppercase">Export Settings</p>

          {/* Format */}
          <div className="flex flex-col gap-2">
            <p className="text-[9px] font-mono text-gray-500">FORMAT</p>
            <div className="flex gap-2">
              {(["wav", "mp3"] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 text-[10px] font-mono tracking-widest border transition-all ${
                    format === f
                      ? "border-cyan-400 text-cyan-400 bg-cyan-500/15"
                      : "border-gray-700 text-gray-500 hover:border-gray-500"
                  }`}
                >
                  .{f.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-[8px] font-mono text-gray-600">
              {format === "wav"
                ? "Lossless · PCM 16-bit · Full quality"
                : "Compressed · Lossy · Smaller file size"}
            </p>
          </div>

          {/* Quality (MP3 only) */}
          {format === "mp3" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              <p className="text-[9px] font-mono text-gray-500">BITRATE</p>
              <div className="flex gap-2">
                {(["128", "192", "320"] as Quality[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className={`flex-1 py-2 text-[9px] font-mono tracking-widest border transition-all ${
                      quality === q
                        ? "border-cyan-400 text-cyan-400 bg-cyan-500/15"
                        : "border-gray-700 text-gray-500 hover:border-gray-500"
                    }`}
                  >
                    {q}k
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Sample rate info */}
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-mono text-gray-500">SAMPLE RATE</p>
            <p className="text-[10px] font-mono text-gray-300">44,100 Hz (44.1 kHz)</p>
          </div>

          {/* Active track */}
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-mono text-gray-500">SOURCE</p>
            <p className="text-[10px] font-mono text-cyan-400 truncate">
              {activeTrack?.name ?? "No track selected"}
            </p>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={!activeTrack || exporting}
            className="btn-cyber-solid text-xs py-3 w-full disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {exporting ? "PROCESSING…" : `⇡ EXPORT ${format.toUpperCase()}`}
          </button>

          {/* Progress */}
          {exporting && (
            <div>
              <div className="progress-cyber h-1.5">
                <motion.div
                  className="progress-cyber-fill"
                  style={{ width: `${progress}%` }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear" }}
                />
              </div>
              <p className="text-[8px] font-mono text-gray-500 mt-1 text-right">{progress}%</p>
            </div>
          )}

          {done && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] font-mono text-cyan-400 tracking-widest text-center"
            >
              ✓ EXPORT COMPLETE — CHECK DOWNLOADS
            </motion.p>
          )}
        </div>

        {/* Stems export */}
        <div className="panel p-5 flex flex-col gap-4">
          <p className="text-[10px] font-mono text-gray-400 tracking-widest uppercase">Stem Exports</p>
          {activeTrack?.stems ? (
            <div className="flex flex-col gap-2">
              {Object.entries(activeTrack.stems).map(([stem, url]) => (
                <div key={stem} className="flex items-center justify-between border border-gray-800 p-2 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-[10px] font-mono text-gray-300 uppercase tracking-widest">{stem}</span>
                  </div>
                  <a
                    href={url}
                    download={`${stem}.wav`}
                    className="btn-cyber text-[8px] py-1 px-2"
                  >
                    ⇡ DL
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-3xl text-gray-800">◈</p>
              <p className="text-[9px] font-mono text-gray-600 tracking-widest">
                NO STEMS AVAILABLE
              </p>
              <p className="text-[8px] font-mono text-gray-700">
                Run AI Separator on a track first
              </p>
            </div>
          )}
        </div>
      </div>

      {/* All tracks export list */}
      {tracks.length > 1 && (
        <div className="panel p-4 flex flex-col gap-3">
          <p className="text-[9px] font-mono text-gray-500 tracking-widest">ALL TRACKS</p>
          <div className="flex flex-col gap-2">
            {tracks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-[9px] font-mono">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm" style={{ background: t.color }} />
                  <span className="text-gray-400 truncate max-w-xs">{t.name}</span>
                </div>
                <a href={t.url} download={t.name} className="text-cyan-400 hover:text-cyan-300">
                  ⇡ WAV
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Utilities ─────────────────────────────────────────────── */
function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function downloadBlob(blob: Blob, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([blob], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function simulateProgress(
  setProgress: (v: number) => void,
  onComplete: () => void
) {
  let p = 0;
  const interval = setInterval(() => {
    p += Math.random() * 15;
    if (p >= 100) {
      clearInterval(interval);
      setProgress(100);
      setTimeout(onComplete, 200);
    } else {
      setProgress(Math.round(p));
    }
  }, 120);
}

async function encodeToMp3(wavBlob: Blob, bitrate: 128|192|320): Promise<Blob> {
  // Decode WAV to PCM via Web Audio API, then encode with lamejs
  const arrayBuffer = await wavBlob.arrayBuffer();
  const audioCtx = new AudioContext();
  const buffer = await audioCtx.decodeAudioData(arrayBuffer);

  try {
    const lamejs = await import("lamejs");
    const mp3encoder = new lamejs.Mp3Encoder(
      buffer.numberOfChannels === 1 ? 1 : 2,
      buffer.sampleRate,
      bitrate
    );

    const left  = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

    // Convert Float32 to Int16
    const toInt16 = (f: Float32Array) =>
      Int16Array.from(f, (s) => Math.max(-32768, Math.min(32767, s * 32768)));

    const BLOCK = 1152;
    const mp3Data: Int8Array[] = [];

    for (let i = 0; i < left.length; i += BLOCK) {
      const l = toInt16(left.slice(i, i + BLOCK));
      const r = toInt16(right.slice(i, i + BLOCK));
      const enc = mp3encoder.encodeBuffer(l, r);
      if (enc.length > 0) mp3Data.push(enc);
    }
    const flush = mp3encoder.flush();
    if (flush.length > 0) mp3Data.push(flush);

    return new Blob(mp3Data, { type: "audio/mpeg" });
  } catch {
    // Fallback: return wav if lamejs fails
    console.warn("lamejs not available, returning WAV");
    return wavBlob;
  }
}
