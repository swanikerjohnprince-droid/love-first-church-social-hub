from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "LFC Social Hub API"
    environment: str = "development"
    frontend_origin: str = "http://localhost:5173"
    database_url: str = "postgresql+psycopg://lfc:lfc_dev_password@localhost:5432/lfc_social_hub"
    jwt_secret: str = "development-only-change-this-secret"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    bootstrap_secret: str = ""
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

settings = Settings()
