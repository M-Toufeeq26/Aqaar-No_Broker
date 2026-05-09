from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.utils.auth import get_current_user

router = APIRouter(prefix="/wishlist", tags=["wishlist"])

@router.get("/")
def get_wishlist(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    wishlist_items = db.query(models.Wishlist).filter(
        models.Wishlist.user_id == current_user.id
    ).all()
    
    result = []
    for item in wishlist_items:
        property = db.query(models.Property).filter(models.Property.id == item.property_id).first()
        if property:
            # Get primary image
            primary_image = db.query(models.PropertyImage).filter(
                models.PropertyImage.property_id == property.id,
                models.PropertyImage.is_primary == True
            ).first()
            
            if not primary_image:
                primary_image = db.query(models.PropertyImage).filter(
                    models.PropertyImage.property_id == property.id
                ).first()
            
            result.append({
                "wishlist_id": item.id,
                "property_id": property.id,
                "title": property.title,
                "price": property.price,
                "land_size_sqft": property.land_size_sqft,
                "location_city": property.location_city,
                "status": property.status,
                "is_verified": property.is_verified,
                "image_url": primary_image.image_url if primary_image else None,
                "created_at": item.created_at
            })
    
    return result

@router.get("/check/{property_id}")
def check_wishlist(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    exists = db.query(models.Wishlist).filter(
        models.Wishlist.user_id == current_user.id,
        models.Wishlist.property_id == property_id
    ).first()
    
    return {"in_wishlist": exists is not None}

@router.post("/")
def add_to_wishlist(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    property = db.query(models.Property).filter(models.Property.id == property_id).first()
    if not property:
        raise HTTPException(status_code=404, detail="Property not found")
    
    existing = db.query(models.Wishlist).filter(
        models.Wishlist.user_id == current_user.id,
        models.Wishlist.property_id == property_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Property already in wishlist")
    
    wishlist_item = models.Wishlist(
        user_id=current_user.id,
        property_id=property_id
    )
    db.add(wishlist_item)
    db.commit()
    
    return {"message": "Added to wishlist"}

@router.delete("/{property_id}")
def remove_from_wishlist(
    property_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    wishlist_item = db.query(models.Wishlist).filter(
        models.Wishlist.user_id == current_user.id,
        models.Wishlist.property_id == property_id
    ).first()
    
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Item not found in wishlist")
    
    db.delete(wishlist_item)
    db.commit()
    
    return {"message": "Removed from wishlist"}