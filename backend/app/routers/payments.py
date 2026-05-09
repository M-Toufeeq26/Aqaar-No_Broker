from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.utils.auth import get_current_user, get_current_admin
from datetime import datetime, timedelta
import uuid
import json

router = APIRouter(prefix="/payments", tags=["payments"])

# Sponsorship Pricing (Final)
SPONSORED_PRICES = {
    7: 699,    # 7 days - ₹699
    15: 1299,  # 15 days - ₹1299
    30: 1999   # 30 days - ₹1999
}

# Property Verification Pricing
PROPERTY_VERIFICATION_PRICES = {
    7: 99,     # Weekly - ₹99
    30: 349,   # Monthly - ₹349
    90: 899    # 3 Months - ₹899
}

class CreateOrderRequest(BaseModel):
    payment_type: str
    amount: float
    duration_days: Optional[int] = None
    property_id: Optional[int] = None

class VerifyPaymentRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str

@router.post("/create-order")
def create_order(
    request: CreateOrderRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order_id = str(uuid.uuid4())
    
    if request.payment_type not in ["verification", "sponsored", "property_verification"]:
        raise HTTPException(status_code=400, detail="Invalid payment type")
    
    # User verification (profile)
    if request.payment_type == "verification" and request.amount != 999:
        raise HTTPException(status_code=400, detail="Verification fee is ₹999")
    
    # Property verification
    if request.payment_type == "property_verification":
        if request.duration_days not in PROPERTY_VERIFICATION_PRICES:
            raise HTTPException(status_code=400, detail="Invalid duration for property verification")
        if request.amount != PROPERTY_VERIFICATION_PRICES[request.duration_days]:
            raise HTTPException(status_code=400, detail=f"Invalid amount. Expected ₹{PROPERTY_VERIFICATION_PRICES[request.duration_days]}")
        if not request.property_id:
            raise HTTPException(status_code=400, detail="Property ID required for property verification")
        
        property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
        if not property:
            raise HTTPException(status_code=404, detail="Property not found")
        if property.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to verify this property")
    
    # Sponsorship
    if request.payment_type == "sponsored":
        if request.duration_days not in SPONSORED_PRICES:
            raise HTTPException(status_code=400, detail="Invalid duration for sponsorship")
        if request.amount != SPONSORED_PRICES[request.duration_days]:
            raise HTTPException(status_code=400, detail=f"Invalid amount. Expected ₹{SPONSORED_PRICES[request.duration_days]}")
        if not request.property_id:
            raise HTTPException(status_code=400, detail="Property ID required for sponsored listing")
        
        property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
        if not property:
            raise HTTPException(status_code=404, detail="Property not found")
        if property.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to sponsor this property")
    
    payment = models.Payment(
        user_id=current_user.id,
        payment_type=request.payment_type,
        amount=request.amount,
        razorpay_order_id=order_id,
        status="pending"
    )
    
    metadata = {
        "payment_type": request.payment_type,
        "amount": request.amount
    }
    
    if request.property_id:
        metadata["property_id"] = request.property_id
    if request.duration_days:
        metadata["duration_days"] = request.duration_days
    
    payment.metadata_json = json.dumps(metadata)
    db.add(payment)
    db.commit()
    
    return {
        "order_id": order_id,
        "amount": request.amount,
        "payment_type": request.payment_type
    }

@router.post("/verify")
def verify_payment(
    request: VerifyPaymentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    payment = db.query(models.Payment).filter(models.Payment.razorpay_order_id == request.order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.status == "completed":
        raise HTTPException(status_code=400, detail="Payment already verified")
    
    payment.razorpay_payment_id = request.payment_id
    payment.razorpay_signature = request.signature
    payment.status = "completed"
    payment.completed_at = datetime.utcnow()
    db.commit()
    
    metadata = json.loads(payment.metadata_json) if payment.metadata_json else {}
    
    # User Verification (Profile)
    if payment.payment_type == "verification":
        user = db.query(models.User).filter(models.User.id == current_user.id).first()
        if user:
            user.is_verified = True
            db.commit()
            
            notification = models.Notification(
                user_id=current_user.id,
                title="Verification Successful",
                message="Your account has been verified. You now have a verified badge on your profile.",
                type="verification_completed",
                related_id=None,
                is_read=False
            )
            db.add(notification)
            db.commit()
        
        return {"message": "Verification successful", "is_verified": True}
    
    # Property Verification
    elif payment.payment_type == "property_verification":
        property_id = metadata.get("property_id")
        duration_days = metadata.get("duration_days")
        
        if not property_id:
            raise HTTPException(status_code=400, detail="Missing property ID")
        
        property = db.query(models.Property).filter(models.Property.id == property_id).first()
        if not property:
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Create verification request for admin approval
        verification_request = models.PropertyVerificationRequest(
            property_id=property_id,
            user_id=current_user.id,
            duration_days=duration_days,
            amount=payment.amount,
            status="pending",
            remaining_attempts=3,
            created_at=datetime.utcnow()
        )
        db.add(verification_request)
        db.commit()
        
        # Notify admins
        admins = db.query(models.User).filter(models.User.is_admin == True).all()
        for admin in admins:
            admin_notif = models.Notification(
                user_id=admin.id,
                title="New Property Verification Request",
                message=f"Property '{property.title}' has requested verification.",
                type="new_verification_request",
                related_id=verification_request.id,
                is_read=False
            )
            db.add(admin_notif)
        db.commit()
        
        notification = models.Notification(
            user_id=current_user.id,
            title="Verification Request Submitted",
            message=f"Your verification request for '{property.title}' has been submitted. Admin will review within 2-3 days.",
            type="verification_request_submitted",
            related_id=verification_request.id,
            is_read=False
        )
        db.add(notification)
        db.commit()
        
        return {
            "message": "Verification request submitted for admin approval",
            "request_id": verification_request.id
        }
    
    # Sponsorship
    elif payment.payment_type == "sponsored":
        property_id = metadata.get("property_id")
        duration_days = metadata.get("duration_days")
        
        if not property_id or not duration_days:
            raise HTTPException(status_code=400, detail="Missing sponsored listing details")
        
        property = db.query(models.Property).filter(models.Property.id == property_id).first()
        if not property:
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Check if SponsorshipRequest model exists
        try:
            sponsorship_request = models.SponsorshipRequest(
                property_id=property_id,
                user_id=current_user.id,
                duration_days=duration_days,
                amount=payment.amount,
                status="pending",
                created_at=datetime.utcnow()
            )
            db.add(sponsorship_request)
            db.commit()
            
            request_id = sponsorship_request.id
        except Exception as e:
            db.rollback()
            return {
                "message": "Payment successful but sponsorship request could not be created. Please contact support.",
                "payment_verified": True
            }
        
        # Notify admins
        admins = db.query(models.User).filter(models.User.is_admin == True).all()
        for admin in admins:
            admin_notif = models.Notification(
                user_id=admin.id,
                title="New Sponsorship Request",
                message=f"Property '{property.title}' has requested sponsorship for {duration_days} days.",
                type="new_sponsorship_request",
                related_id=request_id,
                is_read=False
            )
            db.add(admin_notif)
        db.commit()
        
        notification = models.Notification(
            user_id=current_user.id,
            title="Sponsorship Request Submitted",
            message=f"Your sponsorship request for '{property.title}' has been submitted. Admin will review within 2-3 days.",
            type="sponsorship_request_submitted",
            related_id=request_id,
            is_read=False
        )
        db.add(notification)
        db.commit()
        
        return {
            "message": "Sponsorship request submitted for admin approval",
            "request_id": request_id
        }
    
    return {"message": "Payment verified successfully"}

@router.get("/history")
def get_payment_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    payments = db.query(models.Payment).filter(
        models.Payment.user_id == current_user.id
    ).order_by(models.Payment.created_at.desc()).all()
    
    result = []
    for p in payments:
        metadata = json.loads(p.metadata_json) if p.metadata_json else {}
        result.append({
            "id": p.id,
            "payment_type": p.payment_type,
            "amount": p.amount,
            "status": p.status,
            "created_at": p.created_at,
            "completed_at": p.completed_at,
            "metadata": metadata
        })
    
    return result

@router.get("/sponsored-prices")
def get_sponsored_prices():
    return SPONSORED_PRICES

@router.get("/property-verification-prices")
def get_property_verification_prices():
    return PROPERTY_VERIFICATION_PRICES