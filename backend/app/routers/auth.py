from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas import UserCreate, UserLogin, UserResponse, UserUpdate
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
from app.utils.file_upload import save_document, validate_document

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=dict)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_email = db.query(models.User).filter(models.User.email == user.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_phone = db.query(models.User).filter(models.User.phone == user.phone).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    hashed_password = hash_password(user.password)
    new_user = models.User(
        full_name=user.name,
        email=user.email,
        hashed_password=hashed_password,
        phone=user.phone,
        is_active=True,
        is_verified=False,
        is_admin=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": str(new_user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "phone": new_user.phone,
            "is_verified": new_user.is_verified,
            "is_admin": new_user.is_admin
        }
    }

@router.post("/login", response_model=dict)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    
    # User not found - return 404 to trigger signup redirect
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found with this email. Please sign up."
        )
    
    # Wrong password
    if not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password. Please try again."
        )
    
    # CHECK IF USER IS BLOCKED
    if db_user.is_blocked:
        if db_user.block_until and db_user.block_until > datetime.utcnow():
            days_left = (db_user.block_until - datetime.utcnow()).days
            raise HTTPException(status_code=403, detail=f"Your account is blocked for {days_left} more days. Reason: {db_user.block_reason}")
        elif db_user.block_until is None:
            raise HTTPException(status_code=403, detail=f"Your account has been permanently blocked. Reason: {db_user.block_reason}")
        else:
            # Block expired - unblock user automatically
            db_user.is_blocked = False
            db_user.block_reason = None
            db_user.block_until = None
            db.commit()
    
    access_token = create_access_token(data={"sub": str(db_user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "full_name": db_user.full_name,
            "phone": db_user.phone,
            "is_verified": db_user.is_verified,
            "is_admin": db_user.is_admin
        }
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        phone=current_user.phone,
        is_verified=current_user.is_verified,
        is_admin=current_user.is_admin
    )

@router.put("/profile", response_model=UserResponse)
def update_profile(
    user_data: UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_data.name:
        current_user.full_name = user_data.name
    if user_data.phone:
        existing = db.query(models.User).filter(
            models.User.phone == user_data.phone,
            models.User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already in use")
        current_user.phone = user_data.phone
    if user_data.password:
        current_user.hashed_password = hash_password(user_data.password)
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        phone=current_user.phone,
        is_verified=current_user.is_verified,
        is_admin=current_user.is_admin
    )

# ========== VERIFICATION ENDPOINTS ==========

@router.get("/verification-status")
def get_verification_status(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    verification_request = db.query(models.VerificationRequest).filter(
        models.VerificationRequest.user_id == current_user.id,
        models.VerificationRequest.status == "pending"
    ).first()
    
    return {
        "is_verified": current_user.is_verified,
        "requested": verification_request is not None,
        "status": verification_request.status if verification_request else None
    }

@router.post("/request-verification")
async def request_verification(
    document_type: str = Form(...),
    document: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.is_verified:
        raise HTTPException(status_code=400, detail="User already verified")
    
    existing_request = db.query(models.VerificationRequest).filter(
        models.VerificationRequest.user_id == current_user.id,
        models.VerificationRequest.status == "pending"
    ).first()
    
    if existing_request:
        raise HTTPException(status_code=400, detail="Verification request already pending")
    
    validate_document(document)
    document_url = await save_document(document)
    
    verification_request = models.VerificationRequest(
        user_id=current_user.id,
        document_type=document_type,
        document_url=document_url,
        status="pending"
    )
    db.add(verification_request)
    db.commit()
    
    admins = db.query(models.User).filter(models.User.is_admin == True).all()
    for admin in admins:
        notification = models.Notification(
            user_id=admin.id,
            title="New Verification Request",
            message=f"{current_user.full_name} has requested verification.",
            type="verification_request",
            related_id=verification_request.id,
            is_read=False
        )
        db.add(notification)
    db.commit()
    
    return {"message": "Verification request submitted successfully"}

# ========== PROPERTIES ENDPOINTS ==========

@router.get("/properties/sold-by-me")
def get_sold_properties(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    properties = db.query(models.Property).filter(
        models.Property.owner_id == current_user.id,
        models.Property.status == "sold"
    ).all()
    
    return [{
        "id": p.id,
        "title": p.title,
        "price": p.price,
        "location_city": p.location_city,
        "sold_date": p.updated_at
    } for p in properties]

# ========== RATINGS ENDPOINTS ==========

@router.get("/my-ratings")
def get_my_ratings(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ratings = db.query(models.Rating).join(
        models.Property
    ).filter(
        models.Property.owner_id == current_user.id
    ).order_by(models.Rating.created_at.desc()).all()
    
    result = []
    for r in ratings:
        user = db.query(models.User).filter(models.User.id == r.user_id).first()
        property = db.query(models.Property).filter(models.Property.id == r.property_id).first()
        result.append({
            "id": r.id,
            "property_title": property.title if property else "Unknown",
            "user_name": user.full_name if user else "Anonymous",
            "rating": r.rating,
            "review": r.review,
            "created_at": r.created_at
        })
    
    avg_rating = 0
    if ratings:
        avg_rating = sum(r.rating for r in ratings) / len(ratings)
    
    return {
        "ratings": result,
        "avg_rating": round(avg_rating, 1)
    }