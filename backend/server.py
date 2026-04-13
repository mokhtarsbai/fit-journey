from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import hashlib
import secrets
import jwt
import bcrypt
import io
import asyncio
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Privacy Policy Version (CNDP Compliance)
CURRENT_PRIVACY_VERSION = "2.0-CNDP-2025"
CURRENT_TERMS_VERSION = "2.0-2025"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== SECURITY HELPERS ==============

def hash_email(email: str) -> str:
    """Hash email for secure storage (one-way)"""
    return hashlib.sha256(email.lower().encode()).hexdigest()

def hash_password(password: str) -> str:
    """Hash password with bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(user_id: str, expires_delta: timedelta = None) -> str:
    """Create JWT access token"""
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode = {
        "sub": user_id,
        "exp": expire,
        "type": "access",
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    """Create JWT refresh token"""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
        "jti": secrets.token_hex(16)  # Unique token ID
    }
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== MODELS ==============

class User(BaseModel):
    user_id: str
    email: str
    email_hash: Optional[str] = None  # Hashed email for security
    name: str
    picture: Optional[str] = None
    role: str = "client"
    bio: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    disciplines: List[str] = []
    hourly_rate: Optional[float] = None
    rating: float = 0.0
    total_reviews: int = 0
    credits: float = 0.0
    badges: List[str] = []
    certifications: List[str] = []
    is_verified: bool = False
    total_points: int = 0
    # New auth fields
    auth_methods: List[str] = []  # ["google", "apple", "email"]
    social_unique_ids: dict = {}  # {"google": "xxx", "apple": "yyy"}
    password_hash: Optional[str] = None  # For email auth
    last_login: Optional[datetime] = None
    privacy_consent_version: Optional[str] = None
    terms_consent_version: Optional[str] = None
    consent_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    disciplines: Optional[List[str]] = None
    hourly_rate: Optional[float] = None
    role: Optional[str] = None

class AuthResponse(BaseModel):
    user: dict
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class EmailAuthRequest(BaseModel):
    email: EmailStr
    password: str
    consent_accepted: bool = False

class EmailRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    consent_accepted: bool = True

class SocialAuthRequest(BaseModel):
    provider: str  # "google" or "apple"
    session_id: Optional[str] = None  # For Emergent Auth
    id_token: Optional[str] = None  # For Apple
    consent_accepted: bool = True

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class Session(BaseModel):
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex[:12]}")
    coach_id: str
    client_id: str
    discipline: str
    date: datetime
    duration_minutes: int = 60
    status: str = "pending"
    location: Optional[str] = None
    notes: Optional[str] = None
    price: float = 0.0
    from_pack: bool = False
    pack_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionCreate(BaseModel):
    coach_id: str
    discipline: str
    date: str
    duration_minutes: int = 60
    location: Optional[str] = None
    notes: Optional[str] = None
    use_credits: bool = False

class Pack(BaseModel):
    pack_id: str = Field(default_factory=lambda: f"pack_{uuid.uuid4().hex[:12]}")
    client_id: str
    coach_id: str
    discipline: str
    total_sessions: int
    remaining_sessions: int
    original_price: float
    discounted_price: float
    discount_percent: float = 15.0
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PackCreate(BaseModel):
    coach_id: str
    discipline: str
    total_sessions: int = 10
    validity_days: int = 90

class Event(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    title: str
    description: str
    discipline: str
    location: str
    city: str
    date: datetime
    price: float
    max_participants: int
    current_participants: int = 0
    image_url: Optional[str] = None
    organizer_id: str
    buddy_finder_enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventCreate(BaseModel):
    title: str
    description: str
    discipline: str
    location: str
    city: str
    date: str
    price: float
    max_participants: int
    image_url: Optional[str] = None

class EventRegistration(BaseModel):
    registration_id: str = Field(default_factory=lambda: f"reg_{uuid.uuid4().hex[:12]}")
    event_id: str
    user_id: str
    status: str = "confirmed"
    payment_status: str = "completed"
    looking_for_buddy: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Story(BaseModel):
    story_id: str = Field(default_factory=lambda: f"story_{uuid.uuid4().hex[:12]}")
    coach_id: str
    coach_name: str
    coach_picture: Optional[str] = None
    media_url: str
    media_type: str = "video"
    caption: Optional[str] = None
    views: int = 0
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StoryCreate(BaseModel):
    media_url: str
    media_type: str = "video"
    caption: Optional[str] = None

class Message(BaseModel):
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    sender_id: str
    receiver_id: str
    content: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    receiver_id: str
    content: str

class Wallet(BaseModel):
    wallet_id: str = Field(default_factory=lambda: f"wallet_{uuid.uuid4().hex[:12]}")
    user_id: str
    balance: float = 0.0
    currency: str = "MAD"
    transactions: List[dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Challenge(BaseModel):
    challenge_id: str = Field(default_factory=lambda: f"chlg_{uuid.uuid4().hex[:12]}")
    title: str
    description: str
    discipline: str
    points_reward: int
    start_date: datetime
    end_date: datetime
    participants: List[str] = []
    submissions: List[dict] = []
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChallengeCreate(BaseModel):
    title: str
    description: str
    discipline: str
    points_reward: int
    duration_days: int = 30
    image_url: Optional[str] = None

class ChallengeSubmission(BaseModel):
    video_url: str
    comment: Optional[str] = None

class Progress(BaseModel):
    progress_id: str = Field(default_factory=lambda: f"prog_{uuid.uuid4().hex[:12]}")
    user_id: str
    date: datetime
    weight: Optional[float] = None
    calories: Optional[int] = None
    activity_minutes: Optional[int] = None
    sessions_completed: int = 0
    steps: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProgressCreate(BaseModel):
    date: Optional[str] = None
    weight: Optional[float] = None
    calories: Optional[int] = None
    activity_minutes: Optional[int] = None
    steps: Optional[int] = None
    notes: Optional[str] = None

class SocialPost(BaseModel):
    post_id: str = Field(default_factory=lambda: f"post_{uuid.uuid4().hex[:12]}")
    author_id: str
    author_name: str
    author_picture: Optional[str] = None
    content: str
    media_type: str = "text"
    media_url: Optional[str] = None
    likes: List[str] = []
    comments_count: int = 0
    challenge_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SocialPostCreate(BaseModel):
    content: str
    media_type: str = "text"
    media_url: Optional[str] = None
    challenge_id: Optional[str] = None

class Comment(BaseModel):
    comment_id: str = Field(default_factory=lambda: f"cmt_{uuid.uuid4().hex[:12]}")
    post_id: str
    author_id: str
    author_name: str
    author_picture: Optional[str] = None
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommentCreate(BaseModel):
    content: str

class Review(BaseModel):
    review_id: str = Field(default_factory=lambda: f"rev_{uuid.uuid4().hex[:12]}")
    coach_id: str
    client_id: str
    client_name: str
    rating: int
    comment: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    coach_id: str
    rating: int
    comment: str

class JournalEntry(BaseModel):
    entry_id: str = Field(default_factory=lambda: f"jrn_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    content: str
    mood: str = "good"
    discipline: Optional[str] = None
    duration_minutes: Optional[int] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JournalEntryCreate(BaseModel):
    title: str
    content: str
    mood: str = "good"
    discipline: Optional[str] = None
    duration_minutes: Optional[int] = None
    date: Optional[str] = None

class Report(BaseModel):
    report_id: str = Field(default_factory=lambda: f"rpt_{uuid.uuid4().hex[:12]}")
    reporter_id: str
    reported_content_type: str
    reported_content_id: str
    reason: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReportCreate(BaseModel):
    content_type: str
    content_id: str
    reason: str

# ============== AUTH HELPERS ==============

async def get_current_user(request: Request) -> User:
    """Get current user from JWT token or session"""
    token = None
    
    # Try Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    
    # Fall back to cookie
    if not token:
        token = request.cookies.get("session_token") or request.cookies.get("access_token")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Try JWT decode first
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id:
            user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user_doc:
                return User(**user_doc)
    except HTTPException:
        pass

    # Fall back to session lookup
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)

async def get_optional_user(request: Request) -> Optional[User]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

async def find_or_merge_user(email: str, provider: str, social_id: str, name: str, picture: str = None) -> dict:
    """Find existing user by email or social ID, merge accounts if needed"""
    
    # Check by social ID first
    user_doc = await db.users.find_one({f"social_unique_ids.{provider}": social_id}, {"_id": 0})
    
    if user_doc:
        # Update last login
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$set": {
                "last_login": datetime.now(timezone.utc),
                "name": name,
                "picture": picture or user_doc.get("picture")
            }}
        )
        return user_doc
    
    # Check by email for account merging
    user_doc = await db.users.find_one({"email": email.lower()}, {"_id": 0})
    
    if user_doc:
        # Merge: Add new provider to existing account
        auth_methods = user_doc.get("auth_methods", [])
        if provider not in auth_methods:
            auth_methods.append(provider)
        
        social_ids = user_doc.get("social_unique_ids", {})
        social_ids[provider] = social_id
        
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$set": {
                "auth_methods": auth_methods,
                "social_unique_ids": social_ids,
                "last_login": datetime.now(timezone.utc),
                "name": name,
                "picture": picture or user_doc.get("picture")
            }}
        )
        
        user_doc["auth_methods"] = auth_methods
        user_doc["social_unique_ids"] = social_ids
        return user_doc
    
    # Create new user
    return None

# ============== AUTH ROUTES ==============

async def _google_auth_internal(session_id: str, consent_accepted: bool, response: Response) -> dict:
    """Logique commune pour l'auth Google — appelée par /auth/google et /auth/session"""
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    if not consent_accepted:
        raise HTTPException(status_code=400, detail="Consent to privacy policy required")

    # Get user data from Emergent Auth
    async with httpx.AsyncClient() as http_client:
        auth_response = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )

        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")

        auth_data = auth_response.json()

    email = auth_data["email"].lower()
    name = auth_data.get("name", email.split("@")[0])
    picture = auth_data.get("picture")
    social_id = auth_data.get("sub") or hash_email(email)  # Use sub or hash email as unique ID

    # Find or merge user
    user_doc = await find_or_merge_user(email, "google", social_id, name, picture)

    if not user_doc:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "email_hash": hash_email(email),
            "name": name,
            "picture": picture,
            "role": "client",
            "credits": 0.0,
            "badges": [],
            "total_points": 0,
            "auth_methods": ["google"],
            "social_unique_ids": {"google": social_id},
            "last_login": datetime.now(timezone.utc),
            "privacy_consent_version": CURRENT_PRIVACY_VERSION,
            "terms_consent_version": CURRENT_TERMS_VERSION,
            "consent_date": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)

        # Create wallet
        wallet = Wallet(user_id=user_id)
        await db.wallets.insert_one(wallet.model_dump())

    user_id = user_doc["user_id"]

    # Generate tokens
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    # Store refresh token (invalidate all previous ones first)
    await db.refresh_tokens.delete_many({"user_id": user_id})
    await db.refresh_tokens.insert_one({
        "user_id": user_id,
        "token_hash": hashlib.sha256(refresh_token.encode()).hexdigest(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "created_at": datetime.now(timezone.utc)
    })

    # Also keep legacy session for backward compatibility
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": access_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })

    # Set cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    # Legacy cookie
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )

    # Clean user doc for response - remove sensitive fields and MongoDB _id
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    user_doc.pop("email_hash", None)

    return {
        "user": user_doc,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "session_token": access_token  # Legacy
    }


