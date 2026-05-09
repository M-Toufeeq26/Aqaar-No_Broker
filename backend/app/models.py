from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.database import Base
import enum

class PropertyTypeEnum(str, enum.Enum):
    LAND = "land"
    LAND_AND_HOUSE = "land_and_house"

class PropertyStatusEnum(str, enum.Enum):
    AVAILABLE = "available"
    UNDER_NEGOTIATION = "under_negotiation"
    SOLD = "sold"

class InterestStatusEnum(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"

class DocumentRequestStatusEnum(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class ReportTypeEnum(str, enum.Enum):
    FAKE_LISTING = "fake_listing"
    WRONG_PRICE = "wrong_price"
    FRAUD = "fraud"
    INAPPROPRIATE = "inappropriate"
    DUPLICATE = "duplicate"
    ALREADY_SOLD = "already_sold"
    OTHER = "other"

class ReportStatusEnum(str, enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"

class PaymentTypeEnum(str, enum.Enum):
    VERIFICATION = "verification"
    SPONSORED = "sponsored"
    PROPERTY_VERIFICATION = "property_verification"

class PaymentStatusEnum(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_blocked = Column(Boolean, default=False)
    block_reason = Column(Text, nullable=True)
    block_until = Column(DateTime, nullable=True)
    avg_rating = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    properties = relationship("Property", back_populates="owner", cascade="all, delete-orphan")
    wishlist_items = relationship("Wishlist", back_populates="user", cascade="all, delete-orphan")
    interests = relationship("PropertyInterest", back_populates="user", cascade="all, delete-orphan")
    chat_messages_sent = relationship("ChatMessage", foreign_keys="ChatMessage.sender_id", back_populates="sender")
    chat_messages_received = relationship("ChatMessage", foreign_keys="ChatMessage.receiver_id", back_populates="receiver")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    document_requests_sent = relationship("DocumentRequest", foreign_keys="DocumentRequest.buyer_id", back_populates="buyer")
    document_requests_received = relationship("DocumentRequest", foreign_keys="DocumentRequest.seller_id", back_populates="seller")
    property_views = relationship("PropertyView", back_populates="user", cascade="all, delete-orphan")
    ratings_given = relationship("Rating", foreign_keys="Rating.user_id", back_populates="user")
    saved_searches = relationship("SavedSearch", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    verification_requests = relationship("VerificationRequest", back_populates="user", cascade="all, delete-orphan")
    property_verification_requests = relationship("PropertyVerificationRequest", back_populates="user", cascade="all, delete-orphan")
    property_change_requests = relationship("PropertyChangeRequest", back_populates="user", cascade="all, delete-orphan")
    sponsorship_requests = relationship("SponsorshipRequest", back_populates="user", cascade="all, delete-orphan")
    reports_made = relationship("Report", foreign_keys="Report.reporter_id", back_populates="reporter", cascade="all, delete-orphan")
    reports_received = relationship("Report", foreign_keys="Report.reported_user_id", back_populates="reported_user", cascade="all, delete-orphan")

class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    land_size_sqft = Column(Float, nullable=False)
    per_sqft_price = Column(Float, nullable=False, default=0)
    dimensions_width = Column(Float, nullable=True)
    dimensions_height = Column(Float, nullable=True)
    north = Column(Float, nullable=True)
    south = Column(Float, nullable=True)
    east = Column(Float, nullable=True)
    west = Column(Float, nullable=True)
    property_type = Column(Enum(PropertyTypeEnum), nullable=False)
    status = Column(Enum(PropertyStatusEnum), default=PropertyStatusEnum.AVAILABLE)
    location_city = Column(String(100), nullable=False)
    location_address = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    views_count = Column(Integer, default=0)
    is_sponsored = Column(Boolean, default=False)
    sponsored_until = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)
    verified_until = Column(DateTime, nullable=True)
    verification_chances_remaining = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="properties")
    images = relationship("PropertyImage", back_populates="property", cascade="all, delete-orphan")
    documents = relationship("PropertyDocument", back_populates="property", cascade="all, delete-orphan")
    wishlist_items = relationship("Wishlist", back_populates="property", cascade="all, delete-orphan")
    interests = relationship("PropertyInterest", back_populates="property", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="property", cascade="all, delete-orphan")
    views = relationship("PropertyView", back_populates="property", cascade="all, delete-orphan")
    ratings = relationship("Rating", back_populates="property", cascade="all, delete-orphan")
    sponsored_listings = relationship("SponsoredListing", back_populates="property", cascade="all, delete-orphan")
    property_verification_requests = relationship("PropertyVerificationRequest", back_populates="property", cascade="all, delete-orphan")
    property_change_requests = relationship("PropertyChangeRequest", back_populates="property", cascade="all, delete-orphan")
    sponsorship_requests = relationship("SponsorshipRequest", back_populates="property", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="property", cascade="all, delete-orphan")

class PropertyImage(Base):
    __tablename__ = "property_images"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property", back_populates="images")

class PropertyDocument(Base):
    __tablename__ = "property_documents"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_url = Column(String(500), nullable=False)
    watermarked_url = Column(String(500), nullable=True)
    original_filename = Column(String(255))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    expires_at = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)
    document_label = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploader_id])

