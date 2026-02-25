"""
알림 생성 헬퍼 함수
코칭, 월간 리포트 생성 시 호출하여 알림을 생성합니다.
"""
from .models import Notification


def create_notification(user, notification_type, title, message, **kwargs):
    """
    알림 생성 헬퍼 함수
    
    Args:
        user: 알림을 받을 사용자
        notification_type: 알림 타입 (COACHING, MONTHLY_REPORT, CHALLENGE)
        title: 알림 제목
        message: 알림 메시지
        **kwargs: related_id, related_year, related_month 등 추가 필드
    
    Returns:
        생성된 Notification 객체
    """
    return Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        related_id=kwargs.get('related_id'),
        related_year=kwargs.get('related_year'),
        related_month=kwargs.get('related_month'),
    )


def create_coaching_notification(user, coaching):
    """
    코칭 생성 알림
    
    Args:
        user: 알림을 받을 사용자
        coaching: 생성된 Coaching 객체
    
    Returns:
        생성된 Notification 객체
    """
    return create_notification(
        user=user,
        notification_type=Notification.NotificationType.COACHING,
        title='새로운 코칭이 생성되었습니다',
        message=f'{coaching.title} - {coaching.subject}',
        related_id=coaching.id
    )


def create_monthly_report_notification(user, year, month):
    """
    월간 리포트 생성 알림 (윤택지수 + AI 리포트 통합)
    
    Args:
        user: 알림을 받을 사용자
        year: 리포트 연도
        month: 리포트 월
    
    Returns:
        생성된 Notification 객체
    """
    return create_notification(
        user=user,
        notification_type=Notification.NotificationType.MONTHLY_REPORT,
        title='윤택지수와 AI 분석 리포트가 생성되었습니다',
        message=f'{year}년 {month}월 윤택지수와 AI 분석 리포트를 확인해보세요!',
        related_year=year,
        related_month=month
    )


def create_challenge_notification(user, title, message, **kwargs):
    """
    챌린지 관련 알림
    """
    return create_notification(
        user=user,
        notification_type=Notification.NotificationType.CHALLENGE,
        title=title,
        message=message,
        related_id=kwargs.get('related_id'),
    )


def _format_challenge_title(challenge_name: str, is_success: bool) -> str:
    name = (challenge_name or '').strip() or '챌린지'
    title_name = name if name.endswith('챌린지') else f'{name} 챌린지'
    status_text = '성공했습니다.' if is_success else '실패했습니다.'
    return f'{title_name} {status_text}'


def create_challenge_result_notification(user_challenge, is_success: bool, failure_reason: str = None):
    """
    챌린지 결과 알림 생성
    """
    title = _format_challenge_title(user_challenge.name, is_success)
    if is_success:
        message = '보상받기를 눌러 포인트를 획득하세요.'
    else:
        message = (failure_reason or '').strip() or '성공 조건을 충족하지 못했습니다.'

    return create_challenge_notification(
        user=user_challenge.user,
        title=title,
        message=message,
        related_id=user_challenge.id,
    )
