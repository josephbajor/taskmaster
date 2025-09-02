from __future__ import annotations

import fastapi

from .service import AbstractTranscriptionService
from ..types.health_response import HealthResponse
from ..types.transcription_response import TranscriptionResponse
from taskmaster.transcription import transcribe_audio_file


class TranscriptionService(AbstractTranscriptionService):
    def get_health(self) -> HealthResponse:
        return HealthResponse(status="ok")

    def create_transcription(self, *, file: fastapi.UploadFile) -> TranscriptionResponse:
        contents: bytes = file.file.read()
        text: str = transcribe_audio_file(contents, filename=getattr(file, "filename", None) or "audio.webm")
        return TranscriptionResponse(text=text)


