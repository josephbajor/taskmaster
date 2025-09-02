from __future__ import annotations

from typing import Optional
import io
import os

from openai import OpenAI


async def transcribe_audio_file(file_bytes: bytes, filename: Optional[str] = None) -> str:
	"""Transcribe the given audio bytes using OpenAI Whisper (server-side).

	Args:
		file_bytes: Audio data as bytes.
		filename: Optional filename used for content-type inference.

	Returns:
		Transcribed text.
	"""
	api_key = os.getenv("OPENAI_API_KEY")
	if not api_key:
		raise RuntimeError("OPENAI_API_KEY is not set")

	client = OpenAI(api_key=api_key)

	# Create a file-like object
	file_like = io.BytesIO(file_bytes)
	file_like.name = filename or "audio.webm"

	# Use Whisper for now; can switch to GPT-4o mini transcribe when available
	transcript = client.audio.transcriptions.create(
		model="whisper-1",
		file=file_like,
	)

	# transcript.text for whisper-1
	text = getattr(transcript, "text", None) or getattr(transcript, "output_text", None)
	if not text:
		# Fallback: some SDK versions nest data differently
		try:
			text = transcript["text"]  # type: ignore[index]
		except Exception as exc:  # noqa: BLE001
			raise RuntimeError("Failed to parse transcription response") from exc

	return text
