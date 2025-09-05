from taskmaster.api.resources.transcription.service.service import (
    AbstractTranscriptionService,
)
from taskmaster.api.resources.transcription.types.transcription_response import (
    TranscriptionResponse,
)
from taskmaster.services.transcription.transcription import transcribe_audio_file
import fastapi


class TranscriptionService(AbstractTranscriptionService):
    def create_transcription(
        self, *, file: fastapi.UploadFile
    ) -> TranscriptionResponse:
        contents: bytes = file.file.read()
        text: str = transcribe_audio_file(
            contents, filename=getattr(file, "filename", None) or "audio.webm"
        )
        return TranscriptionResponse(text=text)
