// frontend/store/useAudioStore.ts
// Central Zustand store for ALONE Audio Studio.
// Manages tracks, playback, Tone.js engine, and API calls.

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

/* ─── Types ─────────────────────────────────────────────────── */
export type StemType = "vocals" | "drums" | "bass" | "other";

export interface Track {
  id: string;
  name: string;
  url: string;                  // Object URL or remote URL
  buffer?: AudioBuffer;
  volume: number;               // 0–1
  muted: boolean;
  solo: boolean;
  stems?: Partial<Record<StemType, string>>;  // URLs for separated stems
  color: string;
}

export interface AudioState {
  // ── Tracks ────────────────────────────────────────────────
  tracks: Track[];
  activeTrackId: string | null;

  // ── Playback ──────────────────────────────────────────────
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  // ── Global Controls ───────────────────────────────────────
  masterVolume: number;
  bpm: number;
  pitch: number;               // semitones, -12 to +12

  // ── EQ (10-band, gains in dB) ─────────────────────────────
  eqBands: number[];           // 10 values

  // ── Effects ───────────────────────────────────────────────
  reverb: number;              // 0–1 wet
  delay: number;               // 0–1 wet
  compression: { threshold: number; ratio: number; knee: number };

  // ── UI State ──────────────────────────────────────────────
  isProcessing: boolean;
  processingLabel: string;

  // ── Tone.js Engine reference ──────────────────────────────
  _toneReady: boolean;

  // ── Actions ───────────────────────────────────────────────
  loadTrack:        (file: File) => Promise<void>;
  addTrackFromUrl:  (name: string, url: string) => void;
  removeTrack:      (id: string) => void;
  setActiveTrack:   (id: string) => void;
  updateTrackUrl:   (id: string, url: string) => void;
  updateTrackVolume:(id: string, vol: number) => void;
  toggleMute:       (id: string) => void;
  toggleSolo:       (id: string) => void;

  togglePlayback:   () => void;
  stop:             () => void;
  seek:             (time: number) => void;
  setCurrentTime:   (t: number) => void;
  setDuration:      (d: number) => void;

  setMasterVolume:  (v: number) => void;
  setBpm:           (bpm: number) => void;
  setPitch:         (st: number) => void;
  setEqBand:        (index: number, gainDb: number) => void;
  setReverb:        (v: number) => void;
  setDelay:         (v: number) => void;
  setCompression:   (c: Partial<AudioState["compression"]>) => void;

  separateTrack:    (id: string) => Promise<void>;

  _setProcessing:   (label: string) => void;
  _clearProcessing: () => void;
}

/* ─── Track Color Palette ───────────────────────────────────── */
const TRACK_COLORS = [
  "#00FFFF", "#FF003C", "#FFB800", "#7B2FFF",
  "#00FF88", "#FF6B00", "#0088FF", "#FF00AA",
];
let colorIdx = 0;
const nextColor = () => TRACK_COLORS[colorIdx++ % TRACK_COLORS.length];

/* ─── Tone.js Engine (lazy loaded) ──────────────────────────── */
let toneEngine: {
  player: any;
  pitchShift: any;
  eq: any;
  reverb: any;
  delay: any;
  compressor: any;
  volume: any;
} | null = null;

async function getToneEngine() {
  if (toneEngine) return toneEngine;

  const Tone = await import("tone");

  const volume     = new Tone.Volume(0).toDestination();
  const compressor = new Tone.Compressor(-24, 4).connect(volume);
  const reverb     = new Tone.Reverb(2.5).connect(compressor);
  const delay      = new Tone.FeedbackDelay("8n", 0.3).connect(compressor);
  const eq         = new Tone.EQ3(-3, 0, 3).connect(reverb);
  const pitchShift = new Tone.PitchShift(0).connect(eq);
  const player     = new Tone.Player().connect(pitchShift);

  reverb.wet.value  = 0;
  delay.wet.value   = 0;

  toneEngine = { player, pitchShift, eq, reverb, delay, compressor, volume };
  return toneEngine;
}

