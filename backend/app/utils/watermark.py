import os
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from PyPDF2 import PdfReader, PdfWriter
import shutil

WATERMARK_TEXT = "CONFIDENTIAL - VIEW ONLY"
WATERMARK_DIR = "uploads/watermarks"

os.makedirs(WATERMARK_DIR, exist_ok=True)

def create_watermark_pdf(output_path: str):
    """Create a watermark PDF with diagonal text"""
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter
    
    c.saveState()
    c.setFont("Helvetica", 40)
    c.setFillColorRGB(0.8, 0.8, 0.8, alpha=0.5)
    c.rotate(45)
    
    for x in range(-200, int(width) + 200, 200):
        for y in range(-200, int(height) + 200, 200):
            c.drawString(x, y, WATERMARK_TEXT)
    
    c.restoreState()
    c.save()
    return output_path

def add_watermark_to_pdf(input_path: str, output_path: str) -> str:
    """Add watermark to PDF file"""
    watermark_path = os.path.join(WATERMARK_DIR, "watermark.pdf")
    create_watermark_pdf(watermark_path)
    
    reader = PdfReader(input_path)
    writer = PdfWriter()
    
    watermark_reader = PdfReader(watermark_path)
    watermark_page = watermark_reader.pages[0]
    
    for page in reader.pages:
        page.merge_page(watermark_page)
        writer.add_page(page)
    
    with open(output_path, "wb") as output_file:
        writer.write(output_file)
    
    return output_path

def add_watermark_to_image(input_path: str, output_path: str) -> str:
    """Add watermark to image file (simple copy for now - can be enhanced with PIL)"""
    shutil.copy(input_path, output_path)
    return output_path

def add_watermark(input_path: str, output_path: str, file_type: str = "pdf") -> str:
    """Add watermark to file based on type"""
    if file_type.lower() == "pdf":
        return add_watermark_to_pdf(input_path, output_path)
    else:
        return add_watermark_to_image(input_path, output_path)

def create_watermarked_document(original_path: str, original_filename: str, expires_days: int = 7) -> dict:
    """Create a watermarked copy of a document with expiration"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    watermarked_filename = f"watermarked_{timestamp}_{original_filename}"
    watermarked_path = os.path.join(WATERMARK_DIR, watermarked_filename)
    
    file_ext = os.path.splitext(original_filename)[1].lower().replace('.', '')
    file_type = "pdf" if file_ext == "pdf" else "image"
    
    add_watermark(original_path, watermarked_path, file_type)
    
    expires_at = datetime.now().timestamp() + (expires_days * 24 * 60 * 60)
    
    return {
        "watermarked_url": f"/{watermarked_path}",
        "expires_at": expires_at,
        "watermarked_path": watermarked_path
    }