# backend/main.py
# ALONE Audio Studio — FastAPI Backend
# AI Stem Separation using Demucs (4-stem: vocals, drums, bass, other)

import os
import uuid
import asyncio
import shutil
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from separator import separate_audio, SeparationResult
from dotenv import load_dotenv

load_dotenv()

# ── Config ──────────────────────────────────────────────────
UPLOAD_DIR  = Path("uploads")
OUTPUT_DIR  = Path("outputs")
STATIC_DIR  = Path("static")

for d in [UPLOAD_DIR, OUTPUT_DIR, STATIC_DIR]:
    d.mkdir(exist_ok=True)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "100"))

# ── App ─────────────────────────────────────────────────────
app = FastAPI(
    title="ALONE Audio Studio API",
    description="AI-powered audio stem separation & processing backend",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve separated stems as static files
app.mount("/files", StaticFiles(directory=str(OUTPUT_DIR)), name="files")

# ── In-memory job store (use Redis in production) ────────────
jobs: Dict[str, dict] = {}


# ── Health Check ─────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"status": "online", "service": "ALONE Audio Studio API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}


# ── Sync Separation Endpoint ─────────────────────────────────
@app.post("/api/separate", tags=["AI Separation"])
async def separate_track(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload an audio file and receive separated stems (vocals, drums, bass, other).
    Returns URLs for each stem as static files.

    - Supported formats: MP3, WAV, FLAC, M4A, OGG
    - Max file size: 100 MB
    - Model: Demucs htdemucs (4-stem)
    """
    # Validate file type
    allowed_types = {"audio/mpeg", "audio/wav", "audio/x-wav", "audio/flac",
                     "audio/mp4", "audio/ogg", "audio/webm", "application/octet-stream"}
    if file.content_type not in allowed_types:
        # Fallback: check extension
        ext = Path(file.filename or "").suffix.lower()
        if ext not in {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".webm", ".aac"}:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Use MP3, WAV, FLAC, or OGG."
            )

    # Save upload
    job_id   = str(uuid.uuid4())
    ext      = Path(file.filename or "audio.mp3").suffix or ".mp3"
    upload_path = UPLOAD_DIR / f"{job_id}{ext}"

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB} MB limit.")

    with open(upload_path, "wb") as f:
        f.write(contents)

    # Run separation (synchronous in thread pool for FastAPI)
    try:
        result: SeparationResult = await asyncio.to_thread(
            separate_audio,
            input_path=upload_path,
            output_dir=OUTPUT_DIR / job_id,
            job_id=job_id,
        )
    except Exception as e:
        # Cleanup on failure
        upload_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Separation failed: {str(e)}")
    finally:
        # Schedule upload cleanup
        background_tasks.add_task(cleanup_upload, upload_path)

    # Build public URLs
    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    stem_urls = {
        stem: f"{base_url}/files/{job_id}/{filename}"
        for stem, filename in result.stem_files.items()
    }

    return JSONResponse({
        "job_id":   job_id,
        "model":    result.model,
        "duration": result.duration,
        "stems":    stem_urls,
        "message":  "Separation complete",
    })


# ── Async job endpoint (for large files) ─────────────────────
@app.post("/api/separate/async", tags=["AI Separation"])
async def separate_track_async(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Async job submission for large files.
    Poll /api/jobs/{job_id} for status.
    """
    job_id = str(uuid.uuid4())
    ext    = Path(file.filename or "audio.mp3").suffix or ".mp3"
    upload_path = UPLOAD_DIR / f"{job_id}{ext}"

    contents = await file.read()
    with open(upload_path, "wb") as f:
        f.write(contents)

    jobs[job_id] = {"status": "queued", "progress": 0, "stems": None, "error": None}

    background_tasks.add_task(
        run_separation_job, job_id, upload_path, OUTPUT_DIR / job_id
    )

    return JSONResponse({"job_id": job_id, "status": "queued"})


@app.get("/api/jobs/{job_id}", tags=["AI Separation"])
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


# ── Stem file download ────────────────────────────────────────
@app.get("/api/download/{job_id}/{stem}", tags=["Download"])
async def download_stem(job_id: str, stem: str):
    stem_dir = OUTPUT_DIR / job_id
    matches = list(stem_dir.glob(f"*{stem}*.wav")) + list(stem_dir.glob(f"*{stem}*.mp3"))
    if not matches:
        raise HTTPException(status_code=404, detail=f"Stem '{stem}' not found for job {job_id}")
    return FileResponse(matches[0], media_type="audio/wav", filename=f"{stem}.wav")


# ── Background Tasks ─────────────────────────────────────────
async def run_separation_job(job_id: str, upload_path: Path, output_dir: Path):
    try:
        jobs[job_id]["status"] = "processing"
        result = await asyncio.to_thread(
            separate_audio, input_path=upload_path, output_dir=output_dir, job_id=job_id
        )
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        jobs[job_id]["status"] = "complete"
        jobs[job_id]["stems"] = {
            stem: f"{base_url}/files/{job_id}/{filename}"
            for stem, filename in result.stem_files.items()
        }
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"]  = str(e)
    finally:
        upload_path.unlink(missing_ok=True)


def cleanup_upload(path: Path):
    path.unlink(missing_ok=True)


# ── Entry Point ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENVIRONMENT", "development") == "development",
        workers=1,  # Demucs is memory-intensive; 1 worker per dyno
    )
