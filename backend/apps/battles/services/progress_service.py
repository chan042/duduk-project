from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.battles.models import BattleParticipant, YuntaekBattle
from apps.battles.services.profile_service import get_battle_display_name
from apps.common.months import get_month_end_datetime


PROGRESS_VISIBLE_STATUSES = [
    YuntaekBattle.Status.ACTIVE,
    YuntaekBattle.Status.WAITING_FOR_SCORE,
]


def _get_progress_battle_or_404(user):
    battle = (
        YuntaekBattle.objects.select_related("requester", "opponent", "winner")
        .filter(Q(requester=user) | Q(opponent=user), status__in=PROGRESS_VISIBLE_STATUSES)
        .order_by("-started_at", "-id")
        .first()
    )
    if not battle:
        raise NotFound(detail="Current battle not found.")
    return battle


def _get_participant_map(battle):
    participants = BattleParticipant.objects.filter(battle=battle, user_id__in=[battle.requester_id, battle.opponent_id])
    return {participant.user_id: participant for participant in participants}


def _mission_payload(mission):
    winner_name = get_battle_display_name(mission.winner) if mission.winner else None
    return {
        "id": mission.id,
        "title": mission.title_snapshot,
        "description": mission.description_snapshot,
        "status": mission.status,
        "winner_name": winner_name,
        "point_value": mission.point_value,
    }


def _calculate_d_day(battle):
    if battle.status == YuntaekBattle.Status.WAITING_FOR_SCORE:
        return 0

    now = timezone.localtime(timezone.now())
    if battle.score_expected_at:
        result_day = timezone.localtime(battle.score_expected_at, now.tzinfo).date()
    else:
        end_of_month = _battle_end_at(battle, tzinfo=now.tzinfo)
        result_day = (end_of_month + timedelta(days=1)).date()
    delta = result_day - now.date()
    return max(delta.days, 0)


def _battle_end_at(battle, tzinfo=None):
    return get_month_end_datetime(
        battle.target_year,
        battle.target_month,
        tzinfo=tzinfo,
    )


def _participant_payload(participant, fallback_user):
    mission_won_count = participant.mission_won_count if participant else 0
    mission_bonus_score = participant.mission_bonus_score if participant else 0
    profile_snapshot = (participant.profile_snapshot or {}) if participant else {}
    return {
        "name": get_battle_display_name(fallback_user),
        "character_type": profile_snapshot.get("character_type") or fallback_user.character_type,
        "mission_won_count": mission_won_count,
        "mission_bonus_score": mission_bonus_score,
        "current_score": mission_won_count,
    }


def get_current_battle_summary(user):
    battle = _get_progress_battle_or_404(user)
    opponent = battle.opponent if battle.requester_id == user.id else battle.requester
    return {
        "battle_id": battle.id,
        "status": battle.status,
        "category": battle.category,
        "target_year": battle.target_year,
        "target_month": battle.target_month,
        "state_version": battle.state_version,
        "opponent_display_name": get_battle_display_name(opponent),
    }


def get_current_battle_progress(user):
    battle = _get_progress_battle_or_404(user)
    participants = _get_participant_map(battle)
    my_user = battle.requester if battle.requester_id == user.id else battle.opponent
    opponent_user = battle.opponent if battle.requester_id == user.id else battle.requester
    my_participant = participants.get(my_user.id)
    opponent_participant = participants.get(opponent_user.id)
    missions = list(battle.missions.select_related("winner").order_by("id"))
    battle_end_at = _battle_end_at(battle)

    return {
        "battle_id": battle.id,
        "status": battle.status,
        "category": battle.category,
        "target_year": battle.target_year,
        "target_month": battle.target_month,
        "state_version": battle.state_version,
        "d_day": _calculate_d_day(battle),
        "battle_end_at": battle_end_at,
        "score_expected_at": battle.score_expected_at,
        "result_ready": False,
        "me": _participant_payload(my_participant, my_user),
        "opponent": _participant_payload(opponent_participant, opponent_user),
        "missions": [_mission_payload(mission) for mission in missions],
    }
