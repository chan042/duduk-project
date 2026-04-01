from collections import defaultdict
from datetime import date, timedelta

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.battles.models import BattleMission, BattleParticipant, YuntaekBattle
from apps.common.months import get_month_datetime_range
from apps.battles.services.notification_service import (
    notify_battle_mission_won,
    notify_battle_zero_spend_restart,
)
from apps.transactions.models import Transaction


def _resolve_reference_date(reference_date=None):
    if reference_date is None:
        return timezone.localdate() - timedelta(days=1)
    if isinstance(reference_date, str):
        return date.fromisoformat(reference_date)
    return reference_date


def _battle_first_full_day(battle):
    started_at = timezone.localtime(battle.started_at)
    return started_at.date() + timedelta(days=1)


def _battle_month_bounds(battle):
    return get_month_datetime_range(
        battle.target_year,
        battle.target_month,
    )


def _daily_target_spend(user_id, battle, category, start_date, end_date):
    month_start, month_end = _battle_month_bounds(battle)
    spend_by_date = defaultdict(int)

    transactions = (
        Transaction.objects.filter(
            user_id=user_id,
            date__gte=month_start,
            date__lt=month_end,
        )
        .only("date", "amount", "category")
        .order_by("date", "id")
    )

    for transaction_obj in transactions:
        if transaction_obj.category != category:
            continue
        local_date = timezone.localtime(transaction_obj.date).date()
        if start_date <= local_date <= end_date:
            spend_by_date[local_date] += transaction_obj.amount

    return spend_by_date


def _find_streak_achievement(spend_by_date, start_date, end_date, required_days):
    streak = 0
    current_date = start_date

    while current_date <= end_date:
        if spend_by_date.get(current_date, 0) == 0:
            streak += 1
            if streak >= required_days:
                streak_start = current_date - timedelta(days=required_days - 1)
                return {
                    "streak_start_date": streak_start,
                    "streak_end_date": current_date,
                }
        else:
            streak = 0

        current_date += timedelta(days=1)

    return None


def _streak_length_ending_on(spend_by_date, start_date, end_date):
    if end_date < start_date:
        return 0

    streak = 0
    current_date = end_date
    while current_date >= start_date and spend_by_date.get(current_date, 0) == 0:
        streak += 1
        current_date -= timedelta(days=1)

    return streak


def _maybe_notify_streak_reset(mission, user, spend_by_date, start_date, reference_date, dry_run=False):
    if dry_run or spend_by_date.get(reference_date, 0) <= 0:
        return

    previous_streak = _streak_length_ending_on(
        spend_by_date,
        start_date,
        reference_date - timedelta(days=1),
    )
    if previous_streak <= 0:
        return

    notify_battle_zero_spend_restart(
        mission.battle,
        mission,
        user,
        previous_streak,
        reference_date,
    )


def _build_winner_evidence(category, required_days, achievement, evaluated_at):
    return {
        "type": "category_zero_spend_streak",
        "target_category": category,
        "streak_days": required_days,
        "streak_start_date": achievement["streak_start_date"].isoformat(),
        "streak_end_date": achievement["streak_end_date"].isoformat(),
        "evaluated_at": evaluated_at.isoformat(),
    }


def _build_draw_evidence(category, required_days, achievements, evaluated_at):
    return {
        "type": "category_zero_spend_streak",
        "target_category": category,
        "streak_days": required_days,
        "streak_end_date": achievements["requester"]["streak_end_date"].isoformat(),
        "evaluated_at": evaluated_at.isoformat(),
        "draw_reason": "SAME_STREAK_END_DATE",
        "participants": {
            "requester": {
                "streak_start_date": achievements["requester"]["streak_start_date"].isoformat(),
                "streak_end_date": achievements["requester"]["streak_end_date"].isoformat(),
            },
            "opponent": {
                "streak_start_date": achievements["opponent"]["streak_start_date"].isoformat(),
                "streak_end_date": achievements["opponent"]["streak_end_date"].isoformat(),
            },
        },
    }


