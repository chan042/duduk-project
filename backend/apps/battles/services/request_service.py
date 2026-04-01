from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError

from apps.battles.models import BattleParticipant, BattleProfile, YuntaekBattle
from apps.battles.seed_mission_templates import seed_battle_mission_templates
from apps.notifications.models import Notification
from apps.notifications.services import create_battle_notification
from apps.battles.services.profile_service import (
    get_battle_display_name,
    get_or_create_battle_profile,
    reconcile_locked_battle_profile,
)
from apps.common.months import get_next_month


CATEGORY_SCORE_KEYS = {
    YuntaekBattle.Category.ALTERNATIVE: "alternative_action",
    YuntaekBattle.Category.GROWTH: "growth_consumption",
    YuntaekBattle.Category.HEALTH: "health_score",
    YuntaekBattle.Category.CHALLENGE: "challenge_success",
}

CATEGORY_DISPLAY_NAMES = {
    YuntaekBattle.Category.ALTERNATIVE: "대안 행동 실현도",
    YuntaekBattle.Category.GROWTH: "성장",
    YuntaekBattle.Category.HEALTH: "건강 점수",
    YuntaekBattle.Category.CHALLENGE: "챌린지",
}

DEV_REQUEST_WINDOW_EXTENSION = timedelta(days=1)


class BattleConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "battle_conflict"
    default_detail = "Battle request conflict."

    def __init__(self, code, detail):
        super().__init__({"code": code, "detail": detail})


def _pair_key(user_id_a, user_id_b):
    first, second = sorted([user_id_a, user_id_b])
    return f"{first}:{second}"


def _current_kst():
    return timezone.localtime(timezone.now())


def _current_target_year_month(now):
    return now.year, now.month


def _request_deadline_at(now):
    if settings.DEBUG and now.day > 15:
        return now + DEV_REQUEST_WINDOW_EXTENSION
    return now.replace(day=15, hour=23, minute=59, second=59, microsecond=0)


