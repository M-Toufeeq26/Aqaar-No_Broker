from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_, between
from typing import Optional, List
from datetime import datetime, timedelta
from app.database import get_db
from app import models
from app.schemas import PropertyCreate, PropertyUpdate, PropertyResponse, ImageResponse
from app.utils.auth import get_current_user, get_current_admin
from app.utils.file_upload import save_image, save_document, validate_image, validate_document
import os
import math

router = APIRouter(prefix="/properties", tags=["properties"])

@router.get("/", response_model=List[PropertyResponse])
def get_properties(
    city: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    property_type: Optional[str] = Query(None),
    target_sqft: Optional[float] = Query(None),
    min_sqft: Optional[float] = Query(None),
    max_sqft: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Property).filter(
        models.Property.status.in_(["available", "under_negotiation"])
    )
    
    if city:
        query = query.filter(models.Property.location_city.ilike(f"%{city}%"))
    
    if min_price:
        query = query.filter(models.Property.price >= min_price)
    
    if max_price:
        query = query.filter(models.Property.price <= max_price)
    
    if property_type and property_type != "All Types":
        query = query.filter(models.Property.property_type == property_type)
    
    if target_sqft:
        lower = target_sqft - 50
        upper = target_sqft + 50
        query = query.filter(between(models.Property.land_size_sqft, lower, upper))
    elif min_sqft is not None or max_sqft is not None:
        if min_sqft is not None:
            query = query.filter(models.Property.land_size_sqft >= min_sqft)
        if max_sqft is not None:
            query = query.filter(models.Property.land_size_sqft <= max_sqft)
    
    properties = query.all()
    
    sponsored = []
    non_sponsored = []
    
    for prop in properties:
        if prop.is_sponsored and prop.sponsored_until and prop.sponsored_until > datetime.utcnow():
            sponsored.append(prop)
        else:
            if prop.is_sponsored:
                prop.is_sponsored = False
                db.commit()
            non_sponsored.append(prop)
    
    sponsored.sort(key=lambda x: x.created_at, reverse=True)
    non_sponsored.sort(key=lambda x: x.created_at, reverse=True)
    
    all_properties = sponsored + non_sponsored
    
    result = []
    for prop in all_properties:
        owner = db.query(models.User).filter(models.User.id == prop.owner_id).first()
        
        primary_image = db.query(models.PropertyImage).filter(
            models.PropertyImage.property_id == prop.id,
            models.PropertyImage.is_primary == True
        ).first()
        
        result.append({
            "id": prop.id,
            "title": prop.title,
            "description": prop.description,
            "price": prop.price,
            "land_size_sqft": prop.land_size_sqft,
            "per_sqft_price": prop.per_sqft_price,
            "property_type": prop.property_type,
            "status": prop.status,
            "location_city": prop.location_city,
            "location_address": prop.location_address,
            "owner_id": prop.owner_id,
            "seller_name": owner.full_name if owner else None,
            "views_count": prop.views_count,
            "is_sponsored": prop.is_sponsored,
            "is_verified": prop.is_verified,
            "sponsored_until": prop.sponsored_until,
            "verified_until": prop.verified_until,
            "image_url": primary_image.image_url if primary_image else None,
            "created_at": prop.created_at,
            "updated_at": prop.updated_at
        })
    
    return result

