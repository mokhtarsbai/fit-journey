from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
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
    credits: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    disciplines: Optional[List[str]] = None
    hourly_rate: Optional[float] = None
    role: Optional[str] = None

class CoachProfile(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    disciplines: List[str] = []
    hourly_rate: Optional[float] = None
    rating: float = 0.0
    total_reviews: int = 0
    gallery_images: List[str] = []
    video_url: Optional[str] = None

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionCreate(BaseModel):
    coach_id: str
    discipline: str
    date: str  # ISO format
    duration_minutes: int = 60
    location: Optional[str] = None
    notes: Optional[str] = None

class Pack(BaseModel):
    pack_id: str = Field(default_factory=lambda: f"pack_{uuid.uuid4().hex[:12]}")
    client_id: str
    coach_id: str
    discipline: str
    total_sessions: int
    remaining_sessions: int
    price: float
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PackCreate(BaseModel):
    coach_id: str
    discipline: str
    total_sessions: int
    price: float
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
    status: str = "confirmed"  # confirmed, cancelled
    payment_status: str = "completed"  # MOCKED for MVP
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SocialPost(BaseModel):
    post_id: str = Field(default_factory=lambda: f"post_{uuid.uuid4().hex[:12]}")
    author_id: str
    author_name: str
    author_picture: Optional[str] = None
    content: str
    media_type: str = "text"  # text, image, video
    media_url: Optional[str] = None
    likes: List[str] = []
    comments_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SocialPostCreate(BaseModel):
    content: str
    media_type: str = "text"
    media_url: Optional[str] = None

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
    rating: int  # 1-5
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
    mood: str = "good"  # good, neutral, tired
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
    """Get current user from session token"""
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
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

# ============== AUTH ROUTES ==============

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        auth_data = auth_response.json()
    
    # Check if user exists
    user_doc = await db.users.find_one(
        {"email": auth_data["email"]},
        {"_id": 0}
    )
    
    if user_doc:
        user_id = user_doc["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": auth_data["name"],
                "picture": auth_data.get("picture")
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(
            user_id=user_id,
            email=auth_data["email"],
            name=auth_data["name"],
            picture=auth_data.get("picture"),
            role="client",
            credits=0
        )
        await db.users.insert_one(new_user.model_dump())
    
    # Create session
    session_token = auth_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
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
    """Get current authenticated user"""
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== USER ROUTES ==============

@api_router.put("/users/me")
async def update_user(update: UserUpdate, user: User = Depends(get_current_user)):
    """Update current user profile"""
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data}
        )
    
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return User(**user_doc)

# ============== COACH ROUTES ==============

@api_router.get("/coaches")
async def get_coaches(
    city: Optional[str] = None,
    discipline: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_price: Optional[float] = None
):
    """Get list of coaches with filters"""
    query = {"role": "coach"}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if discipline:
        query["disciplines"] = discipline
    if min_rating:
        query["rating"] = {"$gte": min_rating}
    if max_price:
        query["hourly_rate"] = {"$lte": max_price}
    
    coaches = await db.users.find(query, {"_id": 0}).to_list(100)
    return coaches

