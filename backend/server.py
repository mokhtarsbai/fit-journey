from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "client"  # client or coach
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    disciplines: Optional[List[str]] = None
    hourly_rate: Optional[float] = None
    role: Optional[str] = None

class Session(BaseModel):
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex[:12]}")
    coach_id: str
    client_id: str
    discipline: str
    date: datetime
    duration_minutes: int = 60
    status: str = "pending"  # pending, confirmed, completed, cancelled
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

# ============== NEW MODELS FOR V2 ==============

class Story(BaseModel):
    story_id: str = Field(default_factory=lambda: f"story_{uuid.uuid4().hex[:12]}")
    coach_id: str
    coach_name: str
    coach_picture: Optional[str] = None
    media_url: str
    media_type: str = "video"  # video, image
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

class Conversation(BaseModel):
    conversation_id: str
    participant_ids: List[str]
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0

class Wallet(BaseModel):
    wallet_id: str = Field(default_factory=lambda: f"wallet_{uuid.uuid4().hex[:12]}")
    user_id: str
    balance: float = 0.0
    currency: str = "MAD"
    transactions: List[dict] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WalletTransaction(BaseModel):
    amount: float
    type: str  # credit, debit
    description: str

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

class Badge(BaseModel):
    badge_id: str
    name: str
    description: str
    icon: str
    requirement: str
    points: int

class Report(BaseModel):
    report_id: str = Field(default_factory=lambda: f"rpt_{uuid.uuid4().hex[:12]}")
    reporter_id: str
    reported_content_type: str  # post, story, user
    reported_content_id: str
    reason: str
    status: str = "pending"  # pending, reviewed, resolved
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReportCreate(BaseModel):
    content_type: str
    content_id: str
    reason: str

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

# ============== AUTH HELPERS ==============

async def get_current_user(request: Request) -> User:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)

async def get_optional_user(request: Request) -> Optional[User]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

# ============== AUTH ROUTES ==============

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        auth_data = auth_response.json()
    
    user_doc = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})
    
    if user_doc:
        user_id = user_doc["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": auth_data["name"], "picture": auth_data.get("picture")}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data["name"],
            "picture": auth_data.get("picture"),
            "role": "client",
            "credits": 0.0,
            "badges": [],
            "total_points": 0,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
        # Create wallet for new user
        wallet = Wallet(user_id=user_id)
        await db.wallets.insert_one(wallet.model_dump())
    
    session_token = auth_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== USER ROUTES ==============

@api_router.put("/users/me")
async def update_user(update: UserUpdate, user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**user_doc)

@api_router.get("/users/{user_id}/badges")
async def get_user_badges(user_id: str):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"badges": user.get("badges", []), "total_points": user.get("total_points", 0)}

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
    
    coaches = await db.users.find(query, {"_id": 0}).to_list(100)
    return coaches

