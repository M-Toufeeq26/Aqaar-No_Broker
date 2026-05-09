from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
from app.database import get_db
from app import models
from app.utils.auth import get_current_user, get_current_admin
from app.schemas import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])

# ========== RECEIVED NOTIFICATIONS (For current user) ==========

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    limit: Optional[int] = Query(50, ge=1, le=200),
    offset: Optional[int] = Query(0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).offset(offset).limit(limit).all()
    
    return [NotificationResponse(
        id=n.id,
        title=n.title,
        message=n.message,
        type=n.type,
        related_id=n.related_id,
        is_read=n.is_read,
        created_at=n.created_at
    ) for n in notifications]

@router.get("/all")
def get_all_notifications(
    current_user: models.User = Depends(get_current_user),
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

@router.get("/latest")
def get_latest_notifications(
    limit: Optional[int] = Query(5, ge=1, le=20),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).limit(limit).all()
    
    return [{
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "related_id": n.related_id,
        "is_read": n.is_read,
        "created_at": n.created_at
    } for n in notifications]

@router.get("/unread/count")
def get_unread_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).count()
    
    return {"unread_count": count}

@router.get("/unread")
def get_unread_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
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

@router.put("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    db.commit()
    
    return {"message": "Marked as read"}

@router.put("/read-all")
def mark_all_as_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    
    return {"message": "All notifications marked as read"}

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted"}

@router.delete("/read/all")
def delete_all_read_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    deleted_count = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == True
    ).delete()
    
    db.commit()
    
    return {"message": f"Deleted {deleted_count} read notifications"}

@router.delete("/clear/all")
def clear_all_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).delete()
    
    db.commit()
    
    return {"message": "All notifications cleared"}

# ========== SENT NOTIFICATIONS (For Admin only) ==========

@router.get("/sent")
def get_sent_notifications(
    limit: Optional[int] = Query(50, ge=1, le=200),
    offset: Optional[int] = Query(0, ge=0),
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all notifications sent by admin (broadcast and user-specific)"""
    
    # Get notification types that are sent by admin
    admin_sent_types = [
        "admin_broadcast", "account_blocked", "account_unblocked",
        "verification_approved", "verification_rejected",
        "property_verification_approved", "property_verification_rejected",
        "warning_sent", "edit_request_approved", "edit_request_rejected"
    ]
    
    sent_notifications = db.query(models.Notification).filter(
        models.Notification.type.in_(admin_sent_types)
    ).order_by(models.Notification.created_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for n in sent_notifications:
        # Get recipient name
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

@router.get("/sent/count")
def get_sent_notifications_count(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get count of sent notifications"""
    
    admin_sent_types = [
        "admin_broadcast", "account_blocked", "account_unblocked",
        "verification_approved", "verification_rejected",
        "property_verification_approved", "property_verification_rejected",
        "warning_sent", "edit_request_approved", "edit_request_rejected"
    ]
    
    count = db.query(models.Notification).filter(
        models.Notification.type.in_(admin_sent_types)
    ).count()
    
    return {"sent_notifications_count": count}

@router.get("/sent/{notification_id}")
def get_sent_notification_detail(
    notification_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get details of a specific sent notification"""
    
    admin_sent_types = [
        "admin_broadcast", "account_blocked", "account_unblocked",
        "verification_approved", "verification_rejected",
        "property_verification_approved", "property_verification_rejected",
        "warning_sent", "edit_request_approved", "edit_request_rejected"
    ]
    
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.type.in_(admin_sent_types)
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    recipient = db.query(models.User).filter(models.User.id == notification.user_id).first()
    
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "type": notification.type,
        "recipient_id": notification.user_id,
        "recipient_name": recipient.full_name if recipient else "Unknown",
        "recipient_email": recipient.email if recipient else "Unknown",
        "is_read": notification.is_read,
        "created_at": notification.created_at
    }