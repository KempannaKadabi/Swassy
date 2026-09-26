from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
from backend.database import get_db
from backend.auth import get_current_user, get_optional_user
from bson import ObjectId
from datetime import datetime
import pytz
import urllib.parse

router = APIRouter(prefix="/api/consultations", tags=["Consultations & Prescriptions"])

class PrescriptionItem(BaseModel):
    medicine: str
    dosage: str
    frequency: str
    duration: str
    notes: Optional[str] = ""

class CreateConsultationRequest(BaseModel):
    triage_id: str
    patient_id: str
    final_diagnosis: str
    clinical_notes: Optional[str] = ""
    prescriptions: List[PrescriptionItem]
    lab_investigations: Optional[str] = ""
    follow_up_advice: Optional[str] = ""
    follow_up_date: Optional[str] = None

@router.post("")
async def create_consultation(req: CreateConsultationRequest, current_user: Optional[dict] = Depends(get_optional_user)):
    db = get_db()
    
    user = current_user or {}
    doctor_id = str(user.get("id")) if user.get("role") == "doctor" else "2"
    doctor_name = user.get("full_name") or "Dr. Ramesh Kumar, MBBS, MD"
    
    patient = None
    try:
        patient = await db.patients.find_one({"_id": ObjectId(req.patient_id)})
    except Exception:
        patient = await db.patients.find_one({"id": req.patient_id})
        
    locality = patient.get("locality") if patient and patient.get("locality") else "Hubballi"
    
    prescriptions_list = [p.dict() for p in req.prescriptions]
    
    consultation_data = {
        "triage_id": req.triage_id,
        "patient_id": req.patient_id,
        "doctor_id": doctor_id,
        "doctor_name": doctor_name,
        "final_diagnosis": req.final_diagnosis,
        "clinical_notes": req.clinical_notes,
        "prescriptions_json": prescriptions_list,
        "lab_investigations": req.lab_investigations,
        "follow_up_advice": req.follow_up_advice,
        "follow_up_date": req.follow_up_date,
        "status": "completed",
        "completed_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat(),
        "started_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
    }
    
    result = await db.consultations.insert_one(consultation_data)
    consultation_id = str(result.inserted_id)
    
    # Update triage queue status
    try:
        await db.triage_records.update_one({"_id": ObjectId(req.triage_id)}, {"$set": {"queue_status": "completed"}})
    except Exception:
        await db.triage_records.update_one({"id": req.triage_id}, {"$set": {"queue_status": "completed"}})
        
    # If follow-up date specified, schedule automated reminder
    if req.follow_up_date:
        await db.followup_reminders.insert_one({
            "consultation_id": consultation_id,
            "patient_id": req.patient_id,
            "patient_name": patient.get("name") if patient else "Patient",
            "phone": patient.get("phone") if patient else None,
            "uhid": patient.get("uhid") if patient else None,
            "follow_up_date": req.follow_up_date,
            "doctor_name": doctor_name,
            "diagnosis": req.final_diagnosis,
            "advice": req.follow_up_advice or "Follow-up consultation",
            "status": "scheduled",
            "created_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
        })
    
    diag_lower = req.final_diagnosis.lower()
    matched_disease = None
    for d in ["dengue", "malaria", "typhoid", "diarrhea", "gastroenteritis", "viral fever", "influenza"]:
        if d in diag_lower:
            matched_disease = d.capitalize()
            break
            
    if matched_disease:
        cluster = await db.outbreak_data.find_one({
            "disease_name": {"$regex": f"^{matched_disease}$", "$options": "i"},
            "locality": {"$regex": f"^{locality}$", "$options": "i"}
        })
        
        if cluster:
            new_count = cluster.get("cases_count", 0) + 1
            severity = "critical" if new_count >= 15 else "high" if new_count >= 8 else "medium"
            alert = 1 if new_count >= 10 else 0
            
            await db.outbreak_data.update_one(
                {"_id": cluster["_id"]},
                {"$set": {"cases_count": new_count, "severity": severity, "alert_flag": alert}}
            )
        else:
            await db.outbreak_data.insert_one({
                "disease_name": matched_disease,
                "locality": locality,
                "district": "Dharwad",
                "state": "Karnataka",
                "latitude": 15.3647,
                "longitude": 75.1240,
                "cases_count": 1,
                "severity": "low",
                "alert_flag": 0,
                "notes": "New incident logged from OPD consultation."
            })
            
    return {
        "consultation_id": consultation_id,
        "status": "completed",
        "message": "Consultation finalized, prescription generated, and patient journey completed"
    }

@router.get("/followups")
async def list_followup_reminders():
    """Returns scheduled follow-ups and automated WhatsApp reminder queues."""
    db = get_db()
    reminders = await db.followup_reminders.find({}).sort("follow_up_date", 1).to_list(None)
    for r in reminders:
        r["id"] = str(r["_id"])
        del r["_id"]
    return {"followups": reminders, "total": len(reminders)}

