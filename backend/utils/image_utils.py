"""
Image validation utilities using OpenCV and Pillow.
Handles blur detection, darkness detection, and image corruption checks.
"""
import base64
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def encode_image_base64(image_path: str) -> Optional[str]:
    """
    Encode an image file to base64 JPEG for Vision APIs.
    Converts any format (AVIF, WebP, PNG, etc.) to JPEG so all providers
    accept it — Groq in particular rejects non-JPEG base64 data.
    Returns None if the file is missing or unreadable.
    """
    path = Path(image_path)
    if not path.exists():
        logger.warning(f"Image not found: {image_path}")
        return None
    try:
        from PIL import Image
        import io
        with Image.open(path) as img:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            return base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        logger.warning(f"PIL conversion failed for {image_path}: {e}, falling back to raw bytes")
        try:
            with open(path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
        except Exception as e2:
            logger.error(f"Failed to encode image {image_path}: {e2}")
            return None


def get_image_extension(image_path: str) -> str:
    """
    Always return 'jpeg' — encode_image_base64 normalises all images to JPEG.
    """
    return "jpeg"


def check_blur(image_path: str) -> tuple[float, bool]:
    """
    Detect image blur using Laplacian variance method via OpenCV.
    Returns (blur_score, is_blurry).
    Higher score = sharper image. Score < 100 is considered blurry.
    """
    try:
        import cv2
        import numpy as np

        img = cv2.imread(image_path)
        if img is None:
            return 0.0, True

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_blurry = bool(laplacian_var < 100.0)
        return float(laplacian_var), is_blurry
    except ImportError:
        logger.warning("OpenCV not available, skipping blur detection")
        return -1.0, False
    except Exception as e:
        logger.error(f"Blur check failed for {image_path}: {e}")
        return 0.0, True


def check_image_valid(image_path: str) -> tuple[bool, str]:
    """
    Validate that an image file is readable and not corrupted.
    Returns (is_valid, reason).
    """
    path = Path(image_path)

    if not path.exists():
        return False, "file_not_found"

    if path.stat().st_size == 0:
        return False, "empty_file"

    try:
        from PIL import Image
        with Image.open(image_path) as img:
            img.verify()
        return True, "ok"
    except ImportError:
        # PIL not available, just check file exists
        return True, "ok"
    except Exception as e:
        logger.error(f"Image validation failed for {image_path}: {e}")
        return False, f"corrupted: {str(e)}"


def check_dark_image(image_path: str) -> bool:
    """
    Detect if an image is too dark (average brightness < 30).
    """
    try:
        import cv2
        import numpy as np

        img = cv2.imread(image_path)
        if img is None:
            return False

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        avg_brightness = np.mean(gray)
        return bool(avg_brightness < 30)
    except Exception:
        return False
