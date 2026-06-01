import random
from datetime import timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import auth
from database import engine, get_db, SessionLocal
from flags_data import COUNTRIES

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Guess the Flag API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)


# ── Auto-create Admin account on startup ─────────────────────────────────────
@app.on_event("startup")
def create_admin():
    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.username == "Admin").first()
        if not existing:
            admin = models.User(
                username="Admin",
                email="admin@flaggame.com",
                hashed_password=auth.get_password_hash("123456"),
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            print("[OK] Admin account created (Admin / 123456)")
        else:
            if not existing.is_admin:
                existing.is_admin = True
                db.commit()
            print("[OK] Admin account already exists")
    finally:
        db.close()


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_admin: Optional[bool] = None


class ScoreSubmit(BaseModel):
    score: int
    correct_answers: int
    total_questions: int


# ── Auth helpers ──────────────────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = auth.decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(models.User).filter(models.User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/api/register")
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = models.User(
        username=data.username,
        email=data.email,
        hashed_password=auth.get_password_hash(data.password),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token(
        data={"sub": user.id, "username": user.username, "is_admin": user.is_admin},
        expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"token": token, "username": user.username, "user_id": user.id, "is_admin": user.is_admin}


@app.post("/api/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user or not auth.verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = auth.create_access_token(
        data={"sub": user.id, "username": user.username, "is_admin": user.is_admin},
        expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"token": token, "username": user.username, "user_id": user.id, "is_admin": user.is_admin}


@app.get("/api/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
    }


# ── Game routes ───────────────────────────────────────────────────────────────

@app.get("/api/game/questions")
def get_questions(count: int = 10):
    if count > 20:
        count = 20
    selected = random.sample(COUNTRIES, count)
    questions = []
    for country in selected:
        wrong_pool = [c for c in COUNTRIES if c["code"] != country["code"]]
        wrong_choices = random.sample(wrong_pool, 3)
        options = wrong_choices + [country]
        random.shuffle(options)
        questions.append({
            "flag_code": country["code"].lower(),
            "flag_url": f"https://flagcdn.com/w320/{country['code'].lower()}.png",
            "correct": country["name"],
            "options": [o["name"] for o in options],
        })
    return {"questions": questions}


# ── Score routes ──────────────────────────────────────────────────────────────

@app.post("/api/scores")
def submit_score(
    data: ScoreSubmit,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    score_entry = models.Score(
        user_id=current_user.id,
        username=current_user.username,
        score=data.score,
        correct_answers=data.correct_answers,
        total_questions=data.total_questions,
    )
    db.add(score_entry)
    db.commit()
    return {"message": "Score saved", "score": data.score}


@app.get("/api/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    results = (
        db.query(
            models.Score.username,
            func.max(models.Score.score).label("best_score"),
            func.count(models.Score.id).label("total_games"),
            func.avg(models.Score.score).label("avg_score"),
            func.sum(models.Score.correct_answers).label("total_correct"),
        )
        .group_by(models.Score.username)
        .order_by(func.max(models.Score.score).desc())
        .limit(10)
        .all()
    )

    leaderboard = []
    for rank, row in enumerate(results, start=1):
        leaderboard.append({
            "rank": rank,
            "username": row.username,
            "best_score": row.best_score,
            "total_games": row.total_games,
            "avg_score": round(row.avg_score, 1),
            "total_correct": row.total_correct,
        })
    return {"leaderboard": leaderboard}


@app.get("/api/scores/me")
def get_my_scores(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scores = (
        db.query(models.Score)
        .filter(models.Score.user_id == current_user.id)
        .order_by(models.Score.played_at.desc())
        .limit(10)
        .all()
    )
    return {
        "scores": [
            {
                "score": s.score,
                "correct_answers": s.correct_answers,
                "total_questions": s.total_questions,
                "played_at": s.played_at,
            }
            for s in scores
        ]
    }


# ── Admin CRUD routes ─────────────────────────────────────────────────────────

@app.get("/api/admin/users")
def admin_list_users(
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all users with their stats."""
    users = db.query(models.User).order_by(models.User.id).all()
    result = []
    for u in users:
        games = db.query(func.count(models.Score.id)).filter(models.Score.user_id == u.id).scalar()
        best = db.query(func.max(models.Score.score)).filter(models.Score.user_id == u.id).scalar()
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "created_at": u.created_at,
            "total_games": games or 0,
            "best_score": best or 0,
        })
    return {"users": result}


@app.get("/api/admin/users/{user_id}")
def admin_get_user(
    user_id: int,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get a single user by ID."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    scores = (
        db.query(models.Score)
        .filter(models.Score.user_id == user_id)
        .order_by(models.Score.played_at.desc())
        .all()
    )
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "created_at": user.created_at,
        "scores": [{"score": s.score, "correct_answers": s.correct_answers, "played_at": s.played_at} for s in scores],
    }


@app.post("/api/admin/users")
def admin_create_user(
    data: UserRegister,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a new user (admin only)."""
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        username=data.username,
        email=data.email,
        hashed_password=auth.get_password_hash(data.password),
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created", "id": user.id, "username": user.username}


@app.put("/api/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    data: UserUpdate,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update a user's fields (admin only)."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.username is not None:
        existing = db.query(models.User).filter(
            models.User.username == data.username,
            models.User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        user.username = data.username

    if data.email is not None:
        existing = db.query(models.User).filter(
            models.User.email == data.email,
            models.User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = data.email

    if data.password is not None and data.password.strip():
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        user.hashed_password = auth.get_password_hash(data.password)

    if data.is_admin is not None:
        user.is_admin = data.is_admin

    db.commit()
    return {"message": "User updated", "id": user.id, "username": user.username, "is_admin": user.is_admin}


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a user and all their scores (admin only)."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "Admin" and user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot delete the main admin account")

    db.query(models.Score).filter(models.Score.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    return {"message": f"User '{user.username}' deleted successfully"}


@app.delete("/api/admin/scores/{user_id}")
def admin_clear_user_scores(
    user_id: int,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Clear all scores for a specific user (admin only)."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    deleted = db.query(models.Score).filter(models.Score.user_id == user_id).delete()
    db.commit()
    return {"message": f"Cleared {deleted} scores for '{user.username}'"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
