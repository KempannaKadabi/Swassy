from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

router = APIRouter(prefix="/api/ayush", tags=["Ministry of Ayush Integrative Medicine"])

class AyushAssessRequest(BaseModel):
    thermal_preference: Optional[str] = "moderate"
    appetite_nature: Optional[str] = "moderate"
    sleep_pattern: Optional[str] = "normal"
    chief_complaint: Optional[str] = ""

@router.get("/prakriti-questions")
async def get_prakriti_questions():
    return {
        "questions": [
            {
                "id": "thermal_preference",
                "question": "Thermal Preference / Climate Sensitivity",
                "options": [
                    {"label": "Sensitive to cold, prefers warm environment", "dosha": "Vata"},
                    {"label": "Sensitive to heat, excessive thirst, prefers cool environment", "dosha": "Pitta"},
                    {"label": "Comfortable in most seasons, dislikes damp cold", "dosha": "Kapha"}
                ]
            },
            {
                "id": "appetite_nature",
                "question": "Appetite & Digestive Pattern (Agni)",
                "options": [
                    {"label": "Irregular appetite, frequent gas or bloating (Vishama Agni)", "dosha": "Vata"},
                    {"label": "Sharp intense hunger, acidity/burning if meal skipped (Tikshna Agni)", "dosha": "Pitta"},
                    {"label": "Slow steady appetite, heavy digestion, can skip meals comfortably (Manda Agni)", "dosha": "Kapha"}
                ]
            },
            {
                "id": "sleep_pattern",
                "question": "Sleep Quality & Patterns",
                "options": [
                    {"label": "Light, easily disturbed sleep, tendency for insomnia", "dosha": "Vata"},
                    {"label": "Moderate sound sleep (6-7 hrs), waking feeling energetic", "dosha": "Pitta"},
                    {"label": "Deep, heavy, prolonged sleep, difficulty waking up", "dosha": "Kapha"}
                ]
            }
        ]
    }

@router.post("/assess")
async def assess_ayush_profile(req: AyushAssessRequest):
    """
    Calculates Prakriti constitution, Dashavidha Pariksha, and Pathya-Apathya 
    (Ministry of Ayush Integrative Module).
    """
    v_score = 0
    p_score = 0
    k_score = 0

    t = (req.thermal_preference or "").lower()
    if "cold" in t or "warm" in t: v_score += 2
    elif "heat" in t or "cool" in t: p_score += 2
    else: k_score += 2

    a = (req.appetite_nature or "").lower()
    if "irregular" in a or "gas" in a or "bloat" in a: v_score += 2
    elif "sharp" in a or "acid" in a or "burn" in a: p_score += 2
    else: k_score += 2

    s = (req.sleep_pattern or "").lower()
    if "light" in s or "disturb" in s: v_score += 2
    elif "moderate" in s: p_score += 2
    else: k_score += 2

    if v_score >= p_score and v_score >= k_score:
        prakriti = "Vata-Predominant (Vataja Prakriti)"
        agni = "Vishama Agni (Irregular Digestive Capacity)"
    elif p_score >= v_score and p_score >= k_score:
        prakriti = "Pitta-Predominant (Pittaja Prakriti)"
        agni = "Tikshna Agni (Hyperactive / Acidic Digestive Capacity)"
    else:
        prakriti = "Kapha-Predominant (Kaphaja Prakriti)"
        agni = "Manda Agni (Slow / Sluggish Digestive Capacity)"

    c_lower = (req.chief_complaint or "").lower()
    if any(k in c_lower for k in ["chest", "heart", "pressure", "ಎದೆ", "छाती"]):
        pathya = [
            "Arjuna Kshirapaka (Terminalia arjuna bark medicated milk decoction)",
            "Lasuna (garlic in moderation) with warm meals",
            "Mudga Yusha (light warm green gram soup with cumin)",
            "Ushnodaka (boiled warm water throughout the day)"
        ]
        apathya = [
            "Ati-Snigdha (excessively oily, fried, or fast foods)",
            "Guru Ahara (heavy, hard-to-digest meals late at night)",
            "Manasika Shoka & Krodha (mental anxiety and acute anger)",
            "Vegadharana (suppression of natural bodily urges)"
        ]
        dushya = "Rasa, Rakta, and Mamsa Dhatus; Hridaya Srotas"
    elif any(k in c_lower for k in ["fever", "temperature", "bukhar", "ಜ್ವರ", "ताप"]):
        pathya = [
            "Shadanga Paniya (Herbal medicated water with Musta and Chandana)",
            "Laja Manda (warm puffed-rice water with a pinch of dry ginger)",
            "Light warm moong dal soup",
            "Vishrama (complete physical and mental rest)"
        ]
        apathya = [
            "Snana (heavy bathing during high febrile spikes)",
            "Diva-svapna (sleeping during the day)",
            "Dugdha, Dadhi (raw milk and curd)",
            "Vyayama (physical exertion or walking in wind)"
        ]
        dushya = "Rasa Dhatu and Swedavaha Srotas (Sweat channels)"
    elif any(k in c_lower for k in ["stomach", "diarrhea", "vomit", "loose", "ಹೊಟ್ಟೆ", "पोट"]):
        pathya = [
            "Takra (fresh spiced buttermilk with roasted cumin and rock salt)",
            "Dadima (fresh pomegranate fruit / juice)",
            "Vilepi (thick warm rice gruel)",
            "Shunthi Jala (water boiled with dry ginger)"
        ]
        apathya = [
            "Guru & Vidahi Ahara (spicy pickles, street food, oily gravy)",
            "Cold unboiled water and carbonated drinks",
            "Ati-bhojana (overeating while digestion is weak)"
        ]
        dushya = "Annavaha and Purishavaha Srotas (GI tract)"
    else:
        pathya = [
            "Warm, freshly cooked seasonal meals",
            "Ushnodaka (boiled water)",
            "Adequate rest and timely sleep before 10 PM"
        ]
        apathya = [
            "Viruddhahara (incompatible food combinations)",
            "Late night meals and heavy sleep deprivation",
            "Excessive sedentary habits"
        ]
        dushya = "Rasa Dhatu"

    return {
        "success": True,
        "prakriti": prakriti,
        "dashavidha_pariksha": {
            "Dushya": dushya,
            "Desha": "Sadharana Desha (Habitation in moderate climatic zone)",
            "Bala": "Madhyama Bala (Moderate constitutional strength)",
            "Kala": "Transitional seasonal vulnerability (Sharad / Varsha Ritu)",
            "Agni": agni,
            "Koshtha": "Madhyama Koshtha",
            "Satmya": "Mishra Ahara Satmya (Mixed dietary habituation)"
        },
        "pathya": pathya,
        "apathya": apathya,
        "summary": f"Identified {prakriti} with {agni}. Evaluated under Ayush Dashavidha Pariksha standards."
    }
