import os
import sys
import unittest
import json
from io import BytesIO
from PIL import Image
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db

class TestSwasyaAIWeb(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import asyncio
        asyncio.run(init_db(force_seed=True))
        cls.client = TestClient(app)

    def test_01_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["mode"], "web-only")
        self.assertEqual(data["disclaimer"], "AI GENERATED DRAFT — REQUIRES PHYSICIAN VERIFICATION")

    def test_02_static_files(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("Swasya AI", res.text)
        self.assertIn("Patient Portal", res.text)

    def test_03_auth_demo_switch(self):
        for role in ["doctor", "patient"]:
            res = self.client.post("/api/auth/demo-switch", json={"role": role})
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["user"]["role"], role)
            self.assertTrue(data["token"])

    def test_04_patient_registration_and_returning_lookup(self):
        # 1. Lookup non-existent
        res_lookup1 = self.client.get("/api/patients/lookup?phone=9876543210")
        self.assertEqual(res_lookup1.status_code, 200)
        self.assertFalse(res_lookup1.json()["found"])

        # 2. Register real patient
        new_patient = {
            "name": "Ramesh Patel",
            "age": 48,
            "gender": "Male",
            "phone": "9876543210",
            "locality": "Hubballi",
            "chronic_conditions": "Hypertension, Dyslipidemia",
            "allergies": "Penicillin"
        }
        res_post = self.client.post("/api/patients", json=new_patient)
        self.assertEqual(res_post.status_code, 200)
        created = res_post.json()
        self.assertTrue(created["patient"]["uhid"].startswith("UHID-"))
        patient_id = created["patient"]["id"]

        # 3. Lookup returning patient
        res_lookup2 = self.client.get("/api/patients/lookup?phone=9876543210")
        self.assertEqual(res_lookup2.status_code, 200)
        self.assertTrue(res_lookup2.json()["found"])
        self.assertEqual(res_lookup2.json()["patient"]["name"], "Ramesh Patel")

    def test_05_dynamic_clinical_chat(self):
        # Test greeting
        r1 = self.client.post("/api/scribe/adaptive/chat", json={"message": "hi", "language": "English", "history": []})
        self.assertEqual(r1.status_code, 200)
        self.assertIn("Hello!", r1.json()["reply"])

        # Test cardiac complaint
        r2 = self.client.post("/api/scribe/adaptive/chat", json={"message": "Severe Chest Pain", "language": "English", "history": [{"sender": "PATIENT", "text": "hi"}]})
        self.assertEqual(r2.status_code, 200)
        self.assertIn("chest", r2.json()["reply"].lower())

    def test_06_final_report_generation(self):
        # Register a patient for test
        p_res = self.client.post("/api/patients", json={"name": "Suresh Rao", "age": 52, "gender": "Male", "phone": "9822334455"})
        p_id = p_res.json()["patient"]["id"]

        chat_messages = [
            {"sender": "AI", "text": "What symptoms do you have?"},
            {"sender": "PATIENT", "text": "High fever since 4 days and body aches"},
            {"sender": "AI", "text": "Are you having severe chills or headache?"},
            {"sender": "PATIENT", "text": "Yes chills and headache behind the eyes"}
        ]

        res_rep = self.client.post("/api/scribe/generate-final-report", json={
            "patient_id": p_id,
            "chat_messages": chat_messages,
            "chief_complaint": "High fever for 4 days with retro-orbital headache"
        })
        self.assertEqual(res_rep.status_code, 200)
        data = res_rep.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["token_number"].startswith("OPD-CASE-"))
        self.assertIn("AI GENERATED DRAFT — REQUIRES PHYSICIAN VERIFICATION", data["final_report"])

    def test_07_consultation_flow(self):
        res = self.client.get("/api/triage/queue")
        data = res.json()
        queue = data.get("all", [])
        if queue:
            triage_id = queue[0]["triage_id"]
            patient_id = queue[0]["patient_id"]

            consult_data = {
                "triage_id": triage_id,
                "patient_id": patient_id,
                "final_diagnosis": "Acute Febrile Illness - Suspected Dengue",
                "clinical_notes": "Patient advised rest, CBC with platelets, and hydration.",
                "prescriptions": [
                    {"medicine": "Tab Paracetamol", "dosage": "650mg", "frequency": "TDS", "duration": "3 days", "notes": "After meals"}
                ],
                "lab_investigations": "CBC with Platelets, Dengue NS1",
                "follow_up_advice": "Review after 3 days if fever persists"
            }
            res_consult = self.client.post("/api/consultations", json=consult_data)
            self.assertEqual(res_consult.status_code, 200)

    def test_08_fhir_r4_bundle_export(self):
        res_q = self.client.get("/api/triage/queue")
        queue = res_q.json().get("all", [])
        if queue:
            t_id = queue[0]["triage_id"]
            res = self.client.get(f"/api/fhir/cases/{t_id}")
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertTrue(data["success"])
            self.assertEqual(data["fhirBundle"]["resourceType"], "Bundle")

    def test_09_abdm_gateway_status(self):
        res = self.client.get("/api/abdm/status")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["mode"], "MOCK")

    def test_10_api_key_settings_endpoint(self):
        # Test GET status
        r1 = self.client.get("/api/auth/settings/api-keys")
        self.assertEqual(r1.status_code, 200)

        # Test POST update key
        r2 = self.client.post("/api/auth/settings/api-keys", json={"gemini_api_key": "test-gemini-api-key"})
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.json()["success"])

    def test_11_language_endpoints(self):
        # Verify 14 languages supported
        res = self.client.get("/api/language/supported")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 14)
        self.assertEqual(len(data["languages"]), 14)

        # Verify translation endpoint
        res_trans = self.client.post("/api/language/translate", json={
            "text": "Hello, how are you?",
            "source_language": "en",
            "target_language": "hi"
        })
        self.assertEqual(res_trans.status_code, 200)
        self.assertTrue(res_trans.json()["translated_text"])

    def test_12_disease_detection(self):
        # Supported conditions
        res = self.client.get("/api/disease/supported-conditions")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.json()["regions"]) >= 8)

        # Upload dummy image for disease detection
        dummy_img = BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
        res_detect = self.client.post(
            "/api/disease/detect",
            data={"body_location": "chest", "patient_id": 1},
            files={"file": ("lesion_test.png", dummy_img, "image/png")}
        )
        self.assertEqual(res_detect.status_code, 200)
        data = res_detect.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["analysis"]["primary_condition"])

    def test_13_patient_hospital_files(self):
        # Upload an X-ray file record
        img = Image.new("RGB", (64, 64), color=(10, 10, 10))
        dummy_xray = BytesIO()
        img.save(dummy_xray, format="JPEG")
        dummy_xray.seek(0)
        res_upload = self.client.post(
            "/api/patient-files/upload",
            data={
                "patient_id": 1,
                "file_type": "xray",
                "hospital_name": "District Civil Hospital",
                "visit_date": "2026-08-15",
                "notes": "Chest PA View"
            },
            files={"file": ("chest_xray.jpg", dummy_xray, "image/jpeg")}
        )
        self.assertEqual(res_upload.status_code, 200)
        self.assertEqual(res_upload.json()["file_type"], "xray")

        # List files for patient
        res_files = self.client.get("/api/patient-files/patient/1")
        self.assertEqual(res_files.status_code, 200)
        self.assertTrue(len(res_files.json()["files"]) >= 1)

    def test_14_pdf_report_and_whatsapp(self):
        # Test PDF download endpoint for triage 1
        res_pdf = self.client.get("/api/reports/triage/1/pdf")
        self.assertEqual(res_pdf.status_code, 200)
        self.assertEqual(res_pdf.headers["content-type"], "application/pdf")
        self.assertTrue(len(res_pdf.content) > 1000)

        # Test WhatsApp share link generation
        res_wa = self.client.get("/api/reports/1/whatsapp-link")
        self.assertEqual(res_wa.status_code, 200)
        self.assertIn("https://wa.me/", res_wa.json()["whatsapp_url"])
        self.assertIn("pdf", res_wa.json()["pdf_download_url"])

if __name__ == "__main__":
    unittest.main()

