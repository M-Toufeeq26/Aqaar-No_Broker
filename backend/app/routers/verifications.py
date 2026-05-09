from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
import json
import os
import shutil
from app.database import get_db
from app import models
from app.utils.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/verifications", tags=["verifications"])

# Fee structure
VERIFICATION_FEES = {
    7: 99,    # Weekly
    30: 349,  # Monthly
    90: 899   # 3 Months
}

class VerificationRequestCreate(BaseModel):
    property_id: int
    duration_days: int  # 7, 30, or 90

class EditRequestCreate(BaseModel):
    property_id: int
    changes: dict  # The changes to locked fields

# ========== PROPERTY VERIFICATION ==========

@router.get("/fees")
def get_verification_fees():
    """Get available verification fee options"""
    return {
        "weekly": {"days": 7, "amount": VERIFICATION_FEES[7]},
        "monthly": {"days": 30, "amount": VERIFICATION_FEES[30]},
        "quarterly": {"days": 90, "amount": VERIFICATION_FEES[90]}
    }

@router.post("/request")
def request_property_verification(
    request_data: VerificationRequestCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Seller requests verification for their property"""
    
    # Check if property exists and belongs to user
    property = db.query(models.Property).filter(
        models.Property.id == request_data.property_id,
        models.Property.owner_id == current_user.id
    ).first()
    
    if not property:
        raise HTTPException(status_code=404, detail="Property not found or you don't own it")
    
    # Check if property is already verified
    if property.is_verified and property.verified_until and property.verified_until > datetime.utcnow():
        raise HTTPException(status_code=400, detail="Property is already verified")
    
    # Check if there's a pending verification request
    pending_request = db.query(models.PropertyVerificationRequest).filter(
        models.PropertyVerificationRequest.property_id == request_data.property_id,
        models.PropertyVerificationRequest.status == "pending"
    ).first()
    
    if pending_request:
        raise HTTPException(status_code=400, detail="You already have a pending verification request for this property")
    
    # Validate duration
    if request_data.duration_days not in VERIFICATION_FEES:
        raise HTTPException(status_code=400, detail="Invalid duration. Choose 7, 30, or 90 days")
    
    amount = VERIFICATION_FEES[request_data.duration_days]
    
    # Create verification request
    verification_request = models.PropertyVerificationRequest(
        property_id=request_data.property_id,
        user_id=current_user.id,
        duration_days=request_data.duration_days,
        amount=amount,
        status="pending",
        remaining_attempts=3,
        created_at=datetime.utcnow()
    )
    
    db.add(verification_request)
    
    # Create payment record (mock payment for now)
    payment = models.Payment(
        user_id=current_user.id,
        payment_type=models.PaymentTypeEnum.PROPERTY_VERIFICATION,
        amount=amount,
        status=models.PaymentStatusEnum.COMPLETED,  # Mock - assume success
        metadata_json=json.dumps({
            "property_id": request_data.property_id,
            "duration_days": request_data.duration_days,
            "verification_request_id": verification_request.id
        }),
        created_at=datetime.utcnow(),
        completed_at=datetime.utcnow()
    )
    
    db.add(payment)
    db.commit()
    
    # Send notification to seller
    notification = models.Notification(
        user_id=current_user.id,
        title="Verification Request Submitted",
        message=f"Your verification request for '{property.title}' has been submitted. You will receive a decision in 2-3 business days.",
        type="verification_request_submitted",
        related_id=verification_request.id,
        is_read=False
    )
    db.add(notification)
    
    # Send notification to all admins
    admins = db.query(models.User).filter(models.User.is_admin == True).all()
    for admin in admins:
        admin_notification = models.Notification(
            user_id=admin.id,
            title="New Property Verification Request",
            message=f"Property '{property.title}' has requested verification.",
            type="new_verification_request",
            related_id=verification_request.id,
            is_read=False
        )
        db.add(admin_notification)
    
    db.commit()
    
    return {
        "message": "Verification request submitted successfully",
        "request_id": verification_request.id,
        "amount": amount,
        "remaining_attempts": 3
    }

@router.get("/property/{property_id}/status")
def get_property_verification_status(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get verification status for a property (for seller)"""
    
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Check if user is owner or admin
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get pending verification request
    pending_request = db.query(models.PropertyVerificationRequest).filter(
        models.PropertyVerificationRequest.property_id == property_id,
        models.PropertyVerificationRequest.status == "pending"
    ).first()
    
    # Get rejected requests count
    rejected_requests = db.query(models.PropertyVerificationRequest).filter(
        models.PropertyVerificationRequest.property_id == property_id,
        models.PropertyVerificationRequest.status == "rejected"
    ).all()
    
    result = {
        "is_verified": property.is_verified,
        "verified_until": property.verified_until,
        "verification_chances_remaining": property.verification_chances_remaining,
        "has_pending_request": pending_request is not None,
        "pending_request_id": pending_request.id if pending_request else None,
        "rejected_attempts_used": len(rejected_requests),
        "max_attempts": 3
    }
    
    if pending_request:
        result["pending_request_status"] = pending_request.status
        result["pending_request_created_at"] = pending_request.created_at
    
    return result

@router.get("/property/{property_id}/remaining-chances")
def get_remaining_chances(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get remaining chances for major edits on verified property"""
    
    property = db.query(models.Property).filter(
        models.Property.id == property_id,
        models.Property.owner_id == current_user.id
    ).first()
    
    if not property:
        raise HTTPException(status_code=404, detail="Property not found or you don't own it")
    
    if not property.is_verified:
        return {"remaining_chances": 0, "message": "Property is not verified"}
    
    # Count used chances from approved edit requests
    used_chances = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.property_id == property_id,
        models.PropertyChangeRequest.status == "approved"
    ).count()
    
    remaining = max(0, property.verification_chances_remaining - used_chances)
    
    return {
        "remaining_chances": remaining,
        "total_chances": property.verification_chances_remaining,
        "used_chances": used_chances
    }

# ========== VERIFIED PROPERTY EDIT REQUESTS ==========

@router.post("/edit-request")
def request_property_edit(
    request_data: EditRequestCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit edit request for a verified property (locked fields)"""
    
    property = db.query(models.Property).filter(
        models.Property.id == request_data.property_id,
        models.Property.owner_id == current_user.id
    ).first()
    
    if not property:
        raise HTTPException(status_code=404, detail="Property not found or you don't own it")
    
    if not property.is_verified:
        raise HTTPException(status_code=400, detail="Property is not verified. Only verified properties require approval for major edits.")
    
    # Check if there's already a pending edit request
    pending_request = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.property_id == request_data.property_id,
        models.PropertyChangeRequest.status == "pending"
    ).first()
    
    if pending_request:
        raise HTTPException(status_code=400, detail="You already have a pending edit request for this property")
    
    # Check remaining chances
    used_chances = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.property_id == request_data.property_id,
        models.PropertyChangeRequest.status == "approved"
    ).count()
    
    remaining_chances = max(0, property.verification_chances_remaining - used_chances)
    
    if remaining_chances <= 0:
        raise HTTPException(status_code=400, detail="You have no remaining chances for major edits. Please purchase additional chances.")
    
    # Create edit request
    edit_request = models.PropertyChangeRequest(
        property_id=request_data.property_id,
        user_id=current_user.id,
        changes=json.dumps(request_data.changes),
        status="pending",
        created_at=datetime.utcnow()
    )
    
    db.add(edit_request)
    db.commit()
    
    # Send notification to all admins
    admins = db.query(models.User).filter(models.User.is_admin == True).all()
    for admin in admins:
        admin_notification = models.Notification(
            user_id=admin.id,
            title="New Property Edit Request",
            message=f"Property '{property.title}' has requested to edit locked fields.",
            type="new_edit_request",
            related_id=edit_request.id,
            is_read=False
        )
        db.add(admin_notification)
    
    db.commit()
    
    return {
        "message": "Edit request submitted successfully",
        "request_id": edit_request.id,
        "remaining_chances": remaining_chances - 1,
        "changes_requested": request_data.changes
    }

