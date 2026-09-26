from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.auth import get_current_user, get_optional_user
from bson import ObjectId

router = APIRouter(prefix="/api/triage", tags=["Triage"])

class CreateTriageRequest(BaseModel):
    patient_id: str
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    temperature: Optional[float] = None
    blood_sugar: Optional[float] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    chief_complaint: str

class UpdateQueueStatusRequest(BaseModel):
    queue_status: str

class KioskCheckinRequest(BaseModel):
    patient_id: str
    chief_complaint: Optional[str] = "Registered at Kiosk — Intake in progress"
    bp_systolic: Optional[int] = 120
    bp_diastolic: Optional[int] = 80
    heart_rate: Optional[int] = 76
    spo2: Optional[int] = 98
    temperature: Optional[float] = 98.6
    blood_sugar: Optional[float] = 100.0

def compute_urgency(bp_sys, bp_dia, hr, spo2, temp, rbs, complaint):
    """
    Computes standard clinical triage urgency: critical, urgent, or normal.
    """
    c_lower = (complaint or "").lower()
    
    if (spo2 and spo2 < 90) or (hr and (hr > 130 or hr < 45)):
        return "critical"
    if (bp_sys and bp_sys > 180) or (bp_dia and bp_dia > 120):
        return "critical"
    if any(k in c_lower for k in ["chest pain", "unconscious", "gasping", "severe bleeding", "anaphylaxis"]):
        return "critical"

    if (spo2 and spo2 < 94) or (temp and temp >= 101.5):
        return "urgent"
    if (bp_sys and bp_sys >= 140) or (bp_dia and bp_dia >= 90):
        return "urgent"
    if (hr and hr > 105):
        return "urgent"
    if (rbs and (rbs > 250 or rbs < 65)):
        return "urgent"
    if any(k in c_lower for k in ["dengue", "severe pain", "dehydration", "loose motion 5", "high fever", "breathing difficulty"]):
        return "urgent"

    return "normal"

@router.get("/queue")
async def get_queue():
    db = get_db()
    
    # Use direct query to ensure 100% compatibility with mongomock and MongoDB
    triage_records = await db.triage_records.find({}).sort("recorded_at", -1).to_list(None)
    
    rows = []
    for doc in triage_records:
        triage_id_str = str(doc["_id"])
        row = {
            "triage_id": triage_id_str,
            "recorded_at": doc.get("recorded_at"),
            "bp_systolic": doc.get("bp_systolic"),
            "bp_diastolic": doc.get("bp_diastolic"),
            "heart_rate": doc.get("heart_rate"),
            "spo2": doc.get("spo2"),
            "temperature": doc.get("temperature"),
            "blood_sugar": doc.get("blood_sugar"),
            "weight_kg": doc.get("weight_kg"),
            "bmi": doc.get("bmi"),
            "chief_complaint": doc.get("chief_complaint") or "General medical consultation",
            "triage_urgency": doc.get("triage_urgency", "normal"),
            "queue_status": doc.get("queue_status", "waiting_for_doctor")
        }
        
        patient_id = doc.get("patient_id")
        if patient_id:
            patient = None
            try:
                patient = await db.patients.find_one({"_id": ObjectId(patient_id)})
            except Exception:
                patient = await db.patients.find_one({"id": patient_id})
                
            if not patient:
                patient = await db.patients.find_one({"uhid": patient_id})
                
            if patient:
                row.update({
                    "patient_id": str(patient.get("_id")),
                    "uhid": patient.get("uhid"),
                    "patient_name": patient.get("name"),
                    "age": patient.get("age"),
                    "gender": patient.get("gender"),
                    "phone": patient.get("phone"),
                    "locality": patient.get("locality"),
                    "chronic_conditions": patient.get("chronic_conditions"),
                    "allergies": patient.get("allergies"),
                })
            else:
                row.update({
                    "patient_id": patient_id,
                    "uhid": f"UHID-{patient_id[:6]}",
                    "patient_name": "Patient",
                    "age": 30,
                    "gender": "Other"
                })
                
        nurse_id = doc.get("nurse_id")
        if nurse_id:
            try:
                nurse = await db.users.find_one({"_id": ObjectId(nurse_id)})
                if nurse:
                    row["nurse_name"] = nurse.get("full_name")
            except Exception:
                pass
                
        soap = await db.soap_notes.find_one({"triage_id": triage_id_str})
        if soap:
            row["soap_id"] = str(soap.get("_id"))
            row["doctor_reviewed"] = soap.get("doctor_reviewed")
            
        rows.append(row)

    # Sort by urgency
    def urgency_key(r):
        urgency = r.get("triage_urgency")
        if urgency == "critical": return 1
        if urgency == "urgent": return 2
        return 3
        
    rows.sort(key=urgency_key)

    waiting_for_doctor = [r for r in rows if r["queue_status"] == "waiting_for_doctor"]
    in_consultation = [r for r in rows if r["queue_status"] == "in_consultation"]
    completed = [r for r in rows if r["queue_status"] == "completed"]

    return {
        "all": rows,
        "waiting_for_doctor": waiting_for_doctor,
        "in_consultation": in_consultation,
        "completed": completed,
        "total_active": len(waiting_for_doctor) + len(in_consultation)
    }

