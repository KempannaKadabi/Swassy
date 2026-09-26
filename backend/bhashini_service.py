"""
Swasya AI — AI 4 Bharat Indic Language Integration Service
Supports 14+ Indian languages for Machine Translation (NMT), Automatic Speech Recognition (ASR), and Text-to-Speech (TTS).
Uses AI 4 Bharat ULCA Pipeline API with caching, and intelligent fallback for local offline inference.
"""

import json
import logging
import base64
import requests
from typing import Dict, Any, Optional, List
from backend import config

logger = logging.getLogger("swasya.ai4bharat")

# 14 Supported Languages with native names, ISO codes, speech recognition locales, and script mapping
SUPPORTED_LANGUAGES = {
    "en": {
        "code": "en",
        "name": "English",
        "native": "English",
        "icon": "🇬🇧",
        "speech_code": "en-IN",
        "ai4bharat_code": "en"
    },
    "hi": {
        "code": "hi",
        "name": "Hindi",
        "native": "हिन्दी",
        "icon": "🇮🇳",
        "speech_code": "hi-IN",
        "ai4bharat_code": "hi"
    },
    "kn": {
        "code": "kn",
        "name": "Kannada",
        "native": "ಕನ್ನಡ",
        "icon": "🟡🔴",
        "speech_code": "kn-IN",
        "ai4bharat_code": "kn"
    },
    "mr": {
        "code": "mr",
        "name": "Marathi",
        "native": "मराठी",
        "icon": "🚩",
        "speech_code": "mr-IN",
        "ai4bharat_code": "mr"
    },
    "ta": {
        "code": "ta",
        "name": "Tamil",
        "native": "தமிழ்",
        "icon": "🏛️",
        "speech_code": "ta-IN",
        "ai4bharat_code": "ta"
    },
    "te": {
        "code": "te",
        "name": "Telugu",
        "native": "తెలుగు",
        "icon": "📿",
        "speech_code": "te-IN",
        "ai4bharat_code": "te"
    },
    "bn": {
        "code": "bn",
        "name": "Bengali",
        "native": "বাংলা",
        "icon": "🌸",
        "speech_code": "bn-IN",
        "ai4bharat_code": "bn"
    },
    "gu": {
        "code": "gu",
        "name": "Gujarati",
        "native": "ગુજરાતી",
        "icon": "🦁",
        "speech_code": "gu-IN",
        "ai4bharat_code": "gu"
    },
    "ml": {
        "code": "ml",
        "name": "Malayalam",
        "native": "മലയാളം",
        "icon": "🌴",
        "speech_code": "ml-IN",
        "ai4bharat_code": "ml"
    },
    "pa": {
        "code": "pa",
        "name": "Punjabi",
        "native": "ਪੰਜਾਬੀ",
        "icon": "🌾",
        "speech_code": "pa-IN",
        "ai4bharat_code": "pa"
    },
    "or": {
        "code": "or",
        "name": "Odia",
        "native": "ଓଡ଼ିଆ",
        "icon": "🏯",
        "speech_code": "or-IN",
        "ai4bharat_code": "or"
    },
    "as": {
        "code": "as",
        "name": "Assamese",
        "native": "অসমীয়া",
        "icon": "🍵",
        "speech_code": "as-IN",
        "ai4bharat_code": "as"
    },
    "ur": {
        "code": "ur",
        "name": "Urdu",
        "native": "اردو",
        "icon": "🕌",
        "speech_code": "ur-IN",
        "ai4bharat_code": "ur"
    },
    "sa": {
        "code": "sa",
        "name": "Sanskrit",
        "native": "संस्कृतम्",
        "icon": "📜",
        "speech_code": "sa-IN",
        "ai4bharat_code": "sa"
    }
}

# Cache for AI 4 Bharat pipeline configurations to minimize round-trips
_pipeline_cache: Dict[str, Any] = {}

