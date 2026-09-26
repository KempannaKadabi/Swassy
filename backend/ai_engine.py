import re
import json
from typing import Dict, Any, List

DISCLAIMER = (
    "CLINICAL DECISION SUPPORT ADVISORY: This AI SOAP note is automatically generated "
    "as an assistive draft for Primary Health Center doctors. It must be reviewed, edited, "
    "and verified by the licensed consulting medical officer before final sign-off."
)

def analyze_vitals(vitals: Dict[str, Any]) -> List[str]:
    flags = []
    bp_sys = vitals.get("bp_systolic")
    bp_dia = vitals.get("bp_diastolic")
    hr = vitals.get("heart_rate")
    spo2 = vitals.get("spo2")
    temp = vitals.get("temperature")
    rbs = vitals.get("blood_sugar")
    
    if bp_sys and bp_dia:
        if bp_sys >= 140 or bp_dia >= 90:
            flags.append(f"Hypertension Stage 2 ({bp_sys}/{bp_dia} mmHg)")
        elif bp_sys >= 130 or bp_dia >= 80:
            flags.append(f"Hypertension Stage 1 ({bp_sys}/{bp_dia} mmHg)")
        elif bp_sys < 90 or bp_dia < 60:
            flags.append(f"Hypotension ({bp_sys}/{bp_dia} mmHg)")
            
    if hr:
        if hr > 100:
            flags.append(f"Tachycardia ({hr} bpm)")
        elif hr < 60:
            flags.append(f"Bradycardia ({hr} bpm)")
            
    if spo2:
        if spo2 < 92:
            flags.append(f"Critical Hypoxemia (SpO2 {spo2}%) - Oxygen therapy warranted")
        elif spo2 < 95:
            flags.append(f"Borderline SpO2 ({spo2}%) - Monitor respiratory effort")
            
    if temp:
        if temp >= 102.0:
            flags.append(f"High-grade Pyrexia ({temp} °F)")
        elif temp >= 99.5:
            flags.append(f"Low-grade Pyrexia ({temp} °F)")
            
    if rbs:
        if rbs > 200:
            flags.append(f"Marked Hyperglycemia (RBS {rbs} mg/dL)")
        elif rbs < 70:
            flags.append(f"Hypoglycemia Alert (RBS {rbs} mg/dL)")
            
    return flags