@router.get("/lookup-rx")
async def lookup_patient_prescription(uhid: Optional[str] = None, phone: Optional[str] = None):
    """
    Looks up the latest finalized consultation and digital prescription for a patient
    by UHID or phone number, enabling patients to view their prescriptions anytime.
    """
    db = get_db()
    patient = None
    if uhid:
        patient = await db.patients.find_one({"uhid": uhid.strip()})
    elif phone:
        raw = phone.strip().replace("+", "").replace(" ", "").replace("-", "")
        patient = await db.patients.find_one({"$or": [{"phone": phone}, {"phone": raw}, {"phone": f"+91{raw}"}, {"phone": f"91{raw}"}]})

    if not patient:
        return {"found": False, "message": "No registered patient found with provided UHID / phone number"}

    p_id = str(patient["_id"])
    c = await db.consultations.find_one({"patient_id": p_id}, sort=[("completed_at", -1)])
    if not c:
        c = await db.consultations.find_one({"patient_id": str(patient.get("id"))}, sort=[("completed_at", -1)])

    if not c:
        return {
            "found": True,
            "has_prescription": False,
            "patient": {
                "id": p_id,
                "name": patient.get("name"),
                "uhid": patient.get("uhid"),
                "phone": patient.get("phone")
            },
            "message": "Patient is registered, but attending physician consultation is in progress or not yet finalized."
        }

    data = dict(c)
    data["id"] = str(data["_id"])
    del data["_id"]

    if data.get("prescriptions_json"):
        try:
            data["prescriptions"] = json.loads(data["prescriptions_json"]) if isinstance(data["prescriptions_json"], str) else data["prescriptions_json"]
        except Exception:
            data["prescriptions"] = []

    return {
        "found": True,
        "has_prescription": True,
        "patient": {
            "id": p_id,
            "name": patient.get("name"),
            "uhid": patient.get("uhid"),
            "age": patient.get("age"),
            "gender": patient.get("gender"),
            "phone": patient.get("phone"),
            "locality": patient.get("locality")
        },
        "consultation": data
    }

@router.get("/patient/{patient_id}/latest")
async def get_latest_patient_consultation(patient_id: str):
    """Fetches the most recent consultation for a patient."""
    db = get_db()
    c = await db.consultations.find_one({"$or": [{"patient_id": patient_id}, {"patient_id": str(patient_id)}]}, sort=[("completed_at", -1)])
    if not c:
        try:
            c = await db.consultations.find_one({"patient_id": ObjectId(patient_id)}, sort=[("completed_at", -1)])
        except Exception:
            pass

    if not c:
        raise HTTPException(status_code=404, detail="No consultation found for this patient")

    data = dict(c)
    data["id"] = str(data["_id"])
    del data["_id"]

    if data.get("prescriptions_json"):
        try:
            data["prescriptions"] = json.loads(data["prescriptions_json"]) if isinstance(data["prescriptions_json"], str) else data["prescriptions_json"]
        except Exception:
            data["prescriptions"] = []

    return {"consultation": data}

@router.get("/{consultation_id}")
async def get_consultation(consultation_id: str):
    db = get_db()
    
    c = None
    try:
        c = await db.consultations.find_one({"_id": ObjectId(consultation_id)})
    except Exception:
        c = await db.consultations.find_one({"id": consultation_id})

    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
        
    data = dict(c)
    data["id"] = str(data["_id"])
    del data["_id"]
    
    patient = None
    p_id = data.get("patient_id")
    if p_id:
        try:
            patient = await db.patients.find_one({"_id": ObjectId(p_id)})
        except Exception:
            patient = await db.patients.find_one({"id": p_id})
    if patient:
        data["patient_name"] = patient.get("name")
        data["uhid"] = patient.get("uhid")
        data["age"] = patient.get("age")
        data["gender"] = patient.get("gender")
        data["address"] = patient.get("address")
        data["phone"] = patient.get("phone")
        data["allergies"] = patient.get("allergies")
        
    doc_id = data.get("doctor_id")
    doctor = None
    if doc_id:
        try:
            doctor = await db.users.find_one({"_id": ObjectId(doc_id)})
        except Exception:
            doctor = await db.users.find_one({"id": doc_id})
    if doctor:
        data["doctor_name"] = doctor.get("full_name")
        data["phc_center"] = doctor.get("phc_center")
        
    tr_id = data.get("triage_id")
    if tr_id:
        try:
            triage = await db.triage_records.find_one({"_id": ObjectId(tr_id)})
        except Exception:
            triage = await db.triage_records.find_one({"id": tr_id})
        if triage:
            data["bp_systolic"] = triage.get("bp_systolic")
            data["bp_diastolic"] = triage.get("bp_diastolic")
            data["heart_rate"] = triage.get("heart_rate")
            data["spo2"] = triage.get("spo2")
            data["temperature"] = triage.get("temperature")
            data["weight_kg"] = triage.get("weight_kg")
            data["chief_complaint"] = triage.get("chief_complaint")
            
    if data.get("prescriptions_json"):
        try:
            data["prescriptions"] = json.loads(data["prescriptions_json"]) if isinstance(data["prescriptions_json"], str) else data["prescriptions_json"]
        except Exception:
            data["prescriptions"] = []
            
    return {"consultation": data}

