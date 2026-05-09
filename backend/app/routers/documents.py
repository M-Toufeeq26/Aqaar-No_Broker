from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from app.database import get_db
from app import models
from app.utils.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])

class DocumentRequestModel(BaseModel):
    property_id: int

@router.get("/{property_id}")
def get_documents(
    property_id: int,
    db: Session = Depends(get_db)
):
    documents = db.query(models.PropertyDocument).filter(
        models.PropertyDocument.property_id == property_id
    ).all()
    
    return [{
        "id": doc.id,
        "document_name": doc.original_filename,
        "uploaded_at": doc.created_at
    } for doc in documents]

@router.get("/requests/pending")
def get_pending_document_requests(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    requests = db.query(models.DocumentRequest).join(
        models.Property
    ).filter(
        models.Property.owner_id == current_user.id,
        models.DocumentRequest.status == "PENDING"
    ).all()
    
    result = []
    for req in requests:
        property = db.query(models.Property).filter(models.Property.id == req.property_id).first()
        buyer = db.query(models.User).filter(models.User.id == req.buyer_id).first()
        result.append({
            "id": req.id,
            "property_id": req.property_id,
            "property_title": property.title if property else "",
            "buyer_id": req.buyer_id,
            "buyer_name": buyer.full_name if buyer else "",
            "status": req.status,
            "rejection_count": req.rejection_count,
            "created_at": req.created_at
        })
    
    return result

@router.get("/request-status/{property_id}")
def get_document_request_status(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pending = db.query(models.DocumentRequest).filter(
        models.DocumentRequest.property_id == property_id,
        models.DocumentRequest.buyer_id == current_user.id,
        models.DocumentRequest.status == "PENDING"
    ).first()
    
    approved = db.query(models.DocumentRequest).filter(
        models.DocumentRequest.property_id == property_id,
        models.DocumentRequest.buyer_id == current_user.id,
        models.DocumentRequest.status == "APPROVED"
    ).first()
    
    return {
        "has_pending": pending is not None,
        "has_approved": approved is not None
    }

@router.post("/request")
def request_document_access(
    request_data: DocumentRequestModel,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property_id = request_data.property_id
    
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    total_requests = db.query(models.DocumentRequest).filter(
        models.DocumentRequest.property_id == property_id,
        models.DocumentRequest.buyer_id == current_user.id
    ).count()
    
    if total_requests >= 5:
        cooldown_request = db.query(models.DocumentRequest).filter(
            models.DocumentRequest.property_id == property_id,
            models.DocumentRequest.buyer_id == current_user.id,
            models.DocumentRequest.cooldown_until > datetime.utcnow()
        ).first()
        
        if cooldown_request and cooldown_request.cooldown_until > datetime.utcnow():
            days_left = (cooldown_request.cooldown_until - datetime.utcnow()).days
            raise HTTPException(status_code=400, detail=f"You have reached the limit of 5 requests. Please wait {days_left} days before requesting again.")
        elif total_requests >= 5:
            cooldown_until = datetime.utcnow() + timedelta(days=7)
            raise HTTPException(status_code=400, detail=f"You have reached the limit of 5 requests. Please wait 7 days before requesting again.")
    
    existing = db.query(models.DocumentRequest).filter(
        models.DocumentRequest.property_id == property_id,
        models.DocumentRequest.buyer_id == current_user.id,
        models.DocumentRequest.status == "PENDING"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request")
    
    request = models.DocumentRequest(
        property_id=property_id,
        buyer_id=current_user.id,
        seller_id=property.owner_id,
        status="PENDING"
    )
    db.add(request)
    db.commit()
    
    notification = models.Notification(
        user_id=property.owner_id,
        title="Document Request",
        message=f"{current_user.full_name} has requested access to documents for {property.title}",
        type="document_request",
        related_id=request.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    
    return {"message": "Document request sent successfully"}

@router.put("/requests/{request_id}/approve")
def approve_document_request(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request = db.query(models.DocumentRequest).filter(models.DocumentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    request.status = "APPROVED"
    db.commit()
    
    notification = models.Notification(
        user_id=request.buyer_id,
        title="Document Access Approved",
        message=f"Your document request has been approved. You can now view the documents.",
        type="document_approved",
        related_id=request.property_id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    
    return {"message": "Document request approved successfully"}

@router.put("/requests/{request_id}/reject")
def reject_document_request(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request = db.query(models.DocumentRequest).filter(models.DocumentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    request.status = "REJECTED"
    db.commit()
    
    notification = models.Notification(
        user_id=request.buyer_id,
        title="Document Request Rejected",
        message=f"Your document request has been rejected by the seller.",
        type="document_rejected",
        related_id=request.property_id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    
    return {"message": "Document request rejected"}

@router.get("/view/{property_id}")
def view_documents(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request = db.query(models.DocumentRequest).filter(
        models.DocumentRequest.property_id == property_id,
        models.DocumentRequest.buyer_id == current_user.id,
        models.DocumentRequest.status == "APPROVED"
    ).first()
    
    if not request:
        raise HTTPException(status_code=403, detail="You do not have access to these documents")
    
    documents = db.query(models.PropertyDocument).filter(
        models.PropertyDocument.property_id == property_id
    ).all()
    
    return {"documents": [{"document_name": doc.original_filename, "view_url": doc.document_url} for doc in documents]}