@router.get("/my-listings", response_model=List[PropertyResponse])
def get_my_listings(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    properties = db.query(models.Property).filter(models.Property.owner_id == current_user.id).all()
    
    result = []
    for prop in properties:
        primary_image = db.query(models.PropertyImage).filter(
            models.PropertyImage.property_id == prop.id,
            models.PropertyImage.is_primary == True
        ).first()
        
        result.append({
            "id": prop.id,
            "title": prop.title,
            "description": prop.description,
            "price": prop.price,
            "land_size_sqft": prop.land_size_sqft,
            "per_sqft_price": prop.per_sqft_price,
            "property_type": prop.property_type,
            "status": prop.status,
            "location_city": prop.location_city,
            "location_address": prop.location_address,
            "owner_id": prop.owner_id,
            "seller_name": current_user.full_name,
            "views_count": prop.views_count,
            "is_sponsored": prop.is_sponsored,
            "is_verified": prop.is_verified,
            "sponsored_until": prop.sponsored_until,
            "verified_until": prop.verified_until,
            "image_url": primary_image.image_url if primary_image else None,
            "created_at": prop.created_at,
            "updated_at": prop.updated_at
        })
    
    return result

@router.get("/{property_id}", response_model=PropertyResponse)
def get_property(property_id: int, db: Session = Depends(get_db)):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    owner = db.query(models.User).filter(models.User.id == property.owner_id).first()
    
    primary_image = db.query(models.PropertyImage).filter(
        models.PropertyImage.property_id == property.id,
        models.PropertyImage.is_primary == True
    ).first()
    
    return {
        "id": property.id,
        "title": property.title,
        "description": property.description,
        "price": property.price,
        "land_size_sqft": property.land_size_sqft,
        "per_sqft_price": property.per_sqft_price,
        "property_type": property.property_type,
        "status": property.status,
        "location_city": property.location_city,
        "location_address": property.location_address,
        "owner_id": property.owner_id,
        "seller_name": owner.full_name if owner else None,
        "views_count": property.views_count,
        "is_sponsored": property.is_sponsored,
        "is_verified": property.is_verified,
        "sponsored_until": property.sponsored_until,
        "verified_until": property.verified_until,
        "image_url": primary_image.image_url if primary_image else None,
        "created_at": property.created_at,
        "updated_at": property.updated_at
    }

@router.post("/", response_model=dict)
def create_property(
    title: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    land_size_sqft: float = Form(...),
    per_sqft_price: float = Form(...),
    property_type: str = Form(...),
    location_city: str = Form(...),
    location_address: str = Form(...),
    dimensions_width: Optional[float] = Form(None),
    dimensions_height: Optional[float] = Form(None),
    north: Optional[float] = Form(None),
    south: Optional[float] = Form(None),
    east: Optional[float] = Form(None),
    west: Optional[float] = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_property = models.Property(
        title=title,
        description=description,
        price=price,
        land_size_sqft=land_size_sqft,
        per_sqft_price=per_sqft_price,
        property_type=property_type,
        location_city=location_city,
        location_address=location_address,
        dimensions_width=dimensions_width,
        dimensions_height=dimensions_height,
        north=north,
        south=south,
        east=east,
        west=west,
        owner_id=current_user.id
    )
    db.add(new_property)
    db.commit()
    db.refresh(new_property)
    
    return {"property_id": new_property.id, "message": "Property created successfully"}

@router.put("/{property_id}")
def update_property(
    property_id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    land_size_sqft: Optional[float] = Form(None),
    per_sqft_price: Optional[float] = Form(None),
    property_type: Optional[str] = Form(None),
    location_city: Optional[str] = Form(None),
    location_address: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    dimensions_width: Optional[float] = Form(None),
    dimensions_height: Optional[float] = Form(None),
    north: Optional[float] = Form(None),
    south: Optional[float] = Form(None),
    east: Optional[float] = Form(None),
    west: Optional[float] = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to edit this property")
    
    if title is not None:
        property.title = title
    if description is not None:
        property.description = description
    if price is not None:
        property.price = price
    if land_size_sqft is not None:
        property.land_size_sqft = land_size_sqft
    if per_sqft_price is not None:
        property.per_sqft_price = per_sqft_price
    if property_type is not None:
        property.property_type = property_type
    if location_city is not None:
        property.location_city = location_city
    if location_address is not None:
        property.location_address = location_address
    if status is not None:
        property.status = status
    if dimensions_width is not None:
        property.dimensions_width = dimensions_width
    if dimensions_height is not None:
        property.dimensions_height = dimensions_height
    if north is not None:
        property.north = north
    if south is not None:
        property.south = south
    if east is not None:
        property.east = east
    if west is not None:
        property.west = west
    
    property.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Property updated successfully"}

@router.delete("/{property_id}")
def delete_property(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this property")
    
    db.delete(property)
    db.commit()
    
    return {"message": "Property deleted successfully"}

@router.post("/{property_id}/upload-images")
async def upload_images(
    property_id: int,
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    uploaded_images = []
    for file in files:
        validate_image(file)
        image_url = await save_image(file)
        existing_count = db.query(models.PropertyImage).filter(models.PropertyImage.property_id == property_id).count()
        is_primary = existing_count == 0
        
        property_image = models.PropertyImage(
            property_id=property_id,
            image_url=image_url,
            is_primary=is_primary
        )
        db.add(property_image)
        uploaded_images.append({"url": image_url, "is_primary": is_primary})
    
    db.commit()
    
    return {"message": f"{len(uploaded_images)} images uploaded", "images": uploaded_images}

@router.post("/{property_id}/set-primary-image/{image_id}")
def set_primary_image(
    property_id: int,
    image_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.query(models.PropertyImage).filter(models.PropertyImage.property_id == property_id).update({"is_primary": False})
    
    image = db.query(models.PropertyImage).filter(models.PropertyImage.id == image_id, models.PropertyImage.property_id == property_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    image.is_primary = True
    db.commit()
    
    return {"message": "Primary image updated"}

@router.delete("/{property_id}/images/{image_id}")
def delete_image(
    property_id: int,
    image_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    image = db.query(models.PropertyImage).filter(models.PropertyImage.id == image_id, models.PropertyImage.property_id == property_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    file_path = image.image_url.lstrip('/')
    if os.path.exists(file_path):
        os.remove(file_path)
    
    db.delete(image)
    db.commit()
    
    remaining_images = db.query(models.PropertyImage).filter(models.PropertyImage.property_id == property_id).all()
    if remaining_images and not any(img.is_primary for img in remaining_images):
        remaining_images[0].is_primary = True
        db.commit()
    
    return {"message": "Image deleted"}

@router.get("/{property_id}/images", response_model=List[ImageResponse])
def get_property_images(property_id: int, db: Session = Depends(get_db)):
    images = db.query(models.PropertyImage).filter(models.PropertyImage.property_id == property_id).order_by(models.PropertyImage.is_primary.desc()).all()
    return [{"id": img.id, "image_url": img.image_url, "is_primary": img.is_primary} for img in images]

@router.post("/{property_id}/upload-documents")
async def upload_documents(
    property_id: int,
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    uploaded_documents = []
    for file in files:
        validate_document(file)
        document_url = await save_document(file)
        
        property_doc = models.PropertyDocument(
            property_id=property_id,
            uploader_id=current_user.id,
            document_url=document_url,
            original_filename=file.filename,
            file_size=file.size,
            mime_type=file.content_type,
            document_label=None
        )
        db.add(property_doc)
        uploaded_documents.append({"url": document_url, "filename": file.filename})
    
    db.commit()
    
    return {"message": f"{len(uploaded_documents)} documents uploaded", "documents": uploaded_documents}

# ========== LABELED DOCUMENT UPLOAD (STRUCTURED) ==========

@router.post("/{property_id}/upload-labeled-documents")
async def upload_labeled_documents(
    property_id: int,
    e_khata: Optional[UploadFile] = None,
    b_khata: Optional[UploadFile] = None,
    sale_deed: Optional[UploadFile] = None,
    tax_receipt: Optional[UploadFile] = None,
    encumbrance_certificate: Optional[UploadFile] = None,
    property_card: Optional[UploadFile] = None,
    other_documents: List[UploadFile] = [],
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    uploaded = []
    
    async def save_labeled_document(file: UploadFile, doc_label: str):
        if file:
            validate_document(file)
            doc_url = await save_document(file)
            property_doc = models.PropertyDocument(
                property_id=property_id,
                uploader_id=current_user.id,
                document_url=doc_url,
                original_filename=file.filename,
                file_size=file.size,
                mime_type=file.content_type,
                document_label=doc_label
            )
            db.add(property_doc)
            uploaded.append({"type": doc_label, "filename": file.filename})
    
    await save_labeled_document(e_khata, "E-Khata")
    await save_labeled_document(b_khata, "B-Khata")
    await save_labeled_document(sale_deed, "Sale Deed")
    await save_labeled_document(tax_receipt, "Tax Receipt")
    await save_labeled_document(encumbrance_certificate, "Encumbrance Certificate")
    await save_labeled_document(property_card, "Property Card")
    
    for doc in other_documents:
        validate_document(doc)
        doc_url = await save_document(doc)
        property_doc = models.PropertyDocument(
            property_id=property_id,
            uploader_id=current_user.id,
            document_url=doc_url,
            original_filename=doc.filename,
            file_size=doc.size,
            mime_type=doc.content_type,
            document_label="Other"
        )
        db.add(property_doc)
        uploaded.append({"type": "Other", "filename": doc.filename})
    
    db.commit()
    
    return {"message": f"{len(uploaded)} documents uploaded", "documents": uploaded}

@router.get("/{property_id}/labeled-documents")
def get_labeled_documents(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        approved_request = db.query(models.DocumentRequest).filter(
            models.DocumentRequest.property_id == property_id,
            models.DocumentRequest.buyer_id == current_user.id,
            models.DocumentRequest.status == "APPROVED"
        ).first()
        
        if not approved_request and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="You don't have access to these documents")
    
    documents = db.query(models.PropertyDocument).filter(
        models.PropertyDocument.property_id == property_id
    ).all()
    
    result = {
        "E-Khata": [],
        "B-Khata": [],
        "Sale Deed": [],
        "Tax Receipt": [],
        "Encumbrance Certificate": [],
        "Property Card": [],
        "Other": []
    }
    
    for doc in documents:
        label = doc.document_label if doc.document_label else "Other"
        if label in result:
            result[label].append({
                "id": doc.id,
                "filename": doc.original_filename,
                "url": doc.document_url,
                "uploaded_at": doc.created_at
            })
        else:
            result["Other"].append({
                "id": doc.id,
                "filename": doc.original_filename,
                "url": doc.document_url,
                "uploaded_at": doc.created_at
            })
    
    return result

@router.get("/{property_id}/documents")
def get_property_documents(property_id: int, db: Session = Depends(get_db)):
    documents = db.query(models.PropertyDocument).filter(models.PropertyDocument.property_id == property_id).all()
    return [{
        "id": doc.id,
        "document_url": doc.document_url,
        "original_filename": doc.original_filename,
        "document_label": doc.document_label,
        "file_size": doc.file_size,
        "created_at": doc.created_at
    } for doc in documents]

@router.delete("/{property_id}/documents/{document_id}")
def delete_document(
    property_id: int,
    document_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    document = db.query(models.PropertyDocument).filter(models.PropertyDocument.id == document_id, models.PropertyDocument.property_id == property_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = document.document_url.lstrip('/')
    if os.path.exists(file_path):
        os.remove(file_path)
    
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted"}

# ========== RATINGS ENDPOINTS ==========

@router.post("/{property_id}/rate")
def rate_property(
    property_id: int,
    rating: int = Query(..., ge=1, le=5),
    review: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    interest = db.query(models.PropertyInterest).filter(
        models.PropertyInterest.user_id == current_user.id,
        models.PropertyInterest.property_id == property_id,
        models.PropertyInterest.status == "approved"
    ).first()
    
    if not interest:
        raise HTTPException(status_code=403, detail="You can only rate properties after interest is approved")
    
    existing = db.query(models.Rating).filter(
        models.Rating.property_id == property_id,
        models.Rating.user_id == current_user.id
    ).first()
    
    if existing:
        existing.rating = rating
        existing.review = review
    else:
        new_rating = models.Rating(
            property_id=property_id,
            user_id=current_user.id,
            rating=rating,
            review=review
        )
        db.add(new_rating)
    
    db.commit()
    
    seller = db.query(models.User).filter(models.User.id == property.owner_id).first()
    if seller:
        all_ratings = db.query(models.Rating).join(models.Property).filter(models.Property.owner_id == seller.id).all()
        if all_ratings:
            avg_rating = sum(r.rating for r in all_ratings) / len(all_ratings)
            seller.avg_rating = round(avg_rating, 1)
            db.commit()
    
    return {"message": "Rating submitted successfully"}

# ========== FIXED EDIT RATING ENDPOINT ==========

@router.put("/{property_id}/rate/{rating_id}")
def edit_rating(
    property_id: int,
    rating_id: int,
    rating: int = Query(..., ge=1, le=5),
    review: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_rating = db.query(models.Rating).filter(
        models.Rating.id == rating_id,
        models.Rating.property_id == property_id,
        models.Rating.user_id == current_user.id
    ).first()
    
    if not existing_rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    existing_rating.rating = rating
    existing_rating.review = review
    db.commit()
    
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    
    if property:
        seller = db.query(models.User).filter(models.User.id == property.owner_id).first()
        if seller:
            all_ratings = db.query(models.Rating).join(models.Property).filter(
                models.Property.owner_id == seller.id
            ).all()
            if all_ratings:
                avg_rating = sum(r.rating for r in all_ratings) / len(all_ratings)
                seller.avg_rating = round(avg_rating, 1)
                db.commit()
    
    return {"message": "Rating updated successfully"}

@router.get("/{property_id}/ratings")
def get_property_ratings(
    property_id: int,
    db: Session = Depends(get_db)
):
    ratings = db.query(models.Rating).filter(
        models.Rating.property_id == property_id
    ).order_by(models.Rating.created_at.desc()).all()
    
    result = []
    for r in ratings:
        user = db.query(models.User).filter(models.User.id == r.user_id).first()
        result.append({
            "id": r.id,
            "user_id": r.user_id,
            "user_name": user.full_name if user else "Anonymous",
            "rating": r.rating,
            "review": r.review,
            "created_at": r.created_at
        })
    
    return result

@router.get("/{property_id}/user-rating")
def get_user_rating(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rating = db.query(models.Rating).filter(
        models.Rating.property_id == property_id,
        models.Rating.user_id == current_user.id
    ).first()
    
    if rating:
        return {"rating": {"id": rating.id, "rating": rating.rating, "review": rating.review}}
    return {"rating": None}

# ========== SAVED SEARCHES ENDPOINTS ==========

@router.get("/saved-searches")
def get_saved_searches(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    searches = db.query(models.SavedSearch).filter(
        models.SavedSearch.user_id == current_user.id
    ).order_by(models.SavedSearch.created_at.desc()).all()
    
    return [{
        "id": s.id,
        "name": s.name,
        "filters": s.filters,
        "created_at": s.created_at
    } for s in searches]

@router.post("/saved-searches")
def save_search(
    name: str,
    filters: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    saved_search = models.SavedSearch(
        user_id=current_user.id,
        name=name,
        filters=filters
    )
    db.add(saved_search)
    db.commit()
    db.refresh(saved_search)
    
    return {"id": saved_search.id, "message": "Search saved successfully"}

@router.delete("/saved-searches/{search_id}")
def delete_saved_search(
    search_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    search = db.query(models.SavedSearch).filter(
        models.SavedSearch.id == search_id,
        models.SavedSearch.user_id == current_user.id
    ).first()
    
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    
    db.delete(search)
    db.commit()
    
    return {"message": "Saved search deleted"}

# ========== VIEW TRACKING ==========

@router.post("/{property_id}/track-view")
def track_property_view(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id == current_user.id:
        return {"view_counted": False, "message": "Owner views not counted"}
    
    existing_view = db.query(models.PropertyView).filter(
        models.PropertyView.user_id == current_user.id,
        models.PropertyView.property_id == property_id
    ).first()
    
    if existing_view:
        return {"view_counted": False, "message": "Already viewed this property"}
    
    new_view = models.PropertyView(
        user_id=current_user.id,
        property_id=property_id
    )
    db.add(new_view)
    
    property.views_count += 1
    db.commit()
    
    return {"view_counted": True, "message": "View counted", "total_views": property.views_count}

@router.get("/admin/views")
def get_all_views(
    current_user: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    views = db.query(models.PropertyView).order_by(models.PropertyView.viewed_at.desc()).all()
    
    result = []
    for view in views:
        user = db.query(models.User).filter(models.User.id == view.user_id).first()
        property = db.query(models.Property).filter(models.Property.id == view.property_id).first()
        result.append({
            "id": view.id,
            "user_id": view.user_id,
            "user_name": user.full_name if user else "Unknown",
            "user_email": user.email if user else "Unknown",
            "property_id": view.property_id,
            "property_title": property.title if property else "Unknown",
            "viewed_at": view.viewed_at
        })
    
    return result

# ========== INTEREST ENDPOINTS ==========

@router.post("/{property_id}/interest")
def mark_interest(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot mark interest on your own property")
    
    existing = db.query(models.PropertyInterest).filter(
        models.PropertyInterest.user_id == current_user.id,
        models.PropertyInterest.property_id == property_id
    ).first()
    
    if existing:
        if existing.cooldown_until and existing.cooldown_until > datetime.utcnow():
            days_left = (existing.cooldown_until - datetime.utcnow()).days
            raise HTTPException(status_code=400, detail=f"You are on cooldown for {days_left} more days.")
        
        if existing.status == "rejected" and existing.rejection_count < 3:
            db.delete(existing)
            db.commit()
            new_interest = models.PropertyInterest(
                user_id=current_user.id,
                property_id=property_id,
                status="pending",
                rejection_count=existing.rejection_count,
                expires_at=datetime.utcnow() + timedelta(days=3)
            )
            db.add(new_interest)
            db.commit()
            
            notification = models.Notification(
                user_id=property.owner_id,
                title="New Interest",
                message=f"{current_user.full_name} is interested in your property: {property.title}",
                type="interest",
                related_id=new_interest.id,
                is_read=False
            )
            db.add(notification)
            db.commit()
            
            return {"message": "Interest request sent. Seller has 3 days to respond.", "interest_id": new_interest.id}
        
        elif existing.status == "pending":
            raise HTTPException(status_code=400, detail="You already have a pending request. Please wait for seller response.")
        
        elif existing.status == "approved":
            raise HTTPException(status_code=400, detail="Interest already approved. Go to Chat.")
        
        elif existing.status == "rejected" and existing.rejection_count >= 3:
            raise HTTPException(status_code=400, detail="You have been blocked due to 3 rejections.")
    
    interest = models.PropertyInterest(
        user_id=current_user.id,
        property_id=property_id,
        status="pending",
        rejection_count=0,
        expires_at=datetime.utcnow() + timedelta(days=3)
    )
    db.add(interest)
    db.commit()
    
    notification = models.Notification(
        user_id=property.owner_id,
        title="New Interest",
        message=f"{current_user.full_name} is interested in your property: {property.title}",
        type="interest",
        related_id=interest.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    
    return {"message": "Interest request sent. Seller has 3 days to respond.", "interest_id": interest.id}

@router.get("/{property_id}/interest/check")
def check_interest(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    interest = db.query(models.PropertyInterest).filter(
        models.PropertyInterest.user_id == current_user.id,
        models.PropertyInterest.property_id == property_id
    ).first()
    
    if interest:
        if interest.expires_at and interest.expires_at < datetime.utcnow() and interest.status == "pending":
            db.delete(interest)
            db.commit()
            return {"interested": False, "status": None, "message": "Request expired. You can send a new request."}
        
        return {
            "interested": True,
            "status": interest.status,
            "rejection_count": interest.rejection_count,
            "cooldown_until": interest.cooldown_until,
            "expires_at": interest.expires_at
        }
    return {"interested": False, "status": None}

@router.get("/interests/pending")
def get_pending_interests(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    expired_interests = db.query(models.PropertyInterest).filter(
        models.PropertyInterest.status == "pending",
        models.PropertyInterest.expires_at < datetime.utcnow()
    ).all()
    
    for interest in expired_interests:
        db.delete(interest)
    db.commit()
    
    interests = db.query(models.PropertyInterest).join(
        models.Property
    ).filter(
        models.Property.owner_id == current_user.id,
        models.PropertyInterest.status == "pending"
    ).all()
    
    result = []
    for interest in interests:
        property = db.query(models.Property).filter(models.Property.id == interest.property_id).first()
        buyer = db.query(models.User).filter(models.User.id == interest.user_id).first()
        result.append({
            "id": interest.id,
            "property_id": interest.property_id,
            "property_title": property.title if property else "",
            "buyer_id": interest.user_id,
            "buyer_name": buyer.full_name if buyer else "",
            "status": interest.status,
            "created_at": interest.created_at,
            "expires_at": interest.expires_at
        })
    
    return result

@router.put("/interests/{interest_id}/approve")
def approve_interest(
    interest_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    interest = db.query(models.PropertyInterest).filter(models.PropertyInterest.id == interest_id).first()
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")
    
    property = db.query(models.Property).filter(models.Property.id == interest.property_id).first()
    if property.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to approve this interest")
    
    if interest.status != "pending":
        raise HTTPException(status_code=400, detail=f"Interest already {interest.status}")
    
    interest.status = "approved"
    interest.updated_at = datetime.utcnow()
    db.commit()
    
    notification = models.Notification(
        user_id=interest.user_id,
        title="Interest Approved",
        message=f"Your interest in {property.title} has been approved. You can now chat with the seller.",
        type="interest_approved",
        related_id=property.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    
    return {"message": "Interest approved successfully"}

@router.put("/interests/{interest_id}/reject")
def reject_interest(
    interest_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    interest = db.query(models.PropertyInterest).filter(models.PropertyInterest.id == interest_id).first()
    if not interest:
        raise HTTPException(status_code=404, detail="Interest not found")
    
    property = db.query(models.Property).filter(models.Property.id == interest.property_id).first()
    if property.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to reject this interest")
    
    if interest.status != "pending":
        raise HTTPException(status_code=400, detail=f"Interest already {interest.status}")
    
    interest.rejection_count += 1
    interest.status = "rejected"
    interest.updated_at = datetime.utcnow()
    
    if interest.rejection_count >= 3:
        interest.cooldown_until = datetime.utcnow() + timedelta(days=8)
        message = "Your request has been rejected 3 times. You cannot send new requests for 8 days."
    else:
        message = f"Your request was rejected. You have {3 - interest.rejection_count} attempt(s) left."
    
    db.commit()
    
    notification = models.Notification(
        user_id=interest.user_id,
        title="Interest Rejected",
        message=message,
        type="interest_rejected",
        related_id=property.id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    
    return {"message": "Interest rejected successfully"}