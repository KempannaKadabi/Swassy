#!/usr/bin/env python3
"""
Swasya AI - Clinical Operating System Startup Script
Launches the full-stack hospital web application with FastAPI, MongoDB, and the clinical UI.
"""
import sys
import os
import threading
import webbrowser
from pathlib import Path

# Add current directory to python path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))

from backend.config import HOST, PORT, MONGODB_URI, MONGODB_DB_NAME

# Safe import with fallback
try:
    from backend.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY
except Exception:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

def open_browser():
    try:
        webbrowser.open(f"http://localhost:{PORT}")
    except Exception:
        pass

if __name__ == "__main__":
    server_host = "127.0.0.1" if HOST in ["0.0.0.0", "localhost"] else HOST
    browser_url = f"http://localhost:{PORT}"

    print("=" * 68)
    print("  [+] SWASYA AI - CLINICAL OPERATING SYSTEM")
    print("  [+] Hospital Case-Taking & Triage Platform")
    print("=" * 68)
    if GEMINI_API_KEY:
        masked = GEMINI_API_KEY[:8] + "..." + GEMINI_API_KEY[-4:] if len(GEMINI_API_KEY) > 12 else "Active"
        print(f"* Active AI Engine : Google Gemini ({GEMINI_MODEL}) [{masked}]")
    elif GROQ_API_KEY:
        print(f"* Active AI Engine : Groq LLaMA 3.3 70B")
    else:
        print("* Active AI Engine : Swasya Clinical Reasoning Engine (Offline Mode)")
    print(f"* Database         : MongoDB ({MONGODB_DB_NAME}) -> {MONGODB_URI}")
    print(f"* Web Server URL   : {browser_url}")
    print(f"* Patient Kiosk    : {browser_url} (Click 'Patient Portal')")
    print(f"* Doctor Desk      : {browser_url} (Click 'Doctor Desk')")
    print("=" * 68)

    # Auto-launch default browser after 1.5 seconds
    threading.Timer(1.5, open_browser).start()

    import uvicorn
    uvicorn.run("backend.main:app", host=server_host, port=PORT, reload=True)