def _settle_streak_winner(mission_id, battle_id, winner_id, evidence, resolved_at):
    with transaction.atomic():
        mission = (
            BattleMission.objects.select_for_update()
            .select_related("battle", "battle__requester", "battle__opponent", "template")
            .get(id=mission_id, battle_id=battle_id)
        )
        if mission.status != BattleMission.Status.OPEN:
            return False

        mission.status = BattleMission.Status.WON
        mission.winner_id = winner_id
        mission.won_at = resolved_at
        mission.win_evidence_snapshot = evidence
        mission.save(update_fields=["status", "winner", "won_at", "win_evidence_snapshot"])

        participant = BattleParticipant.objects.select_for_update().get(battle_id=battle_id, user_id=winner_id)
        participant.mission_won_count += 1
        participant.mission_bonus_score += mission.point_value
        participant.save(update_fields=["mission_won_count", "mission_bonus_score"])

        YuntaekBattle.objects.filter(id=battle_id).update(state_version=F("state_version") + 1)
        transaction.on_commit(
            lambda battle=mission.battle, mission=mission, winner_id=winner_id: notify_battle_mission_won(
                battle,
                mission,
                winner_id,
            )
        )

    return True


def _settle_streak_draw(mission_id, battle_id, evidence, resolved_at):
    with transaction.atomic():
        mission = (
            BattleMission.objects.select_for_update()
            .select_related("battle", "template")
            .get(id=mission_id, battle_id=battle_id)
        )
        if mission.status != BattleMission.Status.OPEN:
            return False

        mission.status = BattleMission.Status.DRAW
        mission.winner = None
        mission.won_at = resolved_at
        mission.win_evidence_snapshot = evidence
        mission.save(update_fields=["status", "winner", "won_at", "win_evidence_snapshot"])

        YuntaekBattle.objects.filter(id=battle_id).update(state_version=F("state_version") + 1)

    return True


def _process_open_streak_mission(mission, reference_date, evaluated_at, dry_run=False):
    battle = mission.battle
    category = mission.verification_snapshot.get("category")
    required_days = int(mission.verification_snapshot.get("required_days", 0))
    if not category or required_days <= 0:
        return False

    first_full_day = _battle_first_full_day(battle)
    if reference_date < first_full_day:
        return False

    requester_spend = _daily_target_spend(
        battle.requester_id,
        battle,
        category,
        first_full_day,
        reference_date,
    )
    opponent_spend = _daily_target_spend(
        battle.opponent_id,
        battle,
        category,
        first_full_day,
        reference_date,
    )

    _maybe_notify_streak_reset(
        mission,
        battle.requester,
        requester_spend,
        first_full_day,
        reference_date,
        dry_run=dry_run,
    )
    _maybe_notify_streak_reset(
        mission,
        battle.opponent,
        opponent_spend,
        first_full_day,
        reference_date,
        dry_run=dry_run,
    )

    requester_achievement = _find_streak_achievement(
        requester_spend,
        first_full_day,
        reference_date,
        required_days,
    )
    opponent_achievement = _find_streak_achievement(
        opponent_spend,
        first_full_day,
        reference_date,
        required_days,
    )

    if not requester_achievement and not opponent_achievement:
        return False

    if requester_achievement and opponent_achievement:
        if requester_achievement["streak_end_date"] == opponent_achievement["streak_end_date"]:
            if dry_run:
                return True
            return _settle_streak_draw(
                mission.id,
                battle.id,
                _build_draw_evidence(
                    category,
                    required_days,
                    {
                        "requester": requester_achievement,
                        "opponent": opponent_achievement,
                    },
                    evaluated_at,
                ),
                evaluated_at,
            )

        winner_id = battle.requester_id
        winner_achievement = requester_achievement
        if opponent_achievement["streak_end_date"] < requester_achievement["streak_end_date"]:
            winner_id = battle.opponent_id
            winner_achievement = opponent_achievement
    elif requester_achievement:
        winner_id = battle.requester_id
        winner_achievement = requester_achievement
    else:
        winner_id = battle.opponent_id
        winner_achievement = opponent_achievement

    if dry_run:
        return True

    return _settle_streak_winner(
        mission.id,
        battle.id,
        winner_id,
        _build_winner_evidence(category, required_days, winner_achievement, evaluated_at),
        evaluated_at,
    )


def settle_battle_category_zero_spend(reference_date=None, dry_run=False):
    reference_date = _resolve_reference_date(reference_date)
    evaluated_at = timezone.now()

    missions = list(
        BattleMission.objects.select_related("battle", "template")
        .filter(
            status=BattleMission.Status.OPEN,
            template__verification_type="category_zero_spend_streak",
            battle__status=YuntaekBattle.Status.ACTIVE,
        )
        .order_by("battle_id", "id")
    )

    settled_count = 0
    for mission in missions:
        if _process_open_streak_mission(mission, reference_date, evaluated_at, dry_run=dry_run):
            settled_count += 1

    return {
        "reference_date": reference_date.isoformat(),
        "settled_count": settled_count,
        "mission_count": len(missions),
        "dry_run": dry_run,
    }
