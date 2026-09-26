from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import random
from backend.database import get_db, get_next_sequence
from backend.auth import get_current_user, get_optional_user
from bson import ObjectId

router = APIRouter(prefix="/api/patients", tags=["Patients"])

class CreatePatientRequest(BaseModel):
    name: str
    age: int
    gender: str
    phone: Optional[str] = None
    address: Optional[str] = None
    locality: Optional[str] = "Hubballi"
    blood_group: Optional[str] = "Unknown"
    chronic_conditions: Optional[str] = ""
    allergies: Optional[str] = ""

@router.get("/lookup")
async def lookup_patient(phone: Optional[str] = Query(None), uhid: Optional[str] = Query(None), query: Optional[str] = Query(None)):
    db = get_db()
    
    patient = None
    if uhid:
        patient = await db.patients.find_one({"uhid": uhid.strip()})
    elif phone:
        patient = await db.patients.find_one({"phone": phone.strip()}, sort=[("_id", -1)])
    elif query:
        q = {"$regex": query.strip(), "$options": "i"}
        patient = await db.patients.find_one({"$or": [{"phone": q}, {"uhid": q}, {"name": q}]}, sort=[("_id", -1)])

    if not patient:
        return {"found": False, "message": "No previous patient record found. Register as new patient."}

    p = dict(patient)
    p["id"] = str(p["_id"])
    del p["_id"]
    patient_id = p["id"]

    # 1. Fetch all previous triage records
    triages_cursor = db.triage_records.aggregate([
        {"$match": {"patient_id": patient_id}},
        {"$sort": {"recorded_at": -1}},
        {"$lookup": {
            "from": "users",
            "localField": "nurse_id",
            "foreignField": "_id",
            "as": "nurse"
        }}
    ])
    triages = []
    async for t in triages_cursor:
        t["id"] = str(t["_id"])
        if t.get("nurse") and len(t["nurse"]) > 0:
            t["nurse_name"] = t["nurse"][0].get("full_name")
        triages.append(t)

    # 2. Fetch all previous doctor consultations & prescriptions
    consultations_cursor = db.consultations.aggregate([
        {"$match": {"patient_id": patient_id}},
        {"$sort": {"completed_at": -1}},
        {"$lookup": {
            "from": "users",
            "localField": "doctor_id",
            "foreignField": "_id",
            "as": "doctor"
        }}
    ])
    consultations = []
    past_medications = []
    past_diagnoses = []

    async for c in consultations_cursor:
        c_dict = dict(c)
        c_dict["id"] = str(c_dict["_id"])
        if c_dict.get("doctor") and len(c_dict["doctor"]) > 0:
            c_dict["doctor_name"] = c_dict["doctor"][0].get("full_name")
        
        if c_dict.get("final_diagnosis"):
            past_diagnoses.append(c_dict["final_diagnosis"])
        if c_dict.get("prescriptions_json"):
            try:
                rx_list = json.loads(c_dict["prescriptions_json"]) if isinstance(c_dict["prescriptions_json"], str) else c_dict["prescriptions_json"]
                c_dict["prescriptions"] = rx_list
                for rx in rx_list:
                    med_name = rx.get("medicine") or rx.get("name")
                    if med_name and med_name not in past_medications:
                        past_medications.append(med_name)
            except Exception:
                c_dict["prescriptions"] = []
        consultations.append(c_dict)

    # 3. Fetch past uploaded documents & OCR text
    documents_cursor = db.documents.find({"patient_id": patient_id}).sort("created_at", -1)
    documents = []
    async for d in documents_cursor:
        d["id"] = str(d["_id"])
        documents.append(d)

    return {
        "found": True,
        "patient": p,
        "visits_count": len(triages),
        "previous_diagnoses": past_diagnoses,
        "previous_medications": past_medications,
        "chronic_conditions": p.get("chronic_conditions") or "",
        "allergies": p.get("allergies") or "None reported",
        "recent_visits": [
            {
                "triage_id": str(t["_id"]),
                "date": t.get("recorded_at"),
                "chief_complaint": t.get("chief_complaint"),
                "bp": f"{t.get('bp_systolic')}/{t.get('bp_diastolic')}" if t.get('bp_systolic') else "N/A",
                "pulse": t.get("heart_rate"),
                "temp": t.get("temperature"),
                "spo2": t.get("spo2"),
                "sugar": t.get("blood_sugar")
            }
            for t in triages[:5]
        ],
        "documents": [
            {
                "id": str(d["_id"]),
                "filename": d.get("original_filename"),
                "doc_type": d.get("doc_type"),
                "date": d.get("created_at")
            }
            for d in documents
        ]
    }

@router.get("")
async def list_patients(query: Optional[str] = Query(None)):
    db = get_db()
    if query:
        q = {"$regex": query, "$options": "i"}
        cursor = db.patients.find({"$or": [{"name": q}, {"uhid": q}, {"phone": q}, {"locality": q}]}).sort("_id", -1)
    else:
        cursor = db.patients.find({}).sort("_id", -1)
    
    patients = []
    async for row in cursor:
        p = dict(row)
        p["id"] = str(p["_id"])
        del p["_id"]
        patients.append(p)
    return {"patients": patients}

