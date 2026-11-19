from pydantic import model_validator
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
    credentials_encryption_key: str = ""
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.environment.lower() == "production":
            if len(self.jwt_secret) < 32 or self.jwt_secret == "development-only-change-this-secret":
                raise ValueError("JWT_SECRET must be a unique random value of at least 32 characters in production")
            if len(self.bootstrap_secret) < 24:
                raise ValueError("BOOTSTRAP_SECRET must be at least 24 characters in production")
        return self

settings = Settings()
