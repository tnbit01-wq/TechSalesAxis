"""
FILE STORAGE CONFIGURATION
Add to: apps/api/src/core/file_storage.py (NEW FILE)

Local file storage for bulk uploads (not S3)
"""

import os
from pathlib import Path
from typing import Optional
import aiofiles
import shutil
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Base upload directory (create if not exists)
BULK_UPLOAD_BASE_DIR = Path(os.getenv('BULK_UPLOAD_DIR', '/uploads/bulk_uploads'))
BULK_UPLOAD_BASE_DIR.mkdir(parents=True, exist_ok=True)

# Subdirectories
TEMP_UPLOAD_DIR = BULK_UPLOAD_BASE_DIR / '_temp'
TEMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ARCHIVE_DIR = BULK_UPLOAD_BASE_DIR / '_archive'
ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

# File constraints
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt'}

# ============================================================================
# FILE STORAGE CLASS
# ============================================================================

class LocalFileStorage:
    """Handle local file storage for bulk uploads"""
    
    @staticmethod
    def get_batch_directory(batch_id: str) -> Path:
        """Get directory for a specific batch"""
        batch_dir = BULK_UPLOAD_BASE_DIR / batch_id
        batch_dir.mkdir(parents=True, exist_ok=True)
        return batch_dir
    
    @staticmethod
    def get_file_path(batch_id: str, file_id: str, original_filename: str) -> Path:
        """Get full path for a file in a batch"""
        batch_dir = LocalFileStorage.get_batch_directory(batch_id)
        file_dir = batch_dir / file_id
        file_dir.mkdir(parents=True, exist_ok=True)
        return file_dir / original_filename
    
    @staticmethod
    async def save_uploaded_file(
        batch_id: str,
        file_id: str,
        filename: str,
        file_content: bytes
    ) -> dict:
        """
        Save uploaded file to local storage.
        
        Args:
            batch_id: Bulk upload batch ID
            file_id: Unique file ID
            filename: Original filename
            file_content: File content as bytes
        
        Returns:
            {
                'file_path': str (absolute path),
                'relative_path': str (for database),
                'file_size': int (bytes),
                'saved_at': datetime
            }
        """
        try:
            # Validate file extension
            file_ext = Path(filename).suffix.lower()
            if file_ext not in ALLOWED_EXTENSIONS:
                raise ValueError(f"File extension {file_ext} not allowed")
            
            # Validate file size
            if len(file_content) > MAX_FILE_SIZE_BYTES:
                raise ValueError(
                    f"File size {len(file_content)} exceeds max {MAX_FILE_SIZE_BYTES}"
                )
            
            # Get file path
            file_path = LocalFileStorage.get_file_path(batch_id, file_id, filename)
            
            # Save file asynchronously
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(file_content)
            
            logger.info(f"File saved: {file_path}")
            
            # Return storage info
            relative_path = str(file_path.relative_to(BULK_UPLOAD_BASE_DIR))
            
            return {
                'file_path': str(file_path),
                'relative_path': relative_path,
                'file_size': len(file_content),
                'saved_at': datetime.utcnow(),
                'status': 'success'
            }
        
        except ValueError as e:
            logger.error(f"Validation error: {str(e)}")
            return {
                'status': 'error',
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"File save error: {str(e)}")
            return {
                'status': 'error',
                'error': f"Failed to save file: {str(e)}"
            }
    
    @staticmethod
    async def read_file(file_path: str) -> Optional[bytes]:
        """Read file content from local storage"""
        try:
            async with aiofiles.open(file_path, 'rb') as f:
                content = await f.read()
            return content
        except FileNotFoundError:
            logger.error(f"File not found: {file_path}")
            return None
        except Exception as e:
            logger.error(f"Error reading file: {str(e)}")
            return None
    
    @staticmethod
    def delete_file(file_path: str) -> bool:
        """Delete a file from storage"""
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                logger.info(f"File deleted: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return False
    
    @staticmethod
    def archive_batch(batch_id: str) -> bool:
        """
        Archive a batch directory after retention period.
        Moves batch folder to _archive with timestamp.
        """
        try:
            batch_dir = LocalFileStorage.get_batch_directory(batch_id)
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            archive_path = ARCHIVE_DIR / f"{batch_id}_{timestamp}"
            
            shutil.move(str(batch_dir), str(archive_path))
            logger.info(f"Batch archived: {batch_id} -> {archive_path}")
            return True
        except Exception as e:
            logger.error(f"Error archiving batch: {str(e)}")
            return False
    
    @staticmethod
    def get_batch_size(batch_id: str) -> int:
        """Get total size of all files in a batch (bytes)"""
        try:
            batch_dir = LocalFileStorage.get_batch_directory(batch_id)
            total_size = 0
            for file_path in batch_dir.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
            return total_size
        except Exception as e:
            logger.error(f"Error calculating batch size: {str(e)}")
            return 0
    
    @staticmethod
    def get_storage_stats() -> dict:
        """Get storage usage statistics"""
        try:
            def get_dir_size(path: Path) -> int:
                total = 0
                for item in path.rglob('*'):
                    if item.is_file():
                        total += item.stat().st_size
                return total
            
            total_size = get_dir_size(BULK_UPLOAD_BASE_DIR)
            archive_size = get_dir_size(ARCHIVE_DIR)
            active_size = total_size - archive_size
            
            # Count files
            total_files = len(list(BULK_UPLOAD_BASE_DIR.rglob('*')))
            
            return {
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'active_size_bytes': active_size,
                'active_size_mb': round(active_size / (1024 * 1024), 2),
                'archive_size_bytes': archive_size,
                'archive_size_mb': round(archive_size / (1024 * 1024), 2),
                'total_files': total_files,
                'base_dir': str(BULK_UPLOAD_BASE_DIR),
            }
        except Exception as e:
            logger.error(f"Error getting storage stats: {str(e)}")
            return {}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_file_for_download(batch_id: str, file_id: str) -> Optional[tuple]:
    """
    Get file for download endpoint.
    
    Returns: (file_content, original_filename) or None if not found
    """
    batch_dir = LocalFileStorage.get_batch_directory(batch_id)
    file_dir = batch_dir / file_id
    
    # Find file in directory (should be only one)
    for file_path in file_dir.glob('*'):
        if file_path.is_file():
            content = await LocalFileStorage.read_file(str(file_path))
            if content:
                return content, file_path.name
    
    return None


# ============================================================================
# ENVIRONMENT SETUP
# ============================================================================

"""
Add to .env file:

# Bulk Upload Storage
BULK_UPLOAD_DIR=/uploads/bulk_uploads
MAX_FILE_SIZE_MB=10
ALLOWED_UPLOAD_EXTENSIONS=pdf,doc,docx,txt

Window users can use:
BULK_UPLOAD_DIR=C:\\uploads\\bulk_uploads

Or in Docker:
BULK_UPLOAD_DIR=/var/data/bulk_uploads
(with volume mount: -v /path/on/host:/var/data/bulk_uploads)
"""

# ============================================================================
# CLEANUP TASK (Run periodically with Celery)
# ============================================================================

"""
Create file: apps/api/src/tasks/cleanup_old_uploads.py

from celery import shared_task
from datetime import datetime, timedelta
from pathlib import Path
from ..core.file_storage import LocalFileStorage, BULK_UPLOAD_BASE_DIR
import logging

logger = logging.getLogger(__name__)

@shared_task
def cleanup_expired_uploads(retention_days: int = 90):
    \"\"\"
    Delete or archive files older than retention_days.
    Run this daily via Celery Beat.
    
    Usage:
        # In celery_beat_schedule:
        'cleanup-old-uploads': {
            'task': 'src.tasks.cleanup_old_uploads.cleanup_expired_uploads',
            'schedule': crontab(hour=2, minute=0),  # Run at 2 AM daily
            'kwargs': {'retention_days': 90}
        }
    \"\"\"
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        deleted_count = 0
        archived_count = 0
        
        for batch_dir in BULK_UPLOAD_BASE_DIR.iterdir():
            if not batch_dir.is_dir() or batch_dir.name.startswith('_'):
                continue
            
            # Check directory modification time
            mtime = datetime.fromtimestamp(batch_dir.stat().st_mtime)
            
            if mtime < cutoff_date:
                # Archive instead of delete for compliance
                try:
                    LocalFileStorage.archive_batch(batch_dir.name)
                    archived_count += 1
                except Exception as e:
                    logger.error(f"Failed to archive {batch_dir.name}: {str(e)}")
        
        logger.info(
            f"Cleanup completed: {archived_count} batches archived, "
            f"{deleted_count} files deleted"
        )
        return {
            'archived': archived_count,
            'deleted': deleted_count
        }
    
    except Exception as e:
        logger.error(f"Cleanup task failed: {str(e)}")
        return {'error': str(e)}
"""
