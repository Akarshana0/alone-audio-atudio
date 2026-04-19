"use client";
// frontend/components/AudioEditor.tsx
// Wavesurfer.js integration with zoom, trim, cut, fade-in/out, and region editing.

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAudioStore } from "@/store/useAudioStore";

// Wavesurfer is a browser-only lib — lazy import via dynamic-ish approach
let WaveSurfer: any = null;
let WaveSurferRegions: any = null;

type RegionData = { id: string; start: number; end: number; label?: string };

const ZOOM_MIN = 1;
const ZOOM_MAX = 200;

export default function AudioEditor() {
  const containerRef   = useRef<HTMLDivElement>(null);
  const timelineRef    = useRef<HTMLDivElement>(null);
  const wavesurferRef  = useRef<any>(null);
  const regionsPlugin  = useRef<any>(null);

  const [zoom, setZoom]               = useState(1);
  const [isMounted, setIsMounted]     = useState(false);
  const [wsReady, setWsReady]         = useState(false);
  const [regions, setRegions]         = useState<RegionData[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [fadeType, setFadeType]       = useState<"in" | "out">("in");

  const { activeTrackId, tracks, setDuration, setCurrentTime, isPlaying } = useAudioStore();
  const activeTrack = tracks.find((t) => t.id === activeTrackId);

  // ─── Mount WaveSurfer (browser-only) ───────────────────────
  useEffect(() => {
    setIsMounted(true);
    return () => {
      wavesurferRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!isMounted || !containerRef.current) return;

    const initWS = async () => {
      const WS = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (await import("wavesurfer.js/dist/plugins/regions.esm.js")).default;
      const TimelinePlugin = (await import("wavesurfer.js/dist/plugins/timeline.esm.js")).default;
      const MinimapPlugin = (await import("wavesurfer.js/dist/plugins/minimap.esm.js")).default;

      // Destroy previous instance
      wavesurferRef.current?.destroy();

      const regPlugin = RegionsPlugin.create();
      regionsPlugin.current = regPlugin;

      const ws = WS.create({
        container: containerRef.current!,
        waveColor: "rgba(0,180,180,0.6)",
        progressColor: "rgba(0,255,255,0.9)",
        cursorColor: "#00ffff",
        cursorWidth: 2,
        height: 120,
        normalize: true,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        plugins: [
          regPlugin,
          TimelinePlugin.create({ container: timelineRef.current! }),
          MinimapPlugin.create({
            height: 24,
            waveColor: "rgba(0,100,100,0.5)",
            progressColor: "rgba(0,255,255,0.5)",
          }),
        ],
      });

      ws.on("ready", (dur: number) => {
        setDuration(dur);
        setWsReady(true);
      });

      ws.on("timeupdate", (t: number) => setCurrentTime(t));

      ws.on("decode", () => setWsReady(true));

      regPlugin.on("region-created", (r: any) => {
        setRegions((prev) => [
          ...prev,
          { id: r.id, start: r.start, end: r.end, label: "Region" },
        ]);
      });

      regPlugin.on("region-clicked", (r: any, e: MouseEvent) => {
        e.stopPropagation();
        setSelectedRegion(r.id);
      });

      wavesurferRef.current = ws;
    };

    initWS();
  }, [isMounted]);

  // ─── Load audio when active track changes ──────────────────
  useEffect(() => {
    if (!wavesurferRef.current || !activeTrack?.url) return;
    setWsReady(false);
    wavesurferRef.current.load(activeTrack.url);
  }, [activeTrack?.url]);

  // ─── Sync play/pause from store ────────────────────────────
  useEffect(() => {
    if (!wavesurferRef.current || !wsReady) return;
    if (isPlaying) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  }, [isPlaying, wsReady]);

  // ─── Zoom ───────────────────────────────────────────────────
  const handleZoom = useCallback((v: number) => {
    setZoom(v);
    wavesurferRef.current?.zoom(v);
  }, []);

  // ─── Trim (cut to region) ───────────────────────────────────
  const handleTrim = useCallback(async () => {
    if (!selectedRegion || !wavesurferRef.current || !activeTrack?.buffer) return;
    const region = regionsPlugin.current
      ?.getRegions()
      .find((r: any) => r.id === selectedRegion);
    if (!region) return;

    const { start, end } = region;
    const buffer = wavesurferRef.current.getDecodedData();
    if (!buffer) return;

    const audioCtx = new AudioContext();
    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(start * sampleRate);
    const endSample   = Math.floor(end * sampleRate);
    const length = endSample - startSample;

    const trimmed = audioCtx.createBuffer(
      buffer.numberOfChannels, length, sampleRate
    );
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch).slice(startSample, endSample);
      trimmed.copyToChannel(src, ch);
    }

    // Encode trimmed buffer to Blob and reload
    const blob = await audioBufferToWavBlob(trimmed);
    const url   = URL.createObjectURL(blob);
    useAudioStore.getState().updateTrackUrl(activeTrackId!, url);
    wavesurferRef.current.load(url);
  }, [selectedRegion, activeTrack, activeTrackId]);

  // ─── Fade ───────────────────────────────────────────────────
  const handleFade = useCallback(async () => {
    if (!wavesurferRef.current || !activeTrack) return;
    const buffer = wavesurferRef.current.getDecodedData();
    if (!buffer) return;

    const audioCtx = new AudioContext();
    const fadeDuration = 2; // seconds
    const sampleRate = buffer.sampleRate;
    const fadeSamples = Math.floor(fadeDuration * sampleRate);
    const totalSamples = buffer.length;

    const out = audioCtx.createBuffer(buffer.numberOfChannels, totalSamples, sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch).slice();
      if (fadeType === "in") {
        for (let i = 0; i < fadeSamples && i < totalSamples; i++) {
          data[i] *= i / fadeSamples;
        }
      } else {
        for (let i = 0; i < fadeSamples; i++) {
          const idx = totalSamples - fadeSamples + i;
          if (idx >= 0) data[idx] *= (fadeSamples - i) / fadeSamples;
        }
      }
      out.copyToChannel(data, ch);
    }

    const blob = await audioBufferToWavBlob(out);
    const url = URL.createObjectURL(blob);
    useAudioStore.getState().updateTrackUrl(activeTrackId!, url);
    wavesurferRef.current.load(url);
  }, [fadeType, activeTrack, activeTrackId]);

  // ─── Add region on button click ────────────────────────────
  const handleAddRegion = useCallback(() => {
    if (!regionsPlugin.current || !wavesurferRef.current) return;
    const dur = wavesurferRef.current.getDuration() || 10;
    const start = dur * 0.2;
    const end   = dur * 0.6;
    regionsPlugin.current.addRegion({
      start,
      end,
      color: "rgba(0, 255, 255, 0.12)",
      drag: true,
      resize: true,
    });
  }, []);

  const handleDeleteRegion = useCallback(() => {
    if (!selectedRegion || !regionsPlugin.current) return;
    const region = regionsPlugin.current.getRegions().find((r: any) => r.id === selectedRegion);
    region?.remove();
    setRegions((prev) => prev.filter((r) => r.id !== selectedRegion));
    setSelectedRegion(null);
  }, [selectedRegion]);

  // ─── Toolbar ────────────────────────────────────────────────
  const tools = [
    { label: "ADD REGION",    icon: "⬚", action: handleAddRegion },
    { label: "TRIM TO REGION",icon: "✂", action: handleTrim, disabled: !selectedRegion },
    { label: "DELETE REGION", icon: "✕", action: handleDeleteRegion, disabled: !selectedRegion },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-400" style={{ fontFamily: "var(--font-display)" }}>
            WAVEFORM EDITOR
          </h2>
          <p className="text-[10px] font-mono text-gray-500 mt-0.5">
            {activeTrack ? activeTrack.name : "No track loaded — use LOAD TRACK to begin"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom */}
          <span className="text-[9px] font-mono text-gray-500">ZOOM</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            value={zoom}
            onChange={(e) => handleZoom(Number(e.target.value))}
            className="w-24"
            style={{ "--value": `${((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100}%` } as React.CSSProperties}
          />
          <span className="text-[9px] font-mono text-cyan-400 w-6">{zoom}x</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {tools.map((t) => (
          <button
            key={t.label}
            onClick={t.action}
            disabled={t.disabled}
            className="btn-cyber text-[9px] py-1.5 px-3 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t.icon} {t.label}
          </button>
        ))}

        {/* Fade controls */}
        <div className="flex items-center gap-1 border border-cyan-500/20 p-1 rounded">
          {(["in", "out"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFadeType(f)}
              className={`text-[9px] font-mono px-2 py-1 rounded transition-all ${
                fadeType === f ? "bg-cyan-500/20 text-cyan-400" : "text-gray-500"
              }`}
            >
              FADE {f.toUpperCase()}
            </button>
          ))}
          <button
            onClick={handleFade}
            disabled={!wsReady}
            className="btn-cyber text-[9px] py-1 px-2 disabled:opacity-30"
          >
            APPLY
          </button>
        </div>
      </div>

      {/* Waveform canvas */}
      <div className="panel flex-1 relative overflow-hidden p-3">
        {!activeTrack && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 border border-cyan-500/20 flex items-center justify-center">
              <span className="text-2xl text-cyan-500/30">⊿</span>
            </div>
            <p className="text-[10px] font-mono text-gray-600 tracking-widest">AWAITING AUDIO INPUT</p>
          </div>
        )}
        {!wsReady && activeTrack && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="flex items-center gap-3">
              <div className="loader-cyber w-6 h-6" />
              <span className="text-xs font-mono text-cyan-400 tracking-widest">DECODING AUDIO...</span>
            </div>
          </div>
        )}
        <div id="waveform" ref={containerRef} />
        <div ref={timelineRef} className="mt-1 opacity-50" />
      </div>

      {/* Region list */}
      {regions.length > 0 && (
        <div className="panel p-3">
          <p className="text-[9px] font-mono text-gray-500 tracking-widest mb-2">REGIONS</p>
          <div className="flex flex-wrap gap-2">
            {regions.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRegion(r.id)}
                className={`text-[9px] font-mono px-2 py-1 border rounded transition-all ${
                  selectedRegion === r.id
                    ? "border-cyan-400 text-cyan-400 bg-cyan-500/10"
                    : "border-gray-700 text-gray-500"
                }`}
              >
                {r.start.toFixed(1)}s → {r.end.toFixed(1)}s
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Utility: AudioBuffer → WAV Blob ──────────────────────── */
function audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
  return new Promise((resolve) => {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length * numChannels * 2;
    const ab = new ArrayBuffer(44 + length);
    const view = new DataView(ab);

    const writeStr = (o: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
    };
    const writeUint32 = (o: number, v: number) => view.setUint32(o, v, true);
    const writeUint16 = (o: number, v: number) => view.setUint16(o, v, true);

    writeStr(0, "RIFF");
    writeUint32(4, 36 + length);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    writeUint32(16, 16);
    writeUint16(20, 1); // PCM
    writeUint16(22, numChannels);
    writeUint32(24, buffer.sampleRate);
    writeUint32(28, buffer.sampleRate * numChannels * 2);
    writeUint16(32, numChannels * 2);
    writeUint16(34, 16);
    writeStr(36, "data");
    writeUint32(40, length);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }

    resolve(new Blob([ab], { type: "audio/wav" }));
  });
}
