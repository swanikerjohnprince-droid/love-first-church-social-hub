from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user, router as auth_router
from app.config import settings
from app.database import get_db
from app.models import Membership, SocialAccount, User, Workspace
from app.posts import router as posts_router

app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="Love First Church social media workspace API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(posts_router)

@app.get("/health", tags=["system"])
async def health():
    return {
        "status": "ok",
        "service": "lfc-social-hub-api",
        "environment": settings.environment,
        "version": "0.2.0",
    }

@app.get("/api/v1/workspace", tags=["workspace"])
def get_workspace(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not membership:
        raise HTTPException(status_code=403, detail="No workspace membership")
    workspace = db.get(Workspace, membership.workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    accounts = db.scalars(select(SocialAccount).where(SocialAccount.workspace_id == workspace.id)).all()
    account_by_platform = {account.platform: account for account in accounts}
    platforms = []
    for key, name in [
        ("facebook", "Facebook"),
        ("instagram", "Instagram"),
        ("tiktok", "TikTok"),
        ("youtube", "YouTube"),
        ("whatsapp_channels", "WhatsApp Channels"),
        ("telegram", "Telegram"),
    ]:
        account = account_by_platform.get(key)
        platforms.append({
            "key": key,
            "name": name,
            "connection": account.connection_status if account else ("manual_setup" if key == "whatsapp_channels" else "not_connected"),
        })
    return {"id": str(workspace.id), "name": workspace.name, "timezone": workspace.timezone, "role": membership.role, "platforms": platforms}
