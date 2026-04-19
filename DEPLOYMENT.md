# 🚀 ALONE Audio Studio — Deployment Guide

---

## 1. FRONTEND → Vercel

### Step 1: Push to GitHub
```bash
cd ALONE-Audio-Studio
git init
git add .
git commit -m "feat: initial ALONE Audio Studio"
gh repo create alone-audio-studio --public --push
# or: git remote add origin https://github.com/YOUR_USER/alone-audio-studio.git && git push -u origin main
```

### Step 2: Deploy to Vercel
```bash
# Option A: Vercel CLI (recommended)
npm i -g vercel
cd frontend
vercel

# Answer prompts:
#   Set up and deploy? → Y
#   Which scope? → your account
#   Link to existing project? → N
#   Project name → alone-audio-studio
#   Directory → ./  (already in /frontend)
#   Override settings? → N

# Option B: Vercel Dashboard
# 1. Go to https://vercel.com/new
# 2. Import your GitHub repo
# 3. Set Root Directory → frontend
# 4. Framework Preset → Next.js (auto-detected)
# 5. Click Deploy
```

### Step 3: Set Vercel Environment Variables
In Vercel Dashboard → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL = https://your-backend.onrender.com
```

---

## 2. BACKEND → Render (Recommended for Free Tier)

### Step 1: Create Render Account
Go to https://render.com and sign up with GitHub.

### Step 2: New Web Service
```
1. Dashboard → New → Web Service
2. Connect your GitHub repo → alone-audio-studio
3. Settings:
   Name:         alone-audio-studio-api
   Root Dir:     backend
   Environment:  Docker
   Branch:       main
   Instance:     Standard (2GB RAM — Demucs needs ~1.5GB)
```

### Step 3: Set Environment Variables on Render
```
PORT              = 8000
ENVIRONMENT       = production
BASE_URL          = https://alone-audio-studio-api.onrender.com
ALLOWED_ORIGINS   = https://your-app.vercel.app
DEMUCS_MODEL      = htdemucs
MAX_FILE_SIZE_MB  = 100
```

### Step 4: Deploy
Click "Create Web Service" → Render builds Docker image automatically.
First build takes ~8–12 min (downloading PyTorch + Demucs model).

---

## 3. BACKEND → Railway (Alternative)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# From /backend directory:
cd backend
railway init        # create new project
railway up          # deploy

# Set env vars
railway variables set PORT=8000
railway variables set BASE_URL=$(railway domain)
railway variables set ALLOWED_ORIGINS=https://your-app.vercel.app
railway variables set DEMUCS_MODEL=htdemucs
```

---

## 4. BACKEND → Docker (Self-hosted / VPS)

```bash
cd backend

# Build image
docker build -t alone-audio-api .

# Run container
docker run -d \
  --name alone-audio-api \
  -p 8000:8000 \
  -e BASE_URL=https://your-domain.com \
  -e ALLOWED_ORIGINS=https://your-app.vercel.app \
  -e DEMUCS_MODEL=htdemucs \
  -v $(pwd)/outputs:/app/outputs \
  alone-audio-api

# With docker-compose (recommended for production):
docker-compose up -d
```

### docker-compose.yml (create in /backend):
```yaml
version: "3.9"
services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - ENVIRONMENT=production
      - BASE_URL=https://your-domain.com
      - ALLOWED_ORIGINS=https://your-app.vercel.app
      - DEMUCS_MODEL=htdemucs
      - MAX_FILE_SIZE_MB=100
    volumes:
      - ./uploads:/app/uploads
      - ./outputs:/app/outputs
    restart: unless-stopped
```

---

## 5. Post-Deploy Checklist

```bash
# ✅ Test API health
curl https://your-backend.onrender.com/health
# Expected: {"status":"healthy"}

# ✅ Test CORS (from browser console on your Vercel URL)
fetch("https://your-backend.onrender.com/health").then(r=>r.json()).then(console.log)

# ✅ Test separation endpoint
curl -X POST https://your-backend.onrender.com/api/separate \
  -F "file=@test.mp3" \
  -o response.json && cat response.json

# ✅ Update NEXT_PUBLIC_API_URL in Vercel → redeploy frontend
```

---

## 6. Production Optimizations

### Frontend (Vercel)
```js
// next.config.js — add image domains if needed
images: { domains: ["your-backend.onrender.com"] }
```

### Backend (Performance)
```python
# For GPU server (dramatically faster separation):
# In Dockerfile, replace CPU torch with:
# RUN pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121

# In .env:
# DEMUCS_DEVICE=cuda
```

### File Cleanup (add to backend cron)
```bash
# Clean outputs older than 24h (add to Railway/Render cron job)
find /app/outputs -type f -mtime +1 -delete
```

---

## 7. Key URLs After Deploy

| Service | URL |
|---------|-----|
| Frontend (Vercel) | `https://alone-audio-studio.vercel.app` |
| Backend API | `https://alone-audio-studio-api.onrender.com` |
| API Docs (Swagger) | `https://alone-audio-studio-api.onrender.com/docs` |
| API Docs (ReDoc) | `https://alone-audio-studio-api.onrender.com/redoc` |

---

## 8. Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS error | Add Vercel URL to `ALLOWED_ORIGINS` on backend |
| Demucs OOM crash | Upgrade to 2GB+ RAM plan on Render/Railway |
| Cold start timeout | Render free tier sleeps; upgrade to paid or use Railway |
| WaveSurfer SSR error | Already handled with dynamic `import()` in AudioEditor.tsx |
| Tone.js AudioContext | Already handled with `await Tone.start()` on user gesture |
| MP3 export fails | Install `lamejs` — it's in package.json |
