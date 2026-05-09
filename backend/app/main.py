from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.routers import auth, properties, documents, chat, wishlist, reports, admin, payments, notifications, locations, verifications
import os

os.makedirs("uploads/images", exist_ok=True)
os.makedirs("uploads/documents", exist_ok=True)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Aqaar API", description="No Broker Real Estate Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(wishlist.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(payments.router)
app.include_router(notifications.router)
app.include_router(locations.router)
app.include_router(verifications.router)

@app.get("/")
def root():
    return {"message": "Welcome to Aqaar API"}

@app.get("/health")
def health():
    return {"status": "ok"}