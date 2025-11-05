"""
Document Storage and Processing Service

Handles:
- Document upload (ID cards, passports, utility bills)
- Image processing and validation
- Secure storage (S3/local)
- Document extraction
- Face detection
"""
import os
import logging
import hashlib
import mimetypes
from typing import Dict, List, Optional, BinaryIO
from datetime import datetime, timedelta
from pathlib import Path
import base64
from io import BytesIO

from PIL import Image
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings

logger = logging.getLogger(__name__)


class DocumentService:
    """
    Document storage and processing service
    
    Features:
    - Secure document upload
    - Image validation and processing
    - Multiple storage backends (S3, local)
    - Document type detection
    - Image optimization
    """
    
    # Allowed document types
    DOCUMENT_TYPES = {
        'national_id': 'National ID Card',
        'passport': 'International Passport',
        'drivers_license': 'Driver\'s License',
        'utility_bill': 'Utility Bill',
        'bank_statement': 'Bank Statement',
        'selfie': 'Selfie Photo',
    }
    
    # Allowed image formats
    ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/jpg']
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    # Image processing settings
    MAX_DIMENSION = 2048  # Max width/height
    JPEG_QUALITY = 85
    
    def __init__(self):
        """Initialize document service"""
        self.storage_backend = getattr(settings, 'KYC_STORAGE_BACKEND', 'local')
        self.storage_path = getattr(settings, 'KYC_STORAGE_PATH', 'kyc_documents')
    
    def validate_file(
        self,
        file_data: bytes,
        filename: str
    ) -> Dict:
        """
        Validate uploaded file
        
        Args:
            file_data: Binary file data
            filename: Original filename
            
        Returns:
            Validation result with details
        """
        result = {
            'valid': False,
            'errors': [],
            'file_size': len(file_data),
            'mime_type': None,
        }
        
        # Check file size
        if len(file_data) > self.MAX_FILE_SIZE:
            result['errors'].append(f'File too large. Max size: {self.MAX_FILE_SIZE / 1024 / 1024}MB')
            return result
        
        # Check MIME type
        mime_type, _ = mimetypes.guess_type(filename)
        result['mime_type'] = mime_type
        
        if mime_type not in self.ALLOWED_FORMATS:
            result['errors'].append(f'Invalid file format. Allowed: {", ".join(self.ALLOWED_FORMATS)}')
            return result
        
        # Try to open as image
        try:
            image = Image.open(BytesIO(file_data))
            result['width'], result['height'] = image.size
            result['format'] = image.format
            
            # Check minimum dimensions
            if image.width < 300 or image.height < 300:
                result['errors'].append('Image too small. Minimum 300x300 pixels')
                return result
            
            result['valid'] = True
            
        except Exception as e:
            result['errors'].append(f'Invalid image file: {str(e)}')
            return result
        
        return result
    
    def process_image(
        self,
        file_data: bytes,
        optimize: bool = True
    ) -> bytes:
        """
        Process and optimize image
        
        Args:
            file_data: Binary image data
            optimize: Whether to optimize image
            
        Returns:
            Processed image data
        """
        image = Image.open(BytesIO(file_data))
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        
        # Resize if too large
        if max(image.size) > self.MAX_DIMENSION:
            image.thumbnail((self.MAX_DIMENSION, self.MAX_DIMENSION), Image.Resampling.LANCZOS)
        
        # Save optimized
        output = BytesIO()
        if optimize:
            image.save(output, format='JPEG', quality=self.JPEG_QUALITY, optimize=True)
        else:
            image.save(output, format='JPEG', quality=95)
        
        return output.getvalue()
    
    def generate_filename(
        self,
        user_id: int,
        document_type: str,
        original_filename: str
    ) -> str:
        """
        Generate secure filename
        
        Args:
            user_id: User ID
            document_type: Type of document
            original_filename: Original filename
            
        Returns:
            Generated filename
        """
        # Get file extension
        ext = Path(original_filename).suffix.lower()
        if not ext:
            ext = '.jpg'
        
        # Generate hash
        timestamp = datetime.now().isoformat()
        hash_input = f"{user_id}_{document_type}_{timestamp}_{original_filename}"
        file_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:16]
        
        # Format: user_{id}/documents/{type}_{hash}.jpg
        filename = f"user_{user_id}/documents/{document_type}_{file_hash}{ext}"
        
        return filename
    
    async def upload_document(
        self,
        user_id: int,
        document_type: str,
        file_data: bytes,
        original_filename: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Upload and store document
        
        Args:
            user_id: User ID
            document_type: Type of document
            file_data: Binary file data
            original_filename: Original filename
            metadata: Optional metadata
            
        Returns:
            Upload result with file URL
        """
        # Validate file
        validation = self.validate_file(file_data, original_filename)
        if not validation['valid']:
            return {
                'success': False,
                'errors': validation['errors']
            }
        
        # Process image
        try:
            processed_data = self.process_image(file_data)
        except Exception as e:
            logger.error(f"Image processing error: {e}")
            return {
                'success': False,
                'errors': [f'Image processing failed: {str(e)}']
            }
        
        # Generate filename
        filename = self.generate_filename(user_id, document_type, original_filename)
        
        # Save file
        try:
            file_path = default_storage.save(
                os.path.join(self.storage_path, filename),
                ContentFile(processed_data)
            )
            
            file_url = default_storage.url(file_path)
            
            return {
                'success': True,
                'file_path': file_path,
                'file_url': file_url,
                'file_size': len(processed_data),
                'mime_type': validation['mime_type'],
                'width': validation.get('width'),
                'height': validation.get('height'),
                'metadata': metadata or {},
            }
            
        except Exception as e:
            logger.error(f"File storage error: {e}")
            return {
                'success': False,
                'errors': [f'File upload failed: {str(e)}']
            }
    
    async def get_document(
        self,
        file_path: str
    ) -> Optional[bytes]:
        """
        Retrieve document from storage
        
        Args:
            file_path: Path to file
            
        Returns:
            File data or None
        """
        try:
            if default_storage.exists(file_path):
                with default_storage.open(file_path, 'rb') as f:
                    return f.read()
            return None
        except Exception as e:
            logger.error(f"File retrieval error: {e}")
            return None
    
    async def delete_document(
        self,
        file_path: str
    ) -> bool:
        """
        Delete document from storage
        
        Args:
            file_path: Path to file
            
        Returns:
            Success status
        """
        try:
            if default_storage.exists(file_path):
                default_storage.delete(file_path)
                return True
            return False
        except Exception as e:
            logger.error(f"File deletion error: {e}")
            return False
    
    def encode_image_base64(
        self,
        file_data: bytes
    ) -> str:
        """
        Encode image to base64 for API submission
        
        Args:
            file_data: Binary image data
            
        Returns:
            Base64 encoded string
        """
        return base64.b64encode(file_data).decode('utf-8')
    
    def decode_image_base64(
        self,
        base64_str: str
    ) -> bytes:
        """
        Decode base64 image
        
        Args:
            base64_str: Base64 encoded image
            
        Returns:
            Binary image data
        """
        return base64.b64decode(base64_str)
    
    async def extract_document_info(
        self,
        file_data: bytes
    ) -> Dict:
        """
        Extract information from document (OCR)
        
        Args:
            file_data: Binary image data
            
        Returns:
            Extracted information
        """
        # Placeholder for OCR integration (Tesseract, AWS Textract, etc.)
        # This would extract text from ID cards, passports, etc.
        
        return {
            'text': '',
            'fields': {},
            'confidence': 0,
        }
    
    async def detect_faces(
        self,
        file_data: bytes
    ) -> Dict:
        """
        Detect faces in image
        
        Args:
            file_data: Binary image data
            
        Returns:
            Face detection results
        """
        # Placeholder for face detection (OpenCV, AWS Rekognition, etc.)
        # This would detect faces in selfies and ID cards
        
        return {
            'faces_detected': 0,
            'bounding_boxes': [],
            'confidence': 0,
        }
    
    def get_presigned_url(
        self,
        file_path: str,
        expiry_seconds: int = 3600
    ) -> Optional[str]:
        """
        Generate presigned URL for temporary access (S3)
        
        Args:
            file_path: Path to file
            expiry_seconds: URL expiry time in seconds
            
        Returns:
            Presigned URL or None
        """
        # For S3 storage backend
        if self.storage_backend == 's3':
            # This would use boto3 to generate presigned URL
            pass
        
        # For local storage, return regular URL
        try:
            return default_storage.url(file_path)
        except Exception as e:
            logger.error(f"Presigned URL error: {e}")
            return None