@api_router.get("/coaches/{coach_id}")
async def get_coach(coach_id: str):
    """Get coach profile by ID"""
    coach = await db.users.find_one(
        {"user_id": coach_id, "role": "coach"},
        {"_id": 0}
    )
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Get reviews
    reviews = await db.reviews.find(
        {"coach_id": coach_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {**coach, "reviews": reviews}

# ============== SESSION BOOKING ROUTES ==============

@api_router.post("/sessions")
async def create_session(session_data: SessionCreate, user: User = Depends(get_current_user)):
    """Book a session with a coach"""
    coach = await db.users.find_one(
        {"user_id": session_data.coach_id, "role": "coach"},
        {"_id": 0}
    )
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    price = (coach.get("hourly_rate", 200) * session_data.duration_minutes) / 60
    
    session = Session(
        coach_id=session_data.coach_id,
        client_id=user.user_id,
        discipline=session_data.discipline,
        date=datetime.fromisoformat(session_data.date.replace('Z', '+00:00')),
        duration_minutes=session_data.duration_minutes,
        location=session_data.location,
        notes=session_data.notes,
        price=price,
        status="confirmed"  # MOCKED: Auto-confirm for MVP
    )
    
    await db.sessions.insert_one(session.model_dump())
    return session

@api_router.get("/sessions")
async def get_user_sessions(user: User = Depends(get_current_user)):
    """Get current user's sessions"""
    if user.role == "coach":
        query = {"coach_id": user.user_id}
    else:
        query = {"client_id": user.user_id}
    
    sessions = await db.sessions.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    
    # Enrich with coach/client info
    for session in sessions:
        if user.role == "coach":
            client = await db.users.find_one({"user_id": session["client_id"]}, {"_id": 0})
            session["client"] = client
        else:
            coach = await db.users.find_one({"user_id": session["coach_id"]}, {"_id": 0})
            session["coach"] = coach
    
    return sessions

@api_router.put("/sessions/{session_id}/status")
async def update_session_status(
    session_id: str,
    status: str,
    user: User = Depends(get_current_user)
):
    """Update session status"""
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["coach_id"] != user.user_id and session["client_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": status}}
    )
    
    return {"message": "Status updated", "status": status}

# ============== PACK ROUTES ==============

@api_router.post("/packs")
async def create_pack(pack_data: PackCreate, user: User = Depends(get_current_user)):
    """Purchase a session pack - MOCKED PAYMENT"""
    coach = await db.users.find_one(
        {"user_id": pack_data.coach_id, "role": "coach"},
        {"_id": 0}
    )
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    pack = Pack(
        client_id=user.user_id,
        coach_id=pack_data.coach_id,
        discipline=pack_data.discipline,
        total_sessions=pack_data.total_sessions,
        remaining_sessions=pack_data.total_sessions,
        price=pack_data.price,
        expires_at=datetime.now(timezone.utc) + timedelta(days=pack_data.validity_days)
    )
    
    await db.packs.insert_one(pack.model_dump())
    return pack

@api_router.get("/packs")
async def get_user_packs(user: User = Depends(get_current_user)):
    """Get user's session packs"""
    packs = await db.packs.find(
        {"client_id": user.user_id},
        {"_id": 0}
    ).to_list(50)
    
    for pack in packs:
        coach = await db.users.find_one({"user_id": pack["coach_id"]}, {"_id": 0})
        pack["coach"] = coach
    
    return packs

# ============== EVENT ROUTES ==============

@api_router.get("/events")
async def get_events(
    city: Optional[str] = None,
    discipline: Optional[str] = None
):
    """Get list of events"""
    query = {"date": {"$gte": datetime.now(timezone.utc)}}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if discipline:
        query["discipline"] = discipline
    
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(50)
    return events

