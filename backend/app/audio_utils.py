import shutil
import subprocess
import tempfile
from pathlib import Path


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def convert_to_wav_16k_mono(input_path: str) -> str:
    input_p = Path(input_path)
    if not input_p.exists():
        raise FileNotFoundError(str(input_p))

    out_fd, out_path = tempfile.mkstemp(suffix=".wav")
    Path(out_path).unlink(missing_ok=True)  # we just need the path

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_p),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        out_path,
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ffmpeg conversion failed: {exc}") from exc
    return out_path


