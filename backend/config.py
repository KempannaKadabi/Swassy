import os
from pathlib import Path
from dotenv import load_dotenv

# Base project directory
BASE_DIR = Path(__file__).resolve().parent.parent
env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(env_file, override=True)

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
SECRET_KEY = os.getenv("SECRET_KEY", "swasya-ai-secure-secret-key")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/swasya_ai')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'swasya_ai')

UPLOAD_DIR = os.getenv("UPLOAD_DIR", str(BASE_DIR / "backend" / "data" / "uploads"))
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

# AI API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "groq/compound-mini").strip()
GROK_API_KEY = (os.getenv("GROK_API_KEY", "") or os.getenv("XAI_API_KEY", "")).strip()
GROK_MODEL = os.getenv("GROK_MODEL", "grok-2-latest").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
AWS_REGION = os.getenv("AWS_DEFAULT_REGION", "ap-south-1").strip()

# AI 4 Bharat Indic Language API
AI4BHARAT_USER_ID = os.getenv("AI4BHARAT_USER_ID", "").strip()
AI4BHARAT_API_KEY = os.getenv("AI4BHARAT_API_KEY", "").strip()
AI4BHARAT_PIPELINE_ENDPOINT = os.getenv("AI4BHARAT_PIPELINE_ENDPOINT", "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline").strip()

# Hugging Face Inference API for Disease Detection
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "").strip()
HUGGINGFACE_MODEL = os.getenv("HUGGINGFACE_MODEL", "Arko007/skin-disease-detector-ai").strip()