@api_router.get("/events/{event_id}")
async def get_event(event_id: str):
    """Get event details"""
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@api_router.post("/events")
async def create_event(event_data: EventCreate, user: User = Depends(get_current_user)):
    """Create a new event (coach only)"""
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
async def register_for_event(event_id: str, user: User = Depends(get_current_user)):
    """Register for an event - MOCKED PAYMENT"""
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event["current_participants"] >= event["max_participants"]:
        raise HTTPException(status_code=400, detail="Event is full")
    
    # Check if already registered
    existing = await db.event_registrations.find_one({
        "event_id": event_id,
        "user_id": user.user_id,
        "status": "confirmed"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")
    
    registration = EventRegistration(
        event_id=event_id,
        user_id=user.user_id
    )
    
    await db.event_registrations.insert_one(registration.model_dump())
    await db.events.update_one(
        {"event_id": event_id},
        {"$inc": {"current_participants": 1}}
    )
    
    return registration

@api_router.get("/events/my/registrations")
async def get_my_registrations(user: User = Depends(get_current_user)):
    """Get user's event registrations"""
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
    """Get social feed posts"""
    posts = await db.social_posts.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return posts

@api_router.post("/feed")
async def create_post(post_data: SocialPostCreate, user: User = Depends(get_current_user)):
    """Create a social post"""
    post = SocialPost(
        author_id=user.user_id,
        author_name=user.name,
        author_picture=user.picture,
        content=post_data.content,
        media_type=post_data.media_type,
        media_url=post_data.media_url
    )
    
    await db.social_posts.insert_one(post.model_dump())
    return post

@api_router.post("/feed/{post_id}/like")
async def toggle_like(post_id: str, user: User = Depends(get_current_user)):
    """Toggle like on a post"""
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
    
    await db.social_posts.update_one(
        {"post_id": post_id},
        {"$set": {"likes": likes}}
    )
    
    return {"liked": liked, "likes_count": len(likes)}

@api_router.get("/feed/{post_id}/comments")
async def get_comments(post_id: str):
    """Get comments for a post"""
    comments = await db.comments.find(
        {"post_id": post_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return comments

@api_router.post("/feed/{post_id}/comments")
async def create_comment(
    post_id: str,
    comment_data: CommentCreate,
    user: User = Depends(get_current_user)
):
    """Add a comment to a post"""
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
    await db.social_posts.update_one(
        {"post_id": post_id},
        {"$inc": {"comments_count": 1}}
    )
    
    return comment

# ============== JOURNAL ROUTES ==============

@api_router.get("/journal")
async def get_journal(user: User = Depends(get_current_user)):
    """Get user's journal entries"""
    entries = await db.journal.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    return entries

@api_router.post("/journal")
async def create_journal_entry(
    entry_data: JournalEntryCreate,
    user: User = Depends(get_current_user)
):
    """Create a journal entry"""
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
    """Delete a journal entry"""
    result = await db.journal.delete_one({
        "entry_id": entry_id,
        "user_id": user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": "Entry deleted"}

# ============== REVIEW ROUTES ==============

@api_router.post("/reviews")
async def create_review(review_data: ReviewCreate, user: User = Depends(get_current_user)):
    """Create a review for a coach"""
    coach = await db.users.find_one(
        {"user_id": review_data.coach_id, "role": "coach"},
        {"_id": 0}
    )
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
    
    # Update coach rating
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
    """Seed initial data for demo"""
    # Check if already seeded
    existing = await db.users.find_one({"role": "coach"})
    if existing:
        return {"message": "Data already seeded"}
    
    # Create demo coaches
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
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.users.insert_many(coaches)
    
    # Create demo events
    events = [
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "title": "Marathon de Casablanca 2025",
            "description": "Le plus grand marathon du Maroc ! Parcours de 42km à travers la ville blanche.",
            "discipline": "Running",
            "location": "Boulevard de la Corniche, Casablanca",
            "city": "Casablanca",
            "date": datetime(2025, 9, 15, 7, 0, tzinfo=timezone.utc),
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
            "description": "Week-end de détente et yoga face à l'océan. Yoga, surf et bien-être.",
            "discipline": "Yoga",
            "location": "Taghazout Beach Resort",
            "city": "Taghazout",
            "date": datetime(2025, 8, 22, 9, 0, tzinfo=timezone.utc),
            "price": 1500.0,
            "max_participants": 30,
            "current_participants": 18,
            "image_url": "https://images.pexels.com/photos/1472887/pexels-photo-1472887.jpeg?auto=compress&cs=tinysrgb&w=800",
            "organizer_id": coaches[0]["user_id"],
            "created_at": datetime.now(timezone.utc)
        },
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "title": "Bootcamp Bouskoura",
            "description": "Entraînement intensif en plein air dans la forêt de Bouskoura. CrossFit et cardio.",
            "discipline": "CrossFit",
            "location": "Forêt de Bouskoura",
            "city": "Bouskoura",
            "date": datetime(2025, 8, 10, 8, 0, tzinfo=timezone.utc),
            "price": 150.0,
            "max_participants": 50,
            "current_participants": 32,
            "image_url": "https://images.pexels.com/photos/7276505/pexels-photo-7276505.jpeg?auto=compress&cs=tinysrgb&w=800",
            "organizer_id": coaches[1]["user_id"],
            "created_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.events.insert_many(events)
    
    return {"message": "Data seeded successfully", "coaches": len(coaches), "events": len(events)}

@api_router.get("/")
async def root():
    return {"message": "Fit Journey API v1.0", "status": "online"}

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