@api_router.post("/auth/google")
async def auth_google(request: Request, response: Response):
    """Google OAuth authentication via Emergent"""
    body = await request.json()
    return await _google_auth_internal(
        session_id=body.get("session_id"),
        consent_accepted=body.get("consent_accepted", False),
        response=response,
    )

@api_router.post("/auth/apple")
async def auth_apple(request: Request, response: Response):
    """Apple Sign-In authentication (MOCKED for MVP - requires Apple Developer Account)"""
    body = await request.json()
    id_token = body.get("id_token")
    consent_accepted = body.get("consent_accepted", False)
    name = body.get("name", "Apple User")
    email = body.get("email")
    
    if not consent_accepted:
        raise HTTPException(status_code=400, detail="Consent to privacy policy required")
    
    # In production: Verify Apple ID token with Apple's servers
    # For MVP: Accept the token and create/merge user
    
    if not email:
        # Apple may hide email - generate placeholder
        email = f"apple_{uuid.uuid4().hex[:8]}@private.appleid.com"
    
    social_id = body.get("apple_user_id") or hash_email(email)
    
    # Find or merge user
    user_doc = await find_or_merge_user(email.lower(), "apple", social_id, name)
    
    if not user_doc:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email.lower(),
            "email_hash": hash_email(email),
            "name": name,
            "role": "client",
            "credits": 0.0,
            "badges": [],
            "total_points": 0,
            "auth_methods": ["apple"],
            "social_unique_ids": {"apple": social_id},
            "last_login": datetime.now(timezone.utc),
            "privacy_consent_version": CURRENT_PRIVACY_VERSION,
            "terms_consent_version": CURRENT_TERMS_VERSION,
            "consent_date": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)
        
        wallet = Wallet(user_id=user_id)
        await db.wallets.insert_one(wallet.model_dump())
    
    user_id = user_doc["user_id"]
    
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    
    await db.refresh_tokens.insert_one({
        "user_id": user_id,
        "token_hash": hashlib.sha256(refresh_token.encode()).hexdigest(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "created_at": datetime.now(timezone.utc)
    })
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": access_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", path="/", max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", path="/", max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60)
    response.set_cookie(key="session_token", value=access_token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60)
    
    # Remove sensitive fields and MongoDB _id
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    user_doc.pop("email_hash", None)
    
    return {
        "user": user_doc,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "session_token": access_token
    }

@api_router.post("/auth/email/register")
async def register_email(data: EmailRegisterRequest, response: Response):
    """Register with email and password"""
    if not data.consent_accepted:
        raise HTTPException(status_code=400, detail="Consent to privacy policy required")
    
    # Check if email exists
    existing = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered. Try logging in or use social login.")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": data.email.lower(),
        "email_hash": hash_email(data.email),
        "name": data.name,
        "phone": data.phone,
        "role": "client",
        "credits": 0.0,
        "badges": [],
        "total_points": 0,
        "auth_methods": ["email"],
        "social_unique_ids": {},
        "password_hash": hash_password(data.password),
        "last_login": datetime.now(timezone.utc),
        "privacy_consent_version": CURRENT_PRIVACY_VERSION,
        "terms_consent_version": CURRENT_TERMS_VERSION,
        "consent_date": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_doc)
    
    wallet = Wallet(user_id=user_id)
    await db.wallets.insert_one(wallet.model_dump())
    
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    
    await db.refresh_tokens.insert_one({
        "user_id": user_id,
        "token_hash": hashlib.sha256(refresh_token.encode()).hexdigest(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "created_at": datetime.now(timezone.utc)
    })
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": access_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", path="/", max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", path="/", max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60)
    response.set_cookie(key="session_token", value=access_token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60)
    
    # Remove sensitive fields and MongoDB _id before returning
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    user_doc.pop("email_hash", None)
    
    return {
        "user": user_doc,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@api_router.post("/auth/email/login")
async def login_email(data: EmailAuthRequest, response: Response):
    """Login with email and password"""
    user_doc = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if "email" not in user_doc.get("auth_methods", []):
        # User registered via social, suggest that method
        methods = user_doc.get("auth_methods", [])
        raise HTTPException(
            status_code=400, 
            detail=f"This account uses {', '.join(methods)} login. Please use that method."
        )
    
    if not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = user_doc["user_id"]
    
    # Update last login
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )

    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    # Invalidate all previous refresh tokens before issuing a new one
    await db.refresh_tokens.delete_many({"user_id": user_id})
    await db.refresh_tokens.insert_one({
        "user_id": user_id,
        "token_hash": hashlib.sha256(refresh_token.encode()).hexdigest(),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "created_at": datetime.now(timezone.utc)
    })
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": access_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", path="/", max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", path="/", max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60)
    response.set_cookie(key="session_token", value=access_token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60)
    
    # Remove sensitive fields and MongoDB _id
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    user_doc.pop("email_hash", None)
    
    return {
        "user": user_doc,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@api_router.post("/auth/refresh")
async def refresh_tokens(data: RefreshTokenRequest, response: Response):
    """Refresh access token using refresh token"""
    try:
        payload = decode_token(data.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        token_hash = hashlib.sha256(data.refresh_token.encode()).hexdigest()
        
        # Verify refresh token exists and is valid
        stored_token = await db.refresh_tokens.find_one({
            "user_id": user_id,
            "token_hash": token_hash
        })
        
        if not stored_token:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        # Generate new tokens
        new_access_token = create_access_token(user_id)
        new_refresh_token = create_refresh_token(user_id)
        
        # Revoke old refresh token and store new one
        await db.refresh_tokens.delete_one({"token_hash": token_hash})
        await db.refresh_tokens.insert_one({
            "user_id": user_id,
            "token_hash": hashlib.sha256(new_refresh_token.encode()).hexdigest(),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            "created_at": datetime.now(timezone.utc)
        })
        
        # Update session
        await db.user_sessions.update_one(
            {"user_id": user_id},
            {"$set": {
                "session_token": new_access_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
            }}
        )
        
        response.set_cookie(key="access_token", value=new_access_token, httponly=True, secure=True, samesite="none", path="/", max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        response.set_cookie(key="refresh_token", value=new_refresh_token, httponly=True, secure=True, samesite="none", path="/", max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60)
        response.set_cookie(key="session_token", value=new_access_token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60)
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# Legacy endpoint for backward compatibility
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Legacy: Exchange session_id for session_token (redirects to Google auth)"""
    body = await request.json()
    return await _google_auth_internal(
        session_id=body.get("session_id"),
        consent_accepted=True,  # Assume consent for legacy calls
        response=response,
    )

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    user_dict = user.model_dump()
    user_dict.pop("password_hash", None)
    user_dict.pop("email_hash", None)
    return user_dict

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and invalidate tokens"""
    # Get tokens
    access_token = request.cookies.get("access_token") or request.cookies.get("session_token")
    refresh_token = request.cookies.get("refresh_token")
    
    if access_token:
        try:
            payload = decode_token(access_token)
            user_id = payload.get("sub")
            if user_id:
                await db.user_sessions.delete_many({"user_id": user_id})
        except:
            pass
    
    if refresh_token:
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        await db.refresh_tokens.delete_one({"token_hash": token_hash})
    
    # Clear cookies
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}

@api_router.get("/auth/privacy-policy")
async def get_privacy_policy():
    """Get current privacy policy (CNDP compliant)"""
    return {
        "version": CURRENT_PRIVACY_VERSION,
        "effective_date": "2025-01-01",
        "title": "Politique de Confidentialité - Fit Journey",
        "compliance": "CNDP (Commission Nationale de Contrôle de la Protection des Données à Caractère Personnel - Maroc)",
        "sections": [
            {
                "title": "Données collectées",
                "content": "Nous collectons votre nom, email, photo de profil (via Google/Apple) et données de fitness pour personnaliser votre expérience."
            },
            {
                "title": "Utilisation des données",
                "content": "Vos données sont utilisées pour la mise en relation avec les coachs, le suivi de progression et la personnalisation des recommandations."
            },
            {
                "title": "Stockage et sécurité",
                "content": "Toutes les données sont chiffrées (TLS 1.3) et stockées de manière sécurisée. Les mots de passe sont hachés avec bcrypt."
            },
            {
                "title": "Vos droits",
                "content": "Conformément à la loi CNDP, vous avez droit à l'accès, la rectification et la suppression de vos données."
            },
            {
                "title": "Contact DPO",
                "content": "Pour toute question: privacy@fitjourney.ma"
            }
        ]
    }

@api_router.get("/auth/terms")
async def get_terms():
    """Get current terms of service"""
    return {
        "version": CURRENT_TERMS_VERSION,
        "effective_date": "2025-01-01",
        "title": "Conditions Générales d'Utilisation - Fit Journey"
    }

# ============== USER ROUTES ==============

@api_router.put("/users/me")
async def update_user(update: UserUpdate, user: User = Depends(get_current_user)):
    update_data = update.model_dump(exclude_unset=True)
    if update_data:
        await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    user_doc.pop("password_hash", None)
    user_doc.pop("email_hash", None)
    return user_doc

@api_router.get("/users/{user_id}/badges")
async def get_user_badges(user_id: str):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"badges": user.get("badges", []), "total_points": user.get("total_points", 0)}

@api_router.delete("/users/me")
async def delete_account(user: User = Depends(get_current_user)):
    """Delete user account (CNDP right to deletion)"""
    user_id = user.user_id
    
    # Delete all user data
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.refresh_tokens.delete_many({"user_id": user_id})
    await db.wallets.delete_one({"user_id": user_id})
    await db.journal.delete_many({"user_id": user_id})
    await db.progress.delete_many({"user_id": user_id})
    await db.sessions.delete_many({"$or": [{"client_id": user_id}, {"coach_id": user_id}]})
    await db.social_posts.delete_many({"author_id": user_id})
    await db.messages.delete_many({"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]})
    
    return {"message": "Account deleted successfully"}

# ============== COACH ROUTES ==============

@api_router.get("/coaches")
async def get_coaches(
    city: Optional[str] = None,
    discipline: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_price: Optional[float] = None,
    verified_only: bool = False
):
    query = {"role": "coach"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if discipline:
        query["disciplines"] = discipline
    if min_rating:
        query["rating"] = {"$gte": min_rating}
    if max_price:
        query["hourly_rate"] = {"$lte": max_price}
    if verified_only:
        query["is_verified"] = True
    
    coaches = await db.users.find(query, {"_id": 0, "password_hash": 0, "email_hash": 0}).to_list(100)
    return coaches

@api_router.get("/coaches/{coach_id}")
async def get_coach(coach_id: str):
    coach = await db.users.find_one({"user_id": coach_id, "role": "coach"}, {"_id": 0, "password_hash": 0, "email_hash": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    reviews = await db.reviews.find({"coach_id": coach_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {**coach, "reviews": reviews}

# ============== Continue with remaining routes (stories, messages, sessions, etc.) ==============
# [Keeping all existing route implementations from previous version]

@api_router.get("/stories")
async def get_stories():
    now = datetime.now(timezone.utc)
    stories = await db.stories.find({"expires_at": {"$gt": now}}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    coaches_stories = {}
    for story in stories:
        coach_id = story["coach_id"]
        if coach_id not in coaches_stories:
            coaches_stories[coach_id] = {
                "coach_id": coach_id,
                "coach_name": story["coach_name"],
                "coach_picture": story.get("coach_picture"),
                "stories": []
            }
        coaches_stories[coach_id]["stories"].append(story)
    
    return list(coaches_stories.values())

@api_router.post("/stories")
async def create_story(story_data: StoryCreate, user: User = Depends(get_current_user)):
    if user.role != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can post stories")
    
    story = Story(
        coach_id=user.user_id,
        coach_name=user.name,
        coach_picture=user.picture,
        media_url=story_data.media_url,
        media_type=story_data.media_type,
        caption=story_data.caption
    )
    await db.stories.insert_one(story.model_dump())
    return story

@api_router.get("/messages/conversations")
async def get_conversations(user: User = Depends(get_current_user)):
    messages = await db.messages.find(
        {"$or": [{"sender_id": user.user_id}, {"receiver_id": user.user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    conversations = {}
    for msg in messages:
        partner_id = msg["receiver_id"] if msg["sender_id"] == user.user_id else msg["sender_id"]
        if partner_id not in conversations:
            partner = await db.users.find_one({"user_id": partner_id}, {"_id": 0, "password_hash": 0})
            conversations[partner_id] = {
                "partner_id": partner_id,
                "partner_name": partner["name"] if partner else "Unknown",
                "partner_picture": partner.get("picture") if partner else None,
                "last_message": msg["content"],
                "last_message_at": msg["created_at"],
                "unread_count": 0
            }
        if msg["receiver_id"] == user.user_id and not msg.get("read"):
            conversations[partner_id]["unread_count"] += 1
    
    return list(conversations.values())

@api_router.get("/messages/{partner_id}")
async def get_messages(partner_id: str, user: User = Depends(get_current_user)):
    messages = await db.messages.find(
        {"$or": [
            {"sender_id": user.user_id, "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": user.user_id}
        ]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    await db.messages.update_many(
        {"sender_id": partner_id, "receiver_id": user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    return messages

@api_router.post("/messages")
async def send_message(message_data: MessageCreate, user: User = Depends(get_current_user)):
    message = Message(
        sender_id=user.user_id,
        receiver_id=message_data.receiver_id,
        content=message_data.content
    )
    await db.messages.insert_one(message.model_dump())
    return message

@api_router.post("/sessions")
async def create_session(session_data: SessionCreate, user: User = Depends(get_current_user)):
    coach = await db.users.find_one({"user_id": session_data.coach_id, "role": "coach"}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    price = (coach.get("hourly_rate", 200) * session_data.duration_minutes) / 60
    from_pack = False
    pack_id = None
    
    if session_data.use_credits:
        # Atomique : le filtre remaining_sessions > 0 et la décrémentation
        # se font en une seule opération — élimine la race condition
        pack = await db.packs.find_one_and_update(
            {
                "client_id": user.user_id,
                "coach_id": session_data.coach_id,
                "discipline": session_data.discipline,
                "remaining_sessions": {"$gt": 0},
                "expires_at": {"$gt": datetime.now(timezone.utc)}
            },
            {"$inc": {"remaining_sessions": -1}},
            return_document=False
        )

        if pack:
            price = 0
            from_pack = True
            pack_id = pack["pack_id"]
    
    session = Session(
        coach_id=session_data.coach_id,
        client_id=user.user_id,
        discipline=session_data.discipline,
        date=datetime.fromisoformat(session_data.date.replace('Z', '+00:00')),
        duration_minutes=session_data.duration_minutes,
        location=session_data.location,
        notes=session_data.notes,
        price=price,
        from_pack=from_pack,
        pack_id=pack_id,
        status="confirmed"
    )
    
    await db.sessions.insert_one(session.model_dump())
    return session

@api_router.get("/sessions")
async def get_user_sessions(user: User = Depends(get_current_user)):
    if user.role == "coach":
        query = {"coach_id": user.user_id}
    else:
        query = {"client_id": user.user_id}
    
    sessions = await db.sessions.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    
    for session in sessions:
        if user.role == "coach":
            client = await db.users.find_one({"user_id": session["client_id"]}, {"_id": 0, "password_hash": 0})
            session["client"] = client
        else:
            coach = await db.users.find_one({"user_id": session["coach_id"]}, {"_id": 0, "password_hash": 0})
            session["coach"] = coach
    
    return sessions

@api_router.post("/packs")
async def create_pack(pack_data: PackCreate, user: User = Depends(get_current_user)):
    coach = await db.users.find_one({"user_id": pack_data.coach_id, "role": "coach"}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    hourly_rate = coach.get("hourly_rate", 200)
    original_price = hourly_rate * pack_data.total_sessions
    discount_percent = 15.0 if pack_data.total_sessions >= 10 else 10.0 if pack_data.total_sessions >= 5 else 0.0
    discounted_price = original_price * (1 - discount_percent / 100)
    
    pack = Pack(
        client_id=user.user_id,
        coach_id=pack_data.coach_id,
        discipline=pack_data.discipline,
        total_sessions=pack_data.total_sessions,
        remaining_sessions=pack_data.total_sessions,
        original_price=original_price,
        discounted_price=discounted_price,
        discount_percent=discount_percent,
        expires_at=datetime.now(timezone.utc) + timedelta(days=pack_data.validity_days)
    )
    
    await db.packs.insert_one(pack.model_dump())
    return {**pack.model_dump(), "savings": original_price - discounted_price}

@api_router.get("/packs")
async def get_user_packs(user: User = Depends(get_current_user)):
    packs = await db.packs.find({"client_id": user.user_id}, {"_id": 0}).to_list(50)
    for pack in packs:
        coach = await db.users.find_one({"user_id": pack["coach_id"]}, {"_id": 0, "password_hash": 0})
        pack["coach"] = coach
    return packs

@api_router.get("/wallet")
async def get_wallet(user: User = Depends(get_current_user)):
    wallet = await db.wallets.find_one({"user_id": user.user_id}, {"_id": 0})
    if not wallet:
        wallet = Wallet(user_id=user.user_id).model_dump()
        await db.wallets.insert_one(wallet)
    return wallet

@api_router.get("/challenges")
async def get_challenges():
    now = datetime.now(timezone.utc)
    challenges = await db.challenges.find({"end_date": {"$gt": now}}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return challenges

@api_router.post("/challenges/{challenge_id}/join")
async def join_challenge(challenge_id: str, user: User = Depends(get_current_user)):
    challenge = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    if user.user_id in challenge.get("participants", []):
        raise HTTPException(status_code=400, detail="Already joined")
    
    await db.challenges.update_one(
        {"challenge_id": challenge_id},
        {"$push": {"participants": user.user_id}}
    )
    return {"message": "Joined challenge"}

@api_router.get("/leaderboard")
async def get_leaderboard(city: Optional[str] = None):
    query = {}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0, "email_hash": 0}).sort("total_points", -1).limit(50).to_list(50)
    
    leaderboard = []
    for i, user in enumerate(users):
        leaderboard.append({
            "rank": i + 1,
            "user_id": user["user_id"],
            "name": user["name"],
            "picture": user.get("picture"),
            "city": user.get("city"),
            "total_points": user.get("total_points", 0),
            "badges": user.get("badges", [])
        })
    
    return leaderboard

@api_router.get("/progress")
async def get_progress(days: int = 30, user: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    progress = await db.progress.find(
        {"user_id": user.user_id, "date": {"$gte": since}},
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    sessions = await db.sessions.count_documents({"client_id": user.user_id, "status": "completed"})
    
    return {
        "entries": progress,
        "total_sessions_completed": sessions,
        "total_points": user.total_points
    }

@api_router.post("/progress")
async def add_progress(progress_data: ProgressCreate, user: User = Depends(get_current_user)):
    progress = Progress(
        user_id=user.user_id,
        date=datetime.fromisoformat(progress_data.date.replace('Z', '+00:00')) if progress_data.date else datetime.now(timezone.utc),
        weight=progress_data.weight,
        calories=progress_data.calories,
        activity_minutes=progress_data.activity_minutes,
        steps=progress_data.steps,
        notes=progress_data.notes
    )
    await db.progress.insert_one(progress.model_dump())
    await db.users.update_one({"user_id": user.user_id}, {"$inc": {"total_points": 5}})
    return progress

AVAILABLE_BADGES = [
    {"badge_id": "first_session", "name": "Première Séance", "description": "Complétez votre première séance", "icon": "🎯", "requirement": "1 session", "points": 50},
    {"badge_id": "sessions_10", "name": "10 Séances", "description": "Complétez 10 séances", "icon": "💪", "requirement": "10 sessions", "points": 200},
    {"badge_id": "sessions_50", "name": "Athlète Confirmé", "description": "Complétez 50 séances", "icon": "🏆", "requirement": "50 sessions", "points": 500},
    {"badge_id": "yogi_bronze", "name": "Yogi de Bronze", "description": "Complétez 5 séances de Yoga", "icon": "🧘", "requirement": "5 yoga sessions", "points": 100},
    {"badge_id": "challenger", "name": "Challenger", "description": "Participez à votre premier challenge", "icon": "🎖️", "requirement": "1 challenge", "points": 100},
    {"badge_id": "social_butterfly", "name": "Papillon Social", "description": "Publiez 10 posts", "icon": "🦋", "requirement": "10 posts", "points": 150},
    {"badge_id": "consistent", "name": "Régulier", "description": "Enregistrez 7 jours de progression consécutifs", "icon": "📊", "requirement": "7 day streak", "points": 200},
]

@api_router.get("/badges")
async def get_all_badges():
    return AVAILABLE_BADGES

@api_router.get("/events")
async def get_events(city: Optional[str] = None, discipline: Optional[str] = None):
    query = {"date": {"$gte": datetime.now(timezone.utc)}}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if discipline:
        query["discipline"] = discipline
    
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(50)
    return events

@api_router.get("/events/{event_id}")
async def get_event(event_id: str):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@api_router.post("/events/{event_id}/register")
async def register_for_event(event_id: str, looking_for_buddy: bool = False, user: User = Depends(get_current_user)):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = await db.event_registrations.find_one({
        "event_id": event_id,
        "user_id": user.user_id,
        "status": "confirmed"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")

    # Atomique : $expr compare current_participants < max_participants dans le même
    # document et incrémente en une seule opération — élimine l'overbooking
    updated = await db.events.find_one_and_update(
        {
            "event_id": event_id,
            "$expr": {"$lt": ["$current_participants", "$max_participants"]}
        },
        {"$inc": {"current_participants": 1}},
        return_document=False
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Event is full")

    registration = EventRegistration(
        event_id=event_id,
        user_id=user.user_id,
        looking_for_buddy=looking_for_buddy
    )

    await db.event_registrations.insert_one(registration.model_dump())

    return registration

@api_router.get("/events/{event_id}/buddies")
async def find_buddies(event_id: str, user: User = Depends(get_current_user)):
    registrations = await db.event_registrations.find({
        "event_id": event_id,
        "looking_for_buddy": True,
        "user_id": {"$ne": user.user_id}
    }, {"_id": 0}).to_list(50)
    
    buddies = []
    for reg in registrations:
        buddy = await db.users.find_one({"user_id": reg["user_id"]}, {"_id": 0, "password_hash": 0})
        if buddy:
            buddies.append({
                "user_id": buddy["user_id"],
                "name": buddy["name"],
                "picture": buddy.get("picture"),
                "city": buddy.get("city")
            })
    
    return buddies

@api_router.get("/feed")
async def get_feed(skip: int = 0, limit: int = 20):
    posts = await db.social_posts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return posts

@api_router.post("/feed")
async def create_post(post_data: SocialPostCreate, user: User = Depends(get_current_user)):
    post = SocialPost(
        author_id=user.user_id,
        author_name=user.name,
        author_picture=user.picture,
        content=post_data.content,
        media_type=post_data.media_type,
        media_url=post_data.media_url,
        challenge_id=post_data.challenge_id
    )
    await db.social_posts.insert_one(post.model_dump())
    return post

@api_router.post("/feed/{post_id}/like")
async def toggle_like(post_id: str, user: User = Depends(get_current_user)):
    # Tenter un unlike atomique : $pull ne s'applique que si user.user_id est dans likes
    result = await db.social_posts.find_one_and_update(
        {"post_id": post_id, "likes": user.user_id},
        {"$pull": {"likes": user.user_id}},
        return_document=False,
        projection={"_id": 0, "likes": 1}
    )
    if result is not None:
        # Le user était dans likes → unlike effectué
        liked = False
        likes_count = len(result.get("likes", [])) - 1
    else:
        # Le user n'était pas dans likes → like atomique via $addToSet
        result = await db.social_posts.find_one_and_update(
            {"post_id": post_id},
            {"$addToSet": {"likes": user.user_id}},
            return_document=True,
            projection={"_id": 0, "likes": 1}
        )
        if result is None:
            raise HTTPException(status_code=404, detail="Post not found")
        liked = True
        likes_count = len(result.get("likes", []))

    return {"liked": liked, "likes_count": likes_count}

@api_router.get("/journal")
async def get_journal(user: User = Depends(get_current_user)):
    entries = await db.journal.find({"user_id": user.user_id}, {"_id": 0}).sort("date", -1).to_list(100)
    return entries

@api_router.post("/journal")
async def create_journal_entry(entry_data: JournalEntryCreate, user: User = Depends(get_current_user)):
    entry = JournalEntry(
        user_id=user.user_id,
        title=entry_data.title,
        content=entry_data.content,
        mood=entry_data.mood,
        discipline=entry_data.discipline,
        duration_minutes=entry_data.duration_minutes,
        date=datetime.fromisoformat(entry_data.date.replace('Z', '+00:00')) if entry_data.date else datetime.now(timezone.utc)
    )
    await db.journal.insert_one(entry.model_dump())
    return entry

@api_router.post("/report")
async def report_content(report_data: ReportCreate, user: User = Depends(get_current_user)):
    report = Report(
        reporter_id=user.user_id,
        reported_content_type=report_data.content_type,
        reported_content_id=report_data.content_id,
        reason=report_data.reason
    )
    await db.reports.insert_one(report.model_dump())
    return {"message": "Report submitted"}

@api_router.post("/reviews")
async def create_review(review_data: ReviewCreate, user: User = Depends(get_current_user)):
    coach = await db.users.find_one({"user_id": review_data.coach_id, "role": "coach"}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    existing = await db.reviews.find_one({
        "coach_id": review_data.coach_id,
        "client_id": user.user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà évalué ce coach")

    review = Review(
        coach_id=review_data.coach_id,
        client_id=user.user_id,
        client_name=user.name,
        rating=review_data.rating,
        comment=review_data.comment
    )
    await db.reviews.insert_one(review.model_dump())
    
    all_reviews = await db.reviews.find({"coach_id": review_data.coach_id}, {"_id": 0}).to_list(1000)
    avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    
    await db.users.update_one(
        {"user_id": review_data.coach_id},
        {"$set": {"rating": round(avg_rating, 1), "total_reviews": len(all_reviews)}}
    )
    
    return review

@api_router.post("/seed")
async def seed_data():
    existing = await db.users.find_one({"role": "coach", "email": "sarah.yoga@fitjourney.ma"})
    if existing:
        return {"message": "Data already seeded"}
    
    coaches = [
        {
            "user_id": f"coach_{uuid.uuid4().hex[:12]}",
            "email": "sarah.yoga@fitjourney.ma",
            "name": "Sarah Benali",
            "picture": "https://images.pexels.com/photos/6246482/pexels-photo-6246482.jpeg?auto=compress&cs=tinysrgb&w=300",
            "role": "coach",
            "bio": "Instructrice de Yoga certifiée avec 8 ans d'expérience.",
            "city": "Casablanca",
            "disciplines": ["Yoga", "Pilates", "Méditation"],
            "hourly_rate": 300.0,
            "rating": 4.8,
            "total_reviews": 45,
            "is_verified": True,
            "certifications": ["Yoga Alliance RYT-500"],
            "auth_methods": ["email"],
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": f"coach_{uuid.uuid4().hex[:12]}",
            "email": "karim.fitness@fitjourney.ma",
            "name": "Karim El Amrani",
            "picture": "https://images.pexels.com/photos/5646004/pexels-photo-5646004.jpeg?auto=compress&cs=tinysrgb&w=300",
            "role": "coach",
            "bio": "Coach sportif certifié. Expert en musculation.",
            "city": "Rabat",
            "disciplines": ["Musculation", "CrossFit", "Boxe"],
            "hourly_rate": 350.0,
            "rating": 4.9,
            "total_reviews": 67,
            "is_verified": True,
            "certifications": ["NASM CPT"],
            "auth_methods": ["email"],
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": f"coach_{uuid.uuid4().hex[:12]}",
            "email": "leila.pilates@fitjourney.ma",
            "name": "Leila Tazi",
            "picture": "https://images.pexels.com/photos/7991631/pexels-photo-7991631.jpeg?auto=compress&cs=tinysrgb&w=300",
            "role": "coach",
            "bio": "Professeur de Pilates. Formation internationale à Londres.",
            "city": "Marrakech",
            "disciplines": ["Pilates", "Stretching", "Yoga"],
            "hourly_rate": 280.0,
            "rating": 4.7,
            "total_reviews": 38,
            "is_verified": True,
            "certifications": ["Stott Pilates"],
            "auth_methods": ["email"],
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.users.insert_many(coaches)
    
    events = [
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "title": "Marathon de Casablanca 2025",
            "description": "Le plus grand marathon du Maroc !",
            "discipline": "Running",
            "location": "Boulevard de la Corniche",
            "city": "Casablanca",
            "date": datetime.now(timezone.utc) + timedelta(days=60),
            "price": 200.0,
            "max_participants": 5000,
            "current_participants": 1234,
            "image_url": "https://images.unsplash.com/photo-1565133293110-c4ef9fbd8041?auto=format&fit=crop&w=800",
            "organizer_id": coaches[0]["user_id"],
            "created_at": datetime.now(timezone.utc)
        },
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "title": "Retraite Yoga Taghazout",
            "description": "Week-end yoga face à l'océan.",
            "discipline": "Yoga",
            "location": "Taghazout Beach Resort",
            "city": "Taghazout",
            "date": datetime.now(timezone.utc) + timedelta(days=30),
            "price": 1500.0,
            "max_participants": 30,
            "current_participants": 18,
            "image_url": "https://images.pexels.com/photos/1472887/pexels-photo-1472887.jpeg?auto=compress&cs=tinysrgb&w=800",
            "organizer_id": coaches[0]["user_id"],
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.events.insert_many(events)
    
    challenges = [
        {
            "challenge_id": f"chlg_{uuid.uuid4().hex[:12]}",
            "title": "Le Défi Planche de Casablanca",
            "description": "Tenez la planche le plus longtemps possible !",
            "discipline": "Fitness",
            "points_reward": 200,
            "start_date": datetime.now(timezone.utc),
            "end_date": datetime.now(timezone.utc) + timedelta(days=30),
            "participants": [],
            "submissions": [],
            "image_url": "https://images.pexels.com/photos/4162491/pexels-photo-4162491.jpeg?auto=compress&cs=tinysrgb&w=800",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "challenge_id": f"chlg_{uuid.uuid4().hex[:12]}",
            "title": "30 Jours de Yoga",
            "description": "Pratiquez le yoga pendant 30 jours !",
            "discipline": "Yoga",
            "points_reward": 500,
            "start_date": datetime.now(timezone.utc),
            "end_date": datetime.now(timezone.utc) + timedelta(days=30),
            "participants": [],
            "submissions": [],
            "image_url": "https://images.pexels.com/photos/6246482/pexels-photo-6246482.jpeg?auto=compress&cs=tinysrgb&w=800",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.challenges.insert_many(challenges)
    
    return {"message": "Data seeded successfully", "coaches": len(coaches), "events": len(events), "challenges": len(challenges)}

# ============== PDF INVOICE GENERATION ==============

def generate_invoice_pdf(invoice_data: dict) -> io.BytesIO:
    """Generate a real PDF invoice using ReportLab"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#4ECDC4'), alignment=TA_CENTER)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, textColor=colors.gray, alignment=TA_CENTER)
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#0A1628'))
    normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=11)
    right_style = ParagraphStyle('Right', parent=styles['Normal'], fontSize=11, alignment=TA_RIGHT)
    
    elements = []
    
    # Header
    elements.append(Paragraph("FIT JOURNEY", title_style))
    elements.append(Paragraph("Votre coach sportif à domicile au Maroc", subtitle_style))
    elements.append(Spacer(1, 1*cm))
    
    # Invoice Info
    elements.append(Paragraph(f"FACTURE N° {invoice_data.get('invoice_number', 'N/A')}", header_style))
    elements.append(Paragraph(f"Date: {invoice_data.get('date', datetime.now().strftime('%d/%m/%Y'))}", normal_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # Client Info
    elements.append(Paragraph("INFORMATIONS CLIENT", header_style))
    elements.append(Paragraph(f"Nom: {invoice_data.get('client_name', 'N/A')}", normal_style))
    elements.append(Paragraph(f"Email: {invoice_data.get('client_email', 'N/A')}", normal_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # Items Table
    table_data = [['Description', 'Quantité', 'Prix unitaire', 'Total']]
    
    items = invoice_data.get('items', [])
    subtotal = 0
    for item in items:
        qty = item.get('quantity', 1)
        price = item.get('price', 0)
        total = qty * price
        subtotal += total
        table_data.append([
            item.get('description', 'Service'),
            str(qty),
            f"{price:.2f} MAD",
            f"{total:.2f} MAD"
        ])
    
    # Discount
    discount = invoice_data.get('discount', 0)
    discount_amount = subtotal * (discount / 100)
    final_total = subtotal - discount_amount
    
    table_data.append(['', '', 'Sous-total:', f"{subtotal:.2f} MAD"])
    if discount > 0:
        table_data.append(['', '', f'Remise ({discount}%):', f"-{discount_amount:.2f} MAD"])
    table_data.append(['', '', 'TOTAL:', f"{final_total:.2f} MAD"])
    
    table = Table(table_data, colWidths=[8*cm, 2.5*cm, 3.5*cm, 3.5*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4ECDC4')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -4), colors.HexColor('#F8FAFC')),
        ('GRID', (0, 0), (-1, -4), 1, colors.HexColor('#E2E8F0')),
        ('FONTNAME', (2, -3), (-1, -1), 'Helvetica-Bold'),
        ('LINEABOVE', (2, -3), (-1, -3), 1, colors.gray),
        ('LINEABOVE', (2, -1), (-1, -1), 2, colors.HexColor('#4ECDC4')),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 1*cm))
    
    # Payment Info
    elements.append(Paragraph("INFORMATIONS DE PAIEMENT", header_style))
    elements.append(Paragraph(f"Mode de paiement: {invoice_data.get('payment_method', 'CMI')}", normal_style))
    elements.append(Paragraph(f"Statut: {invoice_data.get('payment_status', 'Payé')}", normal_style))
    elements.append(Spacer(1, 0.5*cm))
    
    # Footer
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.gray, alignment=TA_CENTER)
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph("Fit Journey SARL - RC: 123456 - IF: 12345678", footer_style))
    elements.append(Paragraph("Casablanca, Maroc - contact@fitjourney.ma", footer_style))
    elements.append(Paragraph("Conforme à la réglementation CNDP", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

@api_router.get("/invoices/{pack_id}/pdf")
async def get_pack_invoice_pdf(pack_id: str, user: User = Depends(get_current_user)):
    """Generate and download a PDF invoice for a pack purchase"""
    pack = await db.packs.find_one({"pack_id": pack_id, "client_id": user.user_id}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    
    coach = await db.users.find_one({"user_id": pack["coach_id"]}, {"_id": 0})
    coach_name = coach.get("name", "Coach") if coach else "Coach"
    
    invoice_number = f"FJ-{pack_id[-8:].upper()}-{datetime.now().strftime('%Y%m')}"
    
    invoice_data = {
        "invoice_number": invoice_number,
        "date": pack.get("created_at", datetime.now()).strftime("%d/%m/%Y"),
        "client_name": user.name,
        "client_email": user.email,
        "items": [{
            "description": f"Pack {pack['total_sessions']} séances - {pack['discipline']} avec {coach_name}",
            "quantity": 1,
            "price": pack.get("original_price", 0)
        }],
        "discount": pack.get("discount_percent", 0),
        "payment_method": "CMI (Carte bancaire)",
        "payment_status": "Payé"
    }
    
    pdf_buffer = generate_invoice_pdf(invoice_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=facture_{invoice_number}.pdf"}
    )

@api_router.post("/invoices/generate")
async def generate_custom_invoice(
    items: List[dict],
    discount: float = 0,
    user: User = Depends(get_current_user)
):
    """Generate a custom PDF invoice"""
    invoice_number = f"FJ-{uuid.uuid4().hex[:8].upper()}-{datetime.now().strftime('%Y%m')}"
    
    invoice_data = {
        "invoice_number": invoice_number,
        "date": datetime.now().strftime("%d/%m/%Y"),
        "client_name": user.name,
        "client_email": user.email,
        "items": items,
        "discount": discount,
        "payment_method": "CMI (Carte bancaire)",
        "payment_status": "Payé"
    }
    
    pdf_buffer = generate_invoice_pdf(invoice_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=facture_{invoice_number}.pdf"}
    )

# ============== WEBSOCKET CHAT ==============

class ConnectionManager:
    """Manage WebSocket connections for real-time chat"""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected to WebSocket")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected from WebSocket")
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to {user_id}: {e}")
    
    async def broadcast_to_users(self, message: dict, user_ids: List[str]):
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)

manager = ConnectionManager()

@app.websocket("/ws/chat/{token}")
async def websocket_chat(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time chat"""
    # Verify JWT token
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            action = data.get("action")
            
            if action == "send_message":
                receiver_id = data.get("receiver_id")
                content = data.get("content")
                
                if not receiver_id or not content:
                    await websocket.send_json({"error": "receiver_id and content required"})
                    continue
                
                # Get sender info
                sender = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "picture": 1})
                sender_name = sender.get("name", "Unknown") if sender else "Unknown"
                sender_picture = sender.get("picture") if sender else None
                
                # Save message to DB
                message = {
                    "message_id": f"msg_{uuid.uuid4().hex[:12]}",
                    "sender_id": user_id,
                    "receiver_id": receiver_id,
                    "content": content,
                    "sender_name": sender_name,
                    "sender_picture": sender_picture,
                    "read": False,
                    "created_at": datetime.now(timezone.utc)
                }
                await db.messages.insert_one(message)
                
                # Remove MongoDB _id for JSON serialization
                message.pop("_id", None)
                message["created_at"] = message["created_at"].isoformat()
                
                # Send to receiver if online
                await manager.send_personal_message({
                    "type": "new_message",
                    "message": message
                }, receiver_id)
                
                # Confirm to sender
                await websocket.send_json({
                    "type": "message_sent",
                    "message": message
                })
            
            elif action == "mark_read":
                partner_id = data.get("partner_id")
                if partner_id:
                    await db.messages.update_many(
                        {"sender_id": partner_id, "receiver_id": user_id, "read": False},
                        {"$set": {"read": True}}
                    )
                    await websocket.send_json({"type": "messages_marked_read", "partner_id": partner_id})
            
            elif action == "typing":
                receiver_id = data.get("receiver_id")
                if receiver_id:
                    await manager.send_personal_message({
                        "type": "user_typing",
                        "sender_id": user_id
                    }, receiver_id)
            
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket, user_id)

# Notification WebSocket for real-time alerts
@app.websocket("/ws/notifications/{token}")
async def websocket_notifications(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time notifications"""
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    await manager.connect(websocket, f"notif_{user_id}")
    
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_json()
            if data.get("action") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, f"notif_{user_id}")

@api_router.get("/")
async def root():
    return {
        "message": "Fit Journey API v3.0",
        "status": "online",
        "auth": ["google", "apple", "email"],
        "security": ["JWT", "OAuth2.0", "TLS1.3", "bcrypt"],
        "compliance": "CNDP Morocco",
        "features": ["PDF invoices", "WebSocket chat", "Real-time notifications"]
    }

app.include_router(api_router)

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        'ALLOWED_ORIGINS',
        'http://localhost:8081,http://localhost:19006,http://localhost:3000'
    ).split(',')
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
