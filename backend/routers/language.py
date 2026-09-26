"""
Swasya AI — Language Router
Provides REST API endpoints for 14 Indian languages, translation, ASR, and TTS.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from backend.bhashini_service import AI4BharatService, SUPPORTED_LANGUAGES

router = APIRouter(prefix="/api/language", tags=["Language & Indic AI"])

class TranslationRequest(BaseModel):
    text: str = Field(..., description="Text to translate")
    source_language: str = Field("en", description="Source language code (e.g. en, hi, kn)")
    target_language: str = Field("hi", description="Target language code (e.g. en, hi, kn)")

class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to convert to speech")
    language: str = Field("hi", description="Language code")
    gender: Optional[str] = Field("female", description="male or female")

@router.get("/supported")
async def get_supported_languages():
    """Returns all 14 supported Indian languages with native scripts and speech codes."""
    return {
        "count": len(SUPPORTED_LANGUAGES),
        "languages": AI4BharatService.get_supported_languages(),
        "ai4bharat_configured": AI4BharatService.is_configured()
    }

@router.get("/status")
async def get_language_engine_status():
    """Checks the status of the Indic language translation & speech engines."""
    return {
        "status": "ready",
        "ai4bharat_active": AI4BharatService.is_configured(),
        "supported_language_count": len(SUPPORTED_LANGUAGES),
        "pipeline_cached_count": len(AI4BharatService._pipeline_cache if hasattr(AI4BharatService, '_pipeline_cache') else {})
    }

@router.post("/translate")
async def translate_text(req: TranslationRequest):
    """Translate clinical or patient intake text between any of the 14 Indian languages."""
    if not req.text.strip():
        return {"translated_text": "", "source": req.source_language, "target": req.target_language}

    result = AI4BharatService.translate(
        text=req.text,
        source_lang=req.source_language,
        target_lang=req.target_language
    )
    return result

@router.post("/asr")
async def speech_to_text_endpoint(
    language: str = Form("hi"),
    file: UploadFile = File(...)
):
    """Automatic Speech Recognition (ASR) via AI 4 Bharat Indic-Transcribe/IndicWhisper."""
    audio_content = await file.read()
    if not audio_content:
        raise HTTPException(status_code=400, detail="Empty audio file provided")

    result = AI4BharatService.speech_to_text(audio_bytes=audio_content, language=language)
    return result

@router.post("/tts")
async def text_to_speech_endpoint(req: TTSRequest):
    """Text to speech synthesis via AI 4 Bharat Indic-TTS."""
    result = AI4BharatService.text_to_speech(text=req.text, language=req.language, gender=req.gender or "female")
    return result