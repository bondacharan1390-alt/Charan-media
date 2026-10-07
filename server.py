"""
Charan Media — Video & Audio Downloader
Modular FastAPI backend with separate MP3/MP4 endpoints and URL analysis.
"""
from __future__ import annotations

import ipaddress
import os
import shutil
import socket
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
DOWNLOAD_DIR = BASE_DIR / "downloads"
UPLOAD_DIR.mkdir(exist_ok=True)
DOWNLOAD_DIR.mkdir(exist_ok=True)

# Load environment variables from .env if present
def _load_env():
    env_file = BASE_DIR / ".env"
    if env_file.is_file():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

_load_env()
API_KEY = os.environ.get("API_KEY") or os.environ.get("YOUTUBE_API_KEY") or ""

def get_ytdlp_opts(extra_opts: dict | None = None) -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }
    if API_KEY:
        opts["extractor_args"] = {
            "youtube": {
                "po_token": [f"web+{API_KEY}"],
                "player_client": ["web", "mweb", "android"],
            }
        }
    if extra_opts:
        opts.update(extra_opts)
    return opts

app = FastAPI(title="Charan Media Downloader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/downloads", StaticFiles(directory=str(DOWNLOAD_DIR)), name="downloads")


# ─────────────────────────────────────────
# PLATFORM MANAGER (server-side)
# ─────────────────────────────────────────

ALLOWED_HOSTS = (
    "youtube.com", "youtu.be",
    "instagram.com",
    "whatsapp.com", "wa.me",
    "facebook.com", "fb.watch",
    "vimeo.com", "dailymotion.com", "twitch.tv",
    "tiktok.com", "twitter.com", "x.com",
)

def _is_allowed_host(hostname: str) -> bool:
    h = hostname.lower().rstrip(".").removeprefix("www.")
    return any(h == d or h.endswith("." + d) for d in ALLOWED_HOSTS)


