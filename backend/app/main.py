import os
import tempfile
import uuid
import logging
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .transcription import transcribe_file
from .audio_utils import ffmpeg_available, convert_to_wav_16k_mono


app = FastAPI(title="Taskmaster API", version="0.1.0")
logger = logging.getLogger("taskmaster.api")
if not logger.handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


# Allow local Electron app to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> JSONResponse:
    tmp_path: str | None = None
    try:
        suffix = Path(file.filename or "audio").suffix or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        logger.info("/transcribe received file name=%s size=%s suffix=%s", file.filename, len(content), suffix)

        source = tmp_path
        # If ffmpeg is available and file is webm/opus, normalize to wav 16k mono
        if ffmpeg_available() and suffix.lower() in {".webm", ".ogg", ".opus", ".m4a", ".mp3"}:
            logger.info("Converting %s to wav via ffmpeg", tmp_path)
            wav_path = convert_to_wav_16k_mono(tmp_path)
            source = wav_path

        result = transcribe_file(source)
        return JSONResponse(result)
    except Exception as exc:  # noqa: BLE001
        # Provide more detail for debugging
        logger.exception("Transcription failed")
        detail = f"Transcription failed: {type(exc).__name__}: {exc}"
        raise HTTPException(status_code=500, detail=detail)
    finally:
        if tmp_path and Path(tmp_path).exists():
            try:
                Path(tmp_path).unlink()
            except Exception:  # noqa: BLE001
                pass