@router.post("/kiosk-checkin")
async def kiosk_checkin(req: KioskCheckinRequest):
    """
    Called immediately when a patient completes Step 1 registration on the kiosk.
    Creates a real-time queue ticket so the patient instantly reflects on Doctor Desk.
    """
    db = get_db()
    from datetime import datetime
    import pytz
    
    # Check if this patient already has an active waiting triage ticket
    existing_triage = await db.triage_records.find_one({
        "patient_id": req.patient_id,
        "queue_status": "waiting_for_doctor"
    }, sort=[("recorded_at", -1)])
    
    if existing_triage:
        return {
            "triage_id": str(existing_triage["_id"]),
            "patient_id": req.patient_id,
            "status": "waiting_for_doctor",
            "message": "Existing active queue ticket retrieved"
        }
    
    triage_data = {
        "patient_id": req.patient_id,
        "nurse_id": None,
        "bp_systolic": req.bp_systolic or 120,
        "bp_diastolic": req.bp_diastolic or 80,
        "heart_rate": req.heart_rate or 76,
        "spo2": req.spo2 or 98,
        "temperature": req.temperature or 98.6,
        "blood_sugar": req.blood_sugar or 100.0,
        "weight_kg": None,
        "height_cm": None,
        "bmi": None,
        "chief_complaint": req.chief_complaint or "Registered at Kiosk — Intake in progress",
        "triage_urgency": "normal",
        "queue_status": "waiting_for_doctor",
        "recorded_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
    }
    
    result = await db.triage_records.insert_one(triage_data)
    triage_id = str(result.inserted_id)
    
    # Also initialize baseline SOAP note so doctor desk can open immediately
    patient = None
    try:
        patient = await db.patients.find_one({"_id": ObjectId(req.patient_id)})
    except Exception:
        patient = await db.patients.find_one({"id": req.patient_id})
        
    p_name = patient.get("name", "Patient") if patient else "Patient"
    allergies = patient.get("allergies", "None reported") if patient else "None reported"
    chronic = patient.get("chronic_conditions", "None reported") if patient else "None reported"
    
    soap_insert = {
        "triage_id": triage_id,
        "patient_id": req.patient_id,
        "subjective": f"Patient {p_name} registered via kiosk intake. Chief complaint: {req.chief_complaint}. Documented allergies: {allergies}. Comorbidities: {chronic}.",
        "objective": f"Baseline vitals: BP {triage_data['bp_systolic']}/{triage_data['bp_diastolic']} mmHg, HR {triage_data['heart_rate']} bpm, SpO2 {triage_data['spo2']}%, Temp {triage_data['temperature']}°F.",
        "assessment": f"Initial clinical evaluation in progress for {p_name}.",
        "plan": "Complete clinical interview, review past medical documents/prescriptions, and finalize physician assessment.",
        "red_flags": "",
        "differential_diagnosis": "",
        "ai_generated": 1,
        "doctor_reviewed": 0,
        "created_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat(),
        "updated_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
    }
    await db.soap_notes.insert_one(soap_insert)
    
    return {
        "triage_id": triage_id,
        "patient_id": req.patient_id,
        "status": "waiting_for_doctor",
        "message": "Patient successfully queued in Doctor Desk"
    }

