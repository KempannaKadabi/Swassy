import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.auth import hash_password, verify_password, create_token, get_current_user
from bson import ObjectId

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "patient"
    phc_center: str = "Primary Health Center"

@router.post("/register")
async def register(req: RegisterRequest):
    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if req.role not in ("doctor", "patient"):
        raise HTTPException(status_code=400, detail="Role must be doctor or patient")

    db = get_db()
    existing = await db.users.find_one({"username": req.username})
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    pw_hash = hash_password(req.password)
    result = await db.users.insert_one({
        "username": req.username,
        "password_hash": pw_hash,
        "full_name": req.full_name,
        "role": req.role,
        "phc_center": req.phc_center
    })
    user_id = str(result.inserted_id)

    token = create_token(user_id, req.username, req.role)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": req.username,
            "full_name": req.full_name,
            "role": req.role,
            "phc_center": req.phc_center
        }
    }

@router.post("/login")
async def login(req: LoginRequest):
    db = get_db()
    user = await db.users.find_one({"username": req.username})

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    user_id = str(user["_id"])
    token = create_token(user_id, user["username"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "phc_center": user["phc_center"]
        }
    }

@router.get("/me")
def get_profile(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

@router.get("/users")
async def list_users(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.users.find({}).sort("_id", 1)
    users = []
    async for u in cursor:
        u["id"] = str(u["_id"])
        del u["_id"]
        users.append(u)
    return {"users": users}

@router.get("/doctors")
async def list_doctors():
    db = get_db()
    cursor = db.users.find({"role": "doctor"}).sort("full_name", 1)
    doctors = []
    async for u in cursor:
        doctors.append({
            "id": str(u["_id"]),
            "username": u.get("username"),
            "full_name": u.get("full_name") or u.get("username"),
            "role": u.get("role", "doctor"),
            "phc_center": u.get("phc_center") or "PHC Civil Hospital OPD"
        })
    if not doctors:
        doctors = [
            {
                "id": "dr_ramesh",
                "username": "dr_ramesh",
                "full_name": "Dr. Ramesh Kumar, MBBS, MD",
                "role": "doctor",
                "phc_center": "PHC Civil Hospital OPD - Room 102"
            },
            {
                "id": "dr_priya",
                "username": "dr_priya",
                "full_name": "Dr. Priya Sharma, MBBS, DCH",
                "role": "doctor",
                "phc_center": "PHC Civil Hospital OPD - Room 103"
            }
        ]
    return {"doctors": doctors}

class ApiKeysUpdateRequest(BaseModel):
    gemini_api_key: Optional[str] = ""
    groq_api_key: Optional[str] = ""

@router.get("/settings/api-keys")
def get_api_keys_status():
    from backend import config
    g_key = os.getenv("GEMINI_API_KEY", "") or config.GEMINI_API_KEY
    gr_key = os.getenv("GROQ_API_KEY", "") or config.GROQ_API_KEY
    
    active_engine = "Local Clinical Engine (Offline Safe)"
    if gr_key and len(gr_key) > 5:
        active_engine = f"Live Groq Cloud ({config.GROQ_MODEL})"
    elif g_key and len(g_key) > 5:
        active_engine = f"Live Google Gemini ({config.GEMINI_MODEL})"

    return {
        "has_gemini": bool(g_key and len(g_key) > 5),
        "has_groq": bool(gr_key and len(gr_key) > 5),
        "gemini_masked": (g_key[:6] + "..." + g_key[-4:]) if g_key and len(g_key) > 10 else "",
        "groq_masked": (gr_key[:6] + "..." + gr_key[-4:]) if gr_key and len(gr_key) > 10 else "",
        "active_engine": active_engine
    }

@router.post("/settings/api-keys")
def update_api_keys(req: ApiKeysUpdateRequest):
    from backend import config
    from pathlib import Path
    
    env_path = config.BASE_DIR / ".env"
    lines = []
    if env_path.exists():
        with open(env_path, "r") as f:
            lines = f.readlines()

    new_lines = []
    has_gemini = False
    has_groq = False

    for line in lines:
        if line.startswith("GEMINI_API_KEY="):
            if req.gemini_api_key and len(req.gemini_api_key.strip()) > 0:
                new_lines.append(f"GEMINI_API_KEY={req.gemini_api_key.strip()}\n")
            else:
                new_lines.append(line)
            has_gemini = True
        elif line.startswith("GROQ_API_KEY="):
            if req.groq_api_key and len(req.groq_api_key.strip()) > 0:
                new_lines.append(f"GROQ_API_KEY={req.groq_api_key.strip()}\n")
            else:
                new_lines.append(line)
            has_groq = True
        else:
            new_lines.append(line)

    if not has_gemini and req.gemini_api_key:
        new_lines.append(f"GEMINI_API_KEY={req.gemini_api_key.strip()}\n")
    if not has_groq and req.groq_api_key:
        new_lines.append(f"GROQ_API_KEY={req.groq_api_key.strip()}\n")

    with open(env_path, "w") as f:
        f.writelines(new_lines)

    if req.gemini_api_key:
        os.environ["GEMINI_API_KEY"] = req.gemini_api_key.strip()
        config.GEMINI_API_KEY = req.gemini_api_key.strip()
    if req.groq_api_key:
        os.environ["GROQ_API_KEY"] = req.groq_api_key.strip()
        config.GROQ_API_KEY = req.groq_api_key.strip()

    engine = "Live Google Gemini" if req.gemini_api_key else "Live Groq" if req.groq_api_key else "Local Clinical Engine"
    return {
        "success": True,
        "message": f"API keys updated successfully! Active Engine: {engine}",
        "active_engine": engine
    }
