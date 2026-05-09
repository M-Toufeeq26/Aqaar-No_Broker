from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app import models
from app.utils.auth import get_current_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/warnings", tags=["warnings"])

class WarningCreate(BaseModel):
    property_id: int
    warning_message: str

@router.post("/send")
def send_warning(
    warning_data: WarningCreate,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == warning_data.property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    warning_record = models.WarningRecord(
        property_id=warning_data.property_id,
        user_id=property.owner_id,
        warning_message=warning_data.warning_message,
        issued_at=datetime.utcnow(),
        expires_at=expires_at,
        status="pending"
    )
    db.add(warning_record)
    db.commit()
    
    notification = models.Notification(
        user_id=property.owner_id,
        title="⚠️ Warning from Admin",
        message=f"Your property '{property.title}' has been reported. Please remove or correct it within 24 hours. Reason: {warning_data.warning_message}",
        type="warning_received",
        related_id=warning_record.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    
    return {
        "message": f"Warning sent to seller for property '{property.title}'",
        "warning_id": warning_record.id,
        "expires_at": expires_at
    }

@router.get("/not-removed")
def get_not_removed_properties(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    expired_warnings = db.query(models.WarningRecord).filter(
        models.WarningRecord.expires_at < datetime.utcnow(),
        models.WarningRecord.status == "pending"
    ).all()
    
    for warning in expired_warnings:
        warning.status = "ignored"
    db.commit()
    
    ignored_properties = db.query(models.WarningRecord).filter(
        models.WarningRecord.status == "ignored"
    ).all()
    
    result = []
    for warning in ignored_properties:
        property = db.query(models.Property).filter(models.Property.id == warning.property_id).first()
        user = db.query(models.User).filter(models.User.id == warning.user_id).first()
        if property and user:
            result.append({
                "id": warning.id,
                "property_id": warning.property_id,
                "property_title": property.title,
                "owner_name": user.full_name,
                "owner_email": user.email,
                "warning_message": warning.warning_message,
                "issued_at": warning.issued_at,
                "expires_at": warning.expires_at
            })
    
    return result

@router.put("/resolve/{property_id}")
def resolve_warning(
    property_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    warning = db.query(models.WarningRecord).filter(
        models.WarningRecord.property_id == property_id,
        models.WarningRecord.status == "pending"
    ).first()
    
    if not warning:
        raise HTTPException(status_code=404, detail="No pending warning found for this property")
    
    warning.status = "resolved"
    db.commit()
    
    return {"message": "Warning marked as resolved (seller removed/corrected the property)"}

@router.delete("/property/{property_id}")
def delete_property_from_warning(
    property_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    warning = db.query(models.WarningRecord).filter(
        models.WarningRecord.property_id == property_id,
        models.WarningRecord.status == "pending"
    ).first()
    
    if warning:
        warning.status = "resolved"
        db.commit()
    
    db.delete(property)
    db.commit()
    
    return {"message": f"Property '{property.title}' has been deleted"}

@router.post("/punish/{property_id}")
def punish_user_for_not_removing(
    property_id: int,
    duration_days: int = 7,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    warning = db.query(models.WarningRecord).filter(
        models.WarningRecord.property_id == property_id,
        models.WarningRecord.status == "ignored"
    ).first()
    
    if not warning:
        raise HTTPException(status_code=404, detail="No ignored warning found for this property")
    
    user = db.query(models.User).filter(models.User.id == property.owner_id).first()
    if user:
        user.is_blocked = True
        user.block_reason = f"Failed to remove reported property within 24 hours after warning"
        user.block_until = datetime.utcnow() + timedelta(days=duration_days)
        db.commit()
        
        notification = models.Notification(
            user_id=user.id,
            title="Account Blocked",
            message=f"Your account has been blocked for {duration_days} days because you did not remove the reported property '{property.title}' within 24 hours after receiving a warning.",
            type="account_blocked",
            related_id=None,
            is_read=False
        )
        db.add(notification)
        db.commit()
    
    warning.status = "punished"
    db.commit()
    
    return {"message": f"User {user.full_name} has been blocked for {duration_days} days"}