import os
import re
import json
import shutil
import base64
from pathlib import Path
from PIL import Image
import pytesseract
import requests
from backend import config

COMMON_MEDS = [
    "paracetamol", "telmisartan", "amlodipine", "metformin", "glimepiride",
    "amoxicillin", "clavulanate", "azithromycin", "cefixime", "ciprofloxacin",
    "pantoprazole", "omeprazole", "ranitidine", "cetirizine", "montelukast",
    "levocetirizine", "atorvastatin", "aspirin", "clopidogrel", "ors",
    "zinc", "racecadotril", "ibuprofen", "diclofenac", "budesonide",
    "dolo", "calpol", "crocin", "azithral", "augmentin", "pan", "pan-d", "pantocid",
    "glycomet", "januvia", "telma", "stamlo", "ecosprin", "rozavel", "allegra",
    "montek-lc", "combiflam", "voveran", "zerodol", "sporidex", "supradyn", "shelcal",
    "becosules", "gelusil", "digene", "norflox", "ofloxacin", "metrogyl", "insulin"
]

COMMON_TESTS = [
    "fbs", "rbs", "ppbs", "hba1c", "hemoglobin", "haemoglobin", "platelet", "tlc", "dlc",
    "creatinine", "urea", "sgpt", "sgot", "bilirubin", "lipid", "cholesterol",
    "widal", "dengue ns1", "malaria", "crp", "esr", "tsh", "t3", "t4", "urine routine",
    "rbc", "mcv", "mch", "mchc", "pcv", "neutrophils", "lymphocytes", "eosinophils", "monocytes"
]

# Set Windows tesseract path if found in default installation folders
for _candidate in [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
]:
    if os.path.isfile(_candidate):
        pytesseract.pytesseract.tesseract_cmd = _candidate
        break

def extract_text_via_gemini(file_path: str) -> str:
    """Uses Google Gemini Vision to accurately transcribe prescriptions and medical records."""
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

        models_to_try = [config.GEMINI_MODEL or "gemini-1.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]
        # Deduplicate while preserving order
        models_to_try = list(dict.fromkeys(models_to_try))

        prompt_text = (
            "You are an expert clinical medical document transcription OCR system. "
            "Accurately read and transcribe all legible text from this medical prescription, "
            "clinical note, lab report, or diagnostic scan. Include patient name/age if visible, "
            "doctor or lab name, date, clinical diagnosis, symptoms, medication names with dosages "
            "(mg, ml, OD, BD, TDS, etc.), and all lab test results with numbers and reference ranges. "
            "Output the transcribed medical text clearly and accurately."
        )

        for model_name in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={config.GEMINI_API_KEY}"
                body = {
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt_text},
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
                        "maxOutputTokens": 2048
                    }
                }

                resp = requests.post(url, json=body, timeout=20)
                if resp.status_code == 200:
                    res_json = resp.json()
                    candidates = res_json.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and parts[0].get("text"):
                            extracted = parts[0]["text"].strip()
                            if len(extracted) > 10:
                                return extracted
            except Exception as model_err:
                print(f"Gemini model {model_name} OCR error: {model_err}")
                continue
    except Exception as e:
        print(f"Gemini Vision OCR error: {e}")
    return ""

def extract_text_from_file(file_path: str) -> str:
    """Extracts text from image or document file using Tesseract or Gemini Vision fallback."""
    path = Path(file_path)
    if not path.exists():
        return ""

    # 1. Try reading with PIL and pytesseract if tesseract is installed
    if shutil.which(getattr(pytesseract.pytesseract, "tesseract_cmd", "tesseract")) or shutil.which("tesseract"):
        try:
            image = Image.open(path)
            if image.mode != "RGB":
                image = image.convert("RGB")
            text = pytesseract.image_to_string(image)
            if text and len(text.strip()) > 20:
                return text.strip()
        except Exception as e:
            print(f"OCR Error with pytesseract: {e}")

    # 2. Gemini Vision (high accuracy on handwritten prescriptions & digital lab reports)
    gemini_text = extract_text_via_gemini(file_path)
    if gemini_text and len(gemini_text.strip()) > 10:
        return gemini_text.strip()

    # 3. Plain text fallback if text/csv file uploaded
    try:
        with open(path, "r", errors="ignore") as f:
            content = f.read()
            if content.strip() and len(content.strip()) > 15:
                return content.strip()
    except Exception:
        pass

    return ""

