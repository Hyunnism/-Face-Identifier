import os
import sys
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Auto-delegate to local .venv if not already active
VENV_PYTHON = BASE_DIR / ".venv" / "Scripts" / "python.exe"
if VENV_PYTHON.exists() and sys.executable.lower() != str(VENV_PYTHON).lower():
    try:
        result = subprocess.run([str(VENV_PYTHON), str(Path(__file__).resolve())] + sys.argv[1:])
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        print("\n[VisionCore] Server dihentikan. Sampai jumpa!")
        sys.exit(0)

import uvicorn

if __name__ == "__main__":
    print("\n=======================================================")
    print(" VISIONCORE: Face Recognition Read & Upload System")
    print(" Environment: .venv (Terisolasi di Folder Proyek)")
    print(" Buka browser di: http://127.0.0.1:8000")
    print(" Tekan CTRL+C di terminal ini untuk berhenti.")
    print("=======================================================\n")
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    try:
        uvicorn.run("src.app:app", host=host, port=port, reload=False, log_level="info")
    except KeyboardInterrupt:
        print("\n[VisionCore] Server dihentikan dengan aman. Sampai jumpa!\n")
        sys.exit(0)