@router.get("/edit-requests")
def get_my_edit_requests(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all edit requests submitted by the current user"""
    
    requests = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.user_id == current_user.id
    ).order_by(models.PropertyChangeRequest.created_at.desc()).all()
    
    result = []
    for req in requests:
        property = db.query(models.Property).filter(models.Property.id == req.property_id).first()
        result.append({
            "id": req.id,
            "property_id": req.property_id,
            "property_title": property.title if property else "Unknown",
            "changes": json.loads(req.changes) if req.changes else {},
            "status": req.status,
            "admin_comment": req.admin_comment,
            "created_at": req.created_at,
            "reviewed_at": req.reviewed_at
        })
    
    return result

@router.get("/edit-request/{request_id}/status")
def get_edit_request_status(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get status of a specific edit request"""
    
    edit_request = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.id == request_id,
        models.PropertyChangeRequest.user_id == current_user.id
    ).first()
    
    if not edit_request:
        raise HTTPException(status_code=404, detail="Edit request not found")
    
    property = db.query(models.Property).filter(models.Property.id == edit_request.property_id).first()
    
    return {
        "id": edit_request.id,
        "property_id": edit_request.property_id,
        "property_title": property.title if property else "Unknown",
        "changes": json.loads(edit_request.changes) if edit_request.changes else {},
        "status": edit_request.status,
        "admin_comment": edit_request.admin_comment,
        "created_at": edit_request.created_at,
        "reviewed_at": edit_request.reviewed_at
    }

