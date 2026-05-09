from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app import models
from app.utils.auth import get_current_user, get_current_admin
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/reports", tags=["reports"])

class ReportCreate(BaseModel):
    property_id: int
    report_type: str
    description: str

class WarningSendRequest(BaseModel):
    property_id: int
    warning_message: str

# ========== CREATE REPORT ==========
@router.post("/property")
def report_property(
    report_data: ReportCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == report_data.property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    if property.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot report your own property")
    twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
    recent_report = db.query(models.Report).filter(
        models.Report.reporter_id == current_user.id,
        models.Report.property_id == report_data.property_id,
        models.Report.created_at > twenty_four_hours_ago
    ).first()
    if recent_report:
        raise HTTPException(status_code=400, detail="You have already reported this property. Please wait 24 hours before reporting again.")
    new_report = models.Report(
        reporter_id=current_user.id,
        reported_user_id=property.owner_id,
        property_id=report_data.property_id,
        report_type=report_data.report_type,
        description=report_data.description,
        status="pending",
        created_at=datetime.utcnow()
    )
    db.add(new_report)
    db.commit()
    admins = db.query(models.User).filter(models.User.is_admin == True).all()
    for admin in admins:
        notification = models.Notification(
            user_id=admin.id,
            title="New Report",
            message=f"Property '{property.title}' has been reported by {current_user.full_name}",
            type="new_report",
            related_id=new_report.id,
            is_read=False
        )
        db.add(notification)
    db.commit()
    return {"message": "Property reported successfully", "report_id": new_report.id}

# ========== GET PENDING REPORTS (grouped by property) ==========
@router.get("/pending")
def get_pending_reports(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    reports = db.query(models.Report).filter(
        models.Report.status == "pending"
    ).order_by(models.Report.created_at.desc()).all()
    property_groups = {}
    for report in reports:
        prop_id = report.property_id
        if prop_id not in property_groups:
            property = db.query(models.Property).filter(models.Property.id == prop_id).first()
            property_groups[prop_id] = {
                "property_id": prop_id,
                "property_title": property.title if property else "Unknown",
                "property_owner_id": property.owner_id if property else None,
                "reports": []
            }
        reporter = db.query(models.User).filter(models.User.id == report.reporter_id).first()
        property_groups[prop_id]["reports"].append({
            "report_id": report.id,
            "reporter_id": report.reporter_id,
            "reporter_name": reporter.full_name if reporter else "Unknown",
            "reporter_email": reporter.email if reporter else "Unknown",
            "report_type": report.report_type,
            "description": report.description or "No description provided",
            "created_at": report.created_at.isoformat() if report.created_at else None
        })
    result = []
    for prop_id, data in property_groups.items():
        result.append({
            "property_id": prop_id,
            "property_title": data["property_title"],
            "property_owner_id": data["property_owner_id"],
            "report_count": len(data["reports"]),
            "reports": data["reports"]
        })
    return result

# ========== RESOLVE / DISMISS SINGLE REPORT ==========
@router.put("/{report_id}/resolve")
def resolve_report(
    report_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "resolved"
    report.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Report resolved", "success": True}

@router.put("/{report_id}/dismiss")
def dismiss_report(
    report_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "dismissed"
    report.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Report dismissed", "success": True}

# ========== SEND WARNING (auto‑resolve pending reports) ==========
@router.post("/warnings/send")
def send_warning(
    request: WarningSendRequest,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == request.property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    owner = db.query(models.User).filter(models.User.id == property.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Property owner not found")
    
    notification = models.Notification(
        user_id=owner.id,
        title="⚠️ Warning for your property",
        message=f"Your property '{property.title}' has been reported. {request.warning_message}",
        type="warning_sent",
        related_id=property.id,
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(notification)
    
    # Resolve all pending reports for this property
    pending_reports = db.query(models.Report).filter(
        models.Report.property_id == request.property_id,
        models.Report.status == "pending"
    ).all()
    for report in pending_reports:
        report.status = "resolved"
        report.resolved_at = datetime.utcnow()
    
    db.commit()
    return {"message": f"Warning sent to {owner.full_name} and {len(pending_reports)} report(s) resolved", "success": True}

# ========== BLOCK USER (for not‑removed property) ==========
@router.post("/warnings/punish/{property_id}")
def punish_user(
    property_id: int,
    duration_days: int = 7,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    owner = db.query(models.User).filter(models.User.id == property.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Property owner not found")
    owner.is_blocked = True
    owner.block_reason = f"Violation: property '{property.title}' reported and not corrected."
    owner.block_until = datetime.utcnow() + timedelta(days=duration_days)
    db.commit()
    notification = models.Notification(
        user_id=owner.id,
        title="Account Blocked",
        message=f"Your account has been blocked for {duration_days} days because your property '{property.title}' violated platform rules.",
        type="account_blocked",
        related_id=property.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    return {"message": f"User {owner.full_name} blocked for {duration_days} days", "success": True}

# ========== DELETE PROPERTY (for not‑removed property) ==========
@router.delete("/warnings/property/{property_id}")
def delete_warning_property(
    property_id: int,
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(property)
    db.commit()
    return {"message": f"Property deleted successfully", "success": True}

# ========== GET NOT‑REMOVED PROPERTIES (using JOIN to exclude blocked owners) ==========
@router.get("/warnings/not-removed")
def get_not_removed_properties(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    three_days_ago = datetime.utcnow() - timedelta(days=3)
    # Join Notification -> Property -> User, filter warnings older than 3 days and owner not blocked
    results = db.query(
        models.Notification.id,
        models.Notification.related_id,
        models.Notification.message,
        models.Notification.created_at,
        models.Property.id.label("property_id"),
        models.Property.title.label("property_title"),
        models.User.full_name.label("owner_name"),
        models.User.email.label("owner_email")
    ).join(
        models.Property, models.Property.id == models.Notification.related_id
    ).join(
        models.User, models.User.id == models.Property.owner_id
    ).filter(
        models.Notification.type == "warning_sent",
        models.Notification.created_at <= three_days_ago,
        models.User.is_blocked == False   # Exclude blocked owners
    ).order_by(
        models.Notification.created_at.desc()
    ).all()
    
    result = []
    for row in results:
        result.append({
            "id": row.id,
            "property_id": row.property_id,
            "property_title": row.property_title,
            "owner_name": row.owner_name,
            "owner_email": row.owner_email,
            "warning_message": row.message,
            "expires_at": (row.created_at + timedelta(days=3)).isoformat(),
            "sent_at": row.created_at.isoformat()
        })
    return result

# ========== COUNT NOT‑REMOVED PROPERTIES (using JOIN) ==========
@router.get("/warnings/not-removed/count")
def get_not_removed_count(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    three_days_ago = datetime.utcnow() - timedelta(days=3)
    count = db.query(models.Notification).join(
        models.Property, models.Property.id == models.Notification.related_id
    ).join(
        models.User, models.User.id == models.Property.owner_id
    ).filter(
        models.Notification.type == "warning_sent",
        models.Notification.created_at <= three_days_ago,
        models.User.is_blocked == False
    ).count()
    return {"count": count}

# ========== CHECK IF USER CAN REPORT AGAIN ==========
@router.get("/check/{property_id}")
def check_user_report(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
    recent_report = db.query(models.Report).filter(
        models.Report.reporter_id == current_user.id,
        models.Report.property_id == property_id,
        models.Report.created_at > twenty_four_hours_ago
    ).first()
    return {
        "has_reported": recent_report is not None,
        "can_report_again": recent_report is None
    }