class Wishlist(Base):
    __tablename__ = "wishlist"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="wishlist_items")
    property = relationship("Property", back_populates="wishlist_items")

class PropertyInterest(Base):
    __tablename__ = "property_interests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    status = Column(Enum(InterestStatusEnum), default=InterestStatusEnum.PENDING)
    rejection_count = Column(Integer, default=0)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=3))
    cooldown_until = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="interests")
    property = relationship("Property", back_populates="interests")

class PropertyView(Base):
    __tablename__ = "property_views"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    viewed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="property_views")
    property = relationship("Property", back_populates="views")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property", back_populates="chat_messages")
    sender = relationship("User", foreign_keys=[sender_id], back_populates="chat_messages_sent")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="chat_messages_received")

class DocumentRequest(Base):
    __tablename__ = "document_requests"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(DocumentRequestStatusEnum), default=DocumentRequestStatusEnum.PENDING)
    rejection_count = Column(Integer, default=0)
    cooldown_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = relationship("Property")
    buyer = relationship("User", foreign_keys=[buyer_id], back_populates="document_requests_sent")
    seller = relationship("User", foreign_keys=[seller_id], back_populates="document_requests_received")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)
    related_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    report_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="reports_made")
    reported_user = relationship("User", foreign_keys=[reported_user_id], back_populates="reports_received")
    property = relationship("Property", back_populates="reports")

class SponsorshipRequest(Base):
    __tablename__ = "sponsorship_requests"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    duration_days = Column(Integer, nullable=False)
    amount = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")
    admin_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    property = relationship("Property", back_populates="sponsorship_requests")
    user = relationship("User", back_populates="sponsorship_requests")

class State(Base):
    __tablename__ = "states"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    cities = relationship("City", back_populates="state", cascade="all, delete-orphan")

class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=False)
    name = Column(String(100), nullable=False)
    state = relationship("State", back_populates="cities")

class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    review = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property", back_populates="ratings")
    user = relationship("User", foreign_keys=[user_id], back_populates="ratings_given")

class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    filters = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="saved_searches")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    payment_type = Column(Enum(PaymentTypeEnum), nullable=False)
    amount = Column(Float, nullable=False)
    razorpay_order_id = Column(String(100), unique=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    razorpay_signature = Column(String(255), nullable=True)
    status = Column(Enum(PaymentStatusEnum), default=PaymentStatusEnum.PENDING)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="payments")

class SponsoredListing(Base):
    __tablename__ = "sponsored_listings"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    duration_days = Column(Integer, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property", back_populates="sponsored_listings")

class VerificationRequest(Base):
    __tablename__ = "verification_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_type = Column(String(50), nullable=False)
    document_url = Column(String(500), nullable=False)
    status = Column(String(20), default="pending")
    admin_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="verification_requests")

class PropertyVerificationRequest(Base):
    __tablename__ = "property_verification_requests"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    duration_days = Column(Integer, nullable=False)
    amount = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")
    remaining_attempts = Column(Integer, default=3)
    admin_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    property = relationship("Property", back_populates="property_verification_requests")
    user = relationship("User", back_populates="property_verification_requests")

class PropertyChangeRequest(Base):
    __tablename__ = "property_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    changes = Column(Text, nullable=False)
    status = Column(String(20), default="pending")
    admin_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    property = relationship("Property", back_populates="property_change_requests")
    user = relationship("User", back_populates="property_change_requests")