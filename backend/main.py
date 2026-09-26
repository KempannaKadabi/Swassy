from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from backend.config import UPLOAD_DIR, BASE_DIR
from backend.database import init_db
from backend.routers import (
    auth,
    patients,
    triage,
    scribe,
    ocr,
    consultations,
    analytics,
    outbreaks,
    fhir_router,
    abdm_router,
    redflags_router,
    ayush_router,
    safety_router,
    language,
    disease_detection,
    patient_files,
    reports
)

app = FastAPI(
    title="Swasya AI — Patient Case-Taking & Clinical Operating System",
    description="Web-only AI-powered healthcare case-taking platform for Primary Health Centers",
    version="2.2.0"
)

# Enable CORS for full web access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(triage.router)
app.include_router(scribe.router)
app.include_router(ocr.router)
app.include_router(consultations.router)
app.include_router(analytics.router)
app.include_router(outbreaks.router)
app.include_router(fhir_router.router)
app.include_router(abdm_router.router)
app.include_router(redflags_router.router)
app.include_router(ayush_router.router)
app.include_router(safety_router.router)
app.include_router(language.router)
app.include_router(disease_detection.router)
app.include_router(patient_files.router)
app.include_router(reports.router)

# Health endpoint MUST be before static '/' mount
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "Swasya AI Clinical Case-Taking Web Platform",
        "version": "2.1.0",
        "mode": "web-only",
        "disclaimer": "AI GENERATED DRAFT — REQUIRES PHYSICIAN VERIFICATION"
    }

@app.on_event("startup")
async def on_startup():
    await init_db()

# Mount uploads directory
uploads_path = Path(UPLOAD_DIR)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# Mount frontend static directory LAST
frontend_static = BASE_DIR / "frontend" / "static"
frontend_static.mkdir(parents=True, exist_ok=True)
app.mount("/", StaticFiles(directory=str(frontend_static), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    from backend.config import HOST, PORT
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=True)
