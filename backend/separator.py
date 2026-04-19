# backend/separator.py
# Demucs-based audio stem separation module.
# Supports: htdemucs (4-stem), htdemucs_6s (6-stem), mdx_extra_q (high quality)

import os
import subprocess
import shutil
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, Optional

# Try importing torchaudio for duration detection
try:
    import torchaudio
    HAS_TORCHAUDIO = True
except ImportError:
    HAS_TORCHAUDIO = False


@dataclass
class SeparationResult:
    job_id:     str
    model:      str
    duration:   float                          # seconds
    stem_files: Dict[str, str]                 # stem_name → filename (relative to job dir)


# ── Model configuration ───────────────────────────────────────
MODELS = {
    "htdemucs":     {"stems": ["vocals", "drums", "bass", "other"],       "quality": "standard"},
    "htdemucs_6s":  {"stems": ["vocals", "drums", "bass", "guitar", "piano", "other"], "quality": "6-stem"},
    "mdx_extra_q":  {"stems": ["vocals", "drums", "bass", "other"],       "quality": "high"},
}

DEFAULT_MODEL = os.getenv("DEMUCS_MODEL", "htdemucs")


def get_audio_duration(path: Path) -> float:
    """Return audio duration in seconds."""
    if HAS_TORCHAUDIO:
        info = torchaudio.info(str(path))
        return info.num_frames / info.sample_rate
    # Fallback using ffprobe
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=30
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def separate_audio(
    input_path: Path,
    output_dir: Path,
    job_id: str,
    model: str = DEFAULT_MODEL,
    device: str = "cpu",
) -> SeparationResult:
    """
    Run Demucs stem separation on input_path.
    Outputs WAV files for each stem into output_dir.

    Args:
        input_path: Path to the source audio file
        output_dir: Directory to write separated stems
        job_id:     Unique job identifier
        model:      Demucs model name (htdemucs, htdemucs_6s, mdx_extra_q)
        device:     'cpu' or 'cuda'

    Returns:
        SeparationResult with stem file paths
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Validate model
    if model not in MODELS:
        model = DEFAULT_MODEL

    duration = get_audio_duration(input_path)

    # ── Run Demucs via subprocess ─────────────────────────────
    # Demucs CLI: python -m demucs --two-stems=... or full 4-stem
    cmd = [
        "python", "-m", "demucs",
        "--name", model,
        "--device", device,
        "--out", str(output_dir),
        "--jobs", "2",
        str(input_path),
    ]

    env = os.environ.copy()
    # Limit memory usage on CPU
    env["OMP_NUM_THREADS"] = "2"

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 min timeout
            env=env,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"Demucs failed (exit {result.returncode}):\n"
                f"STDOUT: {result.stdout[-1000:]}\n"
                f"STDERR: {result.stderr[-1000:]}"
            )
    except subprocess.TimeoutExpired:
        raise RuntimeError("Demucs timed out after 10 minutes.")

    # ── Locate output files ───────────────────────────────────
    # Demucs writes to: output_dir/<model>/<track_name>/<stem>.wav
    track_name = input_path.stem
    stems_dir  = output_dir / model / track_name

    if not stems_dir.exists():
        # Search recursively as fallback
        found_dirs = list(output_dir.rglob(f"*{track_name}*"))
        if found_dirs:
            stems_dir = found_dirs[0] if found_dirs[0].is_dir() else found_dirs[0].parent
        else:
            raise FileNotFoundError(
                f"Demucs output directory not found. Expected: {stems_dir}\n"
                f"Demucs stdout: {result.stdout[-500:]}"
            )

    expected_stems = MODELS[model]["stems"]
    stem_files: Dict[str, str] = {}

    for stem in expected_stems:
        # Search for .wav or .mp3 output
        matches = list(stems_dir.glob(f"{stem}.*")) + list(stems_dir.glob(f"*{stem}*"))
        if not matches:
            continue

        src = matches[0]
        dst_filename = f"{stem}.wav"
        dst = output_dir / dst_filename

        # Move to flat output_dir for easy URL construction
        shutil.copy2(src, dst)
        stem_files[stem] = dst_filename

    if not stem_files:
        raise RuntimeError(
            f"No stem files found in {stems_dir}. "
            f"Demucs output: {list(stems_dir.iterdir()) if stems_dir.exists() else 'directory missing'}"
        )

    # Cleanup Demucs nested folder structure
    model_out_dir = output_dir / model
    if model_out_dir.exists():
        shutil.rmtree(model_out_dir, ignore_errors=True)

    return SeparationResult(
        job_id=job_id,
        model=model,
        duration=duration,
        stem_files=stem_files,
    )


# ── Spleeter fallback (if Demucs not available) ───────────────
def separate_with_spleeter(
    input_path: Path,
    output_dir: Path,
    job_id: str,
    stems: int = 4,
) -> SeparationResult:
    """
    Fallback: use Spleeter for separation.
    Install: pip install spleeter
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    duration = get_audio_duration(input_path)

    cmd = [
        "spleeter", "separate",
        "-p", f"spleeter:{stems}stems",
        "-o", str(output_dir),
        str(input_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"Spleeter failed: {result.stderr}")

    track_stem_dir = output_dir / input_path.stem
    stem_map_4 = {"vocals": "vocals.wav", "drums": "drums.wav",
                  "bass":   "bass.wav",   "other": "other.wav"}
    stem_map_2 = {"vocals": "vocals.wav", "accompaniment": "accompaniment.wav"}
    stem_map   = stem_map_4 if stems == 4 else stem_map_2

    stem_files: Dict[str, str] = {}
    for stem, filename in stem_map.items():
        src = track_stem_dir / filename
        if src.exists():
            dst = output_dir / filename
            shutil.copy2(src, dst)
            stem_files[stem] = filename

    return SeparationResult(
        job_id=job_id,
        model=f"spleeter:{stems}stems",
        duration=duration,
        stem_files=stem_files,
    )
