from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import traceback
from fastapi.responses import JSONResponse

from taskmaster.api.register import register as register_fern
from taskmaster.api.resources.transcription.service.impl import TranscriptionService

app = FastAPI(title="Taskmaster API", version="0.1.0")

# CORS: allow Electron file:// origin and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Register Fern-generated API routes with our implementation
register_fern(app, transcription=TranscriptionService())


# Global error handler with traceback logging
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):  # noqa: ANN001
    logging.basicConfig(level=logging.DEBUG)
    logging.exception("Unhandled exception during request: %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": exc.__class__.__name__,
            "traceback": traceback.format_exc(),
            "path": str(request.url),
            "method": request.method,
        },
    )
