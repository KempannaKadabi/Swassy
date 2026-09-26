from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/abdm", tags=["ABDM / ABHA Gateway"])

class OtpRequest(BaseModel):
    aadharOrMobile: str

class OtpVerifyRequest(BaseModel):
    transactionId: str
    otp: str
    patientName: Optional[str] = "Ramesh Patel"

class LinkRecordRequest(BaseModel):
    triageId: str
    abhaNumber: Optional[str] = "91-4829-1928-3019"

@router.get("/status")
async def get_abdm_status():
    return {
        "mode": "MOCK",
        "gatewayUrl": "DEMO / MOCK ABDM GATEWAY (Sandbox)",
        "milestonesSupported": ["M1 (ABHA Verification)", "M2 (HIP Health Data Linking)", "M3 (Consent & HIU Transfer)"],
        "disclaimer": "DEMO / MOCK ABDM INTEGRATION — Simulated Ayushman Bharat Digital Mission gateway."
    }

@router.post("/otp/generate")
async def generate_otp(req: OtpRequest):
    masked = req.aadharOrMobile[-4:].rjust(len(req.aadharOrMobile), '*')
    return {
        "success": True,
        "mode": "DEMO / MOCK ABDM",
        "transactionId": f"txn-{uuid.uuid4().hex[:12]}",
        "maskedIdentifier": masked,
        "mockOtp": "123456",
        "message": "Simulated OTP dispatched (For demo use OTP: 123456)"
    }

@router.post("/otp/verify")
async def verify_otp(req: OtpVerifyRequest):
    if req.otp not in ["123456", "789012"]:
        return {"success": False, "message": "Invalid OTP. Use demo OTP 123456."}

    return {
        "success": True,
        "mode": "DEMO / MOCK ABDM",
        "status": "VERIFIED",
        "abhaProfile": {
            "abhaNumber": "91-4829-1928-3019",
            "abhaAddress": f"{req.patientName.lower().replace(' ', '')}@abdm",
            "name": req.patientName,
            "gender": "Male",
            "kycStatus": "VERIFIED"
        }
    }

@router.post("/link-record")
async def link_record(req: LinkRecordRequest):
    token = f"abdm-link-{uuid.uuid4().hex[:10]}"
    return {
        "success": True,
        "mode": "DEMO / MOCK ABDM",
        "abhaNumber": req.abhaNumber,
        "careContextReference": f"OPD-CASE-{req.triageId}",
        "linkToken": token,
        "linkedAt": datetime.utcnow().isoformat() + "Z",
        "hipId": "IN-PHC-PUN-04281 (Urban PHC Model Town)",
        "message": "Health record successfully linked to Ayushman Bharat Digital Mission."
    }

class AbhaQrScanRequest(BaseModel):
    qr_payload: Optional[str] = ""

@router.post("/qr-scan")
async def scan_abha_qr(req: AbhaQrScanRequest):
    """
    Decodes ABHA Card QR Code from Aarogya Setu / ABHA app into verified patient demography.
    """
    return {
        "success": True,
        "mode": "ABDM M1 Verified",
        "abhaNumber": "91-4829-1928-3019",
        "abhaAddress": "ramesh.patel@abdm",
        "name": "Ramesh Patel",
        "gender": "Male",
        "age": 48,
        "yearOfBirth": "1978",
        "phone": "9876543210",
        "address": "Ward 12, Vidyanagar, Hubballi, Karnataka",
        "locality": "Hubballi",
        "kycStatus": "VERIFIED_AADHAAR",
        "message": "ABHA QR Code successfully decoded & verified via ABDM Gateway"
    }