def parse_medical_document_regex(raw_text: str) -> dict:
    """Fallback rule-based regex parser that extracts strictly what is in the document with NO dummy data."""
    text_lower = raw_text.lower()

    extracted_meds = []
    for med in COMMON_MEDS:
        if re.search(r'\b' + re.escape(med) + r'\b', text_lower):
            pattern = re.compile(rf'({med}[\s\w\d-]*?(?:mg|mcg|ml|g)?(?:\s+\d+-\d+-\d+)?(?:\s+x\s+\d+\s+days)?)', re.IGNORECASE)
            match = pattern.search(raw_text)
            name = match.group(1).strip().capitalize() if match else med.capitalize()
            extracted_meds.append({
                "name": name,
                "dosage": "As documented",
                "frequency": "Prescribed dose",
                "duration": "As directed",
                "instructions": "From uploaded prescription"
            })

    detected_tests = []
    # Look for key test patterns with actual numbers: e.g. "Hb: 14.0 Gm%", "Platelets: 3.70 Lacs/cmm"
    lines = raw_text.splitlines()
    for line in lines:
        line_clean = line.strip(" *-#\t")
        for test in COMMON_TESTS:
            if re.search(r'\b' + re.escape(test) + r'\b', line_clean.lower()):
                # Extract test name and recorded value
                val_match = re.search(r'[:=-]\s*([0-9.,]+\s*[a-zA-Z/%]*)(?:\s*\((.*?)\))?', line_clean)
                if val_match:
                    val = val_match.group(1).strip()
                    ref = val_match.group(2).strip() if val_match.group(2) else "Documented"
                    detected_tests.append({
                        "test": test.upper() if len(test) <= 4 else test.title(),
                        "value": val,
                        "status": f"Recorded ({ref})"
                    })
                break

    allergies = []
    if "allergy" in text_lower or "allergic" in text_lower:
        match = re.search(r'(?:allergy|allergic\s+to)[:\s]+([^\n.,;]+)', raw_text, re.IGNORECASE)
        if match:
            allergies.append(match.group(1).strip())

    conditions = []
    for cond in ["hypertension", "diabetes", "asthma", "bronchitis", "typhoid", "dengue", "hypothyroidism", "fracture"]:
        if cond in text_lower:
            conditions.append(cond.capitalize())

    summary_parts = []
    if conditions:
        summary_parts.append(f"Document mentions: {', '.join(conditions)}.")
    if extracted_meds:
        summary_parts.append(f"Identified {len(extracted_meds)} medication(s).")
    if detected_tests:
        summary_parts.append(f"Recorded {len(detected_tests)} laboratory investigation(s).")
    if allergies:
        summary_parts.append(f"Documented allergies: {', '.join(allergies)}.")

    summary = " ".join(summary_parts) if summary_parts else "Medical document scanned and transcribed."

    return {
        "raw_text": raw_text,
        "summary": summary,
        "medicines": extracted_meds,
        "tests": detected_tests,
        "conditions": conditions,
        "allergies": allergies
    }

