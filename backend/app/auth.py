import secrets
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import AuditLog, Membership, User, Workspace
from app.schemas import BootstrapRequest, LoginRequest, TokenResponse, UserResponse
from app.security import create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
bearer = HTTPBearer(auto_error=False)

@router.post("/bootstrap", response_model=TokenResponse, status_code=201)
def bootstrap(payload: BootstrapRequest, db: Session = Depends(get_db)):
    if not settings.bootstrap_secret or not secrets.compare_digest(payload.bootstrap_secret, settings.bootstrap_secret):
        raise HTTPException(status_code=403, detail="Bootstrap is not authorised")
    if db.scalar(select(func.count()).select_from(User)):
        raise HTTPException(status_code=409, detail="Initial owner has already been created")
    user = User(email=payload.email, full_name=payload.full_name, password_hash=hash_password(payload.password))
    workspace = Workspace(name="Love First Church", timezone="Africa/Accra")
    db.add_all([user, workspace])
    db.flush()
    db.add(Membership(user_id=user.id, workspace_id=workspace.id, role="owner"))
    db.add(AuditLog(workspace_id=workspace.id, actor_user_id=user.id, action="workspace.bootstrap", target_type="workspace"))
    db.commit()
    return TokenResponse(access_token=create_access_token(str(user.id)), expires_in=settings.access_token_minutes * 60)

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect", headers={"WWW-Authenticate": "Bearer"})
    return TokenResponse(access_token=create_access_token(str(user.id)), expires_in=settings.access_token_minutes * 60)

def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    subject = decode_access_token(credentials.credentials)
    try:
        user_id = uuid.UUID(subject) if subject else None
    except ValueError:
        user_id = None
    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired session", headers={"WWW-Authenticate": "Bearer"})
    return user

@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not membership:
        raise HTTPException(status_code=403, detail="No workspace membership")
    return UserResponse(id=str(user.id), email=user.email, full_name=user.full_name, workspace_id=str(membership.workspace_id), role=membership.role)
