from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from taskmaster.transcription import transcribe_audio_file

app = FastAPI(title="Taskmaster API", version="0.1.0")

# CORS: allow Electron file:// origin and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class HealthResponse(BaseModel):
    status: str


class TranscriptionResponse(BaseModel):
    text: str


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/api/transcriptions", response_model=TranscriptionResponse)
async def transcriptions(file: UploadFile = File(...)) -> TranscriptionResponse:
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    try:
        contents = await file.read()
        text = await transcribe_audio_file(contents, filename=file.filename or "audio.webm")
        return TranscriptionResponse(text=text)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
