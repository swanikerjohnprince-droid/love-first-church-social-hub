import json
from cryptography.fernet import Fernet, InvalidToken
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.integration_schemas import TelegramConnectRequest
from app.models import Membership, SocialAccount, User

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])

PLATFORMS = [
    ("facebook", "Facebook", "oauth"),
    ("instagram", "Instagram", "oauth"),
    ("tiktok", "TikTok", "oauth"),
    ("youtube", "YouTube", "oauth"),
    ("whatsapp_channels", "WhatsApp Channels", "manual_setup"),
    ("telegram", "Telegram", "bot_token"),
]

def _workspace(db: Session, user: User):
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not membership:
        raise HTTPException(status_code=403, detail="No workspace membership")
    return membership.workspace_id

def _fernet() -> Fernet:
    key = settings.credentials_encryption_key
    if not key:
        raise HTTPException(status_code=503, detail="Social account encryption is not configured. Set CREDENTIALS_ENCRYPTION_KEY on the backend.")
    try:
        return Fernet(key.encode("utf-8"))
    except Exception:
        raise HTTPException(status_code=503, detail="CREDENTIALS_ENCRYPTION_KEY must be a valid Fernet key.")

async def _telegram_call(token: str, method: str, params: dict | None = None):
    url = f"https://api.telegram.org/bot{token}/{method}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, params=params or {})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(status_code=502, detail="Could not reach the Telegram Bot API. Please try again.")
    if not payload.get("ok"):
        description = payload.get("description", "Telegram rejected the request.")
        raise HTTPException(status_code=422, detail=f"Telegram: {description}")
    return payload.get("result")

@router.get("")
def list_integrations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace_id = _workspace(db, user)
    rows = db.scalars(select(SocialAccount).where(SocialAccount.workspace_id == workspace_id)).all()
    by_platform = {row.platform: row for row in rows}
    return {
        "integrations": [
            {
                "key": key,
                "name": name,
                "connection": by_platform[key].connection_status if key in by_platform else fallback,
                "account_name": by_platform[key].account_name if key in by_platform else None,
            }
            for key, name, fallback in PLATFORMS
        ]
    }

@router.post("/telegram/connect")
async def connect_telegram(
    payload: TelegramConnectRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace_id = _workspace(db, user)
    bot = await _telegram_call(payload.bot_token.strip(), "getMe")
    if not bot.get("is_bot"):
        raise HTTPException(status_code=422, detail="The supplied Telegram account is not a bot.")
    chat = await _telegram_call(payload.bot_token.strip(), "getChat", {"chat_id": payload.channel_id.strip()})
    member = await _telegram_call(
        payload.bot_token.strip(),
        "getChatMember",
        {"chat_id": payload.channel_id.strip(), "user_id": bot["id"]},
    )
    if member.get("status") not in {"administrator", "creator"}:
        raise HTTPException(status_code=422, detail="Add this bot as an administrator of your Telegram channel before connecting it.")
    if member.get("status") == "administrator" and not member.get("can_post_messages", False):
        raise HTTPException(status_code=422, detail="The bot is an administrator but does not have permission to post messages.")
    encrypted = _fernet().encrypt(json.dumps({
        "bot_token": payload.bot_token.strip(),
        "chat_id": str(chat.get("id", payload.channel_id.strip())),
    }).encode("utf-8")).decode("ascii")
    account = db.scalar(select(SocialAccount).where(
        SocialAccount.workspace_id == workspace_id,
        SocialAccount.platform == "telegram",
    ))
    if account is None:
        account = SocialAccount(
            workspace_id=workspace_id,
            platform="telegram",
        )
        db.add(account)
    account.account_name = chat.get("title") or chat.get("username") or "Telegram channel"
    account.external_account_id = str(chat.get("id", payload.channel_id.strip()))
    account.connection_status = "connected"
    account.credentials_reference = encrypted
    db.commit()
    return {
        "key": "telegram",
        "connection": "connected",
        "account_name": account.account_name,
        "message": "Telegram channel connected. The bot token is encrypted before it is stored.",
    }

@router.delete("/telegram")
def disconnect_telegram(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace_id = _workspace(db, user)
    account = db.scalar(select(SocialAccount).where(
        SocialAccount.workspace_id == workspace_id,
        SocialAccount.platform == "telegram",
    ))
    if account:
        account.connection_status = "not_connected"
        account.credentials_reference = None
        account.external_account_id = None
        account.account_name = None
        db.commit()
    return {"key": "telegram", "connection": "not_connected"}
