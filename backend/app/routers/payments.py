from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.utils.auth import get_current_user
from datetime import datetime, timedelta
import json
import razorpay
import hmac
import hashlib

router = APIRouter(prefix="/payments", tags=["payments"])

# Razorpay Test Keys
RAZORPAY_KEY_ID = "rzp_test_ShSRMSRNfnH1Ai"
RAZORPAY_KEY_SECRET = "gyEiMkHHrU9KGJrJR03v4JBL"

# Initialize Razorpay client
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# Sponsorship Pricing
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

@router.get("/sponsored-prices")
def get_sponsored_prices():
    return SPONSORED_PRICES

@router.get("/property-verification-prices")
def get_property_verification_prices():
    return PROPERTY_VERIFICATION_PRICES

@router.post("/create-order")
def create_order(
    request: CreateOrderRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate payment type
    if request.payment_type not in ["property_verification", "sponsored"]:
        raise HTTPException(status_code=400, detail="Invalid payment type")
    
    # Validate property verification
    if request.payment_type == "property_verification":
        if request.duration_days not in PROPERTY_VERIFICATION_PRICES:
            raise HTTPException(status_code=400, detail="Invalid duration for property verification")
        expected_amount = PROPERTY_VERIFICATION_PRICES[request.duration_days]
        if request.amount != expected_amount:
            raise HTTPException(status_code=400, detail=f"Invalid amount. Expected ₹{expected_amount}")
        if not request.property_id:
            raise HTTPException(status_code=400, detail="Property ID required for property verification")
        
        property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
        if not property:
            raise HTTPException(status_code=404, detail="Property not found")
        if property.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to verify this property")
    
    # Validate sponsorship
    if request.payment_type == "sponsored":
        if request.duration_days not in SPONSORED_PRICES:
            raise HTTPException(status_code=400, detail="Invalid duration for sponsorship")
        expected_amount = SPONSORED_PRICES[request.duration_days]
        if request.amount != expected_amount:
            raise HTTPException(status_code=400, detail=f"Invalid amount. Expected ₹{expected_amount}")
        if not request.property_id:
            raise HTTPException(status_code=400, detail="Property ID required for sponsored listing")
        
        property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
        if not property:
            raise HTTPException(status_code=404, detail="Property not found")
        if property.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to sponsor this property")
    
    # Create actual Razorpay order (amount in paise)
    amount_in_paise = int(request.amount * 100)
    
    order_data = {
        'amount': amount_in_paise,
        'currency': 'INR',
        'payment_capture': 1,
        'notes': {
            'payment_type': request.payment_type,
            'property_id': str(request.property_id) if request.property_id else '',
            'user_id': str(current_user.id),
            'duration_days': str(request.duration_days) if request.duration_days else ''
        }
    }
    
    try:
        razorpay_order = client.order.create(order_data)
        order_id = razorpay_order['id']
        
        # Store payment record in database
        payment = models.Payment(
            user_id=current_user.id,
            payment_type=request.payment_type,
            amount=request.amount,
            razorpay_order_id=order_id,
            status="pending",
            created_at=datetime.utcnow()
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
            "currency": "INR"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Razorpay order: {str(e)}")

@router.post("/verify")
def verify_payment(
    request: VerifyPaymentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify Razorpay signature
    generated_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode('utf-8'),
        f"{request.order_id}|{request.payment_id}".encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    if generated_signature != request.signature:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    
    # Find payment record
    payment = db.query(models.Payment).filter(
        models.Payment.razorpay_order_id == request.order_id
    ).first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.status == "completed":
        raise HTTPException(status_code=400, detail="Payment already verified")
    
    # Update payment status
    payment.status = "completed"
    payment.razorpay_payment_id = request.payment_id
    payment.razorpay_signature = request.signature
    payment.completed_at = datetime.utcnow()
    db.commit()
    
    metadata = json.loads(payment.metadata_json) if payment.metadata_json else {}
    
    # Property Verification
    if payment.payment_type == "property_verification":
        property_id = metadata.get("property_id")
        duration_days = metadata.get("duration_days")
        
        if not property_id:
            raise HTTPException(status_code=400, detail="Missing property ID")
        
        property = db.query(models.Property).filter(models.Property.id == property_id).first()
        if not property:
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Check if there's already a pending/rejected request
        existing_request = db.query(models.PropertyVerificationRequest).filter(
            models.PropertyVerificationRequest.property_id == property_id,
            models.PropertyVerificationRequest.status == "pending"
        ).first()
        
        if existing_request:
            # Update existing request
            existing_request.duration_days = duration_days
            existing_request.amount = payment.amount
            existing_request.created_at = datetime.utcnow()
        else:
            # Create new verification request
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
                related_id=verification_request.id if 'verification_request' in locals() else None,
                is_read=False,
                created_at=datetime.utcnow()
            )
            db.add(admin_notif)
        
        # Notify user
        notification = models.Notification(
            user_id=current_user.id,
            title="Verification Request Submitted",
            message=f"Your verification request for '{property.title}' has been submitted. Admin will review within 2-3 days.",
            type="verification_request_submitted",
            related_id=verification_request.id if 'verification_request' in locals() else None,
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notification)
        db.commit()
        
        return {
            "status": "success",
            "message": "Verification request submitted for admin approval"
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
        
        # Check if there's already a pending request
        existing_request = db.query(models.SponsorshipRequest).filter(
            models.SponsorshipRequest.property_id == property_id,
            models.SponsorshipRequest.status == "pending"
        ).first()
        
        if existing_request:
            existing_request.duration_days = duration_days
            existing_request.amount = payment.amount
            existing_request.created_at = datetime.utcnow()
            request_id = existing_request.id
        else:
            # Create new sponsorship request
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
        
        # Notify admins
        admins = db.query(models.User).filter(models.User.is_admin == True).all()
        for admin in admins:
            admin_notif = models.Notification(
                user_id=admin.id,
                title="New Sponsorship Request",
                message=f"Property '{property.title}' has requested sponsorship for {duration_days} days.",
                type="new_sponsorship_request",
                related_id=request_id,
                is_read=False,
                created_at=datetime.utcnow()
            )
            db.add(admin_notif)
        
        # Notify user
        notification = models.Notification(
            user_id=current_user.id,
            title="Sponsorship Request Submitted",
            message=f"Your sponsorship request for '{property.title}' has been submitted. Admin will review within 2-3 days.",
            type="sponsorship_request_submitted",
            related_id=request_id,
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notification)
        db.commit()
        
        return {
            "status": "success",
            "message": "Sponsorship request submitted for admin approval"
        }
    
    return {"status": "success", "message": "Payment verified successfully"}

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