@router.post("")
async def record_triage(req: CreateTriageRequest, current_user: Optional[dict] = Depends(get_optional_user)):
    db = get_db()
    
    bmi = None
    if req.weight_kg and req.height_cm and req.height_cm > 0:
        height_m = req.height_cm / 100.0
        bmi = round(req.weight_kg / (height_m * height_m), 1)

    urgency = compute_urgency(
        req.bp_systolic, req.bp_diastolic, req.heart_rate,
        req.spo2, req.temperature, req.blood_sugar, req.chief_complaint
    )

    nurse_id = str(current_user.get("id")) if current_user.get("id") else None

    from datetime import datetime
    import pytz
    
    triage_data = {
        "patient_id": req.patient_id,
        "nurse_id": nurse_id,
        "bp_systolic": req.bp_systolic,
        "bp_diastolic": req.bp_diastolic,
        "heart_rate": req.heart_rate,
        "spo2": req.spo2,
        "temperature": req.temperature,
        "blood_sugar": req.blood_sugar,
        "weight_kg": req.weight_kg,
        "height_cm": req.height_cm,
        "bmi": bmi,
        "chief_complaint": req.chief_complaint,
        "triage_urgency": urgency,
        "queue_status": "waiting_for_doctor",
        "recorded_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
    }
    
    result = await db.triage_records.insert_one(triage_data)
    triage_id = str(result.inserted_id)

    patient = await db.patients.find_one({"_id": ObjectId(req.patient_id)})
    if patient:
        patient["id"] = str(patient["_id"])
        from backend.ai_engine import generate_soap_note
        vitals_dict = req.dict()
        vitals_dict["bmi"] = bmi
        soap_data = generate_soap_note(patient, vitals_dict)

        soap_insert = {
            "triage_id": triage_id,
            "patient_id": req.patient_id,
            "subjective": soap_data["subjective"],
            "objective": soap_data["objective"],
            "assessment": soap_data["assessment"],
            "plan": soap_data["plan"],
            "red_flags": soap_data["red_flags"],
            "differential_diagnosis": soap_data["differential_diagnosis"],
            "ai_generated": 1,
            "doctor_reviewed": 0,
            "created_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat(),
            "updated_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
        }
        await db.soap_notes.insert_one(soap_insert)

    triage = await db.triage_records.find_one({"_id": ObjectId(triage_id)})
    if triage:
        triage["id"] = str(triage["_id"])
        del triage["_id"]
    
    return {
        "triage": triage,
        "urgency": urgency,
        "message": "Triage vitals recorded and patient queued for doctor consultation"
    }

@router.patch("/{triage_id}/status")
async def update_status(triage_id: str, req: UpdateQueueStatusRequest, current_user: Optional[dict] = Depends(get_optional_user)):
    valid_statuses = ["waiting_for_doctor", "in_consultation", "completed"]
    if req.queue_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    db = get_db()
    await db.triage_records.update_one({"_id": ObjectId(triage_id)}, {"$set": {"queue_status": req.queue_status}})
    return {"message": f"Queue status updated to {req.queue_status}"}

@router.get("/{triage_id}")
async def get_triage(triage_id: str):
    db = get_db()
    triage = await db.triage_records.find_one({"_id": ObjectId(triage_id)})
    if not triage:
        raise HTTPException(status_code=404, detail="Triage record not found")
        
    triage["id"] = str(triage["_id"])
    del triage["_id"]
    
    patient = await db.patients.find_one({"_id": ObjectId(triage.get("patient_id"))})
    if patient:
        triage["patient_name"] = patient.get("name")
        triage["uhid"] = patient.get("uhid")
        triage["age"] = patient.get("age")
        triage["gender"] = patient.get("gender")
        triage["locality"] = patient.get("locality")
        triage["chronic_conditions"] = patient.get("chronic_conditions")
        triage["allergies"] = patient.get("allergies")
        
    return {"triage": triage}
