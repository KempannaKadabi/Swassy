from fastapi import APIRouter, HTTPException
import json
import uuid
from datetime import datetime
from backend.database import get_db
from bson import ObjectId

router = APIRouter(prefix="/api/fhir", tags=["HL7 FHIR R4"])

@router.get("/cases/{triage_id}")
async def get_fhir_bundle(triage_id: str):
    db = get_db()

    triage = await db.triage_records.find_one({"_id": ObjectId(triage_id)})
    if not triage:
        raise HTTPException(status_code=404, detail="Triage case not found")
        
    patient = await db.patients.find_one({"_id": ObjectId(triage["patient_id"])}) or {}

    triage["patient_name"] = patient.get("name", "")
    triage["uhid"] = patient.get("uhid", "")
    triage["age"] = patient.get("age", "")
    triage["gender"] = patient.get("gender", "")
    triage["phone"] = patient.get("phone", "")
    triage["address"] = patient.get("address", "")
    triage["locality"] = patient.get("locality", "")
    triage["allergies"] = patient.get("allergies", "")
    triage["chronic_conditions"] = patient.get("chronic_conditions", "")

    soap = await db.soap_notes.find_one({"triage_id": triage_id})
    consultation = await db.consultations.find_one({"triage_id": triage_id})

    t = dict(triage)
    t["id"] = str(t["_id"])
    timestamp = datetime.utcnow().isoformat() + "Z"
    bundle_id = f"bundle-case-{triage_id}-{uuid.uuid4().hex[:8]}"

    patient_ref = f"Patient/{t['uhid']}"
    encounter_ref = f"Encounter/enc-{triage_id}"

    entries = []

    # 1. Patient Resource
    entries.append({
        "fullUrl": f"urn:uuid:{t['uhid']}",
        "resource": {
            "resourceType": "Patient",
            "id": t['uhid'],
            "meta": {"profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"]},
            "identifier": [
                {
                    "type": {"coding": [{"system": "https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code", "code": "ABHA", "display": "Ayushman Bharat Health Account"}]},
                    "system": "https://healthid.ndhm.gov.in",
                    "value": f"91-4829-{t['id'][:6]}029-3019"
                },
                {
                    "type": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "MR", "display": "Medical Record Number"}]},
                    "system": "https://hospital.gov.in/uhid",
                    "value": t['uhid']
                }
            ],
            "name": [{"text": t['patient_name']}],
            "telecom": [{"system": "phone", "value": t['phone'] or "9876543210", "use": "mobile"}],
            "gender": (t['gender'] or "unknown").lower(),
            "address": [{"line": [t['address'] or t['locality']], "city": t['locality'], "state": "Karnataka", "country": "IND"}]
        }
    })

    # 2. Encounter Resource
    entries.append({
        "fullUrl": f"urn:uuid:enc-{triage_id}",
        "resource": {
            "resourceType": "Encounter",
            "id": f"enc-{triage_id}",
            "meta": {"profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter"]},
            "status": "finished" if t.get('queue_status') == 'completed' else "in-progress",
            "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB", "display": "ambulatory outpatient"},
            "subject": {"reference": patient_ref, "display": t['patient_name']},
            "period": {"start": t.get('recorded_at', timestamp)},
            "reasonCode": [{"text": t.get('chief_complaint', '')}]
        }
    })

    # 3. Condition Resource (Chief Complaint / Assessment)
    entries.append({
        "fullUrl": f"urn:uuid:cond-{triage_id}",
        "resource": {
            "resourceType": "Condition",
            "id": f"cond-{triage_id}",
            "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active"}]},
            "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-ver-status", "code": "confirmed" if consultation else "provisional"}]},
            "code": {"text": (consultation and consultation.get("final_diagnosis")) or t.get('chief_complaint', '')},
            "subject": {"reference": patient_ref},
            "encounter": {"reference": encounter_ref},
            "recordedDate": timestamp
        }
    })

    # 4. AllergyIntolerance
    if t.get('allergies') and "none" not in t['allergies'].lower() and "no known" not in t['allergies'].lower():
        entries.append({
            "fullUrl": f"urn:uuid:allergy-{triage_id}",
            "resource": {
                "resourceType": "AllergyIntolerance",
                "id": f"allergy-{triage_id}",
                "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "code": "active"}]},
                "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", "code": "confirmed"}]},
                "criticality": "high",
                "code": {"text": t['allergies']},
                "patient": {"reference": patient_ref},
                "recordedDate": timestamp
            }
        })

    # 5. DocumentReference (Clinical Summary Draft)
    summary_text = (soap and f"{soap.get('subjective', '')}\n\n{soap.get('objective', '')}\n\n{soap.get('assessment', '')}\n\n{soap.get('plan', '')}") or t.get('chief_complaint', '')
    entries.append({
        "fullUrl": f"urn:uuid:docref-{triage_id}",
        "resource": {
            "resourceType": "DocumentReference",
            "id": f"docref-{triage_id}",
            "status": "current",
            "docStatus": "final" if (soap and soap.get('doctor_reviewed')) else "preliminary",
            "type": {"text": "AI GENERATED DRAFT — REQUIRES PHYSICIAN VERIFICATION"},
            "subject": {"reference": patient_ref},
            "date": timestamp,
            "description": "Structured Clinical Intake Summary Draft for Doctor Review",
            "content": [{
                "attachment": {
                    "contentType": "text/plain",
                    "title": "Clinical Case Summary",
                    "data": summary_text
                }
            }]
        }
    })

    bundle = {
        "resourceType": "Bundle",
        "id": bundle_id,
        "meta": {
            "lastUpdated": timestamp,
            "profile": ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"]
        },
        "identifier": {
            "system": "https://hospital.gov.in/bundles",
            "value": bundle_id
        },
        "type": "document",
        "timestamp": timestamp,
        "total": len(entries),
        "entry": entries
    }

    return {
        "success": True,
        "fhirBundle": bundle,
        "metadata": {
            "standard": "HL7 FHIR R4",
            "ndhmProfile": "https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle",
            "generatedAt": timestamp
        }
    }
