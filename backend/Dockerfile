# backend/Dockerfile
# ALONE Audio Studio — FastAPI Backend
# Multi-stage Docker build with Demucs + PyTorch CPU

FROM python:3.11-slim AS base

# System dependencies (ffmpeg required by Demucs/librosa)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install PyTorch CPU-only (much smaller image) ─────────────
RUN pip install --no-cache-dir \
    torch torchaudio \
    --index-url https://download.pytorch.org/whl/cpu

# ── Install remaining dependencies ────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy app code ─────────────────────────────────────────────
COPY . .

# Create directories for uploads and outputs
RUN mkdir -p uploads outputs static

# ── Pre-download Demucs model to avoid cold-start delay ───────
# Comment this out to reduce image size (model downloads on first request)
RUN python -c "import demucs.pretrained; demucs.pretrained.get_model('htdemucs')" || true

# ── Expose port ───────────────────────────────────────────────
EXPOSE 8000

# ── Healthcheck ───────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ── Run ───────────────────────────────────────────────────────
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