@router.post("")
async def create_patient(req: CreatePatientRequest, current_user: Optional[dict] = Depends(get_optional_user)):
    db = get_db()
    
    if req.phone and len(req.phone.strip()) >= 10:
        existing = await db.patients.find_one({"phone": req.phone.strip()})
        if existing:
            await db.patients.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "age": req.age, 
                    "gender": req.gender, 
                    "locality": req.locality or "Hubballi", 
                    "chronic_conditions": req.chronic_conditions or "", 
                    "allergies": req.allergies or ""
                }}
            )
            updated = await db.patients.find_one({"_id": existing["_id"]})
            updated["id"] = str(updated["_id"])
            del updated["_id"]
            return {"patient": updated, "message": "Existing patient profile updated", "is_returning": True}

    while True:
        rand_num = random.randint(1010, 9999)
        candidate_uhid = f"UHID-2026-{rand_num}"
        if not await db.patients.find_one({"uhid": candidate_uhid}):
            break

    result = await db.patients.insert_one({
        "uhid": candidate_uhid,
        "name": req.name.strip(),
        "age": req.age,
        "gender": req.gender,
        "phone": req.phone.strip() if req.phone else None,
        "address": req.address,
        "locality": req.locality or "Hubballi",
        "blood_group": req.blood_group,
        "chronic_conditions": req.chronic_conditions,
        "allergies": req.allergies
    })
    
    patient = await db.patients.find_one({"_id": result.inserted_id})
    patient["id"] = str(patient["_id"])
    del patient["_id"]
    return {"patient": patient, "message": "Patient successfully registered", "is_returning": False}

@router.get("/{patient_id}")
async def get_patient(patient_id: str):
    db = get_db()
    try:
        patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    except Exception:
        patient = await db.patients.find_one({"id": patient_id})
        
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient["id"] = str(patient["_id"])
    del patient["_id"]
    return {"patient": patient}

@router.get("/{patient_id}/timeline")
async def get_patient_timeline(patient_id: str):
    db = get_db()
    
    try:
        patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
    except Exception:
        patient = await db.patients.find_one({"id": patient_id})

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    patient["id"] = str(patient["_id"])
    del patient["_id"]

    triages_cursor = db.triage_records.aggregate([
        {"$match": {"patient_id": patient_id}},
        {"$sort": {"recorded_at": -1}},
        {"$lookup": {
            "from": "users",
            "localField": "nurse_id",
            "foreignField": "_id",
            "as": "nurse"
        }}
    ])
    triages = []
    async for t in triages_cursor:
        t["id"] = str(t["_id"])
        if t.get("nurse") and len(t["nurse"]) > 0:
            t["nurse_name"] = t["nurse"][0].get("full_name")
        triages.append(t)

    consultations_cursor = db.consultations.aggregate([
        {"$match": {"patient_id": patient_id}},
        {"$sort": {"completed_at": -1}},
        {"$lookup": {
            "from": "users",
            "localField": "doctor_id",
            "foreignField": "_id",
            "as": "doctor"
        }}
    ])
    consultations = []
    async for c in consultations_cursor:
        c_dict = dict(c)
        c_dict["id"] = str(c_dict["_id"])
        if c_dict.get("doctor") and len(c_dict["doctor"]) > 0:
            c_dict["doctor_name"] = c_dict["doctor"][0].get("full_name")
        if c_dict.get("prescriptions_json"):
            try:
                c_dict["prescriptions"] = json.loads(c_dict["prescriptions_json"]) if isinstance(c_dict["prescriptions_json"], str) else c_dict["prescriptions_json"]
            except Exception:
                c_dict["prescriptions"] = []
        consultations.append(c_dict)

    documents_cursor = db.documents.aggregate([
        {"$match": {"patient_id": patient_id}},
        {"$sort": {"created_at": -1}},
        {"$lookup": {
            "from": "users",
            "localField": "uploaded_by",
            "foreignField": "_id",
            "as": "uploader"
        }}
    ])
    documents = []
    async for d in documents_cursor:
        d_dict = dict(d)
        d_dict["id"] = str(d_dict["_id"])
        if d_dict.get("uploader") and len(d_dict["uploader"]) > 0:
            d_dict["uploaded_by_name"] = d_dict["uploader"][0].get("full_name")
        if d_dict.get("extracted_data_json"):
            try:
                d_dict["extracted_data"] = json.loads(d_dict["extracted_data_json"]) if isinstance(d_dict["extracted_data_json"], str) else d_dict["extracted_data_json"]
            except Exception:
                d_dict["extracted_data"] = {}
        documents.append(d_dict)

    return {
        "patient": patient,
        "timeline": {
            "triages": triages,
            "consultations": consultations,
            "documents": documents
        }
    }
