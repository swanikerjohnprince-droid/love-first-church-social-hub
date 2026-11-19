import json
import secrets
from urllib.parse import urlencode
import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.integration_schemas import TelegramConnectRequest
from app.models import Membership, SocialAccount, User

router = APIRouter(prefix="/api/v1/integrations", tags=["integrations"])
PLATFORMS = [("facebook","Facebook","oauth"),("instagram","Instagram","oauth"),("tiktok","TikTok","oauth"),("youtube","YouTube","oauth"),("whatsapp_channels","WhatsApp Channels","manual_setup"),("telegram","Telegram","bot_token")]
META_SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish"
TIKTOK_SCOPES = "user.info.basic,video.publish,video.upload"
GOOGLE_SCOPES = "openid email https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload"

def _workspace(db, user):
    m=db.scalar(select(Membership).where(Membership.user_id==user.id))
    if not m: raise HTTPException(403,"No workspace membership")
    return m.workspace_id

def _fernet():
    if not settings.credentials_encryption_key: raise HTTPException(503,"Social account encryption is not configured.")
    try: return Fernet(settings.credentials_encryption_key.encode())
    except Exception: raise HTTPException(503,"CREDENTIALS_ENCRYPTION_KEY must be a valid Fernet key.")

def _save(db,wid,platform,name,eid,credentials):
    row=db.scalar(select(SocialAccount).where(SocialAccount.workspace_id==wid,SocialAccount.platform==platform))
    if row is None: row=SocialAccount(workspace_id=wid,platform=platform); db.add(row)
    row.account_name=(name or platform.title())[:160]; row.external_account_id=str(eid)[:200]
    row.connection_status="connected"
    row.credentials_reference=_fernet().encrypt(json.dumps(credentials).encode()).decode("ascii")

def _serializer(): return URLSafeTimedSerializer(settings.jwt_secret,salt="lfc-social-oauth-v1")
def _callback(platform):
    if not settings.api_public_url: raise HTTPException(503,"Set API_PUBLIC_URL in Render.")
    return settings.api_public_url.rstrip("/")+"/api/v1/integrations/"+platform+"/callback"