/* ─── Backend API URL ────────────────────────────────────────── */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Store ─────────────────────────────────────────────────── */
export const useAudioStore = create<AudioState>()(
  subscribeWithSelector((set, get) => ({
    tracks: [],
    activeTrackId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    masterVolume: 0.8,
    bpm: 128,
    pitch: 0,
    eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    reverb: 0,
    delay: 0,
    compression: { threshold: -24, ratio: 4, knee: 10 },
    isProcessing: false,
    processingLabel: "",
    _toneReady: false,

    /* ── Load File ──────────────────────────────────────────── */
    loadTrack: async (file) => {
      const url = URL.createObjectURL(file);
      const id  = crypto.randomUUID();
      const track: Track = {
        id, name: file.name, url, volume: 1, muted: false, solo: false, color: nextColor(),
      };
      set((s) => ({ tracks: [...s.tracks, track], activeTrackId: id }));

      // Prime Tone.js player
      try {
        const engine = await getToneEngine();
        await engine.player.load(url);
      } catch (e) {
        console.warn("Tone.js load warn:", e);
      }
    },

    addTrackFromUrl: (name, url) => {
      const id = crypto.randomUUID();
      set((s) => ({
        tracks: [...s.tracks, { id, name, url, volume: 1, muted: false, solo: false, color: nextColor() }],
        activeTrackId: id,
      }));
    },

    removeTrack: (id) =>
      set((s) => ({
        tracks: s.tracks.filter((t) => t.id !== id),
        activeTrackId: s.activeTrackId === id
          ? s.tracks.find((t) => t.id !== id)?.id ?? null
          : s.activeTrackId,
      })),

    setActiveTrack: (id) => set({ activeTrackId: id }),

    updateTrackUrl: (id, url) =>
      set((s) => ({ tracks: s.tracks.map((t) => t.id === id ? { ...t, url } : t) })),

    updateTrackVolume: async (id, vol) => {
      set((s) => ({ tracks: s.tracks.map((t) => t.id === id ? { ...t, volume: vol } : t) }));
    },

    toggleMute: (id) =>
      set((s) => ({ tracks: s.tracks.map((t) => t.id === id ? { ...t, muted: !t.muted } : t) })),

    toggleSolo: (id) =>
      set((s) => ({ tracks: s.tracks.map((t) => t.id === id ? { ...t, solo: !t.solo } : t) })),

    /* ── Playback ───────────────────────────────────────────── */
    togglePlayback: async () => {
      const { isPlaying } = get();
      const Tone = await import("tone");
      await Tone.start(); // unlock AudioContext on iOS/Chrome
      const engine = await getToneEngine();
      if (isPlaying) {
        engine.player.stop();
        set({ isPlaying: false });
      } else {
        if (engine.player.loaded) {
          engine.player.start();
        }
        set({ isPlaying: true });
      }
    },

    stop: async () => {
      const engine = await getToneEngine();
      engine.player.stop();
      set({ isPlaying: false, currentTime: 0 });
    },

    seek: async (time) => {
      const engine = await getToneEngine();
      if (engine.player.loaded) {
        engine.player.seek(time);
      }
      set({ currentTime: time });
    },

    setCurrentTime: (t) => set({ currentTime: t }),
    setDuration:    (d) => set({ duration: d }),

    /* ── Global Controls ────────────────────────────────────── */
    setMasterVolume: async (v) => {
      set({ masterVolume: v });
      const engine = await getToneEngine();
      const Tone = await import("tone");
      engine.volume.volume.value = Tone.gainToDb(v);
    },

    setBpm: async (bpm) => {
      set({ bpm });
      const Tone = await import("tone");
      Tone.getTransport().bpm.value = bpm;
    },

    setPitch: async (st) => {
      set({ pitch: st });
      const engine = await getToneEngine();
      engine.pitchShift.pitch = st;
    },

    setEqBand: async (index, gainDb) => {
      set((s) => {
        const bands = [...s.eqBands];
        bands[index] = gainDb;
        return { eqBands: bands };
      });
      // Map 10-band to Tone.js EQ3 (low/mid/high approximation)
      const { eqBands } = get();
      const engine = await getToneEngine();
      const low  = eqBands.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const mid  = eqBands.slice(3, 7).reduce((a, b) => a + b, 0) / 4;
      const high = eqBands.slice(7).reduce((a, b) => a + b, 0) / 3;
      engine.eq.low.value  = low;
      engine.eq.mid.value  = mid;
      engine.eq.high.value = high;
    },

    setReverb: async (v) => {
      set({ reverb: v });
      const engine = await getToneEngine();
      engine.reverb.wet.value = v;
    },

    setDelay: async (v) => {
      set({ delay: v });
      const engine = await getToneEngine();
      engine.delay.wet.value = v;
    },

    setCompression: async (c) => {
      set((s) => ({ compression: { ...s.compression, ...c } }));
      const { compression } = get();
      const engine = await getToneEngine();
      if (c.threshold !== undefined) engine.compressor.threshold.value = compression.threshold;
      if (c.ratio !== undefined)     engine.compressor.ratio.value     = compression.ratio;
      if (c.knee !== undefined)      engine.compressor.knee.value      = compression.knee;
    },

    /* ── AI Stem Separation ─────────────────────────────────── */
    separateTrack: async (id) => {
      const track = get().tracks.find((t) => t.id === id);
      if (!track) return;

      get()._setProcessing("AI SEPARATING STEMS — PLEASE WAIT…");

      try {
        // Fetch the blob from the object URL
        const resp = await fetch(track.url);
        const blob = await resp.blob();

        const formData = new FormData();
        formData.append("file", blob, track.name);

        const apiResp = await fetch(`${API_URL}/api/separate`, {
          method: "POST",
          body: formData,
        });

        if (!apiResp.ok) throw new Error(await apiResp.text());

        const data = await apiResp.json();

        // data.stems: { vocals: url, drums: url, bass: url, other: url }
        set((s) => ({
          tracks: s.tracks.map((t) =>
            t.id === id ? { ...t, stems: data.stems } : t
          ),
        }));

        // Auto-add each stem as a new track
        const stemNames: StemType[] = ["vocals", "drums", "bass", "other"];
        stemNames.forEach((stem) => {
          if (data.stems[stem]) {
            get().addTrackFromUrl(`${track.name} [${stem.toUpperCase()}]`, data.stems[stem]);
          }
        });
      } catch (err) {
        console.error("Separation failed:", err);
      } finally {
        get()._clearProcessing();
      }
    },

    _setProcessing:   (label) => set({ isProcessing: true,  processingLabel: label }),
    _clearProcessing: ()      => set({ isProcessing: false, processingLabel: "" }),
  }))
);
