from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional
from pathlib import Path
import time
import json
from backend.database import get_db
from backend.auth import get_current_user
from backend.config import UPLOAD_DIR
from backend.ocr_engine import extract_text_from_file, parse_medical_document
from bson import ObjectId
from datetime import datetime
import pytz

router = APIRouter(prefix="/api/ocr", tags=["Document Scanning & OCR"])

@router.post("/upload")
async def upload_and_ocr(
    patient_id: str = Form(...),
    triage_id: Optional[str] = Form(None),
    doc_type: str = Form("prescription"),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Swasya Scan: Uploads medical document/prescription, executes OCR via pytesseract,
    extracts structured clinical data, and binds it to the patient's UHID.
    """
    db = get_db()
    
    patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    timestamp = int(time.time())
    file_ext = Path(file.filename).suffix
    safe_filename = f"doc_{patient_id}_{timestamp}_{Path(file.filename).stem[:20]}{file_ext}"
    save_path = Path(UPLOAD_DIR) / safe_filename

    contents = await file.read()
    with open(save_path, "wb") as f:
        f.write(contents)

    raw_ocr_text = extract_text_from_file(str(save_path))
    parsed_info = parse_medical_document(raw_ocr_text)

    current_allergies = patient.get("allergies") or ""
    new_allergies = parsed_info.get("allergies", [])
    updated_allergies = current_allergies
    for a in new_allergies:
        if a.lower() not in current_allergies.lower():
            updated_allergies = f"{updated_allergies}, {a}".strip(", ")

    current_chronic = patient.get("chronic_conditions") or ""
    new_chronic = parsed_info.get("conditions", [])
    updated_chronic = current_chronic
    for c in new_chronic:
        if c.lower() not in current_chronic.lower():
            updated_chronic = f"{updated_chronic}, {c}".strip(", ")

    if updated_allergies != current_allergies or updated_chronic != current_chronic:
        await db.patients.update_one(
            {"_id": ObjectId(patient_id)},
            {"$set": {"allergies": updated_allergies, "chronic_conditions": updated_chronic}}
        )

    doc_data = {
        "patient_id": patient_id,
        "triage_id": triage_id,
        "uploaded_by": str(current_user.get("id")) if current_user.get("id") else None,
        "doc_type": doc_type,
        "file_path": f"/uploads/{safe_filename}",
        "original_filename": file.filename,
        "ocr_text": raw_ocr_text,
        "extracted_summary": parsed_info.get("summary", ""),
        "extracted_data_json": parsed_info,
        "created_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
    }
    
    result = await db.documents.insert_one(doc_data)
    doc_id = str(result.inserted_id)

    return {
        "document_id": doc_id,
        "filename": file.filename,
        "file_url": f"/uploads/{safe_filename}",
        "ocr_text": raw_ocr_text,
        "summary": parsed_info.get("summary", ""),
        "extracted_data": parsed_info,
        "message": "Document successfully scanned, parsed by AI, and linked to patient history"
    }

@router.get("/documents/{patient_id}")
async def get_patient_documents(patient_id: str):
    db = get_db()
    cursor = db.documents.find({"patient_id": patient_id}).sort("created_at", -1)
    docs = []
    async for d in cursor:
        doc = dict(d)
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        
        uploader_id = doc.get("uploaded_by")
        if uploader_id:
            try:
                uploader = await db.users.find_one({"_id": ObjectId(uploader_id)})
                if uploader:
                    doc["uploaded_by_name"] = uploader.get("full_name")
            except Exception:
                pass
            
        if doc.get("extracted_data_json"):
            if isinstance(doc["extracted_data_json"], str):
                try:
                    doc["extracted_data"] = json.loads(doc["extracted_data_json"])
                except Exception:
                    doc["extracted_data"] = {}
            else:
                doc["extracted_data"] = doc["extracted_data_json"]
        else:
            doc["extracted_data"] = {}
            
        docs.append(doc)
        
    return {"documents": docs}
