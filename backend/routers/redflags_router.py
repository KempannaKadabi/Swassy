from fastapi import APIRouter, HTTPException
from backend.database import get_db
from bson import ObjectId

router = APIRouter(prefix="/api/red-flags", tags=["Deterministic Red-Flag Engine"])

MANDATORY_PHRASE = "Potential clinical red flag — requires clinician review."

def evaluate_red_flags(patient: dict, triage: dict, voice_transcript: str = "") -> list:
    flags = []
    complaint = (triage.get("chief_complaint") or "").lower()
    transcript = (voice_transcript or "").lower()
    allergies = (patient.get("allergies") or "").lower()
    combined = f"{complaint} {transcript}".lower()

    if any(k in combined for k in ["chest pain", "chest pressure", "chest tightness", "left arm", "सीने में दर्द", "छाती में दर्द", "ಎದೆ ನೋವು"]):
        if any(k in combined for k in ["sweat", "breathless", "shortness of breath", "vomit", "jaw"]):
            flags.append({
                "rule_id": "RF-CARD-001",
                "severity": "CRITICAL",
                "flag": "Acute Retrosternal Chest Pain with Autonomic / Dyspneic Signs",
                "reason": "Reported chest pressure radiating or accompanied by cold sweating/dyspnea may signify acute coronary syndrome or pulmonary embolism.",
                "recommendation": f"{MANDATORY_PHRASE} Immediate 12-lead ECG evaluation and emergency physician examination required."
            })

    if any(k in combined for k in ["facial droop", "weakness on one side", "slurred speech", "लकवा", "bolne me dikkat", "ಮೂಗು ಬಾಯಿ ವಕ್ರ"]):
        flags.append({
            "rule_id": "RF-NEURO-002",
            "severity": "CRITICAL",
            "flag": "Sudden Onset Focal Neurological Deficit (FAST Stroke Criteria)",
            "reason": "Sudden unilateral motor weakness, facial asymmetry, or speech disturbance suggests acute cerebrovascular event.",
            "recommendation": f"{MANDATORY_PHRASE} Urgent neurological examination within thrombolysis window."
        })

    spo2 = triage.get("spo2")
    if (spo2 and spo2 < 92) or any(k in combined for k in ["gasping", "blue lips", "cyanosis", "unable to complete sentence"]):
        flags.append({
            "rule_id": "RF-RESP-003",
            "severity": "CRITICAL",
            "flag": "Severe Respiratory Distress / Critical Hypoxemia",
            "reason": f"SpO2 {spo2 or '<92'}% with marked respiratory distress indicates severe ventilatory compromise.",
            "recommendation": f"{MANDATORY_PHRASE} Immediate high-flow oxygenation, airway evaluation, and nebulization."
        })

    if any(k in combined for k in ["fever", "bukhar", "बुखार", "ಜ್ವರ"]):
        if any(k in combined for k in ["bleeding gums", "blood in vomit", "petechiae", "red spots on skin", "black stool", "मसूड़ों से खून"]):
            flags.append({
                "rule_id": "RF-HEM-005",
                "severity": "HIGH",
                "flag": "Febrile Illness with Hemorrhagic Manifestations / Dengue Warning Signs",
                "reason": "Presence of spontaneous mucosal bleeding or petechiae during acute fever suggests severe thrombocytopenia or dengue hemorrhagic fever.",
                "recommendation": f"{MANDATORY_PHRASE} Urgent platelet count, hematocrit monitoring, and intravenous fluid protocol."
            })

    if allergies and "none" not in allergies and "no known" not in allergies:
        flags.append({
            "rule_id": "RF-ALLERGY-006",
            "severity": "HIGH",
            "flag": f"Documented Drug Allergy: {patient.get('allergies')}",
            "reason": f"Patient has confirmed clinical hypersensitivity to {patient.get('allergies')}. Contraindicated drugs must be avoided in prescription.",
            "recommendation": f"{MANDATORY_PHRASE} Cross-check all prescribed medications against allergy chart."
        })

    return flags

@router.get("/cases/{triage_id}")
async def get_case_red_flags(triage_id: str):
    db = get_db()
    
    triage = await db.triage_records.find_one({"_id": ObjectId(triage_id)})
    if not triage:
        raise HTTPException(status_code=404, detail="Triage case not found")
        
    patient = await db.patients.find_one({"_id": ObjectId(triage["patient_id"])}) or {}
    
    triage["patient_name"] = patient.get("name")
    triage["allergies"] = patient.get("allergies")
    triage["chronic_conditions"] = patient.get("chronic_conditions")

    voice = await db.voice_sessions.find_one({"triage_id": triage_id}, sort=[("_id", -1)])
    transcript = voice.get("raw_transcript", "") if voice else ""

    flags = evaluate_red_flags(patient, triage, transcript)
    return {
        "success": True,
        "triageId": triage_id,
        "redFlags": flags,
        "criticalCount": sum(1 for f in flags if f["severity"] == "CRITICAL"),
        "totalCount": len(flags),
        "disclaimer": "Safety-critical red flags evaluated deterministically by rule engine. Requires clinician review."
    }
