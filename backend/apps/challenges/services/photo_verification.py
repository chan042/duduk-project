import base64
import logging
from typing import Dict, Any, Optional, Tuple

import requests

from external.ai.client import AIClient
from external.clova.client import ClovaOCRClient


logger = logging.getLogger(__name__)


class PhotoVerificationService:
    """
    Challenge photo verification service.
    - amount_limit_with_photo: cash challenge
    - photo_verification + marketplace: treasure challenge
    - photo_verification + 1+1: one-plus-one challenge
    """

    def verify(
        self,
        user_challenge,
        image_base64: Optional[str] = None,
        photo_url: Optional[str] = None,
        mime_type: str = "image/jpeg",
        log_date=None,
    ) -> Dict[str, Any]:
        image_data, normalized_mime = self._resolve_image_data(
            image_base64=image_base64,
            photo_url=photo_url,
            mime_type=mime_type,
        )
        if not image_data:
            return self._failed(
                reason_code="IMAGE_INPUT_MISSING",
                reason_message="이미지를 읽을 수 없습니다. 다시 촬영하거나 첨부해주세요.",
            )

        success_conditions = user_challenge.success_conditions or {}
        condition_type = success_conditions.get("type", "")
        challenge_name = user_challenge.name or ""
        photo_condition = success_conditions.get("photo_condition", "")

        if condition_type == "amount_limit_with_photo":
            return self._verify_cash_challenge(
                user_challenge=user_challenge,
                image_base64=image_data,
                mime_type=normalized_mime,
            )

        if condition_type == "photo_verification":
            if "중고" in photo_condition or "보물찾기" in challenge_name:
                return self._verify_marketplace_post(image_base64=image_data, mime_type=normalized_mime)
            if "1+1" in photo_condition or "원플원" in challenge_name:
                return self._verify_one_plus_one(image_base64=image_data, mime_type=normalized_mime)

        # Other photo challenges: keep permissive.
        return {
            "passed": True,
            "reason_code": "NO_VERIFICATION_RULE",
            "reason_message": "검증 규칙이 없는 챌린지입니다.",
            "confidence": 1.0,
            "evidence": {},
        }

    def _resolve_image_data(
        self,
        image_base64: Optional[str],
        photo_url: Optional[str],
        mime_type: str,
    ) -> Tuple[Optional[str], str]:
        if image_base64:
            return image_base64.strip(), mime_type or "image/jpeg"

        if not photo_url:
            return None, mime_type or "image/jpeg"

        try:
            response = requests.get(photo_url, timeout=10)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "") or ""
            guessed_mime = content_type.split(";")[0].strip() if content_type else ""
            encoded = base64.b64encode(response.content).decode("utf-8")
            return encoded, guessed_mime or (mime_type or "image/jpeg")
        except Exception as exc:
            logger.warning("Failed to fetch photo_url for verification: %s", exc)
            return None, mime_type or "image/jpeg"

    def _verify_cash_challenge(self, user_challenge, image_base64: str, mime_type: str) -> Dict[str, Any]:
        target_amount = int(user_challenge.user_input_values.get("target_amount") or 0)
        current_spent = int((user_challenge.progress or {}).get("current") or 0)
        expected_remaining = max(0, target_amount - current_spent)
        tolerance = int((user_challenge.success_conditions or {}).get("photo_amount_tolerance") or 0)

        ai_client = AIClient(purpose="analysis")
        result = ai_client.analyze_cash_photo(
            image_base64=image_base64,
            expected_remaining=expected_remaining,
            mime_type=mime_type,
        )
        if not result:
            return self._failed(
                reason_code="VISION_ANALYSIS_FAILED",
                reason_message="사진 분석에 실패했습니다. 선명한 사진으로 다시 시도해주세요.",
            )

        is_cash_photo = bool(result.get("is_cash_photo"))
        detected_cash_total = int(result.get("detected_cash_total") or 0)
        confidence = float(result.get("confidence") or 0)
        denominations = result.get("denominations") or []

        if not is_cash_photo:
            return self._failed(
                reason_code="NOT_CASH_PHOTO",
                reason_message="현금 사진으로 확인되지 않습니다. 다시 촬영해주세요.",
                confidence=confidence,
                evidence={
                    "detected_cash_total": detected_cash_total,
                    "expected_remaining": expected_remaining,
                    "denominations": denominations,
                },
            )

        if abs(detected_cash_total - expected_remaining) > tolerance:
            return self._failed(
                reason_code="CASH_AMOUNT_MISMATCH",
                reason_message="사진 속 현금 합계가 남은 금액과 다릅니다. 다시 촬영해주세요.",
                confidence=confidence,
                evidence={
                    "detected_cash_total": detected_cash_total,
                    "expected_remaining": expected_remaining,
                    "tolerance": tolerance,
                    "denominations": denominations,
                },
            )

        return {
            "passed": True,
            "reason_code": "VERIFIED",
            "reason_message": "현금 인증이 확인되었습니다.",
            "confidence": confidence,
            "evidence": {
                "detected_cash_total": detected_cash_total,
                "expected_remaining": expected_remaining,
                "denominations": denominations,
            },
        }

    def _verify_marketplace_post(self, image_base64: str, mime_type: str) -> Dict[str, Any]:
        ai_client = AIClient(purpose="analysis")
        result = ai_client.analyze_marketplace_post_photo(
            image_base64=image_base64,
            mime_type=mime_type,
        )
        if not result:
            return self._failed(
                reason_code="VISION_ANALYSIS_FAILED",
                reason_message="사진 분석에 실패했습니다. 등록 화면을 다시 첨부해주세요.",
            )

        passed = bool(result.get("is_marketplace_post"))
        confidence = float(result.get("confidence") or 0)

        if not passed:
            return self._failed(
                reason_code="NOT_MARKETPLACE_POST",
                reason_message="중고 거래 사이트 게시글 화면으로 확인되지 않습니다. 등록 화면을 다시 첨부해주세요.",
                confidence=confidence,
                evidence=result,
            )

        return {
            "passed": True,
            "reason_code": "VERIFIED",
            "reason_message": "중고거래 게시글 인증이 확인되었습니다.",
            "confidence": confidence,
            "evidence": result,
        }

    def _verify_one_plus_one(self, image_base64: str, mime_type: str) -> Dict[str, Any]:
        ocr_client = ClovaOCRClient()
        ocr_text = None
        if ocr_client.is_configured:
            image_format = "jpg"
            if "/" in mime_type:
                image_format = mime_type.split("/")[-1].lower().strip()
            ocr_text = ocr_client.extract_text(image_base64=image_base64, image_format=image_format)

        ai_client = AIClient(purpose="analysis")
        result = ai_client.analyze_one_plus_one_photo(
            image_base64=image_base64,
            ocr_text=ocr_text or "",
            mime_type=mime_type,
        )

        if not result:
            return self._failed(
                reason_code="VISION_ANALYSIS_FAILED",
                reason_message="편의점/프로모션 판정에 실패했습니다. 더 선명한 사진으로 재시도해주세요.",
                evidence={"ocr_text": ocr_text or ""},
            )

        is_convenience = bool(result.get("is_convenience_purchase"))
        has_promo = bool(result.get("has_promotion_1p1_or_2p1"))
        confidence = float(result.get("confidence") or 0)

        if not (is_convenience and has_promo):
            return self._failed(
                reason_code="CONVENIENCE_PROMO_NOT_CONFIRMED",
                reason_message="편의점 구매 또는 1+1/2+1 증거가 부족합니다. 더 선명한 사진으로 재시도해주세요.",
                confidence=confidence,
                evidence={
                    "ocr_text": ocr_text or "",
                    "model_result": result,
                },
            )

        return {
            "passed": True,
            "reason_code": "VERIFIED",
            "reason_message": "편의점 1+1/2+1 인증이 확인되었습니다.",
            "confidence": confidence,
            "evidence": {
                "ocr_text": ocr_text or "",
                "model_result": result,
            },
        }

    def _failed(
        self,
        reason_code: str,
        reason_message: str,
        confidence: float = 0.0,
        evidence: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {
            "passed": False,
            "reason_code": reason_code,
            "reason_message": reason_message,
            "confidence": float(confidence or 0),
            "evidence": evidence or {},
        }
