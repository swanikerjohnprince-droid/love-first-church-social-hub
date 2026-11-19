import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import AuditLog, MediaAsset, Membership, Post, PostMedia, PostVariant, User
from app.schemas import PostCreateRequest, PostResponse, PostVariantResponse

router = APIRouter(prefix="/api/v1/posts", tags=["posts"])

def _workspace_id(db: Session, user: User):
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not membership:
        raise HTTPException(status_code=403, detail="No workspace membership")
    return membership.workspace_id

def _serialize(post: Post, variants: list[PostVariant], db: Session) -> PostResponse:
    output = []
    for variant in variants:
        links = db.scalars(
            select(PostMedia).where(PostMedia.post_variant_id == variant.id).order_by(PostMedia.position)
        ).all()
        output.append(PostVariantResponse(
            id=str(variant.id), platform=variant.platform, caption=variant.caption,
            media_asset_ids=[str(link.media_asset_id) for link in links],
            options=variant.platform_options or {},
        ))
    return PostResponse(
        id=str(post.id), status=post.status, scheduled_at=post.scheduled_at,
        created_at=post.created_at, variants=output,
    )

@router.get("", response_model=list[PostResponse])
def list_posts(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace_id = _workspace_id(db, user)
    posts = db.scalars(
        select(Post).where(Post.workspace_id == workspace_id)
        .order_by(Post.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return [
        _serialize(post, db.scalars(select(PostVariant).where(PostVariant.post_id == post.id)).all(), db)
        for post in posts
    ]

@router.post("", response_model=PostResponse, status_code=201)
def create_post(
    payload: PostCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace_id = _workspace_id(db, user)
    platforms = [variant.platform for variant in payload.variants]
    if len(platforms) != len(set(platforms)):
        raise HTTPException(status_code=422, detail="Each platform can only appear once per post")
    post = Post(
        workspace_id=workspace_id, created_by=user.id,
        status=payload.status, scheduled_at=payload.scheduled_at,
    )
    db.add(post)
    db.flush()
    variants = []
    for item in payload.variants:
        try:
            asset_ids = [uuid.UUID(value) for value in item.media_asset_ids]
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid media asset ID")
        if len(asset_ids) != len(set(asset_ids)):
            raise HTTPException(status_code=422, detail="Duplicate media attachments are not allowed")
        if asset_ids:
            assets = db.scalars(select(MediaAsset).where(
                MediaAsset.workspace_id == workspace_id, MediaAsset.id.in_(asset_ids)
            )).all()
            if len(assets) != len(asset_ids):
                raise HTTPException(status_code=404, detail="One or more media files were not found in this workspace")
        variant = PostVariant(
            post_id=post.id, platform=item.platform, caption=item.caption,
            platform_options=item.options,
        )
        db.add(variant)
        db.flush()
        variants.append(variant)
        for position, asset_id in enumerate(asset_ids):
            db.add(PostMedia(post_variant_id=variant.id, media_asset_id=asset_id, position=position))
    db.add(AuditLog(
        workspace_id=workspace_id, actor_user_id=user.id,
        action="post.created", target_type="post", target_id=str(post.id),
        details=json.dumps({"status": post.status, "platforms": platforms}),
    ))
    db.commit()
    db.refresh(post)
    for variant in variants:
        db.refresh(variant)
    return _serialize(post, variants, db)
