# Swasya AI — Clinical Case-Taking & Hospital Operating System

> Complete Full-Stack Web Application for Hospitals, Primary Health Centers (PHCs), and Community Clinics.

---

## ⚠️ Core Clinical Safety Philosophy
- **Not an AI Doctor:** The system does **NOT** autonomously diagnose or prescribe treatment.
- **Intake Scribe & Safety Gatekeeper:** The AI collects, structures, summarizes, and highlights potential clinical red flags for physician review.
- **Mandated Clinical Safety Disclaimer:**
  ```
  AI GENERATED DRAFT — REQUIRES PHYSICIAN VERIFICATION
  ```
  This warning is permanently rendered at the header of every AI-synthesized clinical document.
- **Physician Authority:** All medical decisions, differential diagnoses, and prescriptions are strictly controlled and finalized by the attending medical officer.

---

## 🌟 Core Product Portals (All in One Web Application)

### 1. 👤 Patient Self-Intake Station (Kiosk)
Enables ambulatory patients to independently provide their health history prior to entering the physician consultation room:
1. **IDENTIFY:** Registration with Full Name, Age, Gender, Mobile, and optional 14-digit ABHA ID (`91-4829-1928-3019`).
2. **INFORMED CONSENT:** ABDM v2.0 compliant digital consent disclosure explaining data privacy and non-autonomous AI bounds.
3. **LANGUAGE SELECTION:** Large touch tiles supporting **English**, **हिन्दी (Hindi)**, **ಕನ್ನಡ (Kannada)**, and **मराठी (Marathi)**.
4. **AI ADAPTIVE CASE-TAKING:**
   - Multimodal inputs: Browser Microphone (Web Speech API) + Text typing fallback + Touch Symptom Chips (*Chest Pain, Fever, Stomach Pain, Cough*).
   - Audio question synthesis (Text-to-Speech playback).
   - Dynamic clinical branching: Chief complaint → Duration & Onset → Location & Severity → Nature/Character → Associated symptoms → Chronic conditions → Current medications → Allergies → Traditional AYUSH remedies.
5. **MEDICAL DOCUMENT SCANNING (OCR):**
   - Upload/camera capture for previous clinic prescriptions, blood tests, or discharge summaries.
   - Real-time OCR text parsing detecting active medications, lab values, and abnormal markers.
6. **PATIENT REVIEW & SUBMISSION:**
   - *"What we understood from your answers"* summary card.
   - Allows patient to review, correct, or add notes before final submission.
   - Generates unique **OPD Consultation Token** (e.g. `OPD-CASE-1001`) directing patient to Doctor Room 102.

---

### 2. 🩺 Doctor Consultation Desk
A professional, information-dense workstation designed for rapid clinical examination:
- **Prioritized Live Queue:** Visual urgency indicators (`CRITICAL` red pulse, `URGENT` amber, `NORMAL` blue) based on triage vitals.
- **Deterministic Red-Flag Safety Engine:**
  - Rule-based safety gatekeeper (Acute chest pain / ACS `RF-CARD-001`, stroke FAST signs `RF-NEURO-002`, critical hypoxemia `RF-RESP-003`, dengue warning signs `RF-HEM-005`, drug allergy contraindications `RF-ALLERGY-006`).
  - Phrased strictly as: *"Potential clinical red flag — requires clinician review."*
  - Includes doctor acknowledgment toggle.
- **14-Section Structured AI Clinical Summary:**
  - `[EDIT SUMMARY]` allows modifying any field in real time.
  - `[VERIFY SUMMARY]` records physician verification and clinical sign-off.
  - `[ADD DOCTOR NOTE]` records physical examination findings and clinical notes.
- **Digital Prescription (Rx) Builder:** Add drugs with dosage, frequency (`TDS`, `BD`, `OD`, `SOS`), duration, instructions, with instant printable preview (`Ctrl+P` / `window.print`).
- **HL7 FHIR R4 Bundle Export:** `[EXPORT FHIR R4]` button opens a modal displaying the complete NRCeS/NDHM compliant Document Bundle (`Patient`, `Encounter`, `Condition`, `AllergyIntolerance`, `DocumentReference`).
- **ABDM / ABHA Integration:** `[LINK ABDM / ABHA]` button simulates M1 (ABHA verification), M2 (HIP Care Context linking), and M3 (Consent flow) under demo mode.

---

### 3. 🏥 Nurse Triage & Voice Scribe Station
- Vitals logging: Systolic & Diastolic BP, Heart Rate, SpO2, Temp, Blood Sugar, Height, Weight with auto-calculated BMI.
- Swasya Listen Voice Scribe with multi-lingual dictation.
- Document OCR scanner for walk-in patients.

---

### 4. 📊 PHC Supervision & Analytics (Admin)
- Key performance metrics: Total patients registered, consultations completed, active wait queue, average intake time (~3.8 min), and doctor preparation time saved (~44.5%).
- Urgency triage distribution & disease incidence charts.
- Staff roster tracking consultations finalized.
- 1-Click *"Reset & Seed Demo Data"* button for live demonstration.

---

### 5. 🗺️ Swasya Outbreak Map
- Real-time spatial epidemiology radar monitoring local disease clusters (Dengue, Acute Diarrhea, Viral Fever, Malaria, Typhoid).
- Severity filtering and active spike alerts with recommended public health interventions.

---

## ⚡ Quick Start Instructions

### Windows (1-Click Run)
Double-click `run.bat` or open PowerShell / Command Prompt:
```cmd
python start.py
```
*(If `python` is not recognized, use `py start.py`)*

### Linux / macOS
```bash
python3 start.py
```

Open your web browser and navigate to:
```
http://localhost:8000
```

---

## 🔑 AI API Keys Configuration (Optional)
The system has a built-in clinical rule engine that works **100% offline without any API keys**.
To enable live LLM generation with Google Gemini or Groq, edit `.env`:
```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Groq API
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## 🧪 Automated Test Suite
Run the 12 comprehensive API unit tests verifying all workflows:
```bash
python3 tests/test_api.py
```