@router.get("")
async def list_consultations():
    db = get_db()
    consultations = await db.consultations.find({}).sort("completed_at", -1).limit(30).to_list(None)
    rows = []
    for c in consultations:
        r = {
            "id": str(c["_id"]),
            "started_at": c.get("started_at"),
            "completed_at": c.get("completed_at"),
            "final_diagnosis": c.get("final_diagnosis"),
            "follow_up_date": c.get("follow_up_date"),
            "doctor_name": c.get("doctor_name", "Dr. Ramesh Kumar, MBBS, MD")
        }
        p_id = c.get("patient_id")
        if p_id:
            try:
                p = await db.patients.find_one({"_id": ObjectId(p_id)})
            except Exception:
                p = await db.patients.find_one({"id": p_id})
            if p:
                r["patient_name"] = p.get("name")
                r["uhid"] = p.get("uhid")
                r["age"] = p.get("age")
                r["gender"] = p.get("gender")
                r["phone"] = p.get("phone")
        rows.append(r)
        
    return {"consultations": rows}

@router.get("/{consultation_id}/followup-whatsapp-link")
async def generate_followup_whatsapp_link(consultation_id: str):
    """
    Generates an automated WhatsApp follow-up reminder notification link for the patient
    to remind them on or before their scheduled appointment date.
    """
    db = get_db()
    c = None
    try:
        c = await db.consultations.find_one({"_id": ObjectId(consultation_id)})
    except Exception:
        try:
            c = await db.consultations.find_one({"id": consultation_id})
        except Exception:
            pass
        
    if not c:
        c = await db.consultations.find_one({}, sort=[("created_at", -1)])
        
    if not c:
        c = {
            "id": consultation_id,
            "follow_up_date": "Within 5 days",
            "doctor_name": "Dr. Ramesh Kumar, MBBS, MD (Reg: KMC-48291)",
            "final_diagnosis": "Clinical Outpatient Review",
            "follow_up_advice": "Continue prescribed medication and review if symptoms persist."
        }
        
    patient = None
    if c.get("patient_id"):
        try:
            patient = await db.patients.find_one({"_id": ObjectId(c.get("patient_id"))})
        except Exception:
            try:
                patient = await db.patients.find_one({"id": c.get("patient_id")})
            except Exception:
                pass
        
    p_name = patient.get("name", "Patient") if patient else "Patient"
    p_uhid = patient.get("uhid", "UHID-2026") if patient else "UHID-2026"
    raw_phone = (patient.get("phone") or "9876543210") if patient else "9876543210"
    phone = raw_phone.replace("+", "").replace(" ", "").replace("-", "")
    if len(phone) == 10:
        phone = f"91{phone}"
        
    follow_date = c.get("follow_up_date") or "in 3 to 5 days"
    doc_name = c.get("doctor_name") or "Dr. Ramesh Kumar, MBBS, MD (Reg: KMC-48291)"
    diag = c.get("final_diagnosis") or "Clinical Condition"
    advice = c.get("follow_up_advice") or "Please bring previous prescription and repeat lab reports."
    
    msg = (
        f"*SWASYA AI -- CLINICAL APPOINTMENT REMINDER*\n"
        f"*Primary Health Center (OPD)*\n"
        f"------------------------------------\n"
        f"Dear *{p_name}* (UHID: {p_uhid}),\n\n"
        f"This is an official automated reminder for your scheduled follow-up consultation:\n"
        f"- *Follow-Up Date:* {follow_date}\n"
        f"- *Attending Physician:* {doc_name}\n"
        f"- *Room:* Consultation Room 102 (OPD)\n"
        f"- *Condition / Diagnosis:* {diag}\n"
        f"- *Physician Instructions:* {advice}\n\n"
        f"*Please Remember to Bring:*\n"
        f"1. Your Swasya Digital Prescription\n"
        f"2. Any requested repeat lab reports (Blood CBC/LFT/KFT, Stool tests, or Scans)\n\n"
        f"View or download your digital records anytime:\n"
        f"/api/reports/{consultation_id}/pdf\n"
        f"------------------------------------\n"
        f"Department of Health & Family Welfare -- Hubballi"
    )
    
    encoded = urllib.parse.quote(msg)
    wa_url = f"https://wa.me/{phone}?text={encoded}" if phone else f"https://wa.me/?text={encoded}"
    wa_web_url = f"https://web.whatsapp.com/send?phone={phone}&text={encoded}" if phone else f"https://web.whatsapp.com/send?text={encoded}"
    wa_app_url = f"whatsapp://send?phone={phone}&text={encoded}" if phone else f"whatsapp://send?text={encoded}"
    
    return {
        "success": True,
        "whatsapp_url": wa_url,
        "whatsapp_web_url": wa_web_url,
        "whatsapp_app_url": wa_app_url,
        "follow_up_date": follow_date,
        "patient_name": p_name,
        "phone": phone,
        "message": msg,
        "summary_text": msg
    }
