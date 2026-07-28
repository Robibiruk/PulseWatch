from datetime import timezone
from fastapi import BackgroundTasks

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
