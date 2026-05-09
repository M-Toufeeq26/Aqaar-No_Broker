import os
import shutil
from pathlib import Path
from fastapi import UploadFile, HTTPException
from datetime import datetime

UPLOAD_DIR = "uploads"
IMAGES_DIR = os.path.join(UPLOAD_DIR, "images")
DOCUMENTS_DIR = os.path.join(UPLOAD_DIR, "documents")

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
ALLOWED_DOCUMENT_EXTENSIONS = {'.pdf'}

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10MB

def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()

def validate_image(file: UploadFile):
    extension = get_file_extension(file.filename)
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Image extension {extension} not allowed. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}")
    
    if file.size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"Image size exceeds {MAX_IMAGE_SIZE // (1024*1024)}MB limit")

def validate_document(file: UploadFile):
    extension = get_file_extension(file.filename)
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Document extension {extension} not allowed. Allowed: {', '.join(ALLOWED_DOCUMENT_EXTENSIONS)}")
    
    if file.size > MAX_DOCUMENT_SIZE:
        raise HTTPException(status_code=400, detail=f"Document size exceeds {MAX_DOCUMENT_SIZE // (1024*1024)}MB limit")

def generate_unique_filename(original_filename: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    name, ext = os.path.splitext(original_filename)
    return f"{timestamp}_{name}{ext}"

async def save_upload_file(file: UploadFile, folder: str) -> str:
    unique_filename = generate_unique_filename(file.filename)
    file_path = os.path.join(folder, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return f"/{file_path}"

async def save_image(file: UploadFile) -> str:
    validate_image(file)
    return await save_upload_file(file, IMAGES_DIR)

async def save_document(file: UploadFile) -> str:
    validate_document(file)
    return await save_upload_file(file, DOCUMENTS_DIR)