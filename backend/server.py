from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import traceback
import asyncio
from fastapi.responses import JSONResponse
from taskmaster.api.register import register as register_fern
from taskmaster.services.system.core import SystemService
from taskmaster.services.task_management.core import TasksService
from taskmaster.services.transcription.core import TranscriptionService
from taskmaster.config import get_settings

settings = get_settings()

# Optional: enable debugpy when requested via environment variables
_DEBUGPY = None
_DEBUG_WAIT = settings.backend_debug_wait
if settings.backend_debug:
    try:
        # debugpy is installed ad-hoc via `uv run --with debugpy` in dev.sh
        import debugpy  # type: ignore

        _DEBUGPY = debugpy
        debug_host = settings.backend_debug_host
        debug_port = settings.backend_debug_port

        debugpy.listen((debug_host, debug_port))
        logging.getLogger(__name__).info(
            "debugpy listening on %s:%s", debug_host, debug_port
        )
    except Exception:
        logging.exception("Failed to initialize debugpy; continuing without debugger")

app = FastAPI(title="Taskmaster API", version="0.1.0")

# CORS: allow Electron file:// origin and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Fern-generated API routes
register_fern(
    app,
    system=SystemService(),
    tasks=TasksService(),
    transcription=TranscriptionService(),
)

# If requested, wait for debugger attachment during startup in a non-blocking loop
if _DEBUGPY is not None and _DEBUG_WAIT:

    @app.on_event("startup")
    async def _wait_for_debugger() -> None:  # noqa: D401
        logger = logging.getLogger(__name__)
        logger.info("Waiting for debugger to attach (Ctrl-C to quit)...")
        try:
            while not _DEBUGPY.is_client_connected():
                await asyncio.sleep(0.1)
        except Exception:
            logger.exception("Error while waiting for debugger to attach")
        else:
            logger.info("Debugger attached. Continuing startup.")


# Global error handler with traceback logging
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):  # noqa: ANN001
    logging.basicConfig(level=logging.DEBUG)
    logging.exception(
        "Unhandled exception during request: %s %s", request.method, request.url
    )
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
