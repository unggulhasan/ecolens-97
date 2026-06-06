"""FFmpeg-based 1fps frame extractor.

Extracts up to MAX_FRAMES JPEG frames from a video file using a single
FFmpeg subprocess call, then yields frame paths in sorted order.
FFmpeg writes directly to JPEG files — no in-memory frame buffering.

Usage:
    for frame_path in extract_frames(video_path, out_dir, fps=1, max_frames=600):
        process(frame_path)
        frame_path.unlink()   # caller deletes after use for streaming pattern

The caller is responsible for cleaning up out_dir when done.
"""

from __future__ import annotations

import subprocess
from pathlib import Path


def extract_frames(
    video_path: Path,
    out_dir: Path,
    fps: float = 1.0,
    max_frames: int = 600,
) -> list[Path]:
    """Extract up to max_frames JPEG frames at fps frames-per-second.

    Returns a sorted list of extracted frame paths.
    Raises subprocess.CalledProcessError on FFmpeg failure (e.g. corrupt video).
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    pattern = out_dir / "frame_%06d.jpg"

    cmd = [
        "ffmpeg",
        "-y",                        # overwrite without asking
        "-i", str(video_path),
        "-vf", f"fps={fps}",
        "-frames:v", str(max_frames),
        "-q:v", "2",                 # JPEG quality (1=best, 31=worst; 2 is near-lossless)
        str(pattern),
    ]

    print(f"[FRAME] Running: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(f"[FRAME] FFmpeg stderr:\n{result.stderr[-2000:]}")   # last 2 KB
        raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)

    frames = sorted(out_dir.glob("frame_*.jpg"))
    print(f"[FRAME] Extracted {len(frames)} frame(s) @ {fps}fps (cap={max_frames})")
    return frames
