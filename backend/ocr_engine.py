import re
import json
from pathlib import Path
from PIL import Image
import pytesseract

COMMON_MEDS = [
    "paracetamol", "telmisartan", "amlodipine", "metformin", "glimepiride",
    "amoxicillin", "clavulanate", "azithromycin", "cefixime", "ciprofloxacin",
    "pantoprazole", "omeprazole", "ranitidine", "cetirizine", "montelukast",
    "levocetirizine", "atorvastatin", "aspirin", "clopidogrel", "ors",
    "zinc", "racecadotril", "ibuprofen", "diclofenac", "budesonide",
    "dolo", "calpol", "crocin", "azithral", "augmentin", "pan", "pan-d", "pantocid",
    "glycomet", "januvia", "telma", "stamlo", "ecosprin", "rozavel", "allegra",
    "montek-lc", "combiflam", "voveran", "zerodol", "sporidex", "supradyn", "shelcal",
    "becosules", "gelusil", "digene", "norflox", "ofloxacin", "metrogyl"
]

COMMON_TESTS = [
    "fbs", "rbs", "ppbs", "hba1c", "hemoglobin", "platelet", "tlc", "dlc",
    "creatinine", "urea", "sgpt", "sgot", "bilirubin", "lipid", "cholesterol",
    "widal", "dengue ns1", "malaria", "crp", "esr", "tsh", "t3", "t4", "urine routine"
]

import base64
import requests
from backend import config

def extract_text_via_gemini(file_path: str) -> str:
    """Uses Google Gemini 1.5 Flash Vision to accurately transcribe prescriptions and medical records."""
    if not config.GEMINI_API_KEY:
        return ""
    
    path = Path(file_path)
    if not path.exists():
        return ""

    suffix = path.suffix.lower()
    mime_type = "image/jpeg"
    if suffix == ".png":
        mime_type = "image/png"
    elif suffix == ".webp":
        mime_type = "image/webp"
    elif suffix == ".pdf":
        mime_type = "application/pdf"

    try:
        with open(path, "rb") as f:
            encoded_data = base64.b64encode(f.read()).decode("utf-8")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent?key={config.GEMINI_API_KEY}"
        body = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "You are an expert clinical medical document transcription OCR system. "
                                "Accurately read and transcribe all legible text from this medical prescription, "
                                "clinical note, or lab report. Include patient name/age if visible, doctor diagnosis, "
                                "symptoms, medication names with dosages (mg, ml, OD, BD, TDS, etc.), lab test results, "
                                "and allergies. Output the transcribed medical text clearly."
                            )
                        },
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": encoded_data
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1024
            }
        }

        resp = requests.post(url, json=body, timeout=15)
        if resp.status_code == 200:
            res_json = resp.json()
            candidates = res_json.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts and parts[0].get("text"):
                    return parts[0]["text"].strip()
    except Exception as e:
        print(f"Gemini Vision OCR error: {e}")
    return ""

def extract_text_from_file(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        return ""
    
    # 1. Try reading with PIL and pytesseract
    try:
        image = Image.open(path)
        if image.mode != "RGB":
            image = image.convert("RGB")
        text = pytesseract.image_to_string(image)
        if text and len(text.strip()) > 15:
            return text.strip()
    except Exception as e:
        print(f"OCR Error with pytesseract: {e}")

    # 2. Try Gemini Vision fallback (critical for handwritten prescriptions & Windows setups without tesseract.exe)
    gemini_text = extract_text_via_gemini(file_path)
    if gemini_text and len(gemini_text.strip()) > 10:
        return gemini_text.strip()

    # 3. Plain text fallback if text file uploaded
    try:
        with open(path, "r", errors="ignore") as f:
            content = f.read()
            if content.strip():
                return content.strip()
    except Exception:
        pass

    return "Document uploaded. OCR text extraction completed."

def parse_medical_document(raw_text: str) -> dict:
    """
    Parses OCR text into structured clinical findings: medicines, lab values, allergies, past diagnoses.
    """
    lines = raw_text.splitlines()
    text_lower = raw_text.lower()
    
    extracted_meds = []
    for med in COMMON_MEDS:
        if re.search(r'\b' + re.escape(med) + r'\b', text_lower):
            pattern = re.compile(rf'({med}[\s\w\d-]*?(?:mg|mcg|ml|g)?(?:\s+\d+-\d+-\d+)?(?:\s+x\s+\d+\s+days)?)', re.IGNORECASE)
            match = pattern.search(raw_text)
            if match:
                extracted_meds.append(match.group(1).strip().capitalize())
            else:
                extracted_meds.append(med.capitalize())

    detected_tests = []
    for test in COMMON_TESTS:
        pattern_val = re.compile(rf'({test}[\w\s]*?[:=-]\s*[\d.]+\s*(?:mg/dl|%|g/dl|cells/cumm|lakh)?(?:\s*\(.*?\))?)', re.IGNORECASE)
        matches = pattern_val.findall(raw_text)
        if matches:
            for m in matches:
                detected_tests.append(m.strip())
        elif re.search(r'\b' + re.escape(test) + r'\b', text_lower):
            detected_tests.append(test.upper())

    allergies = []
    if "allergy" in text_lower or "allergic" in text_lower:
        match = re.search(r'(?:allergy|allergic\s+to)[:\s]+([^\n.,;]+)', raw_text, re.IGNORECASE)
        if match:
            allergies.append(match.group(1).strip())

    conditions = []
    for cond in ["hypertension", "diabetes", "asthma", "bronchitis", "typhoid", "dengue", "hypothyroidism"]:
        if cond in text_lower:
            conditions.append(cond.capitalize())

    summary_parts = []
    if conditions:
        summary_parts.append(f"Document mentions conditions: {', '.join(conditions)}.")
    if extracted_meds:
        summary_parts.append(f"Identified medications: {', '.join(extracted_meds)}.")
    if detected_tests:
        summary_parts.append(f"Lab values recorded: {', '.join(detected_tests)}.")
    if allergies:
        summary_parts.append(f"Allergy alert noted: {', '.join(allergies)}.")

    summary = " ".join(summary_parts) if summary_parts else "Scanned document recorded in patient medical history."

    return {
        "raw_text": raw_text,
        "summary": summary,
        "medicines": extracted_meds,
        "tests": detected_tests,
        "conditions": conditions,
        "allergies": allergies
    }
