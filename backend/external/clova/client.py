import os
import time
import uuid
import logging
from typing import Optional

import requests


logger = logging.getLogger(__name__)


class ClovaOCRClient:
    """Simple wrapper for Naver Clova OCR V2 API."""

    def __init__(self):
        self.ocr_url = os.environ.get("CLOVA_OCR_URL")
        self.ocr_secret = os.environ.get("CLOVA_OCR_SECRET")

    @property
    def is_configured(self) -> bool:
        return bool(self.ocr_url and self.ocr_secret)

    def extract_text(self, image_base64: str, image_format: str = "jpg") -> Optional[str]:
        """
        Sends image to Clova OCR and returns concatenated text.
        Returns None on any error.
        """
        if not self.is_configured:
            logger.warning("Clova OCR is not configured.")
            return None

        payload = {
            "version": "V2",
            "requestId": str(uuid.uuid4()),
            "timestamp": int(time.time() * 1000),
            "images": [
                {
                    "format": image_format,
                    "name": "challenge_photo",
                    "data": image_base64,
                }
            ],
        }

        try:
            response = requests.post(
                self.ocr_url,
                headers={
                    "Content-Type": "application/json",
                    "X-OCR-SECRET": self.ocr_secret,
                },
                json=payload,
                timeout=20,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.warning("Clova OCR request failed: %s", exc)
            return None

        images = data.get("images") or []
        if not images:
            return None

        first = images[0] or {}
        if first.get("inferResult") == "ERROR":
            logger.warning("Clova OCR inferResult ERROR: %s", first.get("message"))
            return None

        fields = first.get("fields") or []
        if not fields:
            return None

        lines = []
        for field in fields:
            text = field.get("inferText")
            if text:
                lines.append(text.strip())

        return "\n".join(lines).strip() if lines else None