# ========== PURCHASE ADDITIONAL CHANCES ==========

class PurchaseChancesRequest(BaseModel):
    property_id: int
    chance_package: str  # "single" or "three"

@router.post("/purchase-chances")
def purchase_additional_chances(
    request_data: PurchaseChancesRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Purchase additional chances for major edits on verified property"""
    
    property = db.query(models.Property).filter(
        models.Property.id == request_data.property_id,
        models.Property.owner_id == current_user.id
    ).first()
    
    if not property:
        raise HTTPException(status_code=404, detail="Property not found or you don't own it")
    
    if not property.is_verified:
        raise HTTPException(status_code=400, detail="Property is not verified")
    
    # Chance package pricing
    chance_prices = {
        "single": 99,
        "three": 249
    }
    
    if request_data.chance_package not in chance_prices:
        raise HTTPException(status_code=400, detail="Invalid chance package. Choose 'single' or 'three'")
    
    amount = chance_prices[request_data.chance_package]
    chances_to_add = 1 if request_data.chance_package == "single" else 3
    
    # Create payment record (mock payment for now)
    payment = models.Payment(
        user_id=current_user.id,
        payment_type=models.PaymentTypeEnum.PROPERTY_VERIFICATION,
        amount=amount,
        status=models.PaymentStatusEnum.COMPLETED,  # Mock - assume success
        metadata_json=json.dumps({
            "property_id": request_data.property_id,
            "chance_package": request_data.chance_package,
            "chances_added": chances_to_add
        }),
        created_at=datetime.utcnow(),
        completed_at=datetime.utcnow()
    )
    
    db.add(payment)
    
    # Increase property's verification chances
    property.verification_chances_remaining += chances_to_add
    db.commit()
    
    # Send notification to seller
    notification = models.Notification(
        user_id=current_user.id,
        title="Additional Chances Purchased",
        message=f"You have purchased {chances_to_add} additional chance(s) for major edits on '{property.title}'. Total remaining chances: {property.verification_chances_remaining}",
        type="chances_purchased",
        related_id=property.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    
    return {
        "message": f"Successfully purchased {chances_to_add} additional chance(s)",
        "remaining_chances": property.verification_chances_remaining,
        "amount_paid": amount
    }

# ========== CHECK EDIT PERMISSIONS ==========

@router.get("/property/{property_id}/can-edit-field/{field_name}")
def can_edit_field(
    property_id: int,
    field_name: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if a specific field can be edited immediately or requires admin approval"""
    
    property = db.query(models.Property).filter(
        models.Property.id == property_id,
        models.Property.owner_id == current_user.id
    ).first()
    
    if not property:
        raise HTTPException(status_code=404, detail="Property not found or you don't own it")
    
    # Fields that can be edited immediately (no approval needed)
    immediate_edit_fields = ["title", "description", "per_sqft_price", "status"]
    
    # Fields that require admin approval (locked for verified properties)
    locked_fields = ["images", "documents", "dimensions_width", "dimensions_height", 
                     "north", "south", "east", "west", "land_size_sqft", 
                     "location_city", "location_address"]
    
    if not property.is_verified:
        return {
            "field": field_name,
            "requires_approval": False,
            "message": "Property is not verified. All fields can be edited directly."
        }
    
    if field_name in immediate_edit_fields:
        return {
            "field": field_name,
            "requires_approval": False,
            "message": "This field can be edited immediately without admin approval."
        }
    elif field_name in locked_fields:
        # Check remaining chances
        used_chances = db.query(models.PropertyChangeRequest).filter(
            models.PropertyChangeRequest.property_id == property_id,
            models.PropertyChangeRequest.status == "approved"
        ).count()
        
        remaining_chances = max(0, property.verification_chances_remaining - used_chances)
        
        return {
            "field": field_name,
            "requires_approval": True,
            "remaining_chances": remaining_chances,
            "message": f"This field requires admin approval to edit. You have {remaining_chances} chance(s) remaining."
        }
    else:
        return {
            "field": field_name,
            "requires_approval": False,
            "message": "This field can be edited directly."
        }