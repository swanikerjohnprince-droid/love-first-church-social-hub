from pydantic import BaseModel, Field

class TelegramConnectRequest(BaseModel):
    bot_token: str = Field(min_length=20, max_length=512)
    channel_id: str = Field(min_length=2, max_length=128)

