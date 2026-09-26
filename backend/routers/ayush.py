from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from backend.auth import get_current_user

router = APIRouter(prefix="/api/ayush", tags=["AYUSH & Integrative Medicine"])

class PrakritiAssessmentRequest(BaseModel):
    patient_id: str
    thermal_preference: str  # "cold_sensitive" (Vata), "heat_sensitive" (Pitta), "tolerant" (Kapha)
    sleep_pattern: str       # "light_interrupted" (Vata), "moderate" (Pitta), "deep_heavy" (Kapha)
    digestion_type: str      # "irregular_gas" (Vishama/Vata), "sharp_acidic" (Tikshna/Pitta), "slow_heavy" (Manda/Kapha)
    body_frame: str          # "lean_thin" (Vata), "medium_muscular" (Pitta), "broad_heavy" (Kapha)
    chief_complaint: Optional[str] = ""

@router.post("/prakriti")
async def calculate_prakriti(req: PrakritiAssessmentRequest):
    """
    Calculates patient Prakriti (Vata, Pitta, Kapha constitutional scores)
    and Dashavidha Pariksha parameters for Ministry of Ayush.
    """
    scores = {"Vata": 0, "Pitta": 0, "Kapha": 0}

    # 1. Thermal preference
    if "cold" in req.thermal_preference.lower(): scores["Vata"] += 30
    elif "heat" in req.thermal_preference.lower(): scores["Pitta"] += 35
    else: scores["Kapha"] += 25

    # 2. Sleep pattern
    if "light" in req.sleep_pattern.lower(): scores["Vata"] += 25
    elif "moderate" in req.sleep_pattern.lower(): scores["Pitta"] += 25
    else: scores["Kapha"] += 30

    # 3. Digestion / Agni
    agni_type = "Sama Agni (Balanced)"
    if "irregular" in req.digestion_type.lower() or "gas" in req.digestion_type.lower():
        scores["Vata"] += 30
        agni_type = "Vishama Agni (Irregular/Vata)"
    elif "acidic" in req.digestion_type.lower() or "sharp" in req.digestion_type.lower():
        scores["Pitta"] += 30
        agni_type = "Tikshna Agni (Hyperactive/Pitta)"
    else:
        scores["Kapha"] += 25
        agni_type = "Manda Agni (Sluggish/Kapha)"

    # 4. Body frame
    if "thin" in req.body_frame.lower() or "lean" in req.body_frame.lower(): scores["Vata"] += 15
    elif "medium" in req.body_frame.lower(): scores["Pitta"] += 15
    else: scores["Kapha"] += 20

    total = sum(scores.values()) or 1
    percentages = {k: round((v / total) * 100) for k, v in scores.items()}

    sorted_doshas = sorted(percentages.items(), key=lambda x: x[1], reverse=True)
    primary_dosha = sorted_doshas[0][0]
    secondary_dosha = sorted_doshas[1][0]
    prakriti_title = f"{primary_dosha}-{secondary_dosha} Prakriti ({primary_dosha} {percentages[primary_dosha]}%, {secondary_dosha} {percentages[secondary_dosha]}%)"

    # Dashavidha Pariksha Analysis
    dashavidha = {
        "Dushya": "Rasa, Rakta, Mamsa (Tissues involved)",
        "Desha": "Sadharana Desha (Temperate plain / plateau)",
        "Bala": "Madhyama Bala (Moderate physical strength & resilience)",
        "Kala": "Sharad / Grishma vulnerability (Seasonal influence)",
        "Agni": agni_type,
        "Prakriti": prakriti_title,
        "Vaya": "Madhyama Vaya (Adult stage: 20-60 years)",
        "Sattva": "Madhyama Sattva (Balanced psychological endurance)",
        "Satmya": "Mishra Satmya (Adapted to regional mixed grains and pulses)",
        "Ahara_Shakti": "Good appetite with moderate metabolic capacity"
    }

    # Pathya - Apathya (Do's & Don'ts) tailored to complaint and dosha
    cc_lower = (req.chief_complaint or "").lower()
    if "chest" in cc_lower or "heart" in cc_lower:
        pathya = [
            "Arjuna bark decoction (Arjunarishta) with warm water",
            "Garlic (Lashuna) infused in milk",
            "Pomegranate, amla, and soaked almonds",
            "Mild pranayama (Anulom Vilom) and light walking"
        ]
        apathya = [
            "Heavy oily, deep-fried food (Guru Ahara)",
            "Excessive salt and spicy red chili (Lavana & Katu)",
            "Daytime sleeping (Diva Swapna) and night-time staying awake (Ratri Jagarana)",
            "Mental strain and sudden strenuous exertion (Shrama)"
        ]
    elif "fever" in cc_lower or "temperature" in cc_lower:
        pathya = [
            "Giloy (Guduchi) kwatha / fresh decoction",
            "Warm ginger-coriander water (Shunthi-Dhanyaka)",
            "Moong dal khichdi with roasted cumin",
            "Complete physical bed rest (Vishrama)"
        ]
        apathya = [
            "Heavy dairy, curd, and cold drinks (Shita Ahara)",
            "Hard-to-digest heavy meals",
            "Direct cold air and bath with cold water",
            "Suppression of natural urges (Vega Dharana)"
        ]
    elif "stomach" in cc_lower or "diarrhea" in cc_lower or "vomit" in cc_lower:
        pathya = [
            "Buttermilk with roasted cumin and dry ginger (Takra)",
            "Boiled water cooled to room temperature with mint",
            "Pomegranate juice and rice gruel (Peya)",
            "Bilva (Bael) fruit syrup"
        ]
        apathya = [
            "Raw salads, green leafy vegetables, and outside street food",
            "Fermented foods and carbonated drinks",
            "Late night dinners and spicy masala items",
            "Over-eating (Atyashana)"
        ]
    else:
        pathya = [
            "Freshly cooked warm meals with cow's ghee",
            "Triphala with warm water at bedtime",
            "Regular sleep routine (7-8 hours night sleep)",
            "Daily 20-minute gentle yogic stretches and walking"
        ]
        apathya = [
            "Stale, refrigerated, processed junk foods (Paryushita Ahara)",
            "Incompatible food combinations (Viruddha Ahara like milk with citrus)",
            "Irregular meal timings (Vishamashana)",
            "Excessive stress and sedentary lifestyle"
        ]

    return {
        "success": True,
        "patient_id": req.patient_id,
        "prakriti": prakriti_title,
        "dosha_percentages": percentages,
        "dashavidha_pariksha": dashavidha,
        "pathya": pathya,
        "apathya": apathya,
        "herbal_adjuncts": [
            {"herb": "Guduchi (Tinospora cordifolia)", "use": "Immunomodulator & Rasayana"},
            {"herb": "Arjuna (Terminalia arjuna)", "use": "Hridya - Cardiac tonic & vascular health"},
            {"herb": "Triphala", "use": "Digestive regulation & antioxidant support"}
        ]
    }
