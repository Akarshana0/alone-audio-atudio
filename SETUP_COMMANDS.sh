#!/usr/bin/env bash
# ============================================================
#  ALONE Audio Studio — Full Project Initialization Script
# ============================================================

set -e

echo "🎛️  Initializing ALONE Audio Studio..."

# ─── ROOT ────────────────────────────────────────────────────
mkdir -p ALONE-Audio-Studio && cd ALONE-Audio-Studio

# ─── FRONTEND ────────────────────────────────────────────────
echo "\n📦 Bootstrapping Next.js frontend..."

npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-git

cd frontend

# Core UI / Animation
npm install framer-motion

# Audio Engine
npm install tone wavesurfer.js

# State Management
npm install zustand

# Utility / Export
npm install lamejs          # MP3 encoding in-browser
npm install audio-recorder-polyfill

# Types
npm install --save-dev @types/node @types/react @types/react-dom

# WaveSurfer plugins (timeline, regions)
npm install wavesurfer.js   # already included above, ensuring latest

echo "✅ Frontend dependencies installed."
cd ..

# ─── BACKEND ─────────────────────────────────────────────────
echo "\n🐍 Setting up Python FastAPI backend..."

mkdir -p backend && cd backend

python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

pip install --upgrade pip

pip install \
  fastapi==0.111.0 \
  uvicorn[standard]==0.29.0 \
  python-multipart==0.0.9 \
  demucs==4.0.1 \
  torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
  aiofiles==23.2.1 \
  python-dotenv==1.0.1 \
  pydantic==2.7.1 \
  httpx==0.27.0

pip freeze > requirements.txt

echo "✅ Backend environment ready."
cd ..

echo "\n🚀 ALONE Audio Studio project initialized successfully!"
echo "   → Frontend : cd frontend && npm run dev"
echo "   → Backend  : cd backend && source venv/bin/activate && uvicorn main:app --reload"