def _score_expected_at(now):
    next_year, next_month = get_next_month(now.year, now.month)
    return now.replace(
        year=next_year,
        month=next_month,
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


def _category_display_name(category):
    return CATEGORY_DISPLAY_NAMES.get(category, category)


def _ensure_request_window_open(now):
    if settings.DEBUG:
        return
    if now.day < 1 or now.day > 15:
        raise BattleConflict(
            "BATTLE_REQUEST_WINDOW_CLOSED",
            "윤택지수 대결은 매월 1일~15일 사이에만 시작할 수 있습니다.",
        )


def _lock_profiles(requester, opponent):
    get_or_create_battle_profile(requester)
    get_or_create_battle_profile(opponent)

    profiles = (
        BattleProfile.objects.select_for_update()
        .select_related("user")
        .filter(user_id__in=[requester.id, opponent.id])
        .order_by("user_id")
    )
    profile_map = {profile.user_id: profile for profile in profiles}
    return profile_map[requester.id], profile_map[opponent.id]


def _clear_active_battle_if_matches(profile, battle):
    if profile.active_battle_id == battle.id:
        profile.active_battle = None
        profile.save(update_fields=["active_battle", "updated_at"])


def _expire_battle_request_locked(battle, requester_profile, opponent_profile, now):
    if battle.status != YuntaekBattle.Status.REQUESTED or battle.request_deadline_at >= now:
        return False

    battle.status = YuntaekBattle.Status.EXPIRED
    battle.closed_at = now
    battle.state_version = F("state_version") + 1
    battle.save(update_fields=["status", "closed_at", "state_version", "updated_at"])
    battle.refresh_from_db(fields=["state_version", "status", "closed_at", "updated_at"])

    _clear_active_battle_if_matches(requester_profile, battle)
    _clear_active_battle_if_matches(opponent_profile, battle)

    requester_name = get_battle_display_name(battle.requester)
    opponent_name = get_battle_display_name(battle.opponent)
    transaction.on_commit(
        lambda battle_id=battle.id, requester=battle.requester, opponent=battle.opponent: (
            create_battle_notification(
                requester,
                Notification.BattleEventCode.REQUEST_EXPIRED,
                "윤택지수 대결 신청이 만료되었어요",
                f"{opponent_name}님에게 보낸 대결 신청의 응답 시간이 지났어요.",
                battle_id,
            ),
            create_battle_notification(
                opponent,
                Notification.BattleEventCode.REQUEST_EXPIRED,
                "윤택지수 대결 신청이 만료되었어요",
                f"{requester_name}님이 보낸 대결 신청이 자동으로 만료되었어요.",
                battle_id,
            ),
        )
    )
    return True


def expire_overdue_requested_battles(now=None, limit=50):
    now = now or _current_kst()
    battle_ids = list(
        YuntaekBattle.objects.filter(
            status=YuntaekBattle.Status.REQUESTED,
            request_deadline_at__lt=now,
        )
        .order_by("request_deadline_at", "id")
        .values_list("id", flat=True)[:limit]
    )

    if not battle_ids:
        return 0

    expired_count = 0
    for battle_id in battle_ids:
        with transaction.atomic():
            battle = (
                YuntaekBattle.objects.select_for_update()
                .select_related("requester", "opponent")
                .filter(id=battle_id)
                .first()
            )
            if not battle:
                continue

            requester_profile, opponent_profile = _lock_profiles(battle.requester, battle.opponent)
            if _expire_battle_request_locked(battle, requester_profile, opponent_profile, now):
                expired_count += 1

    return expired_count


def _profile_snapshot(user):
    return {
        "display_name": get_battle_display_name(user),
        "username": user.username,
        "character_type": user.character_type,
        "character_name": user.character_name,
    }


def _create_battle_participants_if_missing(battle):
    BattleParticipant.objects.get_or_create(
        battle=battle,
        user=battle.requester,
        defaults={
            "role": BattleParticipant.Role.REQUESTER,
            "profile_snapshot": _profile_snapshot(battle.requester),
        },
    )
    BattleParticipant.objects.get_or_create(
        battle=battle,
        user=battle.opponent,
        defaults={
            "role": BattleParticipant.Role.OPPONENT,
            "profile_snapshot": _profile_snapshot(battle.opponent),
        },
    )


def _clone_battle_missions_if_missing(battle):
    try:
        seed_battle_mission_templates()
    except ValueError as exc:
        raise BattleConflict("BATTLE_MISSION_TEMPLATE_NOT_FOUND", str(exc))

    templates = list(
        battle.__class__
        ._meta.apps.get_model("battles", "BattleMissionTemplate")
        .objects.filter(category=battle.category, is_active=True)
        .order_by("display_order", "id")
    )
    if not templates:
        raise BattleConflict("BATTLE_MISSION_TEMPLATE_NOT_FOUND", "대결 미션 템플릿이 준비되지 않았습니다.")

    BattleMission = battle.__class__._meta.apps.get_model("battles", "BattleMission")
    for template in templates:
        BattleMission.objects.get_or_create(
            battle=battle,
            template=template,
            defaults={
                "title_snapshot": template.title,
                "description_snapshot": template.description,
                "verification_snapshot": template.verification_config,
                "point_value": 3,
            },
        )


def _validate_request_blockers(requester_profile, opponent_profile):
    if not requester_profile.is_enabled:
        raise BattleConflict("BATTLE_PROFILE_DISABLED", "배틀 프로필이 비활성화되어 대결을 시작할 수 없습니다.")

    if not opponent_profile.is_enabled:
        raise BattleConflict("OPPONENT_BATTLE_PROFILE_DISABLED", "상대의 배틀 프로필이 비활성화되어 있습니다.")

    if requester_profile.pending_result_battle_id:
        raise BattleConflict("REQUESTER_HAS_PENDING_RESULT", "이전 대결 결과 확인이 끝나지 않아 새 대결을 시작할 수 없습니다.")

    if opponent_profile.pending_result_battle_id:
        raise BattleConflict("OPPONENT_HAS_PENDING_RESULT", "상대가 이전 대결 결과 확인 전이라 지금은 신청할 수 없습니다.")

    if requester_profile.active_battle_id:
        raise BattleConflict("REQUESTER_ALREADY_HAS_OPEN_BATTLE", "이미 진행 중이거나 응답 대기 중인 대결이 있습니다.")

    if opponent_profile.active_battle_id:
        raise BattleConflict("OPPONENT_ALREADY_HAS_OPEN_BATTLE", "상대가 이미 다른 대결 신청 또는 진행 중인 대결에 참여 중입니다.")


def create_battle_request(requester, opponent_battle_code, category):
    now = _current_kst()
    expire_overdue_requested_battles(now=now)
    _ensure_request_window_open(now)

    normalized_code = (opponent_battle_code or "").strip().upper()
    if not normalized_code:
        raise ValidationError({"opponent_battle_code": "opponent_battle_code is required."})

    requester_profile = get_or_create_battle_profile(requester)
    if requester_profile.battle_code == normalized_code:
        raise ValidationError({"code": "SELF_CHALLENGE_NOT_ALLOWED"})

    opponent_profile = (
        BattleProfile.objects.select_related("user")
        .filter(battle_code=normalized_code, is_enabled=True)
        .exclude(user=requester)
        .first()
    )
    if not opponent_profile:
        raise NotFound(detail="Battle user not found.")

    opponent = opponent_profile.user
    target_year, target_month = _current_target_year_month(now)

    with transaction.atomic():
        requester_profile, opponent_profile = _lock_profiles(requester, opponent)
        requester_profile = reconcile_locked_battle_profile(requester_profile)
        opponent_profile = reconcile_locked_battle_profile(opponent_profile)

        _validate_request_blockers(requester_profile, opponent_profile)

        try:
            battle = YuntaekBattle.objects.create(
                requester=requester,
                opponent=opponent,
                status=YuntaekBattle.Status.REQUESTED,
                category=category,
                score_key=CATEGORY_SCORE_KEYS[category],
                target_year=target_year,
                target_month=target_month,
                requested_at=now,
                request_deadline_at=_request_deadline_at(now),
                pair_key=_pair_key(requester.id, opponent.id),
                state_version=1,
            )
        except IntegrityError:
            raise BattleConflict("BATTLE_REQUEST_RACE_CONDITION", "동시에 대결 신청이 발생해 이번 요청을 완료하지 못했습니다.")

        requester_profile.active_battle = battle
        requester_profile.save(update_fields=["active_battle", "updated_at"])

        opponent_profile.active_battle = battle
        opponent_profile.save(update_fields=["active_battle", "updated_at"])

        requester_name = get_battle_display_name(requester)
        category_name = _category_display_name(category)
        transaction.on_commit(
            lambda battle_id=battle.id, opponent=opponent: create_battle_notification(
                opponent,
                Notification.BattleEventCode.REQUEST_RECEIVED,
                "윤택지수 대결 신청이 도착했어요",
                f"{requester_name}님이 {category_name} 대결을 신청했어요.",
                battle_id,
                payload={"category": category},
            )
        )

    return battle


def _get_participant_battle_or_404(user, battle_id):
    battle = (
        YuntaekBattle.objects.select_for_update()
        .select_related("requester", "opponent")
        .filter(id=battle_id)
        .filter(Q(requester=user) | Q(opponent=user))
        .first()
    )
    if not battle:
        raise NotFound(detail="Battle not found.")
    return battle


def accept_battle_request(user, battle_id):
    now = _current_kst()
    expire_overdue_requested_battles(now=now)
    _ensure_request_window_open(now)

    with transaction.atomic():
        battle = _get_participant_battle_or_404(user, battle_id)
        requester_profile, opponent_profile = _lock_profiles(battle.requester, battle.opponent)
        requester_profile = reconcile_locked_battle_profile(requester_profile)
        opponent_profile = reconcile_locked_battle_profile(opponent_profile)

        if _expire_battle_request_locked(battle, requester_profile, opponent_profile, now):
            raise BattleConflict("BATTLE_REQUEST_EXPIRED", "응답 기한이 지나 신청이 만료되었습니다.")

        if battle.status != YuntaekBattle.Status.REQUESTED:
            raise BattleConflict("BATTLE_REQUEST_NOT_OPEN", "현재 대결 신청은 수락할 수 없는 상태입니다.")

        if battle.opponent_id != user.id:
            raise BattleConflict("ONLY_OPPONENT_CAN_ACCEPT", "대결 신청은 상대방만 수락할 수 있습니다.")

        battle.status = YuntaekBattle.Status.ACTIVE
        battle.accepted_at = now
        battle.started_at = now
        battle.score_expected_at = _score_expected_at(now)
        battle.state_version = F("state_version") + 1
        battle.save(
            update_fields=[
                "status",
                "accepted_at",
                "started_at",
                "score_expected_at",
                "state_version",
                "updated_at",
            ]
        )

        _create_battle_participants_if_missing(battle)
        _clone_battle_missions_if_missing(battle)

        opponent_name = get_battle_display_name(user)
        category_name = _category_display_name(battle.category)
        transaction.on_commit(
            lambda battle_id=battle.id, requester=battle.requester: create_battle_notification(
                requester,
                Notification.BattleEventCode.REQUEST_ACCEPTED,
                "윤택지수 대결이 시작되었어요",
                f"{opponent_name}님이 {category_name} 대결을 수락했어요.",
                battle_id,
                payload={"category": battle.category},
            )
        )

    return battle


def reject_battle_request(user, battle_id):
    now = _current_kst()
    expire_overdue_requested_battles(now=now)

    with transaction.atomic():
        battle = _get_participant_battle_or_404(user, battle_id)
        requester_profile, opponent_profile = _lock_profiles(battle.requester, battle.opponent)
        requester_profile = reconcile_locked_battle_profile(requester_profile)
        opponent_profile = reconcile_locked_battle_profile(opponent_profile)

        if _expire_battle_request_locked(battle, requester_profile, opponent_profile, now):
            raise BattleConflict("BATTLE_REQUEST_EXPIRED", "응답 기한이 지나 신청이 만료되었습니다.")

        if battle.status != YuntaekBattle.Status.REQUESTED:
            raise BattleConflict("BATTLE_REQUEST_NOT_OPEN", "현재 대결 신청은 거절할 수 없는 상태입니다.")

        if battle.opponent_id != user.id:
            raise BattleConflict("ONLY_OPPONENT_CAN_REJECT", "대결 신청은 상대방만 거절할 수 있습니다.")

        battle.status = YuntaekBattle.Status.REJECTED
        battle.closed_at = now
        battle.state_version = F("state_version") + 1
        battle.save(update_fields=["status", "closed_at", "state_version", "updated_at"])

        _clear_active_battle_if_matches(requester_profile, battle)
        _clear_active_battle_if_matches(opponent_profile, battle)

        opponent_name = get_battle_display_name(user)
        transaction.on_commit(
            lambda battle_id=battle.id, requester=battle.requester: create_battle_notification(
                requester,
                Notification.BattleEventCode.REQUEST_REJECTED,
                "윤택지수 대결 신청이 거절되었어요",
                f"{opponent_name}님이 대결 신청을 거절했어요.",
                battle_id,
                payload={"category": battle.category},
            )
        )

    return battle


def cancel_battle_request(user, battle_id):
    now = _current_kst()
    expire_overdue_requested_battles(now=now)

    with transaction.atomic():
        battle = _get_participant_battle_or_404(user, battle_id)
        requester_profile, opponent_profile = _lock_profiles(battle.requester, battle.opponent)
        requester_profile = reconcile_locked_battle_profile(requester_profile)
        opponent_profile = reconcile_locked_battle_profile(opponent_profile)

        if _expire_battle_request_locked(battle, requester_profile, opponent_profile, now):
            raise BattleConflict("BATTLE_REQUEST_EXPIRED", "응답 기한이 지나 신청이 만료되었습니다.")

        if battle.status != YuntaekBattle.Status.REQUESTED:
            raise BattleConflict("BATTLE_REQUEST_NOT_OPEN", "현재 대결 신청은 취소할 수 없는 상태입니다.")

        if battle.requester_id != user.id:
            raise BattleConflict("ONLY_REQUESTER_CAN_CANCEL", "대결 신청은 신청한 사용자만 취소할 수 있습니다.")

        battle.status = YuntaekBattle.Status.CANCELED
        battle.closed_at = now
        battle.state_version = F("state_version") + 1
        battle.save(update_fields=["status", "closed_at", "state_version", "updated_at"])

        _clear_active_battle_if_matches(requester_profile, battle)
        _clear_active_battle_if_matches(opponent_profile, battle)

        requester_name = get_battle_display_name(user)
        transaction.on_commit(
            lambda battle_id=battle.id, opponent=battle.opponent: create_battle_notification(
                opponent,
                Notification.BattleEventCode.REQUEST_CANCELED,
                "윤택지수 대결 신청이 취소되었어요",
                f"{requester_name}님이 보낸 대결 신청을 취소했어요.",
                battle_id,
                payload={"category": battle.category},
            )
        )

    return battle