@api_router.get("/coaches/{coach_id}")
async def get_coach(coach_id: str):
    coach = await db.users.find_one({"user_id": coach_id, "role": "coach"}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    reviews = await db.reviews.find({"coach_id": coach_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {**coach, "reviews": reviews}

# ============== STORIES ROUTES ==============

@api_router.get("/stories")
async def get_stories():
    """Get active stories from coaches"""
    now = datetime.now(timezone.utc)
    stories = await db.stories.find(
        {"expires_at": {"$gt": now}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Group by coach
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

@api_router.post("/stories/{story_id}/view")
async def view_story(story_id: str, user: User = Depends(get_current_user)):
    await db.stories.update_one({"story_id": story_id}, {"$inc": {"views": 1}})
    return {"message": "View recorded"}

# ============== CHAT/MESSAGING ROUTES ==============

@api_router.get("/messages/conversations")
async def get_conversations(user: User = Depends(get_current_user)):
    """Get all conversations for current user"""
    messages = await db.messages.find(
        {"$or": [{"sender_id": user.user_id}, {"receiver_id": user.user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Group by conversation partner
    conversations = {}
    for msg in messages:
        partner_id = msg["receiver_id"] if msg["sender_id"] == user.user_id else msg["sender_id"]
        if partner_id not in conversations:
            partner = await db.users.find_one({"user_id": partner_id}, {"_id": 0})
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
    """Get messages with a specific user"""
    messages = await db.messages.find(
        {"$or": [
            {"sender_id": user.user_id, "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": user.user_id}
        ]},
        {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    
    # Mark as read
    await db.messages.update_many(
        {"sender_id": partner_id, "receiver_id": user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    return messages

@api_router.post("/messages")
async def send_message(message_data: MessageCreate, user: User = Depends(get_current_user)):
    """Send a message"""
    message = Message(
        sender_id=user.user_id,
        receiver_id=message_data.receiver_id,
        content=message_data.content
    )
    await db.messages.insert_one(message.model_dump())
    return message

# ============== SESSION BOOKING ROUTES ==============

@api_router.post("/sessions")
async def create_session(session_data: SessionCreate, user: User = Depends(get_current_user)):
    coach = await db.users.find_one({"user_id": session_data.coach_id, "role": "coach"}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    price = (coach.get("hourly_rate", 200) * session_data.duration_minutes) / 60
    from_pack = False
    pack_id = None
    
    # Check if using credits from a pack
    if session_data.use_credits:
        pack = await db.packs.find_one({
            "client_id": user.user_id,
            "coach_id": session_data.coach_id,
            "discipline": session_data.discipline,
            "remaining_sessions": {"$gt": 0},
            "expires_at": {"$gt": datetime.now(timezone.utc)}
        }, {"_id": 0})
        
        if pack:
            await db.packs.update_one(
                {"pack_id": pack["pack_id"]},
                {"$inc": {"remaining_sessions": -1}}
            )
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
    
    # Update user's completed sessions count
    await check_and_award_badges(user.user_id)
    
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
            client = await db.users.find_one({"user_id": session["client_id"]}, {"_id": 0})
            session["client"] = client
        else:
            coach = await db.users.find_one({"user_id": session["coach_id"]}, {"_id": 0})
            session["coach"] = coach
    
    return sessions

@api_router.put("/sessions/{session_id}/cancel")
async def cancel_session(session_id: str, user: User = Depends(get_current_user)):
    """Cancel a session with 24h policy"""
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["coach_id"] != user.user_id and session["client_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check 24h policy
    session_date = session["date"]
    if isinstance(session_date, str):
        session_date = datetime.fromisoformat(session_date)
    if session_date.tzinfo is None:
        session_date = session_date.replace(tzinfo=timezone.utc)
    
    hours_until = (session_date - datetime.now(timezone.utc)).total_seconds() / 3600
    
    refund_eligible = hours_until >= 24
    
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "cancelled"}}
    )
    
    # Refund pack credit if applicable
    if refund_eligible and session.get("from_pack") and session.get("pack_id"):
        await db.packs.update_one(
            {"pack_id": session["pack_id"]},
            {"$inc": {"remaining_sessions": 1}}
        )
    
    return {
        "message": "Session cancelled",
        "refund_eligible": refund_eligible,
        "hours_until_session": hours_until
    }

# ============== PACK ROUTES WITH 15% DISCOUNT ==============

@api_router.post("/packs")
async def create_pack(pack_data: PackCreate, user: User = Depends(get_current_user)):
    """Purchase a session pack with 15% discount - MOCKED PAYMENT"""
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
    
    # Add wallet transaction
    await db.wallets.update_one(
        {"user_id": user.user_id},
        {"$push": {"transactions": {
            "amount": -discounted_price,
            "type": "debit",
            "description": f"Pack {pack_data.total_sessions} séances - {pack_data.discipline}",
            "date": datetime.now(timezone.utc).isoformat()
        }}}
    )
    
    return {
        **pack.model_dump(),
        "savings": original_price - discounted_price
    }

@api_router.get("/packs")
async def get_user_packs(user: User = Depends(get_current_user)):
    packs = await db.packs.find({"client_id": user.user_id}, {"_id": 0}).to_list(50)
    for pack in packs:
        coach = await db.users.find_one({"user_id": pack["coach_id"]}, {"_id": 0})
        pack["coach"] = coach
    return packs

# ============== WALLET ROUTES ==============

@api_router.get("/wallet")
async def get_wallet(user: User = Depends(get_current_user)):
    wallet = await db.wallets.find_one({"user_id": user.user_id}, {"_id": 0})
    if not wallet:
        wallet = Wallet(user_id=user.user_id).model_dump()
        await db.wallets.insert_one(wallet)
    return wallet

@api_router.post("/wallet/add-credits")
async def add_credits(amount: float, user: User = Depends(get_current_user)):
    """Add credits to wallet - MOCKED PAYMENT"""
    await db.wallets.update_one(
        {"user_id": user.user_id},
        {
            "$inc": {"balance": amount},
            "$push": {"transactions": {
                "amount": amount,
                "type": "credit",
                "description": "Ajout de crédits",
                "date": datetime.now(timezone.utc).isoformat()
            }}
        },
        upsert=True
    )
    return {"message": f"{amount} MAD added to wallet"}

# ============== CHALLENGES ROUTES ==============

@api_router.get("/challenges")
async def get_challenges():
    now = datetime.now(timezone.utc)
    challenges = await db.challenges.find(
        {"end_date": {"$gt": now}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return challenges

@api_router.get("/challenges/{challenge_id}")
async def get_challenge(challenge_id: str):
    challenge = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return challenge

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

@api_router.post("/challenges/{challenge_id}/submit")
async def submit_challenge(
    challenge_id: str,
    submission: ChallengeSubmission,
    user: User = Depends(get_current_user)
):
    challenge = await db.challenges.find_one({"challenge_id": challenge_id}, {"_id": 0})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    if user.user_id not in challenge.get("participants", []):
        raise HTTPException(status_code=400, detail="Must join challenge first")
    
    submission_data = {
        "user_id": user.user_id,
        "user_name": user.name,
        "video_url": submission.video_url,
        "comment": submission.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.challenges.update_one(
        {"challenge_id": challenge_id},
        {"$push": {"submissions": submission_data}}
    )
    
    # Award points
    points = challenge.get("points_reward", 100)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$inc": {"total_points": points}}
    )
    
    await check_and_award_badges(user.user_id)
    
    return {"message": "Submission received", "points_earned": points}

# ============== LEADERBOARD ROUTES ==============

@api_router.get("/leaderboard")
async def get_leaderboard(city: Optional[str] = None):
    query = {}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    
    users = await db.users.find(query, {"_id": 0}).sort("total_points", -1).limit(50).to_list(50)
    
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

# ============== PROGRESS TRACKING ROUTES ==============

@api_router.get("/progress")
async def get_progress(
    days: int = 30,
    user: User = Depends(get_current_user)
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    progress = await db.progress.find(
        {"user_id": user.user_id, "date": {"$gte": since}},
        {"_id": 0}
    ).sort("date", 1).to_list(100)
    
    # Get completed sessions count
    sessions = await db.sessions.count_documents({
        "client_id": user.user_id,
        "status": "completed"
    })
    
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
    
    # Award points for tracking
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$inc": {"total_points": 5}}
    )
    
    return progress

# ============== BADGES SYSTEM ==============

AVAILABLE_BADGES = [
    {"badge_id": "first_session", "name": "Première Séance", "description": "Complétez votre première séance", "icon": "🎯", "requirement": "1 session", "points": 50},
    {"badge_id": "sessions_10", "name": "10 Séances", "description": "Complétez 10 séances", "icon": "💪", "requirement": "10 sessions", "points": 200},
    {"badge_id": "sessions_50", "name": "Athlète Confirmé", "description": "Complétez 50 séances", "icon": "🏆", "requirement": "50 sessions", "points": 500},
    {"badge_id": "yogi_bronze", "name": "Yogi de Bronze", "description": "Complétez 5 séances de Yoga", "icon": "🧘", "requirement": "5 yoga sessions", "points": 100},
    {"badge_id": "challenger", "name": "Challenger", "description": "Participez à votre premier challenge", "icon": "🎖️", "requirement": "1 challenge", "points": 100},
    {"badge_id": "social_butterfly", "name": "Papillon Social", "description": "Publiez 10 posts", "icon": "🦋", "requirement": "10 posts", "points": 150},
    {"badge_id": "consistent", "name": "Régulier", "description": "Enregistrez 7 jours de progression consécutifs", "icon": "📊", "requirement": "7 day streak", "points": 200},
]

async def check_and_award_badges(user_id: str):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return
    
    current_badges = user.get("badges", [])
    new_badges = []
    
    # Check session badges
    sessions_count = await db.sessions.count_documents({"client_id": user_id, "status": "completed"})
    
    if sessions_count >= 1 and "first_session" not in current_badges:
        new_badges.append("first_session")
    if sessions_count >= 10 and "sessions_10" not in current_badges:
        new_badges.append("sessions_10")
    if sessions_count >= 50 and "sessions_50" not in current_badges:
        new_badges.append("sessions_50")
    
    # Check yoga badge
    yoga_sessions = await db.sessions.count_documents({
        "client_id": user_id,
        "discipline": "Yoga",
        "status": "completed"
    })
    if yoga_sessions >= 5 and "yogi_bronze" not in current_badges:
        new_badges.append("yogi_bronze")
    
    # Check challenge badge
    challenges = await db.challenges.count_documents({"participants": user_id})
    if challenges >= 1 and "challenger" not in current_badges:
        new_badges.append("challenger")
    
    # Check posts badge
    posts = await db.social_posts.count_documents({"author_id": user_id})
    if posts >= 10 and "social_butterfly" not in current_badges:
        new_badges.append("social_butterfly")
    
    if new_badges:
        points_to_add = sum(b["points"] for b in AVAILABLE_BADGES if b["badge_id"] in new_badges)
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$push": {"badges": {"$each": new_badges}},
                "$inc": {"total_points": points_to_add}
            }
        )

@api_router.get("/badges")
async def get_all_badges():
    return AVAILABLE_BADGES

# ============== EVENT ROUTES WITH BUDDY FINDER ==============

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

@api_router.post("/events")
async def create_event(event_data: EventCreate, user: User = Depends(get_current_user)):
    if user.role != "coach":
        raise HTTPException(status_code=403, detail="Only coaches can create events")
    
    event = Event(
        title=event_data.title,
        description=event_data.description,
        discipline=event_data.discipline,
        location=event_data.location,
        city=event_data.city,
        date=datetime.fromisoformat(event_data.date.replace('Z', '+00:00')),
        price=event_data.price,
        max_participants=event_data.max_participants,
        image_url=event_data.image_url,
        organizer_id=user.user_id
    )
    await db.events.insert_one(event.model_dump())
    return event

@api_router.post("/events/{event_id}/register")
async def register_for_event(event_id: str, looking_for_buddy: bool = False, user: User = Depends(get_current_user)):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["current_participants"] >= event["max_participants"]:
        raise HTTPException(status_code=400, detail="Event is full")
    
    existing = await db.event_registrations.find_one({
        "event_id": event_id,
        "user_id": user.user_id,
        "status": "confirmed"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")
    
    registration = EventRegistration(
        event_id=event_id,
        user_id=user.user_id,
        looking_for_buddy=looking_for_buddy
    )
    
    await db.event_registrations.insert_one(registration.model_dump())
    await db.events.update_one({"event_id": event_id}, {"$inc": {"current_participants": 1}})
    
    return registration

@api_router.get("/events/{event_id}/buddies")
async def find_buddies(event_id: str, user: User = Depends(get_current_user)):
    """Find training partners for an event"""
    registrations = await db.event_registrations.find({
        "event_id": event_id,
        "looking_for_buddy": True,
        "user_id": {"$ne": user.user_id}
    }, {"_id": 0}).to_list(50)
    
    buddies = []
    for reg in registrations:
        buddy = await db.users.find_one({"user_id": reg["user_id"]}, {"_id": 0})
        if buddy:
            buddies.append({
                "user_id": buddy["user_id"],
                "name": buddy["name"],
                "picture": buddy.get("picture"),
                "city": buddy.get("city")
            })
    
    return buddies

@api_router.put("/events/{event_id}/toggle-buddy")
async def toggle_buddy_search(event_id: str, user: User = Depends(get_current_user)):
    """Toggle looking for buddy status"""
    reg = await db.event_registrations.find_one({
        "event_id": event_id,
        "user_id": user.user_id
    }, {"_id": 0})
    
    if not reg:
        raise HTTPException(status_code=404, detail="Not registered for this event")
    
    new_status = not reg.get("looking_for_buddy", False)
    await db.event_registrations.update_one(
        {"event_id": event_id, "user_id": user.user_id},
        {"$set": {"looking_for_buddy": new_status}}
    )
    
    return {"looking_for_buddy": new_status}

@api_router.get("/events/my/registrations")
async def get_my_registrations(user: User = Depends(get_current_user)):
    registrations = await db.event_registrations.find(
        {"user_id": user.user_id, "status": "confirmed"},
        {"_id": 0}
    ).to_list(50)
    
    for reg in registrations:
        event = await db.events.find_one({"event_id": reg["event_id"]}, {"_id": 0})
        reg["event"] = event
    
    return registrations

# ============== SOCIAL FEED ROUTES ==============

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
    await check_and_award_badges(user.user_id)
    return post

@api_router.post("/feed/{post_id}/like")
async def toggle_like(post_id: str, user: User = Depends(get_current_user)):
    post = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get("likes", [])
    if user.user_id in likes:
        likes.remove(user.user_id)
        liked = False
    else:
        likes.append(user.user_id)
        liked = True
    
    await db.social_posts.update_one({"post_id": post_id}, {"$set": {"likes": likes}})
    return {"liked": liked, "likes_count": len(likes)}

@api_router.get("/feed/{post_id}/comments")
async def get_comments(post_id: str):
    comments = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return comments

@api_router.post("/feed/{post_id}/comments")
async def create_comment(post_id: str, comment_data: CommentCreate, user: User = Depends(get_current_user)):
    post = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = Comment(
        post_id=post_id,
        author_id=user.user_id,
        author_name=user.name,
        author_picture=user.picture,
        content=comment_data.content
    )
    await db.comments.insert_one(comment.model_dump())
    await db.social_posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})
    return comment

# ============== REPORT/MODERATION ROUTES ==============

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

# ============== JOURNAL ROUTES ==============

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

@api_router.delete("/journal/{entry_id}")
async def delete_journal_entry(entry_id: str, user: User = Depends(get_current_user)):
    result = await db.journal.delete_one({"entry_id": entry_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}

# ============== REVIEW ROUTES ==============

@api_router.post("/reviews")
async def create_review(review_data: ReviewCreate, user: User = Depends(get_current_user)):
    coach = await db.users.find_one({"user_id": review_data.coach_id, "role": "coach"}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
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

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_data():
    existing = await db.users.find_one({"role": "coach"})
    if existing:
        return {"message": "Data already seeded"}
    
    coaches = [
        {
            "user_id": f"coach_{uuid.uuid4().hex[:12]}",
            "email": "sarah.yoga@fitjourney.ma",
            "name": "Sarah Benali",
            "picture": "https://images.pexels.com/photos/6246482/pexels-photo-6246482.jpeg?auto=compress&cs=tinysrgb&w=300",
            "role": "coach",
            "bio": "Instructrice de Yoga certifiée avec 8 ans d'expérience. Spécialisée en Hatha et Vinyasa Yoga.",
            "phone": "+212 6 12 34 56 78",
            "city": "Casablanca",
            "disciplines": ["Yoga", "Pilates", "Méditation"],
            "hourly_rate": 300.0,
            "rating": 4.8,
            "total_reviews": 45,
            "credits": 0,
            "badges": [],
            "is_verified": True,
            "certifications": ["Yoga Alliance RYT-500"],
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": f"coach_{uuid.uuid4().hex[:12]}",
            "email": "karim.fitness@fitjourney.ma",
            "name": "Karim El Amrani",
            "picture": "https://images.pexels.com/photos/5646004/pexels-photo-5646004.jpeg?auto=compress&cs=tinysrgb&w=300",
            "role": "coach",
            "bio": "Coach sportif certifié. Expert en musculation et préparation physique. Ancien athlète professionnel.",
            "phone": "+212 6 23 45 67 89",
            "city": "Rabat",
            "disciplines": ["Musculation", "CrossFit", "Boxe"],
            "hourly_rate": 350.0,
            "rating": 4.9,
            "total_reviews": 67,
            "credits": 0,
            "badges": [],
            "is_verified": True,
            "certifications": ["NASM CPT", "CrossFit L2"],
            "created_at": datetime.now(timezone.utc)
        },
        {
            "user_id": f"coach_{uuid.uuid4().hex[:12]}",
            "email": "leila.pilates@fitjourney.ma",
            "name": "Leila Tazi",
            "picture": "https://images.pexels.com/photos/7991631/pexels-photo-7991631.jpeg?auto=compress&cs=tinysrgb&w=300",
            "role": "coach",
            "bio": "Professeur de Pilates et stretching. Formation internationale à Londres. 5 ans d'expérience.",
            "phone": "+212 6 34 56 78 90",
            "city": "Marrakech",
            "disciplines": ["Pilates", "Stretching", "Yoga"],
            "hourly_rate": 280.0,
            "rating": 4.7,
            "total_reviews": 38,
            "credits": 0,
            "badges": [],
            "is_verified": True,
            "certifications": ["Stott Pilates"],
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.users.insert_many(coaches)
    
    # Create events
    events = [
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "title": "Marathon de Casablanca 2025",
            "description": "Le plus grand marathon du Maroc ! Parcours de 42km à travers la ville blanche.",
            "discipline": "Running",
            "location": "Boulevard de la Corniche, Casablanca",
            "city": "Casablanca",
            "date": datetime.now(timezone.utc) + timedelta(days=60),
            "price": 200.0,
            "max_participants": 5000,
            "current_participants": 1234,
            "image_url": "https://images.unsplash.com/photo-1565133293110-c4ef9fbd8041?auto=format&fit=crop&w=800",
            "organizer_id": coaches[0]["user_id"],
            "buddy_finder_enabled": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "title": "Retraite Yoga Taghazout",
            "description": "Week-end de détente et yoga face à l'océan. Yoga, surf et bien-être.",
            "discipline": "Yoga",
            "location": "Taghazout Beach Resort",
            "city": "Taghazout",
            "date": datetime.now(timezone.utc) + timedelta(days=30),
            "price": 1500.0,
            "max_participants": 30,
            "current_participants": 18,
            "image_url": "https://images.pexels.com/photos/1472887/pexels-photo-1472887.jpeg?auto=compress&cs=tinysrgb&w=800",
            "organizer_id": coaches[0]["user_id"],
            "buddy_finder_enabled": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "title": "Bootcamp Bouskoura",
            "description": "Entraînement intensif en plein air dans la forêt de Bouskoura. CrossFit et cardio.",
            "discipline": "CrossFit",
            "location": "Forêt de Bouskoura",
            "city": "Bouskoura",
            "date": datetime.now(timezone.utc) + timedelta(days=15),
            "price": 150.0,
            "max_participants": 50,
            "current_participants": 32,
            "image_url": "https://images.pexels.com/photos/7276505/pexels-photo-7276505.jpeg?auto=compress&cs=tinysrgb&w=800",
            "organizer_id": coaches[1]["user_id"],
            "buddy_finder_enabled": True,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.events.insert_many(events)
    
    # Create challenges
    challenges = [
        {
            "challenge_id": f"chlg_{uuid.uuid4().hex[:12]}",
            "title": "Le Défi Planche de Casablanca",
            "description": "Tenez la position de planche le plus longtemps possible ! Postez votre vidéo pour participer.",
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
            "description": "Pratiquez le yoga pendant 30 jours consécutifs et partagez votre progression !",
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

@api_router.get("/")
async def root():
    return {"message": "Fit Journey API v2.0", "status": "online", "features": ["stories", "chat", "challenges", "leaderboard", "badges", "buddy_finder"]}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
