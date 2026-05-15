from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class PropertyTypeEnum(str, Enum):
    LAND = "land"
    LAND_AND_HOUSE = "land_and_house"

class PropertyStatusEnum(str, Enum):
    AVAILABLE = "available"
    UNDER_NEGOTIATION = "under_negotiation"
    SOLD = "sold"

class ReportTypeEnum(str, Enum):
    FAKE_LISTING = "fake_listing"
    FRAUD = "fraud"
    INAPPROPRIATE = "inappropriate"
    OTHER = "other"

class ReportStatusEnum(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str
    is_verified: bool
    is_admin: bool

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    current_password: Optional[str] = None
    password: Optional[str] = None

class PropertyCreate(BaseModel):
    title: str
    description: str
    price: float
    land_size_sqft: float
    per_sqft_price: float
    property_type: PropertyTypeEnum
    location_city: str
    location_address: str
    dimensions_width: Optional[float] = None
    dimensions_height: Optional[float] = None
    north: Optional[float] = None
    south: Optional[float] = None
    east: Optional[float] = None
    west: Optional[float] = None

class PropertyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    land_size_sqft: Optional[float] = None
    per_sqft_price: Optional[float] = None
    property_type: Optional[PropertyTypeEnum] = None
    location_city: Optional[str] = None
    location_address: Optional[str] = None
    status: Optional[PropertyStatusEnum] = None
    dimensions_width: Optional[float] = None
    dimensions_height: Optional[float] = None
    north: Optional[float] = None
    south: Optional[float] = None
    east: Optional[float] = None
    west: Optional[float] = None

class PropertyResponse(BaseModel):
    id: int
    title: str
    description: str
    price: float
    land_size_sqft: float
    per_sqft_price: Optional[float] = None
    property_type: PropertyTypeEnum
    status: PropertyStatusEnum
    location_city: str
    location_address: str
    owner_id: int
    seller_name: Optional[str] = None
    views_count: int
    created_at: datetime
    updated_at: datetime
    dimensions_width: Optional[float] = None
    dimensions_height: Optional[float] = None
    north: Optional[float] = None
    south: Optional[float] = None
    east: Optional[float] = None
    west: Optional[float] = None
    # NEW FIELDS - Sponsorship and Verification
    is_sponsored: Optional[bool] = None
    is_verified: Optional[bool] = None
    sponsored_until: Optional[datetime] = None
    verified_until: Optional[datetime] = None
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

class ImageResponse(BaseModel):
    id: int
    image_url: str
    is_primary: bool

class WishlistResponse(BaseModel):
    id: int
    property_id: int
    title: str
    price: float
    location_city: str
    image_url: Optional[str] = None

class ChatMessageCreate(BaseModel):
    property_id: int
    receiver_id: int
    message: str

class ChatMessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    message: str
    is_read: bool
    created_at: datetime

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    related_id: Optional[int]
    is_read: bool
    created_at: datetime

class StateResponse(BaseModel):
    id: int
    name: str

class CityResponse(BaseModel):
    id: int
    name: str

class InterestResponse(BaseModel):
    id: int
    property_id: int
    property_title: str
    buyer_id: int
    buyer_name: str
    status: str
    created_at: datetime