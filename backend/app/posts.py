import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import AuditLog, Membership, Post, PostVariant, User
from app.schemas import PostCreateRequest, PostResponse, PostVariantResponse

router = APIRouter(prefix="/api/v1/posts", tags=["posts"])

def _workspace_id(db: Session, user: User):
    membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
    if not membership:
        raise HTTPException(status_code=403, detail="No workspace membership")
    return membership.workspace_id

def _serialize(post: Post, variants: list[PostVariant]) -> PostResponse:
    return PostResponse(
        id=str(post.id),
        status=post.status,
        scheduled_at=post.scheduled_at,
        created_at=post.created_at,
        variants=[PostVariantResponse(id=str(v.id), platform=v.platform, caption=v.caption) for v in variants],
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
    result = []
    for post in posts:
        variants = db.scalars(select(PostVariant).where(PostVariant.post_id == post.id)).all()
        result.append(_serialize(post, variants))
    return result

@router.post("", response_model=PostResponse, status_code=201)
def create_post(
    payload: PostCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace_id = _workspace_id(db, user)
    if payload.status == "scheduled" and payload.scheduled_at is None:
        raise HTTPException(status_code=422, detail="Scheduled posts need a scheduled_at value")
    if payload.status == "draft" and payload.scheduled_at is not None:
        raise HTTPException(status_code=422, detail="Draft posts cannot have a scheduled_at value")
    platforms = [variant.platform for variant in payload.variants]
    if len(platforms) != len(set(platforms)):
        raise HTTPException(status_code=422, detail="Each platform can only appear once per post")
    post = Post(
        workspace_id=workspace_id,
        created_by=user.id,
        status=payload.status,
        scheduled_at=payload.scheduled_at,
    )
    db.add(post)
    db.flush()
    variants = [
        PostVariant(post_id=post.id, platform=item.platform, caption=item.caption)
        for item in payload.variants
    ]
    db.add_all(variants)
    db.add(AuditLog(
        workspace_id=workspace_id,
        actor_user_id=user.id,
        action="post.created",
        target_type="post",
        target_id=str(post.id),
        details=json.dumps({"status": post.status, "platforms": platforms}),
    ))
    db.commit()
    db.refresh(post)
    for variant in variants:
        db.refresh(variant)
    return _serialize(post, variants)