def _validate_url(url: str) -> str:
    """Validate URL and return clean version or raise HTTPException."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Enter a valid http or https URL.")
    if not _is_allowed_host(parsed.hostname):
        raise HTTPException(
            status_code=400,
            detail="This platform is not supported. Supported: YouTube, Instagram, WhatsApp, Facebook, Vimeo, etc.",
        )
    try:
        addresses = socket.getaddrinfo(parsed.hostname, None)
        if not addresses or any(
            not ipaddress.ip_address(item[4][0]).is_global for item in addresses
        ):
            raise HTTPException(status_code=400, detail="URL must point to a public website.")
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="Cannot resolve the URL host.") from exc
    return url.strip()


# ─────────────────────────────────────────
# FFMPEG HELPER
# ─────────────────────────────────────────

def get_ffmpeg_binary() -> str:
    try:
        from imageio_ffmpeg import get_ffmpeg_exe
        exe = get_ffmpeg_exe()
        if exe and Path(exe).exists():
            return exe
    except Exception:
        pass
    venv_bins = list(BASE_DIR.glob(".venv/**/imageio_ffmpeg/binaries/ffmpeg*.exe"))
    if venv_bins and venv_bins[0].exists():
        return str(venv_bins[0])
    path = shutil.which("ffmpeg")
    if path:
        return path
    return "ffmpeg"


# ─────────────────────────────────────────
# STATIC FILE SERVING
# ─────────────────────────────────────────

@app.get("/")
async def root():
    idx = BASE_DIR / "index.html"
    if idx.exists():
        return FileResponse(idx)
    return {"status": "online", "message": "Charan Media API running."}


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(content=b"", media_type="image/x-icon")


@app.get("/style.css")
async def get_css():
    f = BASE_DIR / "style.css"
    if f.exists():
        return FileResponse(f, media_type="text/css")
    raise HTTPException(status_code=404, detail="CSS not found.")


@app.get("/script.js")
async def get_js():
    f = BASE_DIR / "script.js"
    if f.exists():
        return FileResponse(f, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="JS not found.")


# ─────────────────────────────────────────
# HEALTH
# ─────────────────────────────────────────

@app.get("/health")
@app.get("/api/health")
async def health():
    ffmpeg_ready = False
    try:
        ff = get_ffmpeg_binary()
        r = subprocess.run([ff, "-version"], capture_output=True, text=True)
        ffmpeg_ready = r.returncode == 0
    except Exception:
        pass
    return {
        "status": "online",
        "message": "Charan Media API running.",
        "ffmpeg": "ready" if ffmpeg_ready else "not_found",
    }


# ─────────────────────────────────────────
# DOWNLOAD FILE ENDPOINT
# ─────────────────────────────────────────

@app.get("/download/{filename}")
async def download_file(filename: str):
    safe = Path(filename).name
    fpath = DOWNLOAD_DIR / safe
    if not fpath.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    # Determine media type
    suffix = fpath.suffix.lower()
    if suffix == ".mp4":
        media_type = "video/mp4"
    elif suffix == ".mp3":
        media_type = "audio/mpeg"
    else:
        media_type = "application/octet-stream"
    return FileResponse(
        path=fpath,
        media_type=media_type,
        filename=safe,
        headers={"Content-Disposition": f'attachment; filename="{safe}"'},
    )


# ─────────────────────────────────────────
# ANALYZE URL — Returns metadata without downloading
# ─────────────────────────────────────────

@app.post("/analyze-url")
async def analyze_url(url: str = Form(...)):
    """Analyze a URL and return media metadata (title, thumbnail, duration, formats)."""
    clean_url = _validate_url(url)

    try:
        import yt_dlp

        opts = get_ytdlp_opts({
            "skip_download": True,
            "extract_flat": False,
        })
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(clean_url, download=False)

        # Determine available streams
        formats = info.get("formats") or []
        has_audio = any(f.get("acodec") not in (None, "none") for f in formats)
        has_video = any(f.get("vcodec") not in (None, "none") for f in formats)

        # Pick best thumbnail
        thumbnails = info.get("thumbnails") or []
        thumbnail = info.get("thumbnail") or (thumbnails[-1]["url"] if thumbnails else None)

        return {
            "title": info.get("title") or "Media",
            "thumbnail": thumbnail,
            "duration": info.get("duration"),
            "platform": info.get("extractor_key") or "Unknown",
            "has_audio": has_audio,
            "has_video": has_video,
            "uploader": info.get("uploader"),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not analyze this URL. Make sure it is public and from a supported platform. ({exc})",
        ) from exc


# ─────────────────────────────────────────
# DOWNLOAD MP3 — Audio only, independently
# ─────────────────────────────────────────

@app.post("/download-mp3")
async def download_mp3(url: str = Form(...), quality: str = Form("192k")):
    """Download audio as MP3 — independent of video download."""
    clean_url = _validate_url(url)

    valid_qualities = {"128k", "192k", "256k", "320k"}
    clean_quality = quality if quality in valid_qualities else "192k"

    safe_id = uuid.uuid4().hex[:12]
    output_template = str(DOWNLOAD_DIR / f"{safe_id}.%(ext)s")
    output_path = DOWNLOAD_DIR / f"{safe_id}.mp3"
    ffmpeg_path = get_ffmpeg_binary()

    try:
        import yt_dlp

        options = get_ytdlp_opts({
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "ffmpeg_location": ffmpeg_path,
            "max_filesize": 500 * 1024 * 1024,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": clean_quality.removesuffix("k"),
            }],
        })

        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([clean_url])

        if not output_path.is_file() or output_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="MP3 conversion produced an empty file.")

        return {
            "download_url": f"/download/{output_path.name}",
            "filename": f"{safe_id}.mp3",
        }

    except HTTPException:
        _cleanup(safe_id)
        raise
    except Exception as exc:
        _cleanup(safe_id)
        raise HTTPException(
            status_code=400,
            detail=f"MP3 download failed: {exc}",
        ) from exc
    finally:
        # Remove intermediate non-mp3 files
        for f in DOWNLOAD_DIR.glob(f"{safe_id}.*"):
            if f != output_path:
                try:
                    f.unlink()
                except OSError:
                    pass


# ─────────────────────────────────────────
# DOWNLOAD MP4 — Video, independently
# ─────────────────────────────────────────

@app.post("/download-mp4")
async def download_mp4(url: str = Form(...), quality: str = Form("720p")):
    """Download video as MP4 — independent of audio download."""
    clean_url = _validate_url(url)

    # Map quality label to yt-dlp format selector
    quality_map = {
        "360p": "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]",
        "480p": "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]",
        "720p": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]",
        "1080p": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
    }
    fmt = quality_map.get(quality, quality_map["720p"])

    safe_id = uuid.uuid4().hex[:12]
    output_template = str(DOWNLOAD_DIR / f"{safe_id}.%(ext)s")
    ffmpeg_path = get_ffmpeg_binary()

    try:
        import yt_dlp

        options = get_ytdlp_opts({
            "format": fmt,
            "outtmpl": output_template,
            "ffmpeg_location": ffmpeg_path,
            "max_filesize": 1024 * 1024 * 1024,  # 1 GB
            "merge_output_format": "mp4",
        })

        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(clean_url, download=True)

        # Find the output file
        output_path = None
        for f in DOWNLOAD_DIR.glob(f"{safe_id}.*"):
            if f.suffix.lower() in (".mp4", ".mkv", ".webm"):
                output_path = f
                break

        if not output_path or not output_path.is_file() or output_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="MP4 download produced an empty file.")

        return {
            "download_url": f"/download/{output_path.name}",
            "filename": f"{safe_id}.mp4",
        }

    except HTTPException:
        _cleanup(safe_id)
        raise
    except Exception as exc:
        _cleanup(safe_id)
        raise HTTPException(
            status_code=400,
            detail=f"MP4 download failed: {exc}",
        ) from exc


# ─────────────────────────────────────────
# LEGACY — Convert uploaded file to MP3
# ─────────────────────────────────────────

@app.post("/convert")
async def convert_video(file: UploadFile = File(...), quality: str = Form("192k")):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    source_name = Path(file.filename).name
    valid_qualities = {"128k", "192k", "256k", "320k"}
    clean_quality = quality if quality in valid_qualities else "192k"

    stem = Path(source_name).stem
    safe_stem = "".join(ch for ch in stem if ch.isalnum() or ch in ("-", "_", ".")).strip() or "converted_audio"
    input_ext = Path(source_name).suffix.lower() or ".mp4"
    safe_id = uuid.uuid4().hex[:8]
    input_path = UPLOAD_DIR / f"{safe_id}{input_ext}"
    output_name = f"{safe_stem}_{safe_id}.mp3"
    output_path = DOWNLOAD_DIR / output_name

    try:
        with input_path.open("wb") as dst:
            shutil.copyfileobj(file.file, dst)

        if input_path.stat().st_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        ffmpeg_path = get_ffmpeg_binary()
        cmd = [
            ffmpeg_path, "-y", "-i", str(input_path),
            "-vn", "-ar", "44100", "-ac", "2", "-b:a", clean_quality,
            str(output_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            err = result.stderr.strip() or "Conversion failed."
            if "does not contain any stream" in err:
                raise HTTPException(status_code=400, detail="No audio stream found in this file.")
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {err[-250:]}")

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="Generated audio file is empty.")

        return {"download_url": f"/download/{output_name}", "filename": f"{safe_stem}.mp3"}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error: {exc}") from exc
    finally:
        try:
            file.file.close()
        except Exception:
            pass
        try:
            if input_path.exists():
                input_path.unlink()
        except OSError:
            pass


# ─────────────────────────────────────────
# LEGACY — Convert URL to MP3
# ─────────────────────────────────────────

@app.post("/convert-url")
async def convert_video_url(url: str = Form(...), quality: str = Form("192k")):
    clean_url = _validate_url(url)
    valid_qualities = {"128k", "192k", "256k", "320k"}
    clean_quality = quality if quality in valid_qualities else "192k"
    safe_id = uuid.uuid4().hex[:12]
    output_template = str(DOWNLOAD_DIR / f"{safe_id}.%(ext)s")
    output_path = DOWNLOAD_DIR / f"{safe_id}.mp3"
    ffmpeg_path = get_ffmpeg_binary()

    try:
        import yt_dlp
        options = get_ytdlp_opts({
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "ffmpeg_location": ffmpeg_path,
            "max_filesize": 500 * 1024 * 1024,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": clean_quality.removesuffix("k"),
            }],
        })
        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([clean_url])

        if not output_path.is_file() or output_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="MP3 conversion produced an empty file.")

        return {"download_url": f"/download/{output_path.name}", "filename": f"{safe_id}.mp3"}

    except HTTPException:
        _cleanup(safe_id)
        raise
    except Exception as exc:
        _cleanup(safe_id)
        raise HTTPException(status_code=400, detail=f"Download failed: {exc}") from exc
    finally:
        for f in DOWNLOAD_DIR.glob(f"{safe_id}.*"):
            if f != output_path:
                try:
                    f.unlink()
                except OSError:
                    pass


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def _cleanup(safe_id: str) -> None:
    for f in DOWNLOAD_DIR.glob(f"{safe_id}.*"):
        try:
            f.unlink()
        except OSError:
            pass


# ─────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    sys.path.insert(0, str(BASE_DIR))
    print("Starting Charan Media Downloader on http://127.0.0.1:8000 ...")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
