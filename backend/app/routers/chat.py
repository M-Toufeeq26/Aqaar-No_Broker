from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from app.database import get_db
from app import models
from app.schemas import ChatMessageCreate, ChatMessageResponse
from app.utils.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/create-or-get")
def create_or_get_chat(
    other_user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if there's any approved interest between these users (case-insensitive)
    interest_as_buyer = db.query(models.PropertyInterest).filter(
        models.PropertyInterest.user_id == current_user.id,
        models.PropertyInterest.status.ilike("approved")
    ).first()
    
    interest_as_seller = db.query(models.PropertyInterest).join(
        models.Property
    ).filter(
        models.Property.owner_id == current_user.id,
        models.PropertyInterest.status.ilike("approved")
    ).first()
    
    if not interest_as_buyer and not interest_as_seller:
        raise HTTPException(status_code=403, detail="No approved interest found. Cannot chat.")
    
    return {"message": "Chat ready"}

@router.get("/messages/{other_user_id}")
def get_messages(
    other_user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get messages between current_user and other_user_id (any property)
    messages = db.query(models.ChatMessage).filter(
        (
            (models.ChatMessage.sender_id == current_user.id) & (models.ChatMessage.receiver_id == other_user_id)
        ) | (
            (models.ChatMessage.sender_id == other_user_id) & (models.ChatMessage.receiver_id == current_user.id)
        )
    ).order_by(models.ChatMessage.created_at).all()
    
    # Mark messages received by current user as read
    for msg in messages:
        if msg.receiver_id == current_user.id and not msg.is_read:
            msg.is_read = True
    db.commit()
    
    return [ChatMessageResponse(
        id=msg.id,
        sender_id=msg.sender_id,
        receiver_id=msg.receiver_id,
        message=msg.message,
        is_read=msg.is_read,
        created_at=msg.created_at
    ) for msg in messages]

@router.post("/send")
def send_message(
    message_data: ChatMessageCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify that the property_id belongs to an approved interest
    # Check if current user is buyer (has approved interest on this property)
    is_buyer = db.query(models.PropertyInterest).filter(
        models.PropertyInterest.user_id == current_user.id,
        models.PropertyInterest.property_id == message_data.property_id,
        models.PropertyInterest.status.ilike("approved")
    ).first()
    
    # Check if current user is seller (owner of the property) and there's an approved interest from the buyer
    property_obj = db.query(models.Property).filter(models.Property.id == message_data.property_id).first()
    if property_obj and property_obj.owner_id == current_user.id:
        is_seller = True
    else:
        is_seller = False
    
    if not is_buyer and not is_seller:
        raise HTTPException(status_code=403, detail="You are not authorized to chat about this property.")
    
    new_message = models.ChatMessage(
        property_id=message_data.property_id,
        sender_id=current_user.id,
        receiver_id=message_data.receiver_id,
        message=message_data.message
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    # Also, create a notification for the receiver (optional but good)
    notification = models.Notification(
        user_id=message_data.receiver_id,
        title="New Message",
        message=f"{current_user.full_name} sent you a message.",
        type="new_chat_message",
        related_id=new_message.id,
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(notification)
    db.commit()
    
    from app.websockets import manager
    
    msg_dict = {
        "id": new_message.id,
        "sender_id": new_message.sender_id,
        "receiver_id": new_message.receiver_id,
        "message": new_message.message,
        "is_read": new_message.is_read,
        "created_at": new_message.created_at.isoformat()
    }
    
    background_tasks.add_task(
        manager.send_personal_message,
        {"type": "new_chat_message", "data": msg_dict},
        message_data.receiver_id
    )
    
    return ChatMessageResponse(
        id=new_message.id,
        sender_id=new_message.sender_id,
        receiver_id=new_message.receiver_id,
        message=new_message.message,
        is_read=new_message.is_read,
        created_at=new_message.created_at
    )

@router.get("/conversations")
def get_conversations(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find all unique sender/receiver pairs involving current user
    sent_to = db.query(models.ChatMessage.receiver_id).filter(
        models.ChatMessage.sender_id == current_user.id
    ).distinct().all()
    received_from = db.query(models.ChatMessage.sender_id).filter(
        models.ChatMessage.receiver_id == current_user.id
    ).distinct().all()
    
    user_ids = set()
    for (uid,) in sent_to:
        user_ids.add(uid)
    for (uid,) in received_from:
        user_ids.add(uid)
        
    contact_property_map = {}

    # Find users with whom there is an approved interest
    # 1. As buyer (current user requested interest, owner of property is contact)
    buyer_interests = db.query(models.PropertyInterest, models.Property).join(
        models.Property, models.PropertyInterest.property_id == models.Property.id
    ).filter(
        models.PropertyInterest.user_id == current_user.id,
        models.PropertyInterest.status.ilike("approved")
    ).all()
    
    # 2. As seller (current user owns property, buyer is contact)
    seller_interests = db.query(models.PropertyInterest).join(
        models.Property, models.PropertyInterest.property_id == models.Property.id
    ).filter(
        models.Property.owner_id == current_user.id,
        models.PropertyInterest.status.ilike("approved")
    ).all()

    for interest, property_obj in buyer_interests:
        user_ids.add(property_obj.owner_id)
        if property_obj.owner_id not in contact_property_map:
            contact_property_map[property_obj.owner_id] = property_obj.id

    for interest in seller_interests:
        user_ids.add(interest.user_id)
        if interest.user_id not in contact_property_map:
            contact_property_map[interest.user_id] = interest.property_id
    
    result = []
    for contact_id in user_ids:
        other_user = db.query(models.User).filter(models.User.id == contact_id).first()
        if other_user:
            # Get last message
            last_message = db.query(models.ChatMessage).filter(
                (
                    (models.ChatMessage.sender_id == current_user.id) & (models.ChatMessage.receiver_id == contact_id)
                ) | (
                    (models.ChatMessage.sender_id == contact_id) & (models.ChatMessage.receiver_id == current_user.id)
                )
            ).order_by(models.ChatMessage.created_at.desc()).first()
            
            # Count unread messages where the other user is the sender and current user is receiver
            unread_count = db.query(func.count(models.ChatMessage.id)).filter(
                models.ChatMessage.sender_id == contact_id,
                models.ChatMessage.receiver_id == current_user.id,
                models.ChatMessage.is_read == False
            ).scalar() or 0
            
            # Find a property_id that connects them (first message's property_id)
            first_message = db.query(models.ChatMessage).filter(
                (
                    (models.ChatMessage.sender_id == current_user.id) & (models.ChatMessage.receiver_id == contact_id)
                ) | (
                    (models.ChatMessage.sender_id == contact_id) & (models.ChatMessage.receiver_id == current_user.id)
                )
            ).first()
            property_id = first_message.property_id if first_message else contact_property_map.get(contact_id)
            
            result.append({
                "user_id": other_user.id,
                "full_name": other_user.full_name,
                "last_message": last_message.message if last_message else "",
                "last_message_time": last_message.created_at if last_message else None,
                "unread_count": unread_count,
                "property_id": property_id
            })
    
    # Sort by last message time descending
    result.sort(key=lambda x: x["last_message_time"] or datetime.min, reverse=True)
    return result

@router.get("/unread-count")
def get_unread_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(models.ChatMessage).filter(
        models.ChatMessage.receiver_id == current_user.id,
        models.ChatMessage.is_read == False
    ).count()
    return {"unread_count": count}