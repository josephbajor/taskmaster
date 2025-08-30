# taskmaster
Taskmaster is an llm-powered time management app designed to eliminate unstructured time in your day

## Prerequisites
- Python 3.13+
- uv (Python project manager). Install via pipx:
```
pipx install uv
```
- Node.js 20+ and npm
- ffmpeg (for audio transcoding)
  - macOS: `brew install ffmpeg`

## Setup

### 1) Backend API (FastAPI)
From the project root:
```
uv sync
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Verify it's up:
```
curl http://127.0.0.1:8000/healthz
```

First transcription may download the model (hundreds of MB) on demand.

Optional environment variables (tune Whisper runtime):
- `WHISPER_MODEL` (default: `small`)
- `WHISPER_DEVICE` (default: `auto`)
- `WHISPER_COMPUTE_TYPE` (defaults vary by platform; loader auto-falls back among `float16`, `int8_float32`, `int8`, `float32`)
- `WHISPER_VAD` (`1` to enable VAD; default `0`)

If you see a 500 error about compute type, try:
```
export WHISPER_COMPUTE_TYPE=int8_float32
```

### 2) Desktop app (Electron + React)
In a separate terminal:
```
cd desktop
npm install
npm run dev
```
This starts Vite and launches Electron pointed at `http://localhost:5173`.

## Using the jot pad
- In the app, type in the quick jot area and press Enter (or Cmd/Ctrl+Enter) to add a note.
- Click "Start Mic" to record; click "Stop Mic" to send audio to the backend and append the transcription as a note.

## Troubleshooting
- Backend 500 with compute type: set `WHISPER_COMPUTE_TYPE=int8_float32` and restart the API.
- No audio transcription: ensure `ffmpeg` is installed and available on PATH.
- macOS microphone access: System Settings → Privacy & Security → Microphone → allow for your terminal/Electron app.

## Project structure (partial)
```
backend/
  app/
    main.py           # FastAPI app (healthz, /transcribe)
    transcription.py  # faster-whisper loader + transcribe
    audio_utils.py    # ffmpeg-based WebM/Opus→WAV conversion
desktop/
  electron/           # electron main & preload
  src/ui/             # React UI
  package.json        # dev scripts
```