@router.get("")
def list_integrations(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    wid=_workspace(db,user); rows=db.scalars(select(SocialAccount).where(SocialAccount.workspace_id==wid)).all()
    found={r.platform:r for r in rows}
    return {"integrations":[{"key":k,"name":n,"connection":found[k].connection_status if k in found else fallback,"account_name":found[k].account_name if k in found else None} for k,n,fallback in PLATFORMS]}

@router.post("/{platform}/oauth/start")
def oauth_start(platform:str,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    wid=_workspace(db,user); cb=_callback(platform)
    state=_serializer().dumps({"platform":platform,"user_id":str(user.id),"workspace_id":str(wid),"nonce":secrets.token_urlsafe(16)})
    if platform in ("facebook","instagram"):
        if not settings.meta_app_id or not settings.meta_app_secret: raise HTTPException(503,"Configure META_APP_ID and META_APP_SECRET in Render.")
        params={"client_id":settings.meta_app_id,"redirect_uri":cb,"state":state,"response_type":"code","scope":META_SCOPES}
        url="https://www.facebook.com/v27.0/dialog/oauth?"+urlencode(params)
    elif platform=="tiktok":
        if not settings.tiktok_client_key or not settings.tiktok_client_secret: raise HTTPException(503,"Configure TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Render.")
        params={"client_key":settings.tiktok_client_key,"redirect_uri":cb,"state":state,"response_type":"code","scope":TIKTOK_SCOPES}
        url="https://www.tiktok.com/v2/auth/authorize/?"+urlencode(params)
    elif platform=="youtube":
        if not settings.google_client_id or not settings.google_client_secret: raise HTTPException(503,"Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render.")
        params={"client_id":settings.google_client_id,"redirect_uri":cb,"response_type":"code","scope":GOOGLE_SCOPES,"access_type":"offline","prompt":"consent","state":state}
        url="https://accounts.google.com/o/oauth2/v2/auth?"+urlencode(params)
    else: raise HTTPException(404,"OAuth is not available for this platform.")
    return {"authorization_url":url}

async def _form(url,data):
    async with httpx.AsyncClient(timeout=25) as c:
        r=await c.post(url,data=data); r.raise_for_status(); return r.json()
async def _get(url,token,params=None):
    async with httpx.AsyncClient(timeout=25) as c:
        r=await c.get(url,params=params,headers={"Authorization":"Bearer "+token}); r.raise_for_status(); return r.json()

@router.get("/{platform}/callback")
async def oauth_callback(platform:str,code:str|None=None,state:str|None=None,error:str|None=None,db:Session=Depends(get_db)):
    def done(status):
        return RedirectResponse(settings.frontend_origin.rstrip("/")+"/?oauth="+status+"&platform="+platform,status_code=303)
    if error or not code or not state: return done("denied" if error else "invalid")
    try: data=_serializer().loads(state,max_age=600)
    except (BadSignature,SignatureExpired): return done("invalid")
    if data.get("platform")!=platform: return done("invalid")
    user=db.get(User,data.get("user_id"))
    member=db.scalar(select(Membership).where(Membership.user_id==data.get("user_id"),Membership.workspace_id==data.get("workspace_id")))
    if not user or not user.is_active or not member: return done("invalid")
    try:
        cb=_callback(platform); wid=data["workspace_id"]
        if platform in ("facebook","instagram"):
            async with httpx.AsyncClient(timeout=25) as c:
                r=await c.get("https://graph.facebook.com/v27.0/oauth/access_token",params={"client_id":settings.meta_app_id,"client_secret":settings.meta_app_secret,"redirect_uri":cb,"code":code})
                r.raise_for_status(); short=r.json()["access_token"]
                r=await c.get("https://graph.facebook.com/v27.0/oauth/access_token",params={"grant_type":"fb_exchange_token","client_id":settings.meta_app_id,"client_secret":settings.meta_app_secret,"fb_exchange_token":short})
                r.raise_for_status(); long=r.json()
            token=long["access_token"]
            pages=await _get("https://graph.facebook.com/v27.0/me/accounts",token,{"fields":"id,name,access_token,instagram_business_account"})
            if not pages.get("data"): return done("no_accounts")
            for page in pages["data"]:
                pt=page.get("access_token",token)
                _save(db,wid,"facebook",page.get("name","Facebook Page"),page["id"],{"provider":"meta","access_token":pt,"page_id":page["id"],"expires_in":long.get("expires_in")})
                ig=page.get("instagram_business_account")
                if ig and ig.get("id"):
                    profile=await _get("https://graph.facebook.com/v27.0/"+ig["id"],pt,{"fields":"id,username,name"})
                    _save(db,wid,"instagram",profile.get("username") or "Instagram Professional",ig["id"],{"provider":"meta","access_token":pt,"instagram_user_id":ig["id"],"page_id":page["id"],"expires_in":long.get("expires_in")})
            db.commit(); return done("success")
        if platform=="tiktok":
            t=await _form("https://open.tiktokapis.com/v2/oauth/token/",{"client_key":settings.tiktok_client_key,"client_secret":settings.tiktok_client_secret,"code":code,"grant_type":"authorization_code","redirect_uri":cb})
            profile=await _get("https://open.tiktokapis.com/v2/user/info/",t["access_token"],{"fields":"open_id,display_name"})
            u=profile.get("data",{}).get("user",{})
            _save(db,wid,"tiktok",u.get("display_name","TikTok account"),t.get("open_id") or u.get("open_id",""),{"provider":"tiktok",**t})
            db.commit(); return done("success")
        if platform=="youtube":
            t=await _form("https://oauth2.googleapis.com/token",{"code":code,"client_id":settings.google_client_id,"client_secret":settings.google_client_secret,"redirect_uri":cb,"grant_type":"authorization_code"})
            channels=await _get("https://www.googleapis.com/youtube/v3/channels",t["access_token"],{"part":"snippet","mine":"true"})
            ch=(channels.get("items") or [None])[0]
            if not ch: return done("no_accounts")
            _save(db,wid,"youtube",ch["snippet"].get("title","YouTube channel"),ch["id"],{"provider":"google",**t,"channel_id":ch["id"]})
            db.commit(); return done("success")
    except (httpx.HTTPError,KeyError,ValueError,TypeError):
        db.rollback(); return done("failed")
    return done("invalid")

@router.delete("/{platform}")
def disconnect(platform:str,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    if platform not in [x[0] for x in PLATFORMS]: raise HTTPException(404,"Unknown platform")
    wid=_workspace(db,user); targets=("facebook","instagram") if platform in ("facebook","instagram") else (platform,)
    for key in targets:
        row=db.scalar(select(SocialAccount).where(SocialAccount.workspace_id==wid,SocialAccount.platform==key))
        if row: row.connection_status="not_connected"; row.credentials_reference=None; row.external_account_id=None; row.account_name=None
    db.commit(); return {"key":platform,"connection":"not_connected"}

async def _telegram(token,method,params=None):
    async with httpx.AsyncClient(timeout=15) as c:
        r=await c.get("https://api.telegram.org/bot"+token+"/"+method,params=params or {})
        r.raise_for_status(); p=r.json()
    if not p.get("ok"): raise HTTPException(422,"Telegram rejected the bot or channel details.")
    return p["result"]

@router.post("/telegram/connect")
async def connect_telegram(payload:TelegramConnectRequest,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    wid=_workspace(db,user); bot=await _telegram(payload.bot_token.strip(),"getMe")
    chat=await _telegram(payload.bot_token.strip(),"getChat",{"chat_id":payload.channel_id.strip()})
    if not bot.get("is_bot") or chat.get("type")!="channel": raise HTTPException(422,"Provide a valid bot and channel.")
    member=await _telegram(payload.bot_token.strip(),"getChatMember",{"chat_id":payload.channel_id.strip(),"user_id":bot["id"]})
    if member.get("status") not in ("administrator","creator") or (member.get("status")=="administrator" and not member.get("can_post_messages",False)):
        raise HTTPException(422,"The bot needs channel administrator permission to post.")
    _save(db,wid,"telegram",chat.get("title","Telegram channel"),chat.get("id",payload.channel_id),{"bot_token":payload.bot_token.strip(),"chat_id":str(chat.get("id",payload.channel_id))})
    db.commit()
    return {"key":"telegram","connection":"connected","account_name":chat.get("title"),"message":"Telegram channel connected; credentials encrypted."}
