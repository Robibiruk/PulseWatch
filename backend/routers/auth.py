from datetime import timezone
from fastapi import BackgroundTasks
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import User
from auth import (
    hash_password, verify_password, create_access_token, get_current_user,
)
from schemas import UserCreate, UserOut, Token
import emailer
import notifications
import os

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token)
async def register(
    payload: UserCreate,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    # Welcome email (best-effort, off the request path)
    background.add_task(_send_signup_email, user.email, user.full_name)
    return Token(access_token=create_access_token(str(user.id)))


async def _send_signup_email(email: str, name: str) -> None:
    subject, html, text = emailer.signup_welcome(name or email.split("@")[0])
    await notifications._send_email_html(subject, html, text, email)


@router.post("/token", response_model=Token)
async def login(
    background: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    # The form's `username` field carries the user's email (OAuth2 convention).
    user = (await db.execute(select(User).where(User.email == form_data.username))).scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WW-Authenticate": "Bearer"},
        )
    # New sign-in notice (best-effort, off the request path)
    client_ip = os.environ.get("CLIENT_IP")
    background.add_task(_send_login_email, user.email, user.full_name, client_ip)
    return Token(access_token=create_access_token(str(user.id)))


async def _send_login_email(email: str, name: str, ip: str | None) -> None:
    subject, html, text = emailer.login_notice(name or email.split("@")[0], ip=ip)
    await notifications._send_email_html(subject, html, text, email)


@router.get("/me", response_model=UserOut)
async def me(current: User = Depends(get_current_user)):
    return current


@router.get("/onboarding")
async def check_onboarding(current: User = Depends(get_current_user)):
    """Returns whether the user needs to complete plan selection (first login)."""
    return {"needs_onboarding": current.plan == "free" and not current.telegram_chat_id}


@router.post("/plan")
async def set_plan(body: dict, current: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Set user plan (called by bot after payment, or directly for free tier)."""
    plan = body.get("plan", "free")
    if plan not in ("free", "pro", "team"):
        raise HTTPException(status_code=400, detail="Invalid plan")
    current.plan = plan
    await db.commit()
    return {"ok": True, "plan": plan}


# ── GitHub OAuth ────────────────────────────────────────────────────────
GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


@router.get("/github/login")
async def github_login():
    """Redirect the user to GitHub's OAuth consent screen."""
    if not settings.github_client_id:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured on this server")
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": f"{settings.public_base_url_clean}/auth/github/callback",
        "scope": "user:email",
        "state": "pulsewatch",
    }
    return RedirectResponse(f"{GITHUB_AUTHORIZE}?{urlencode(params)}")


@router.get("/github/callback")
async def github_callback(code: str = "", state: str = "", db: AsyncSession = Depends(get_db)):
    """Exchange the code for a token, find/create the user, redirect to the frontend with a JWT."""
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code from GitHub")
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured on this server")

    # Exchange authorization code for access token
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/login?error=github_auth_failed")

        # Fetch GitHub user info
        user_resp = await client.get(
            GITHUB_USER_URL,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        gh_user = user_resp.json()
        email = gh_user.get("email")
        if not email:
            # Primary email may be private — fetch from /user/emails
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            for e in emails_resp.json():
                if e.get("primary"):
                    email = e["email"]
                    break
            if not email:
                email = f"{gh_user.get('login', 'user')}@github.local"

    name = gh_user.get("name") or gh_user.get("login") or email.split("@")[0]
    avatar = gh_user.get("avatar_url") or ""

    # Find or create the user
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(
            email=email,
            full_name=name,
            hashed_password=hash_password(os.urandom(16).hex()),  # no password for OAuth users
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    jwt_token = create_access_token(str(user.id))
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}/login?token={jwt_token}")
