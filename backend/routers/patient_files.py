"""
Swasya AI — Patient Hospital Records & Document Upload Router
Supports uploading past hospital visits, prescriptions, X-rays, lab reports, and discharge summaries.
Stores files securely, extracts OCR text, and provides files to the prescriber (Doctor Desk).
"""

import os
import time
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse
from typing import Optional, List, Dict, Any
from backend import config
from backend.database import get_db, get_next_sequence
from backend.ocr_engine import extract_text_from_file, parse_medical_document
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/patient-files", tags=["Patient Records & Files"])

FILES_DIR = Path(config.UPLOAD_DIR) / "patient_records"
FILES_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload")
async def upload_patient_record(
    patient_id: str = Form(...),
    file_type: str = Form("prescription"), # prescription, xray, lab_report, discharge_summary, other
    hospital_name: Optional[str] = Form(""),
    visit_date: Optional[str] = Form(""),
    notes: Optional[str] = Form(""),
    triage_id: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    """
    Uploads previous medical records from other hospitals (X-ray, Prescription, Discharge Summary, Lab Report).
    Saves file, performs OCR on readable documents, and links to patient history for prescriber view.
    """
    VALID_FILE_TYPES = ('prescription', 'xray', 'mri', 'ct_scan', 'sonography', 'lab_report', 'discharge_summary', 'other')
    if file_type not in VALID_FILE_TYPES:
        file_type = 'other'

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    filename = file.filename or f"record_{int(time.time())}.jpg"
    safe_name = f"rec_{patient_id}_{int(time.time())}_{filename.replace(' ', '_')}"
    target_path = FILES_DIR / safe_name

    with open(target_path, "wb") as f:
        f.write(contents)

    rel_path = f"/uploads/patient_records/{safe_name}"
    file_size = len(contents)

    # If it's a document/prescription, scan, MRI, CT, Sonography or lab report, run OCR
    ocr_text = ""
    parsed_info = {}
    try:
        if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.pdf', '.webp', '.txt', '.csv')) or file_type in ('prescription', 'discharge_summary', 'lab_report', 'mri', 'ct_scan', 'sonography', 'xray', 'other'):
            ocr_text = extract_text_from_file(str(target_path))
            if ocr_text:
                parsed_info = parse_medical_document(ocr_text)
    except Exception as e:
        print(f"OCR/Parsing error on patient file upload: {e}")
        ocr_text = ""
        parsed_info = {}

    # Save in database
    db = get_db()
    try:
        # If allergies or chronic conditions found in the document, link to patient record
        if parsed_info.get("allergies") or parsed_info.get("conditions"):
            try:
                p_filter = {"_id": ObjectId(patient_id)} if ObjectId.is_valid(patient_id) else {"_id": patient_id}
                p_curr = await db.patients.find_one(p_filter)
                if p_curr:
                    updates = {}
                    if parsed_info.get("allergies"):
                        curr_all = p_curr.get("allergies") or ""
                        new_all = ", ".join(parsed_info["allergies"])
                        if new_all and new_all.lower() not in curr_all.lower():
                            updates["allergies"] = f"{curr_all}, {new_all}".strip(", ")
                    if parsed_info.get("conditions"):
                        curr_cond = p_curr.get("chronic_conditions") or ""
                        new_cond = ", ".join(parsed_info["conditions"])
                        if new_cond and new_cond.lower() not in curr_cond.lower():
                            updates["chronic_conditions"] = f"{curr_cond}, {new_cond}".strip(", ")
                    if updates:
                        await db.patients.update_one(p_filter, {"$set": updates})
            except Exception as pe:
                print("Patient allergy/condition update notice:", pe)

        doc = {
            "patient_id": patient_id,
            "triage_id": triage_id,
            "file_name": safe_name,
            "original_filename": filename,
            "file_type": file_type,
            "file_path": rel_path,
            "file_size": file_size,
            "hospital_name": hospital_name or "",
            "visit_date": visit_date or "",
            "notes": notes or "",
            "ocr_text": ocr_text or "",
            "extracted_summary": parsed_info.get("summary", ""),
            "extracted_data_json": parsed_info,
            "uploaded_at": datetime.utcnow()
        }
        result = await db.patient_files.insert_one(doc)
        file_id = str(result.inserted_id)

        return {
            "success": True,
            "file_id": file_id,
            "patient_id": patient_id,
            "file_type": file_type,
            "file_name": filename,
            "file_path": rel_path,
            "file_size_bytes": file_size,
            "hospital_name": hospital_name,
            "ocr_extracted": bool(ocr_text),
            "summary": parsed_info.get("summary", ""),
            "extracted_data": parsed_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error saving file record: {str(e)}")

@router.get("/patient/{patient_id}")
async def get_patient_files(patient_id: str):
    """Returns all previous hospital files, X-rays, and prescriptions for a patient."""
    db = get_db()
    cursor = db.patient_files.find({"patient_id": patient_id}).sort("uploaded_at", -1)
    rows = []
    async for row in cursor:
        r = dict(row)
        r["id"] = str(r["_id"])
        del r["_id"]
        rows.append(r)
    return {
        "patient_id": patient_id,
        "count": len(rows),
        "files": rows
    }

@router.get("/triage/{triage_id}")
async def get_triage_files(triage_id: str):
    """Returns all files associated with a specific triage encounter."""
    db = get_db()
    
    # We need files where pf.triage_id = triage_id OR pf.patient_id = patient_id from the triage record.
    # First get the triage record to find the patient_id
    try:
        triage = await db.triage_records.find_one({"_id": ObjectId(triage_id)})
    except Exception:
        triage = await db.triage_records.find_one({"id": triage_id})
        
    patient_id = triage.get("patient_id") if triage else None

    query = {}
    if patient_id:
        query = {"$or": [{"triage_id": triage_id}, {"patient_id": patient_id}]}
    else:
        query = {"triage_id": triage_id}

    cursor = db.patient_files.aggregate([
        {"$match": query},
        {"$sort": {"uploaded_at": -1}}
    ])
    
    rows = []
    async for row in cursor:
        r = dict(row)
        r["id"] = str(r["_id"])
        
        # Get patient info
        if r.get("patient_id"):
            try:
                p = await db.patients.find_one({"_id": ObjectId(r["patient_id"])})
            except Exception:
                p = await db.patients.find_one({"id": r["patient_id"]})
            if p:
                r["patient_name"] = p.get("name")
                r["uhid"] = p.get("uhid")
        
        del r["_id"]
        rows.append(r)

    return {
        "triage_id": triage_id,
        "count": len(rows),
        "files": rows
    }

@router.delete("/{file_id}")
async def delete_patient_file(file_id: str):
    """Deletes a patient file record."""
    db = get_db()
    try:
        file_doc = await db.patient_files.find_one({"_id": ObjectId(file_id)})
        if not file_doc:
            raise HTTPException(status_code=404, detail="File record not found")

        await db.patient_files.delete_one({"_id": ObjectId(file_id)})
        return {"success": True, "message": "Record deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
