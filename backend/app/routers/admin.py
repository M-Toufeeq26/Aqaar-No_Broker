from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app import models
from app.utils.auth import get_current_admin
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/admin", tags=["admin"])

class BlockUserRequest(BaseModel):
    duration_days: Optional[int] = None
    reason: str
    is_permanent: bool = False

class UpdateBlockRequest(BaseModel):
    duration_days: Optional[int] = None
    reason: str
    is_permanent: bool = False

class BroadcastNotificationRequest(BaseModel):
    title: str
    message: str
    type: str = "admin_broadcast"

# ========== PROFILE ==========
@router.get("/profile")
def get_admin_profile(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "is_admin": current_user.is_admin,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at
    }

# ========== NOTIFICATION HISTORY ==========
@router.get("/notifications/received")
def get_received_notifications(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).all()
    return [{
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "related_id": n.related_id,
        "is_read": n.is_read,
        "created_at": n.created_at
    } for n in notifications]

@router.get("/notifications/sent")
def get_sent_notifications(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    sent_notifications = db.query(models.Notification).filter(
        models.Notification.type.in_(["admin_broadcast", "account_blocked", "account_unblocked", 
                                       "verification_approved", "verification_rejected",
                                       "property_verification_approved", "property_verification_rejected",
                                       "warning_sent", "edit_request_approved", "edit_request_rejected",
                                       "sponsorship_approved", "sponsorship_rejected"])
    ).order_by(models.Notification.created_at.desc()).all()
    result = []
    for n in sent_notifications:
        recipient = db.query(models.User).filter(models.User.id == n.user_id).first()
        result.append({
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "recipient_id": n.user_id,
            "recipient_name": recipient.full_name if recipient else "Unknown",
            "recipient_email": recipient.email if recipient else "Unknown",
            "is_read": n.is_read,
            "created_at": n.created_at
        })
    return result

@router.post("/notifications/broadcast")
def broadcast_notification(
    request: BroadcastNotificationRequest,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    users = db.query(models.User).filter(models.User.is_active == True).all()
    count = 0
    for user in users:
        notification = models.Notification(
            user_id=user.id,
            title=request.title,
            message=request.message,
            type=request.type,
            related_id=None,
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notification)
        count += 1
    db.commit()
    return {"message": f"Broadcast notification sent to {count} users"}

# ========== USER MANAGEMENT (EXCLUDING ADMINS) ==========
@router.get("/users")
def get_all_users(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    users = db.query(models.User).filter(models.User.is_admin == False).all()
    return [{
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "phone": u.phone,
        "is_admin": u.is_admin,
        "is_verified": u.is_verified,
        "is_blocked": u.is_blocked if hasattr(u, 'is_blocked') else False,
        "block_reason": u.block_reason if hasattr(u, 'block_reason') else None,
        "block_until": u.block_until if hasattr(u, 'block_until') else None,
        "avg_rating": u.avg_rating,
        "created_at": u.created_at
    } for u in users]

@router.get("/users/{user_id}/detail")
def get_user_detail(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified,
        "is_blocked": getattr(user, 'is_blocked', False),
        "block_reason": getattr(user, 'block_reason', None),
        "block_until": getattr(user, 'block_until', None),
        "avg_rating": user.avg_rating,
        "created_at": user.created_at
    }

@router.get("/users/{user_id}/properties")
def get_user_properties(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    properties = db.query(models.Property).filter(models.Property.owner_id == user_id).all()
    return [{
        "id": p.id,
        "title": p.title,
        "price": p.price,
        "status": p.status,
        "is_verified": p.is_verified if hasattr(p, 'is_verified') else False,
        "verified_until": p.verified_until if hasattr(p, 'verified_until') else None,
        "created_at": p.created_at
    } for p in properties]

@router.get("/users/{user_id}/interests")
def get_user_interests(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    interests = db.query(models.PropertyInterest).filter(
        models.PropertyInterest.user_id == user_id
    ).all()
    result = []
    for interest in interests:
        property = db.query(models.Property).filter(models.Property.id == interest.property_id).first()
        result.append({
            "id": interest.id,
            "property_id": interest.property_id,
            "property_title": property.title if property else "Unknown",
            "status": interest.status,
            "created_at": interest.created_at
        })
    return result

@router.get("/users/{user_id}/chats")
def get_user_chats(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    chats = db.query(models.ChatMessage).filter(
        (models.ChatMessage.sender_id == user_id) | (models.ChatMessage.receiver_id == user_id)
    ).order_by(models.ChatMessage.created_at.desc()).limit(50).all()
    result = []
    for chat in chats:
        other_user_id = chat.receiver_id if chat.sender_id == user_id else chat.sender_id
        other_user = db.query(models.User).filter(models.User.id == other_user_id).first()
        property = db.query(models.Property).filter(models.Property.id == chat.property_id).first()
        result.append({
            "id": chat.id,
            "property_title": property.title if property else "Unknown",
            "other_user_name": other_user.full_name if other_user else "Unknown",
            "message": chat.message,
            "is_sent_by_user": chat.sender_id == user_id,
            "created_at": chat.created_at
        })
    return result

@router.get("/users/{user_id}/wishlist")
def get_user_wishlist(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wishlist = db.query(models.Wishlist).filter(
        models.Wishlist.user_id == user_id
    ).all()
    result = []
    for item in wishlist:
        property = db.query(models.Property).filter(models.Property.id == item.property_id).first()
        if property:
            result.append({
                "id": item.id,
                "property_id": property.id,
                "property_title": property.title,
                "property_price": property.price,
                "created_at": item.created_at
            })
    return result

@router.get("/users/{user_id}/payments")
def get_user_payments(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    payments = db.query(models.Payment).filter(models.Payment.user_id == user_id).all()
    return [{
        "id": p.id,
        "payment_type": p.payment_type,
        "amount": p.amount,
        "status": p.status,
        "created_at": p.created_at
    } for p in payments]

@router.get("/users/{user_id}/warning-history")
def get_user_warning_history(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    warnings = db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.type == "warning_sent"
    ).order_by(models.Notification.created_at.desc()).all()
    return [{
        "id": w.id,
        "title": w.title,
        "message": w.message,
        "created_at": w.created_at
    } for w in warnings]

@router.post("/users/{user_id}/block")
def block_user(
    user_id: int,
    request: BlockUserRequest,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_blocked = True
    user.block_reason = request.reason
    if request.is_permanent:
        user.block_until = None
    else:
        user.block_until = datetime.utcnow() + timedelta(days=request.duration_days or 7)
    db.commit()
    if request.is_permanent:
        message = f"Your account has been permanently banned. Reason: {request.reason}"
    else:
        days_left = request.duration_days or 7
        message = f"Your account has been temporarily blocked for {days_left} days. Reason: {request.reason}"
    notification = models.Notification(
        user_id=user_id,
        title="Account Blocked",
        message=message,
        type="account_blocked",
        related_id=None,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": f"User {user.email} has been blocked", "success": True}

@router.put("/users/{user_id}/block/update")
def update_user_block(
    user_id: int,
    request: UpdateBlockRequest,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_blocked:
        raise HTTPException(status_code=400, detail="User is not currently blocked")
    user.block_reason = request.reason
    if request.is_permanent:
        user.block_until = None
    else:
        user.block_until = datetime.utcnow() + timedelta(days=request.duration_days or 7)
    db.commit()
    if request.is_permanent:
        message = f"Your block has been updated to permanent. Reason: {request.reason}"
    else:
        days_left = request.duration_days or 7
        message = f"Your block has been extended to {days_left} days. Reason: {request.reason}"
    notification = models.Notification(
        user_id=user_id,
        title="Block Updated",
        message=message,
        type="account_blocked",
        related_id=None,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": f"Block for user {user.email} has been updated", "success": True}

@router.delete("/users/{user_id}/block")
def unblock_user(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot unblock yourself")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_blocked = False
    user.block_reason = None
    user.block_until = None
    db.commit()
    notification = models.Notification(
        user_id=user_id,
        title="Account Unblocked",
        message="Your account has been unblocked. You can now log in and use the platform.",
        type="account_unblocked",
        related_id=None,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": f"User {user.email} has been unblocked", "success": True}

@router.put("/users/{user_id}/toggle-verify")
def toggle_verify(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own verification status")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = not user.is_verified
    db.commit()
    properties = db.query(models.Property).filter(models.Property.owner_id == user_id).all()
    for prop in properties:
        prop.is_verified = user.is_verified
        if user.is_verified:
            prop.verified_until = datetime.utcnow() + timedelta(days=30)
        else:
            prop.verified_until = None
    db.commit()
    return {"message": f"Verification status for {user.email} updated to {user.is_verified}", "success": True}

# ========== DELETE USER ==========
@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        properties = db.query(models.Property).filter(models.Property.owner_id == user_id).all()
        property_ids = [p.id for p in properties]
        if property_ids:
            db.query(models.SponsoredListing).filter(
                models.SponsoredListing.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.SponsorshipRequest).filter(
                models.SponsorshipRequest.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.PropertyVerificationRequest).filter(
                models.PropertyVerificationRequest.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.PropertyChangeRequest).filter(
                models.PropertyChangeRequest.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.PropertyImage).filter(
                models.PropertyImage.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.PropertyDocument).filter(
                models.PropertyDocument.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.PropertyInterest).filter(
                models.PropertyInterest.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.Wishlist).filter(
                models.Wishlist.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.PropertyView).filter(
                models.PropertyView.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
            db.query(models.ChatMessage).filter(
                models.ChatMessage.property_id.in_(property_ids)
            ).delete(synchronize_session=False)
        db.query(models.Property).filter(models.Property.owner_id == user_id).delete(synchronize_session=False)
        db.query(models.Notification).filter(models.Notification.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Wishlist).filter(models.Wishlist.user_id == user_id).delete(synchronize_session=False)
        db.query(models.PropertyInterest).filter(models.PropertyInterest.user_id == user_id).delete(synchronize_session=False)
        db.query(models.ChatMessage).filter(
            (models.ChatMessage.sender_id == user_id) | (models.ChatMessage.receiver_id == user_id)
        ).delete(synchronize_session=False)
        db.query(models.DocumentRequest).filter(
            (models.DocumentRequest.buyer_id == user_id) | (models.DocumentRequest.seller_id == user_id)
        ).delete(synchronize_session=False)
        db.query(models.Report).filter(
            (models.Report.reporter_id == user_id) | (models.Report.reported_user_id == user_id)
        ).delete(synchronize_session=False)
        db.query(models.Rating).filter(models.Rating.user_id == user_id).delete(synchronize_session=False)
        db.query(models.Payment).filter(models.Payment.user_id == user_id).delete(synchronize_session=False)
        db.query(models.VerificationRequest).filter(
            models.VerificationRequest.user_id == user_id
        ).delete(synchronize_session=False)
        db.delete(user)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting user: {str(e)}")
    return {"message": "User deleted successfully", "success": True}

# ========== PROPERTIES MANAGEMENT ==========
@router.get("/properties")
def get_all_properties_admin(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    properties = db.query(models.Property).order_by(models.Property.created_at.desc()).all()
    result = []
    for p in properties:
        owner = db.query(models.User).filter(models.User.id == p.owner_id).first()
        result.append({
            "id": p.id,
            "title": p.title,
            "price": p.price,
            "status": p.status,
            "is_sponsored": p.is_sponsored,
            "is_verified": getattr(p, 'is_verified', False),
            "verified_until": getattr(p, 'verified_until', None),
            "sponsored_until": getattr(p, 'sponsored_until', None),
            "owner_id": p.owner_id,
            "owner_email": owner.email if owner else None,
            "views_count": p.views_count,
            "created_at": p.created_at,
            "updated_at": p.updated_at
        })
    return result

@router.delete("/properties/{property_id}")
def delete_property_admin(
    property_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(property)
    db.commit()
    return {"message": "Property deleted successfully"}

# ========== SPONSORSHIP APPROVAL ==========
@router.get("/sponsorship-requests")
def get_sponsorship_requests(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    requests = db.query(models.SponsorshipRequest).filter(
        models.SponsorshipRequest.status == "pending"
    ).order_by(models.SponsorshipRequest.created_at.desc()).all()
    result = []
    for req in requests:
        property = db.query(models.Property).filter(models.Property.id == req.property_id).first()
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
        result.append({
            "id": req.id,
            "property_id": req.property_id,
            "property_title": property.title if property else "Unknown",
            "user_id": req.user_id,
            "user_name": user.full_name if user else "Unknown",
            "user_email": user.email if user else "Unknown",
            "duration_days": req.duration_days,
            "amount": req.amount,
            "status": req.status,
            "created_at": req.created_at
        })
    return result

@router.put("/sponsorship-requests/{request_id}/approve")
def approve_sponsorship(
    request_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    request = db.query(models.SponsorshipRequest).filter(
        models.SponsorshipRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Sponsorship request not found")
    property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    request.status = "approved"
    request.reviewed_at = datetime.utcnow()
    property.is_sponsored = True
    property.sponsored_until = datetime.utcnow() + timedelta(days=request.duration_days)
    sponsored_listing = models.SponsoredListing(
        property_id=request.property_id,
        duration_days=request.duration_days,
        start_date=datetime.utcnow(),
        end_date=datetime.utcnow() + timedelta(days=request.duration_days),
        is_active=True
    )
    db.add(sponsored_listing)
    db.commit()
    notification = models.Notification(
        user_id=request.user_id,
        title="Sponsorship Approved",
        message=f"Your sponsorship request for '{property.title}' has been approved. Your property will show a sponsored badge for {request.duration_days} days.",
        type="sponsorship_approved",
        related_id=property.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": f"Sponsorship approved for property '{property.title}'"}

@router.put("/sponsorship-requests/{request_id}/reject")
def reject_sponsorship(
    request_id: int,
    reason: str = None,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    request = db.query(models.SponsorshipRequest).filter(
        models.SponsorshipRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Sponsorship request not found")
    property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
    request.status = "rejected"
    request.admin_comment = reason
    request.reviewed_at = datetime.utcnow()
    db.commit()
    notification_message = f"Your sponsorship request for '{property.title if property else 'Unknown'}' was rejected."
    if reason:
        notification_message += f" Reason: {reason}"
    notification = models.Notification(
        user_id=request.user_id,
        title="Sponsorship Rejected",
        message=notification_message,
        type="sponsorship_rejected",
        related_id=property.id if property else None,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": "Sponsorship request rejected"}

# ========== PROPERTY VERIFICATION REQUESTS ==========
@router.get("/property-verifications")
def get_property_verification_requests(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    requests = db.query(models.PropertyVerificationRequest).filter(
        models.PropertyVerificationRequest.status == "pending"
    ).order_by(models.PropertyVerificationRequest.created_at.desc()).all()
    result = []
    for req in requests:
        property = db.query(models.Property).filter(models.Property.id == req.property_id).first()
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
        result.append({
            "id": req.id,
            "property_id": req.property_id,
            "property_title": property.title if property else "Unknown",
            "user_id": req.user_id,
            "user_name": user.full_name if user else "Unknown",
            "user_email": user.email if user else "Unknown",
            "duration_days": req.duration_days,
            "amount": req.amount,
            "remaining_attempts": req.remaining_attempts,
            "status": req.status,
            "created_at": req.created_at
        })
    return result

@router.put("/property-verifications/{request_id}/approve")
def approve_property_verification(
    request_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    request = db.query(models.PropertyVerificationRequest).filter(
        models.PropertyVerificationRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Verification request not found")
    property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    request.status = "approved"
    request.reviewed_at = datetime.utcnow()
    property.is_verified = True
    property.verified_until = datetime.utcnow() + timedelta(days=request.duration_days)
    property.verification_chances_remaining = 3
    db.commit()
    notification = models.Notification(
        user_id=request.user_id,
        title="Property Verification Approved",
        message=f"Your property '{property.title}' has been verified and will show a verified badge until {property.verified_until.strftime('%Y-%m-%d')}.",
        type="property_verification_approved",
        related_id=property.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": f"Property '{property.title}' has been verified"}

@router.put("/property-verifications/{request_id}/reject")
def reject_property_verification(
    request_id: int,
    reason: str = None,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    request = db.query(models.PropertyVerificationRequest).filter(
        models.PropertyVerificationRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Verification request not found")
    property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
    request.remaining_attempts -= 1
    request.admin_comment = reason
    if request.remaining_attempts <= 0:
        request.status = "rejected"
    else:
        request.status = "pending"
    request.reviewed_at = datetime.utcnow()
    db.commit()
    notification_message = f"Your verification request for property '{property.title if property else 'Unknown'}' was rejected."
    if reason:
        notification_message += f" Reason: {reason}"
    if request.remaining_attempts > 0:
        notification_message += f" You have {request.remaining_attempts} attempt(s) remaining."
    else:
        notification_message += " You have no attempts left. Please make a new payment to try again."
    notification = models.Notification(
        user_id=request.user_id,
        title="Property Verification Rejected",
        message=notification_message,
        type="property_verification_rejected",
        related_id=property.id if property else None,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": f"Verification request rejected. {request.remaining_attempts} attempts remaining"}

# ========== PROPERTY EDIT REQUESTS ==========
@router.get("/property-edit-requests")
def get_property_edit_requests(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    requests = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.status == "pending"
    ).order_by(models.PropertyChangeRequest.created_at.desc()).all()
    result = []
    for req in requests:
        property = db.query(models.Property).filter(models.Property.id == req.property_id).first()
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
        result.append({
            "id": req.id,
            "property_id": req.property_id,
            "property_title": property.title if property else "Unknown",
            "user_name": user.full_name if user else "Unknown",
            "user_email": user.email if user else "Unknown",
            "changes": req.changes,
            "status": req.status,
            "created_at": req.created_at
        })
    return result

@router.put("/property-edit-requests/{request_id}/approve")
def approve_edit_request(
    request_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    request = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Edit request not found")
    property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    import json
    try:
        changes = json.loads(request.changes)
        locked_fields = ["images", "documents", "dimensions_width", "dimensions_height", 
                         "north", "south", "east", "west", "land_size_sqft", 
                         "location_city", "location_address"]
        for key, value in changes.items():
            if key in locked_fields:
                setattr(property, key, value)
        property.updated_at = datetime.utcnow()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid changes format")
    request.status = "approved"
    request.reviewed_at = datetime.utcnow()
    db.commit()
    notification = models.Notification(
        user_id=request.user_id,
        title="Edit Request Approved",
        message=f"Your requested changes for property '{property.title}' have been approved and applied.",
        type="edit_request_approved",
        related_id=property.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": f"Edit request approved and changes applied to property '{property.title}'"}

@router.put("/property-edit-requests/{request_id}/reject")
def reject_edit_request(
    request_id: int,
    reason: str = None,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    request = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Edit request not found")
    property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
    request.status = "rejected"
    request.admin_comment = reason
    request.reviewed_at = datetime.utcnow()
    db.commit()
    notification_message = f"Your edit request for property '{property.title if property else 'Unknown'}' was rejected."
    if reason:
        notification_message += f" Reason: {reason}"
    notification = models.Notification(
        user_id=request.user_id,
        title="Edit Request Rejected",
        message=notification_message,
        type="edit_request_rejected",
        related_id=property.id if property else None,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": "Edit request rejected"}

# ========== USER VERIFICATION REQUESTS ==========
@router.get("/verifications")
def get_verification_requests(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    requests = db.query(models.VerificationRequest).filter(
        models.VerificationRequest.status == "pending"
    ).order_by(models.VerificationRequest.created_at.desc()).all()
    result = []
    for req in requests:
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
        result.append({
            "id": req.id,
            "user_id": req.user_id,
            "user_name": user.full_name if user else "Unknown",
            "user_email": user.email if user else "Unknown",
            "document_type": req.document_type,
            "document_url": req.document_url,
            "status": req.status,
            "created_at": req.created_at
        })
    return result

@router.put("/verifications/{request_id}/approve")
def approve_verification(
    request_id: int,
    admin_comment: str = None,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    request = db.query(models.VerificationRequest).filter(models.VerificationRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    request.status = "approved"
    request.admin_comment = admin_comment
    request.reviewed_at = datetime.utcnow()
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if user:
        user.is_verified = True
    db.commit()
    notification = models.Notification(
        user_id=request.user_id,
        title="Verification Approved",
        message="Your verification request has been approved. You now have a verified badge!",
        type="verification_approved",
        related_id=None,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": "Verification request approved"}

@router.put("/verifications/{request_id}/reject")
def reject_verification(
    request_id: int,
    admin_comment: str = None,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    request = db.query(models.VerificationRequest).filter(models.VerificationRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    request.status = "rejected"
    request.admin_comment = admin_comment
    request.reviewed_at = datetime.utcnow()
    db.commit()
    notification = models.Notification(
        user_id=request.user_id,
        title="Verification Rejected",
        message=f"Your verification request was rejected. Reason: {admin_comment or 'Please submit valid documents'}",
        type="verification_rejected",
        related_id=None,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": "Verification request rejected"}

# ========== DASHBOARD STATS (with not‑removed count, excluding blocked owners) ==========
@router.get("/dashboard")
def get_dashboard_stats(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    total_users = db.query(models.User).filter(models.User.is_admin == False).count()
    total_properties = db.query(models.Property).count()
    pending_property_verifications = db.query(models.PropertyVerificationRequest).filter(
        models.PropertyVerificationRequest.status == "pending"
    ).count()
    pending_user_verifications = db.query(models.VerificationRequest).filter(
        models.VerificationRequest.status == "pending"
    ).count()
    pending_edit_requests = db.query(models.PropertyChangeRequest).filter(
        models.PropertyChangeRequest.status == "pending"
    ).count()
    pending_sponsorships = db.query(models.SponsorshipRequest).filter(
        models.SponsorshipRequest.status == "pending"
    ).count()
    pending_reports = db.query(models.Report).filter(
        models.Report.status == "pending"
    ).count()
    
    # Count not‑removed properties (same logic as reports.py)
    three_days_ago = datetime.utcnow() - timedelta(days=3)
    warnings = db.query(models.Notification).filter(
        models.Notification.type == "warning_sent",
        models.Notification.created_at <= three_days_ago
    ).all()
    not_removed_count = 0
    for w in warnings:
        if w.related_id:
            prop = db.query(models.Property).filter(models.Property.id == w.related_id).first()
            if prop:
                owner = db.query(models.User).filter(models.User.id == prop.owner_id).first()
                if owner and not owner.is_blocked:
                    not_removed_count += 1
    
    total_pending_reports = pending_reports + not_removed_count
    
    return {
        "total_users": total_users,
        "total_properties": total_properties,
        "pending_property_verifications": pending_property_verifications,
        "pending_user_verifications": pending_user_verifications,
        "pending_edit_requests": pending_edit_requests,
        "pending_sponsorships": pending_sponsorships,
        "total_pending_reports": total_pending_reports
    }