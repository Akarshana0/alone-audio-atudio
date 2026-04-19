# 🎛️ ALONE Audio Studio

> **Production-ready, AI-powered web DAW** — Cyberpunk Dark Tech aesthetic, built for professional audio workflows.

---

## ⚡ Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Audio Engine | Tone.js, Web Audio API, Wavesurfer.js |
| State | Zustand |
| Backend | Python 3.11, FastAPI, Demucs / Spleeter |
| Deploy | Vercel (frontend) + Render/Railway or Docker (backend) |

---

## 📁 Directory Structure

```
ALONE-Audio-Studio/
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── AudioEditor.tsx
│   │   ├── Equalizer.tsx
│   │   ├── TrackMixer.tsx
│   │   ├── EffectsRack.tsx
│   │   └── ExportPanel.tsx
│   ├── store/
│   │   └── useAudioStore.ts
│   ├── lib/
│   │   └── audioEngine.ts
│   ├── public/
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
└── backend/
    ├── main.py
    ├── separator.py
    ├── requirements.txt
    ├── Dockerfile
    └── .env.example
```

---

## 🚀 Quick Start

See `SETUP_COMMANDS.sh` for all initialization commands.
