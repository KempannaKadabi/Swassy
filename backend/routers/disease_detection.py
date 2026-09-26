"""
Swasya AI — Disease Detection API Router
Supports camera captures of body lesions and integrates with the anatomical skeleton workflow.
"""

import os
import json
import time
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from backend import config
from backend.database import get_db, get_next_sequence
from backend.disease_detector import DiseaseDetector, BODY_REGION_DISEASE_PROFILES
from backend.xray_analyzer import XrayAnalyzer
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/disease", tags=["Disease Detection & Vision AI"])

CAPTURES_DIR = Path(config.UPLOAD_DIR) / "disease_captures"
CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
XRAYS_DIR = Path(config.UPLOAD_DIR) / "xrays"
XRAYS_DIR.mkdir(parents=True, exist_ok=True)

class DoctorReviewRequest(BaseModel):
    doctor_notes: str
    confirmed: bool = True

@router.get("/supported-conditions")
async def get_supported_conditions():
    """Returns all anatomical regions and detectable dermatological / lesion conditions."""
    return {
        "regions": list(BODY_REGION_DISEASE_PROFILES.keys()),
        "profiles": BODY_REGION_DISEASE_PROFILES,
        "disclaimer": "AI Screening Engine for PHC Triage and Preliminary Clinical Categorization."
    }