def generate_soap_note(
    patient: Dict[str, Any],
    vitals: Dict[str, Any],
    transcript: str = "",
    ocr_context: str = ""
) -> Dict[str, Any]:
    """
    Generates a structured SOAP note from patient triage, voice transcript, and OCR context.
    Works fully offline using intelligent clinical rule synthesis, with support for Indian PHC pathologies.
    """
    complaint = (vitals.get("chief_complaint") or "").lower()
    combined_text = f"{complaint} {transcript} {ocr_context}".lower()
    
    age = patient.get("age", "")
    gender = patient.get("gender", "")
    allergies = patient.get("allergies") or "No known drug allergies (NKDA)"
    chronic = patient.get("chronic_conditions") or "None documented"
    
    vital_flags = analyze_vitals(vitals)
    vitals_str = (
        f"BP: {vitals.get('bp_systolic', '---')}/{vitals.get('bp_diastolic', '---')} mmHg | "
        f"Pulse: {vitals.get('heart_rate', '---')} bpm | "
        f"SpO2: {vitals.get('spo2', '---')}% | "
        f"Temp: {vitals.get('temperature', '---')} °F | "
        f"RBS: {vitals.get('blood_sugar', '---')} mg/dL | "
        f"BMI: {vitals.get('bmi', '---')}"
    )

    # Detect symptom clusters
    is_fever = any(w in combined_text for w in ["fever", "bukhar", "temperature", "chills", "pyrexia", "ताप", "बुखार"])
    is_dengue_like = is_fever and any(w in combined_text for w in ["retro-orbital", "behind eye", "joint", "backache", "breakbone", "platelet", "rash"])
    is_diarrhea = any(w in combined_text for w in ["diarrhea", "loose motion", "dast", "watery stool", "cramp", "vomit", "उल्टी", "दस्त"])
    is_respiratory = any(w in combined_text for w in ["cough", "khansi", "sputum", "wheezing", "breathless", "dyspnea", "asthma", "सांस", "खांसी"])
    is_chest_pain = any(w in combined_text for w in ["chest pain", "angina", "tightness", "sweating", "left arm", "सीने में दर्द"])
    is_skin = any(w in combined_text for w in ["rash", "itching", "khujli", "boil", "lesion", "खुजली"])
    is_urinary = any(w in combined_text for w in ["burning urination", "dysuria", "flank pain", "hematuria", "peshab"])

    red_flags = []
    diff_diagnosis = []

    # 1. Subjective
    subjective_parts = [
        f"Patient is a {age}-year-old {gender} presenting to PHC with complaints of: {vitals.get('chief_complaint') or 'General malaise'}."
    ]
    if transcript:
        subjective_parts.append(f"Nurse Voice Scribe Transcript summary: {transcript.strip()}")
    if ocr_context:
        subjective_parts.append(f"Relevant past medical records (OCR): {ocr_context.strip()}")
    subjective_parts.append(f"Past History & Comorbidities: {chronic}. Allergies: {allergies}.")
    subjective = "\n\n".join(subjective_parts)

    # 2. Objective
    objective_parts = [
        f"VITAL SIGNS AT TRIAGE:\n{vitals_str}"
    ]
    if vital_flags:
        objective_parts.append("VITAL ABNORMALITIES FLAGGED:\n• " + "\n• ".join(vital_flags))
    else:
        objective_parts.append("Vital signs currently stable within baseline PHC parameters.")
    objective = "\n\n".join(objective_parts)

    # 3. Assessment
    assessment_parts = []
    if is_chest_pain:
        assessment_parts.append("CRITICAL: Acute Chest Pain Syndrome. Rule out Acute Coronary Syndrome (ACS) / Unstable Angina.")
        red_flags.append("RED FLAG: Potential cardiac etiology. Immediate 12-lead ECG and emergency stabilization required.")
        diff_diagnosis.extend(["1. Acute Coronary Syndrome", "2. Gastroesophageal Reflux Disease", "3. Musculoskeletal Chest Wall Pain"])
    elif is_dengue_like:
        assessment_parts.append("Acute Febrile Illness suspicious of Vector-Borne Infection (Dengue Fever / Chikungunya).")
        red_flags.append("MONITOR: Bleeding manifestations, abdominal pain, mucosal bleed, severe thrombocytopenia.")
        diff_diagnosis.extend(["1. Dengue Fever (Probable)", "2. Viral Febrile Syndrome", "3. Chikungunya", "4. Enteric (Typhoid) Fever"])
    elif is_diarrhea:
        assessment_parts.append("Acute Gastroenteritis / Acute Diarrheal Disease with risk of dehydration.")
        if "gandhi camp" in combined_text or "outbreak" in combined_text:
            red_flags.append("EPIDEMIC ALERT: Matches local water contamination cluster in surveillance zone.")
        diff_diagnosis.extend(["1. Acute Infective Gastroenteritis", "2. Viral Gastroenteritis (Rotavirus/Norovirus)", "3. Food Poisoning"])
    elif is_respiratory:
        assessment_parts.append("Acute Upper / Lower Respiratory Tract Infection (URTI / Acute Bronchitis).")
        if vitals.get("spo2", 100) < 94:
            red_flags.append("Hypoxemic respiratory compromise. Check for consolidation / Pneumonia.")
        diff_diagnosis.extend(["1. Acute Bronchitis", "2. Infective Exacerbation of Asthma/COPD", "3. Community-Acquired Pneumonia"])
    elif is_skin:
        assessment_parts.append("Dermatological infection / Allergic dermatitis.")
        diff_diagnosis.extend(["1. Allergic Contact Dermatitis", "2. Scabies / Parasitic Infestation", "3. Superficial Fungal Infection"])
    elif is_urinary:
        assessment_parts.append("Urinary Tract Infection (UTI) / Urolithiasis.")
        diff_diagnosis.extend(["1. Acute Cystitis", "2. Pyelonephritis", "3. Renal Colic"])
    else:
        assessment_parts.append("Symptomatic presentation requiring physician physical examination and evaluation.")
        diff_diagnosis.extend(["1. Acute Viral Syndrome", "2. Functional Malaise / Fatigue", "3. Nutritional Deficiency"])

    if allergies and allergies.lower() != "none" and "no known" not in allergies.lower():
        red_flags.append(f"ALLERGY WARNING: Patient has documented allergy to {allergies}. Cross-check all prescriptions.")

    assessment = "\n".join(assessment_parts)

    # 4. Plan
    plan_parts = []
    plan_parts.append("DIAGNOSTIC INVESTIGATIONS RECOMMENDED:")
    if is_dengue_like:
        plan_parts.append("• Complete Blood Count (CBC) with Hematocrit and Platelet Count")
        plan_parts.append("• Dengue NS1 Antigen & IgM/IgG Serology")
        plan_parts.append("• Rapid Malarial Antigen (Card Test)")
    elif is_diarrhea:
        plan_parts.append("• Stool Routine & Microscopy")
        plan_parts.append("• Serum Electrolytes (Na+, K+, Cl-)")
    elif is_respiratory:
        plan_parts.append("• Sputum examination for AFB / Gram Stain")
        plan_parts.append("• Chest X-Ray PA View (if crepitations/rhonchi persist)")
    else:
        plan_parts.append("• Baseline CBC, Urine Routine, Random Blood Sugar (RBS)")

    plan_parts.append("\nSUGGESTED CLINICAL MANAGEMENT (Subject to Doctor Modification):")
    if is_dengue_like:
        plan_parts.append("• Tab. Paracetamol 650 mg TDS (Strictly avoid NSAIDs/Aspirin)")
        plan_parts.append("• Aggressive oral rehydration with ORS (2.5 to 3 Liters daily)")
        plan_parts.append("• Daily platelet monitoring until fever subsides")
    elif is_diarrhea:
        plan_parts.append("• Oral Rehydration Salt (ORS) solution after every loose bowel movement")
        plan_parts.append("• Tab. Zinc Sulfate 20 mg OD x 14 days")
        plan_parts.append("• Tab. Racecadotril 100 mg TDS x 3 days")
        plan_parts.append("• Light bland diet (khichdi, curd, banana, boiled potatoes)")
    elif is_respiratory:
        plan_parts.append("• Steam inhalation twice daily")
        plan_parts.append("• Warm saline gargles TDS")
        plan_parts.append("• Syp. Ambroxol + Levosalbutamol if productive cough")
        plan_parts.append("• Consider oral antibiotic (e.g. Amoxicillin/Azithromycin) only if bacterial signs evident")
    else:
        plan_parts.append("• Supportive care and symptomatic relief as indicated by doctor")
        plan_parts.append("• Adequate hydration and balanced nutrition")

    plan_parts.append("\nPATIENT COUNSELING & WARNING SIGNS:")
    plan_parts.append("• Instruct patient to return immediately if severe abdominal pain, persistent vomiting, bleeding from gums/nose, or extreme lethargy develops.")

    plan = "\n".join(plan_parts)

    return {
        "subjective": subjective,
        "objective": objective,
        "assessment": assessment,
        "plan": plan,
        "red_flags": " | ".join(red_flags) if red_flags else "No immediate red flags detected",
        "differential_diagnosis": "\n".join(diff_diagnosis),
        "disclaimer": DISCLAIMER
    }
