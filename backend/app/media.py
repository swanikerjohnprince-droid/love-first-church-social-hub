import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import MediaAsset, Membership, User

router = APIRouter(prefix="/api/v1/media", tags=["media"])
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", "./media")).resolve()
MAX_BYTES = 100 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/quicktime",
}

def current_workspace(db: Session, user: User):
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not membership:
        raise HTTPException(status_code=403, detail="No workspace membership")
    return membership.workspace_id

@router.post("", status_code=201)
async def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, WebP, GIF, MP4 or MOV file")
    workspace_id = current_workspace(db, user)
    asset_id = uuid.uuid4()
    suffix = Path(file.filename or "").suffix.lower()[:12]
    storage_key = f"{workspace_id}/{asset_id}{suffix}"
    destination = (MEDIA_ROOT / storage_key).resolve()
    if MEDIA_ROOT not in destination.parents:
        raise HTTPException(status_code=400, detail="Invalid file path")
    destination.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(status_code=413, detail="Each upload must be 100 MB or smaller")
                output.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="The selected file is empty")
        asset = MediaAsset(
            id=asset_id, workspace_id=workspace_id,
            original_name=(file.filename or "upload")[:255],
            storage_key=storage_key, mime_type=file.content_type,
            size_bytes=size, uploaded_by=user.id,
        )
        db.add(asset)
        db.commit()
        return {
            "id": str(asset.id), "name": asset.original_name,
            "mime_type": asset.mime_type, "size_bytes": asset.size_bytes,
        }
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

@router.get("/{asset_id}/file")
def get_media_file(
    asset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace_id = current_workspace(db, user)
    asset = db.scalar(select(MediaAsset).where(
        MediaAsset.id == asset_id, MediaAsset.workspace_id == workspace_id
    ))
    if not asset:
        raise HTTPException(status_code=404, detail="Media file not found")
    path = (MEDIA_ROOT / asset.storage_key).resolve()
    if MEDIA_ROOT not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Media file is unavailable")
    return FileResponse(path, media_type=asset.mime_type, filename=asset.original_name)
