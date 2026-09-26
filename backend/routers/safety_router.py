from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/api/safety", tags=["Clinical Drug Safety Radar"])

class SafetyCheckRequest(BaseModel):
    medications: List[str]
    patient_allergies: Optional[str] = ""

DRUG_INTERACTIONS = [
    {
        "drugs": ["aspirin", "ibuprofen"],
        "severity": "CRITICAL",
        "warning": "Adverse Interaction: Concurrent use of Aspirin and Ibuprofen antagonizes antiplatelet cardioprotection and significantly increases gastrointestinal bleeding risk."
    },
    {
        "drugs": ["clopidogrel", "omeprazole"],
        "severity": "MODERATE",
        "warning": "Pharmacokinetic Interaction: Omeprazole inhibits CYP2C19, significantly reducing active antiplatelet levels of Clopidogrel. Consider Pantoprazole as safer alternative."
    },
    {
        "drugs": ["telmisartan", "spironolactone"],
        "severity": "HIGH",
        "warning": "Electrolyte Risk: Concomitant use of Angiotensin Receptor Blockers (ARBs) with potassium-sparing diuretics increases severe hyperkalemia risk."
    },
    {
        "drugs": ["metformin", "contrast"],
        "severity": "HIGH",
        "warning": "Nephrotoxic Risk: Withhold Metformin 48 hours before and after radiocontrast administration to prevent contrast-induced nephropathy and lactic acidosis."
    },
    {
        "drugs": ["paracetamol", "alcohol"],
        "severity": "MODERATE",
        "warning": "Hepatotoxicity Alert: Increased risk of liver injury with chronic alcohol intake."
    }
]

ALLERGY_CONTRAINDICATIONS = {
    "penicillin": ["amoxicillin", "ampicillin", "augmentin", "penicillin", "piperacillin", "co-amoxiclav", "amox"],
    "sulfa": ["bactrim", "septran", "sulfamethoxazole", "cotrimoxazole", "sulfadiazine"],
    "aspirin": ["aspirin", "ibuprofen", "diclofenac", "naproxen", "aceclofenac"]
}

@router.post("/check-prescription")
async def check_prescription_safety(req: SafetyCheckRequest):
    """
    Real-time safety radar checking drug-drug adverse interactions 
    and patient drug-allergy contraindications.
    """
    alerts = []
    meds_clean = [m.lower().strip() for m in req.medications if m.strip()]
    allergies_text = (req.patient_allergies or "").lower().strip()

    # 1. Allergy contraindication checking
    if allergies_text and "none" not in allergies_text and "no known" not in allergies_text:
        for allergy_name, trigger_drugs in ALLERGY_CONTRAINDICATIONS.items():
            if allergy_name in allergies_text:
                for med in meds_clean:
                    if any(t in med for t in trigger_drugs):
                        alerts.append({
                            "type": "ALLERGY_CONTRAINDICATION",
                            "severity": "CRITICAL",
                            "badge_class": "badge-critical",
                            "title": f"🚨 Critical Allergy Contraindication: {allergy_name.upper()}",
                            "message": f"Patient has documented {allergy_name.upper()} allergy. Prescribing '{med.title()}' can trigger acute anaphylactic shock!"
                        })

    # 2. Drug-Drug interaction checking
    for interaction in DRUG_INTERACTIONS:
        d1, d2 = interaction["drugs"]
        has_d1 = any(d1 in m for m in meds_clean)
        has_d2 = any(d2 in m for m in meds_clean)
        if has_d1 and has_d2:
            alerts.append({
                "type": "DRUG_INTERACTION",
                "severity": interaction["severity"],
                "badge_class": "badge-critical" if interaction["severity"] == "CRITICAL" else "badge-urgent",
                "title": f"⚠️ Drug-Drug Interaction: {d1.title()} + {d2.title()}",
                "message": interaction["warning"]
            })

    is_safe = len(alerts) == 0
    return {
        "success": True,
        "is_safe": is_safe,
        "total_alerts": len(alerts),
        "alerts": alerts,
        "status_text": "All medications verified safe. No adverse interactions or allergy conflicts detected." if is_safe else f"{len(alerts)} Clinical Safety Alert(s) Flagged."
    }
