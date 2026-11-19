from pydantic import BaseModel, Field, field_validator

class BootstrapRequest(BaseModel):
    bootstrap_secret: str = Field(min_length=1)
    email: str = Field(min_length=5, max_length=320)
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=12, max_length=128)
    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or value.startswith("@") or value.endswith("@"):
            raise ValueError("Enter a valid email address")
        return value

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    workspace_id: str
    role: str

from datetime import datetime
from typing import Literal

class PostVariantInput(BaseModel):
    platform: Literal["facebook", "instagram", "tiktok", "youtube", "whatsapp_channels", "telegram"]
    caption: str = Field(default="", max_length=10000)

class PostCreateRequest(BaseModel):
    status: Literal["draft", "scheduled"] = "draft"
    scheduled_at: datetime | None = None
    variants: list[PostVariantInput] = Field(min_length=1, max_length=6)

    @field_validator("scheduled_at")
    @classmethod
    def scheduled_time_must_be_future(cls, value):
        if value is not None:
            from datetime import timezone
            now = datetime.now(timezone.utc)
            comparable = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
            if comparable <= now:
                raise ValueError("Scheduled time must be in the future")
        return value

    @field_validator("status")
    @classmethod
    def scheduled_posts_need_time(cls, value, info):
        return value

class PostVariantResponse(BaseModel):
    id: str
    platform: str
    caption: str

class PostResponse(BaseModel):
    id: str
    status: str
    scheduled_at: datetime | None
    created_at: datetime
    variants: list[PostVariantResponse]
