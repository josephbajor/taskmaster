import os
import platform
import typing as t
import logging

from faster_whisper import WhisperModel


_model: WhisperModel | None = None
_logger = logging.getLogger("taskmaster.transcription")


def _load_model() -> WhisperModel:
    global _model
    if _model is not None:
        return _model

    model_size = os.getenv("WHISPER_MODEL", "small")
    # device: "auto" lets faster-whisper choose. On Apple Silicon this may fall back to CPU.
    device = os.getenv("WHISPER_DEVICE", "auto")

    # Choose safer defaults by platform, allow override via env
    default_compute = os.getenv("WHISPER_COMPUTE_TYPE")
    if not default_compute:
        if platform.system() == "Darwin":
            # On Apple Silicon, float16 is widely supported via MPS; int8_float16 often is not
            default_compute = "float16"
        else:
            # CPU-friendly default on other platforms
            default_compute = "int8_float32"

    attempts: list[str] = [
        default_compute,
        "float16",
        "int8_float32",
        "int8",
        "float32",
    ]

    last_err: Exception | None = None
    for compute_type in attempts:
        try:
            _logger.info(
                "Loading Whisper model size=%s device=%s compute_type=%s",
                model_size,
                device,
                compute_type,
            )
            _model = WhisperModel(model_size, device=device, compute_type=compute_type)
            _logger.info("Whisper model loaded with compute_type=%s", compute_type)
            return _model
        except Exception as exc:  # noqa: BLE001
            _logger.warning("Failed to load compute_type=%s: %s", compute_type, exc)
            last_err = exc

    # If all attempts failed, raise the last error
    raise last_err  # type: ignore[misc]


def transcribe_file(
    audio_path: str,
    language: str | None = None,
    beam_size: int = 5,
) -> dict[str, t.Any]:
    model = _load_model()
    vad_env = os.getenv("WHISPER_VAD", "0").lower()
    use_vad = vad_env in {"1", "true", "yes"}
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=beam_size,
        vad_filter=use_vad,
    )

    text_parts: list[str] = []
    output_segments: list[dict[str, t.Any]] = []
    for seg in segments:
        text_parts.append(seg.text)
        output_segments.append(
            {
                "id": seg.id,
                "start": seg.start,
                "end": seg.end,
                "text": seg.text,
                "avg_logprob": seg.avg_logprob,
                "compression_ratio": seg.compression_ratio,
                "no_speech_prob": seg.no_speech_prob,
            }
        )

    return {
        "language": info.language,
        "duration": info.duration,
        "text": " ".join(text_parts).strip(),
        "segments": output_segments,
    }


