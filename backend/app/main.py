from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "LFC Social Hub API"
    environment: str = "development"
    frontend_origin: str = "http://localhost:5173"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
app = FastAPI(title=settings.app_name, version="0.1.0", description="Love First Church social media workspace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "lfc-social-hub-api", "environment": settings.environment, "version": "0.1.0"}

@app.get("/api/v1/workspace", tags=["workspace"])
async def get_workspace():
    return {
        "name": "Love First Church",
        "timezone": "Africa/Accra",
        "platforms": [
            {"key": "facebook", "name": "Facebook", "connection": "not_connected"},
            {"key": "instagram", "name": "Instagram", "connection": "not_connected"},
            {"key": "tiktok", "name": "TikTok", "connection": "not_connected"},
            {"key": "youtube", "name": "YouTube", "connection": "not_connected"},
            {"key": "whatsapp_channels", "name": "WhatsApp Channels", "connection": "manual_setup"},
            {"key": "telegram", "name": "Telegram", "connection": "not_connected"},
        ],
    }
