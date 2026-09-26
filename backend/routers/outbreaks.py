from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from backend.database import get_db
from backend.auth import get_current_user
from bson import ObjectId
from datetime import datetime
import pytz

router = APIRouter(prefix="/api/outbreaks", tags=["Swasya Map Outbreak Surveillance"])

class ReportOutbreakRequest(BaseModel):
    disease_name: str
    locality: str
    district: Optional[str] = "Hubballi"
    state: Optional[str] = "Karnataka"
    latitude: float
    longitude: float
    cases_count: int
    severity: Optional[str] = "medium"
    alert_flag: Optional[bool] = False
    notes: Optional[str] = ""

@router.get("/map-data")
async def get_map_data(disease: Optional[str] = Query(None), severity: Optional[str] = Query(None)):
    db = get_db()
    
    query = {}
    if disease and disease != "All":
        query["disease_name"] = {"$regex": disease, "$options": "i"}

    if severity and severity != "All":
        query["severity"] = severity

    cursor = db.outbreak_data.find(query).sort("cases_count", -1)
    clusters = []
    total_cases = 0
    async for c in cursor:
        cluster = dict(c)
        cluster["id"] = str(cluster["_id"])
        del cluster["_id"]
        clusters.append(cluster)
        total_cases += cluster.get("cases_count", 0)

    return {
        "center": {"lat": 15.3647, "lng": 75.1240, "city": "Hubballi, Karnataka"},
        "clusters": clusters,
        "total_cases_tracked": total_cases
    }

@router.get("/alerts")
async def get_outbreak_alerts():
    db = get_db()
    
    query = {
        "$or": [
            {"alert_flag": 1},
            {"severity": {"$in": ["high", "critical"]}}
        ]
    }
    
    cursor = db.outbreak_data.find(query).sort("cases_count", -1)
    alerts = []
    async for a in cursor:
        alert = dict(a)
        alert["id"] = str(alert["_id"])
        del alert["_id"]
        alerts.append(alert)

    return {"alerts": alerts, "active_count": len(alerts)}

@router.post("/report")
async def report_outbreak(req: ReportOutbreakRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    outbreak_data = {
        "disease_name": req.disease_name,
        "locality": req.locality,
        "district": req.district,
        "state": req.state,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "cases_count": req.cases_count,
        "severity": req.severity,
        "alert_flag": 1 if req.alert_flag else 0,
        "notes": req.notes,
        "created_at": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat()
    }
    
    result = await db.outbreak_data.insert_one(outbreak_data)
    
    return {"id": str(result.inserted_id), "message": "Surveillance incident successfully registered"}