class AI4BharatService:
    """Interface to AI 4 Bharat ULCA APIs for Indic Speech & Language Processing"""

    @classmethod
    def is_configured(cls) -> bool:
        return bool(config.AI4BHARAT_USER_ID and config.AI4BHARAT_API_KEY)

    @classmethod
    def get_supported_languages(cls) -> List[Dict[str, Any]]:
        return list(SUPPORTED_LANGUAGES.values())

    @classmethod
    def get_pipeline(cls, task_type: str, source_lang: str, target_lang: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Negotiate pipeline capabilities with AI 4 Bharat ULCA endpoint.
        task_type: 'translation', 'asr', 'tts'
        """
        if not cls.is_configured():
            return None

        cache_key = f"{task_type}_{source_lang}_{target_lang}"
        if cache_key in _pipeline_cache:
            return _pipeline_cache[cache_key]

        payload = {
            "pipelineTasks": [
                {
                    "taskType": task_type,
                    "config": {
                        "language": {
                            "sourceLanguage": source_lang
                        }
                    }
                }
            ],
            "pipelineRequestConfig": {
                "pipelineId": "64392f96daac500b55c543d6"
            }
        }

        if target_lang and task_type == "translation":
            payload["pipelineTasks"][0]["config"]["language"]["targetLanguage"] = target_lang

        headers = {
            "userID": config.AI4BHARAT_USER_ID,
            "ulcaApiKey": config.AI4BHARAT_API_KEY,
            "Content-Type": "application/json"
        }

        try:
            resp = requests.post(config.AI4BHARAT_PIPELINE_ENDPOINT, json=payload, headers=headers, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                _pipeline_cache[cache_key] = data
                return data
            else:
                logger.warning(f"AI 4 Bharat pipeline negotiation failed: {resp.status_code} - {resp.text}")
                return None
        except Exception as e:
            logger.error(f"Error querying AI 4 Bharat pipeline endpoint: {e}")
            return None

    @classmethod
    def translate(cls, text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
        """
        Translates text between Indic languages.
        If AI 4 Bharat API is available, calls AI 4 Bharat NMT / Bodhan-Translate.
        Otherwise falls back to Groq/Gemini Indic translation or echo if source == target.
        """
        if not text or not text.strip():
            return {"translated_text": text, "source": source_lang, "target": target_lang, "provider": "noop"}

        if source_lang == target_lang:
            return {"translated_text": text, "source": source_lang, "target": target_lang, "provider": "identity"}

        # 1. Try AI 4 Bharat API if configured
        if cls.is_configured():
            pipeline = cls.get_pipeline("translation", source_lang, target_lang)
            if pipeline and "pipelineInferenceAPIEndPoint" in pipeline:
                try:
                    endpoint = pipeline["pipelineInferenceAPIEndPoint"]["callbackUrl"]
                    auth_header = pipeline["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]["value"]
                    service_id = pipeline["pipelineResponseConfig"][0]["config"][0]["serviceId"]

                    inf_payload = {
                        "pipelineTasks": [
                            {
                                "taskType": "translation",
                                "config": {
                                    "language": {
                                        "sourceLanguage": source_lang,
                                        "targetLanguage": target_lang
                                    },
                                    "serviceId": service_id
                                }
                            }
                        ],
                        "inputData": {
                            "input": [{"source": text}]
                        }
                    }

                    resp = requests.post(endpoint, json=inf_payload, headers={"Authorization": auth_header, "Content-Type": "application/json"}, timeout=8)
                    if resp.status_code == 200:
                        res_data = resp.json()
                        out_text = res_data["pipelineResponse"][0]["output"][0]["target"]
                        return {
                            "translated_text": out_text,
                            "source": source_lang,
                            "target": target_lang,
                            "provider": "ai4bharat"
                        }
                except Exception as e:
                    logger.warning(f"AI 4 Bharat translation inference failed: {e}")

        # 2. Try LLM translation (Groq or Gemini) if available
        llm_trans = cls._translate_via_llm(text, source_lang, target_lang)
        if llm_trans:
            return {
                "translated_text": llm_trans,
                "source": source_lang,
                "target": target_lang,
                "provider": "llm"
            }

        # 3. Fallback
        return {
            "translated_text": text,
            "source": source_lang,
            "target": target_lang,
            "provider": "fallback"
        }

    @classmethod
    def speech_to_text(cls, audio_bytes: bytes, language: str) -> Dict[str, Any]:
        """
        Transcribes audio bytes to text using AI 4 Bharat ASR (Indic-Transcribe / IndicWhisper).
        """
        if cls.is_configured():
            pipeline = cls.get_pipeline("asr", language)
            if pipeline and "pipelineInferenceAPIEndPoint" in pipeline:
                try:
                    endpoint = pipeline["pipelineInferenceAPIEndPoint"]["callbackUrl"]
                    auth_header = pipeline["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]["value"]
                    service_id = pipeline["pipelineResponseConfig"][0]["config"][0]["serviceId"]

                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    inf_payload = {
                        "pipelineTasks": [
                            {
                                "taskType": "asr",
                                "config": {
                                    "language": {"sourceLanguage": language},
                                    "serviceId": service_id,
                                    "audioFormat": "wav"
                                }
                            }
                        ],
                        "inputData": {
                            "audio": [{"audioContent": audio_b64}]
                        }
                    }
                    resp = requests.post(endpoint, json=inf_payload, headers={"Authorization": auth_header, "Content-Type": "application/json"}, timeout=12)
                    if resp.status_code == 200:
                        res_data = resp.json()
                        transcript = res_data["pipelineResponse"][0]["output"][0]["source"]
                        return {
                            "transcript": transcript,
                            "language": language,
                            "provider": "ai4bharat"
                        }
                except Exception as e:
                    logger.warning(f"AI 4 Bharat ASR failed: {e}")

        return {
            "transcript": "",
            "language": language,
            "provider": "browser_fallback_recommended",
            "message": "Use client-side Web Speech API or provide AI 4 Bharat API credentials."
        }

    @classmethod
    def text_to_speech(cls, text: str, language: str, gender: str = "female") -> Dict[str, Any]:
        """
        Synthesizes text to speech using AI 4 Bharat Indic-TTS.
        Returns base64 encoded audio content.
        """
        if cls.is_configured():
            pipeline = cls.get_pipeline("tts", language)
            if pipeline and "pipelineInferenceAPIEndPoint" in pipeline:
                try:
                    endpoint = pipeline["pipelineInferenceAPIEndPoint"]["callbackUrl"]
                    auth_header = pipeline["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]["value"]
                    service_id = pipeline["pipelineResponseConfig"][0]["config"][0]["serviceId"]

                    inf_payload = {
                        "pipelineTasks": [
                            {
                                "taskType": "tts",
                                "config": {
                                    "language": {"sourceLanguage": language},
                                    "serviceId": service_id,
                                    "gender": gender
                                }
                            }
                        ],
                        "inputData": {
                            "input": [{"source": text[:250]}]
                        }
                    }
                    resp = requests.post(endpoint, json=inf_payload, headers={"Authorization": auth_header, "Content-Type": "application/json"}, timeout=10)
                    if resp.status_code == 200:
                        res_data = resp.json()
                        audio_b64 = res_data["pipelineResponse"][0]["audio"][0]["audioContent"]
                        return {
                            "audio_base64": audio_b64,
                            "audio_format": "wav",
                            "language": language,
                            "provider": "ai4bharat"
                        }
                except Exception as e:
                    logger.warning(f"AI 4 Bharat TTS failed: {e}")

        # 2. Universal gTTS Fallback (supports Hindi, Kannada, Marathi, English, etc.)
        try:
            from gtts import gTTS
            import io
            lang_lower = (language or "hi").lower()
            if "kannada" in lang_lower or "kn" in lang_lower:
                lang_code = "kn"
            elif "marathi" in lang_lower or "mr" in lang_lower:
                lang_code = "mr"
            elif "hindi" in lang_lower or "hi" in lang_lower:
                lang_code = "hi"
            elif "english" in lang_lower or "en" in lang_lower:
                lang_code = "en"
            else:
                lang_code = lang_lower[:2]

            tts = gTTS(text=text[:350], lang=lang_code, slow=False)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            buf.seek(0)
            audio_b64 = base64.b64encode(buf.read()).decode("utf-8")
            return {
                "audio_base64": audio_b64,
                "audio_format": "mp3",
                "language": lang_code,
                "provider": "gtts"
            }
        except Exception as e:
            logger.warning(f"gTTS fallback note: {e}")

        return {
            "audio_base64": None,
            "language": language,
            "provider": "browser_speech_synthesis_fallback",
            "message": "Use client-side SpeechSynthesis API"
        }

    @classmethod
    def _translate_via_llm(cls, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """Helper to translate text via Groq (LLaMA 3.3) or Gemini for quick accurate Indian language translation."""
        source_name = SUPPORTED_LANGUAGES.get(source_lang, {}).get("name", source_lang)
        target_name = SUPPORTED_LANGUAGES.get(target_lang, {}).get("name", target_lang)

        prompt = f"""You are an expert medical interpreter in India. Translate the following text from {source_name} to {target_name}.
Output ONLY the direct natural translation in the native script of {target_name}. Do NOT add explanations, notes, or quotes.

Text to translate:
{text}"""

        # Try Groq
        if config.GROQ_API_KEY:
            try:
                headers = {"Authorization": f"Bearer {config.GROQ_API_KEY}", "Content-Type": "application/json"}
                body = {
                    "model": config.GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a professional medical translator for Indian languages."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 512
                }
                res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=body, timeout=7)
                if res.status_code == 200:
                    ans = res.json()["choices"][0]["message"]["content"].strip()
                    if ans:
                        return ans
            except Exception as e:
                logger.debug(f"Groq translation fallback error: {e}")

        # Try Gemini
        if config.GEMINI_API_KEY:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{config.GEMINI_MODEL}:generateContent?key={config.GEMINI_API_KEY}"
                body = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 512}
                }
                res = requests.post(url, json=body, timeout=7)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        ans = candidates[0]["content"]["parts"][0]["text"].strip()
                        if ans:
                            return ans
            except Exception as e:
                logger.debug(f"Gemini translation fallback error: {e}")

        return None
