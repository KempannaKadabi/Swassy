import hashlib
import hmac
import time
from typing import Optional
from fastapi import Header, HTTPException
from backend.config import SECRET_KEY
from backend.database import get_db
from bson import ObjectId

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password), password_hash)

def create_token(user_id: str, username: str, role: str) -> str:
    timestamp = int(time.time())
    payload = f"{user_id}:{username}:{role}:{timestamp}"
    signature = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"

def verify_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(":")
        if len(parts) != 5:
            return None
        user_id, username, role, timestamp, signature = parts
        payload = f"{user_id}:{username}:{role}:{timestamp}"
        expected_sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        return {
            "id": user_id,
            "username": username,
            "role": role,
            "timestamp": int(timestamp)
        }
    except Exception:
        return None

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = authorization
    if authorization.startswith("Bearer "):
        token = authorization[7:]
        
    user_data = verify_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    db = get_db()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_data["id"])})
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid user ID")
        
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    user["id"] = str(user["_id"])
    del user["_id"]
    return user

async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization:
        return None
    token = authorization
    if authorization.startswith("Bearer "):
        token = authorization[7:]
    user_data = verify_token(token)
    if not user_data:
        return None
    db = get_db()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_data["id"])})
        if user:
            user["id"] = str(user["_id"])
            del user["_id"]
            return user
    except Exception:
        pass
    return None