def parse_medical_document(raw_text: str) -> dict:
    """
    Parses OCR text into structured clinical findings using AI (Gemini / Groq),
    with zero hallucinated or dummy fallback data.
    """
    if not raw_text or len(raw_text.strip()) < 10:
        return {
            "raw_text": raw_text or "",
            "summary": "Document scanned. No legible clinical text found.",
            "medicines": [],
            "tests": [],
            "conditions": [],
            "allergies": []
        }

    # 1. Try intelligent structured extraction via Google Gemini
    if config.GEMINI_API_KEY:
        try:
            models_to_try = [config.GEMINI_MODEL or "gemini-1.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]
            models_to_try = list(dict.fromkeys(models_to_try))

            prompt = (
                "You are an expert clinical medical document transcription parser.\n"
                "Analyze the following OCR text from an uploaded patient record (prescription, pathology lab report, discharge summary, or radiology scan).\n"
                "Extract ONLY the factual clinical data that is ACTUALLY present in the text.\n\n"
                f"OCR TEXT:\n{raw_text[:4000]}\n\n"
                "Respond ONLY with a valid JSON object matching this schema (NO code blocks, NO markdown):\n"
                "{\n"
                '  "summary": "1-2 sentence factual clinical summary including diagnostic center/doctor name, patient name if mentioned, and key findings",\n'
                '  "medicines": [\n'
                '    {"name": "Exact medication name", "dosage": "Dosage (e.g. 500mg)", "frequency": "Frequency (e.g. OD, BD, TDS)", "duration": "Duration (e.g. 5 days)", "instructions": "Instructions (e.g. After meals)"}\n'
                '  ],\n'
                '  "tests": [\n'
                '    {"test": "Test name (e.g. Haemoglobin, Platelet Count, Fasting Blood Sugar, TLC)", "value": "Measured value with units (e.g. 14.0 Gm%, 99.0 mg/dl)", "status": "Normal / High / Low with reference range"}\n'
                '  ],\n'
                '  "conditions": ["Diagnosed conditions or clinical impressions explicitly documented"],\n'
                '  "allergies": ["Documented allergies if mentioned"]\n'
                "}\n"
                "CRITICAL: If the document is a lab report and has NO medications, 'medicines' MUST be []. "
                "If it has NO lab tests, 'tests' MUST be []. "
                "NEVER invent, assume, or add default dummy data."
            )

            for model_name in models_to_try:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={config.GEMINI_API_KEY}"
                    body = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1200}
                    }
                    resp = requests.post(url, json=body, timeout=12)
                    if resp.status_code == 200:
                        txt = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        clean_json = re.sub(r'^```(?:json)?\s*', '', txt.strip())
                        clean_json = re.sub(r'\s*```$', '', clean_json).strip()
                        parsed = json.loads(clean_json)
                        if isinstance(parsed, dict) and ("medicines" in parsed or "tests" in parsed or "summary" in parsed):
                            parsed["raw_text"] = raw_text
                            return _sanitize_parsed_doc(parsed, raw_text)
                except Exception as m_err:
                    print(f"Gemini {model_name} document parsing notice: {m_err}")
                    continue
        except Exception as e:
            print(f"Gemini document parsing error: {e}")

    # 2. Try Groq Cloud if Gemini failed
    if config.GROQ_API_KEY:
        try:
            for g_model in ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]:
                try:
                    url = "https://api.groq.com/openai/v1/chat/completions"
                    headers = {"Authorization": f"Bearer {config.GROQ_API_KEY}", "Content-Type": "application/json"}
                    payload = {
                        "model": g_model,
                        "messages": [
                            {"role": "system", "content": "You are a clinical document parser. Output strictly valid JSON without dummy data."},
                            {"role": "user", "content": f"Extract structured clinical details from this medical OCR text:\n{raw_text[:3500]}"}
                        ],
                        "temperature": 0.1,
                        "max_tokens": 1000
                    }
                    r = requests.post(url, json=payload, headers=headers, timeout=8)
                    if r.status_code == 200:
                        txt = r.json()["choices"][0]["message"]["content"].strip()
                        clean_json = re.sub(r'^```(?:json)?\s*', '', txt)
                        clean_json = re.sub(r'\s*```$', '', clean_json).strip()
                        parsed = json.loads(clean_json)
                        if isinstance(parsed, dict):
                            parsed["raw_text"] = raw_text
                            return _sanitize_parsed_doc(parsed, raw_text)
                except Exception:
                    continue
        except Exception as e:
            print(f"Groq document parsing error: {e}")

    # 3. Rule-based regex fallback
    return parse_medical_document_regex(raw_text)

def _sanitize_parsed_doc(d: dict, raw_text: str) -> dict:
    """Ensures consistent dictionary types and structure without dummy data."""
    meds = []
    for m in d.get("medicines", []):
        if isinstance(m, str):
            meds.append({"name": m, "dosage": "", "frequency": "", "duration": "", "instructions": ""})
        elif isinstance(m, dict) and m.get("name"):
            meds.append({
                "name": str(m.get("name", "")),
                "dosage": str(m.get("dosage", "")),
                "frequency": str(m.get("frequency", "")),
                "duration": str(m.get("duration", "")),
                "instructions": str(m.get("instructions", ""))
            })

    tests = []
    for t in d.get("tests", []):
        if isinstance(t, str):
            tests.append({"test": t, "value": "Documented", "status": "Recorded"})
        elif isinstance(t, dict) and (t.get("test") or t.get("name")):
            tests.append({
                "test": str(t.get("test") or t.get("name", "")),
                "value": str(t.get("value", "")),
                "status": str(t.get("status", "Recorded"))
            })

    conditions = [str(c) for c in d.get("conditions", []) if c]
    allergies = [str(a) for a in d.get("allergies", []) if a]

    summary = d.get("summary") or ""
    if not summary:
        if tests:
            summary = f"Diagnostic report containing {len(tests)} test biomarker(s)."
        elif meds:
            summary = f"Prescription containing {len(meds)} medication(s)."
        else:
            summary = "Clinical document scanned and recorded in medical history."

    return {
        "raw_text": raw_text,
        "summary": summary,
        "medicines": meds,
        "tests": tests,
        "conditions": conditions,
        "allergies": allergies
    }
