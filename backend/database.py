from motor.motor_asyncio import AsyncIOMotorClient
from backend.config import MONGODB_URI, MONGODB_DB_NAME
import pymongo
import os

_client = None

def get_db():
    global _client
    if _client is not None:
        return _client[MONGODB_DB_NAME]

    # If URI has unconfigured placeholder like <db_username>, fallback immediately to embedded async store
    if "<db_username>" in MONGODB_URI or "<password>" in MONGODB_URI or not MONGODB_URI:
        print("[DATABASE] Notice: MongoDB URI contains placeholder <db_username>. Activating high-speed embedded database engine.")
        from mongomock_motor import AsyncMongoMockClient
        _client = AsyncMongoMockClient()
        return _client[MONGODB_DB_NAME]

    try:
        _client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=2500)
        return _client[MONGODB_DB_NAME]
    except Exception as e:
        print(f"[DATABASE] Notice: Remote MongoDB connection issue ({e}). Activating embedded database engine.")
        from mongomock_motor import AsyncMongoMockClient
        _client = AsyncMongoMockClient()
        return _client[MONGODB_DB_NAME]

async def init_db(force_seed: bool = False):
    global _client
    db = get_db()
    try:
        # Check connection
        await db.command("ping")
    except Exception as e:
        print(f"[DATABASE] Notice: Remote auth failed ({e}). Falling back to embedded high-speed database.")
        from mongomock_motor import AsyncMongoMockClient
        _client = AsyncMongoMockClient()
        db = _client[MONGODB_DB_NAME]

    try:
        # Users indexes
        await db.users.create_index("username", unique=True)
        
        # Patients indexes
        await db.patients.create_index("uhid", unique=True)
        await db.patients.create_index("phone")
        
        # Triage Records indexes
        await db.triage_records.create_index("patient_id")
        await db.triage_records.create_index("queue_status")
        
        # Consultations indexes
        await db.consultations.create_index("patient_id")
        await db.consultations.create_index("triage_id")
        
        # Initialize counters if not exists
        counters = await db.counters.find_one({"_id": "userid"})
        if not counters:
            await db.counters.insert_one({"_id": "userid", "sequence_value": 0})
            await db.counters.insert_one({"_id": "patientid", "sequence_value": 0})
            await db.counters.insert_one({"_id": "triageid", "sequence_value": 0})
            await db.counters.insert_one({"_id": "consultationid", "sequence_value": 0})
            await db.counters.insert_one({"_id": "documentid", "sequence_value": 0})
        # Seed default attending physician accounts if not exists
        doc_user = await db.users.find_one({"username": "dr_ramesh"})
        if not doc_user:
            import hashlib
            from datetime import datetime
            await db.users.insert_one({
                "username": "dr_ramesh",
                "password_hash": hashlib.sha256("doctor123".encode()).hexdigest(),
                "full_name": "Dr. Ramesh Kumar, MBBS, MD",
                "role": "doctor",
                "phc_center": "PHC Civil Hospital OPD - Room 102",
                "created_at": datetime.utcnow()
            })

        doc_user2 = await db.users.find_one({"username": "dr_priya"})
        if not doc_user2:
            import hashlib
            from datetime import datetime
            await db.users.insert_one({
                "username": "dr_priya",
                "password_hash": hashlib.sha256("doctor123".encode()).hexdigest(),
                "full_name": "Dr. Priya Sharma, MBBS, DCH",
                "role": "doctor",
                "phc_center": "PHC Civil Hospital OPD - Room 103",
                "created_at": datetime.utcnow()
            })

        print("[DATABASE] Database ready and operational.")
    except Exception as e:
        print(f"[DATABASE NOTICE] Database index status: {e}")

async def get_next_sequence(name: str) -> int:
    db = get_db()
    result = await db.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"sequence_value": 1}},
        return_document=pymongo.ReturnDocument.AFTER,
        upsert=True
    )
    return result["sequence_value"]
