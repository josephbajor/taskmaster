from __future__ import annotations

from typing import Optional
import io
import os
import tempfile
from pathlib import Path

from openai import OpenAI
from taskmaster.config import get_settings


def transcribe_audio_file(file_bytes: bytes, filename: Optional[str] = None) -> str:
    """Transcribe the given audio bytes using OpenAI Whisper (server-side).

    Args:
            file_bytes: Audio data as bytes.
            filename: Optional filename used for content-type inference.

    Returns:
            Transcribed text.
    """
    settings = get_settings()
    api_key = settings.openai_api_key
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set in configuration")

    client = OpenAI(api_key=api_key)

    # Determine file suffix based on provided filename; default to webm (common from MediaRecorder)
    allowed_suffixes = {
        ".flac",
        ".m4a",
        ".mp3",
        ".mp4",
        ".mpeg",
        ".mpga",
        ".oga",
        ".ogg",
        ".wav",
        ".webm",
    }
    extension = ".webm"
    if filename:
        candidate = Path(filename).suffix.lower()
        if candidate in allowed_suffixes:
            extension = candidate

    # Write bytes to a temporary file so the SDK sends a proper filename
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(suffix=extension, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp.flush()
            tmp_path = tmp.name

        # Use Whisper for now
        with open(tmp_path, "rb") as fh:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=fh,
            )
    finally:
        if tmp_path is not None:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    # transcript.text for whisper-1
    text = getattr(transcript, "text", None) or getattr(transcript, "output_text", None)
    if not text:
        # Fallback: some SDK versions nest data differently
        try:
            text = transcript["text"]  # type: ignore[index]
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError("Failed to parse transcription response") from exc

    return text