@router.post("/detect")
async def detect_disease_from_photo(
    file: UploadFile = File(...),
    body_location: str = Form("auto"),
    patient_id: Optional[str] = Form(None),
    triage_id: Optional[str] = Form(None)
):
    """
    Analyzes an uploaded or camera-clicked image of a patient's body lesion.
    Saves image, runs vision classification, stores result in database, and returns diagnostic screening.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="No image uploaded or empty file")

    # Save capture file
    safe_name = f"lesion_{int(time.time())}_{file.filename.replace(' ', '_')}"
    target_path = CAPTURES_DIR / safe_name
    with open(target_path, "wb") as f:
        f.write(contents)

    rel_path = f"/uploads/disease_captures/{safe_name}"

    # Analyze via DiseaseDetector
    analysis = DiseaseDetector.analyze_image(contents, body_location=body_location)

    # Save in database if patient_id is provided
    record_id = None
    if patient_id:
        db = get_db()
        try:
            doc = {
                "patient_id": patient_id,
                "triage_id": triage_id,
                "image_path": rel_path,
                "body_location": analysis.get("body_location", body_location),
                "detected_body_part": analysis.get("detected_body_part", analysis.get("body_location", body_location)),
                "is_body_part": analysis.get("is_body_part", True),
                "predicted_condition": analysis.get("primary_condition", "Unknown Condition"),
                "confidence": float(analysis.get("confidence_pct", 80.0)),
                "severity": analysis.get("severity", "medium"),
                "details_json": json.dumps(analysis),
                "created_at": datetime.utcnow()
            }
            result = await db.disease_detections.insert_one(doc)
            record_id = str(result.inserted_id)
        except Exception as e:
            pass

    return {
        "success": True,
        "record_id": record_id,
        "image_url": rel_path,
        "analysis": analysis
    }

@router.get("/patient/{patient_id}")
async def get_patient_detections(patient_id: str):
    """Retrieves all photo-detected disease records for a specific patient."""
    db = get_db()
    cursor = db.disease_detections.find({"patient_id": patient_id}).sort("created_at", -1)
    rows = []
    async for row in cursor:
        r = dict(row)
        r["id"] = str(r["_id"])
        del r["_id"]
        if r.get("details_json"):
            try:
                r["details"] = json.loads(r["details_json"])
            except Exception:
                r["details"] = {}
        rows.append(r)
    return {"patient_id": patient_id, "detections": rows}

@router.post("/review/{detection_id}")
async def review_disease_detection(detection_id: str, req: DoctorReviewRequest):
    """Allows attending doctor to verify, confirm, or annotate the AI disease detection."""
    db = get_db()
    try:
        await db.disease_detections.update_one(
            {"_id": ObjectId(detection_id)},
            {"$set": {
                "doctor_notes": req.doctor_notes,
                "doctor_confirmed": 1 if req.confirmed else 0
            }}
        )
        return {"success": True, "message": "Detection review recorded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-xray")
async def analyze_xray_image(
    file: UploadFile = File(...),
    region: str = Form("auto"),
    patient_id: Optional[str] = Form(None),
    triage_id: Optional[str] = Form(None),
    clinical_notes: Optional[str] = Form(None)
):
    """
    Analyzes an uploaded X-ray image immediately upon upload using AI Vision
    and clinical radiology intelligence. Returns structured findings, severity,
    and recommendations, and saves to patient records.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded X-ray image is empty")

    safe_name = f"xray_{int(time.time())}_{file.filename.replace(' ', '_')}"
    target_path = XRAYS_DIR / safe_name
    with open(target_path, "wb") as f:
        f.write(contents)

    rel_path = f"/uploads/xrays/{safe_name}"

    # Run AI Radiologic Analysis
    analysis = XrayAnalyzer.analyze(
        image_bytes=contents,
        filename=file.filename,
        region_hint=region,
        clinical_notes=clinical_notes or ""
    )

    db = get_db()
    record_id = None
    try:
        xray_doc = {
            "patient_id": patient_id,
            "triage_id": triage_id,
            "filename": file.filename,
            "image_url": rel_path,
            "region": analysis.get("anatomical_region"),
            "projection": analysis.get("projection"),
            "primary_impression": analysis.get("primary_impression"),
            "severity": analysis.get("severity", "normal"),
            "confidence_pct": analysis.get("confidence_pct", 92.0),
            "findings": analysis.get("findings", []),
            "radiological_features": analysis.get("radiological_features", {}),
            "clinical_recommendation": analysis.get("clinical_recommendation", ""),
            "ai_engine": analysis.get("ai_engine"),
            "created_at": datetime.utcnow()
        }
        res = await db.xray_analyses.insert_one(xray_doc)
        record_id = str(res.inserted_id)

        # Also register in disease_detections so Doctor Desk AI screening card picks it up
        await db.disease_detections.insert_one({
            "patient_id": patient_id,
            "triage_id": triage_id,
            "image_path": rel_path,
            "body_location": analysis.get("anatomical_region", "Chest"),
            "predicted_condition": analysis.get("primary_impression"),
            "confidence": analysis.get("confidence_pct", 92.0),
            "severity": analysis.get("severity", "medium"),
            "details_json": json.dumps(analysis),
            "created_at": datetime.utcnow()
        })

        # Also register in patient_files as an X-ray document with OCR text for SOAP synthesis
        findings_text = "\n".join(analysis.get("findings", []))
        summary_ocr = f"X-RAY ({analysis.get('anatomical_region')}, {analysis.get('projection')} View):\nIMPRESSION: {analysis.get('primary_impression')}\nFINDINGS:\n{findings_text}\nRECOMMENDATION: {analysis.get('clinical_recommendation')}"
        
        await db.patient_files.insert_one({
            "patient_id": patient_id or "1",
            "file_name": safe_name,
            "original_filename": file.filename,
            "file_type": "xray",
            "file_path": rel_path,
            "file_size": len(contents),
            "ocr_text": summary_ocr,
            "hospital_name": "Digital X-Ray Radiography",
            "visit_date": time.strftime("%Y-%m-%d"),
            "uploaded_at": datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.warning(f"Database save notice for X-ray analysis: {e}")

    return {
        "success": True,
        "record_id": record_id,
        "image_url": rel_path,
        "file_name": file.filename,
        "analysis": analysis
    }

@router.get("/xray/patient/{patient_id}")
async def get_patient_xrays(patient_id: str):
    """Retrieves all analyzed X-rays for a patient."""
    db = get_db()
    cursor = db.xray_analyses.find({"patient_id": patient_id}).sort("created_at", -1)
    rows = []
    async for r in cursor:
        d = dict(r)
        d["id"] = str(d["_id"])
        del d["_id"]
        rows.append(d)
    return {"patient_id": patient_id, "xrays": rows}
