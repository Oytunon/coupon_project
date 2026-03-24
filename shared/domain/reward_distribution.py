"""
Ödül dağıtım planı: reward_worker ile aynı kural sırası ve 'kullanıcı başına tek ödül' mantığı.
"""
from typing import Any, Dict, List, Set

from sqlalchemy.orm import Session

from shared.models.event import Event
from shared.domain.leaderboard import get_event_leaderboard


def compute_reward_distribution_plan(db: Session, event_id: int) -> Dict[str, Any]:
    """
    Dağıtım önizlemesi. Gerçek worker ile uyumlu:
    - Kurallar `event.rules.rewards` sırasıyla işlenir.
    - Her client_id en fazla bir kez ödül alır (ilk eşleşen kural).
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return {"error": "event_not_found"}

    participants = get_event_leaderboard(db, event_id)
    for idx, p in enumerate(participants, 1):
        p["rank"] = idx

    rewards = event.rules.get("rewards", []) or []
    rewarded_clients: Set[Any] = set()
    payouts: List[Dict[str, Any]] = []
    skipped_rules: List[str] = []

    for rule in rewards:
        rule_type = rule.get("reward_type")
        amount = rule.get("amount")
        criteria_type = rule.get("criteria_type")
        criteria_value = rule.get("criteria_value")

        if rule_type not in ["cash", "spin", "freebet", "bonus"]:
            skipped_rules.append(str(rule_type or "?"))
            continue

        eligible_users: List[dict] = []
        if criteria_type == "rank":
            eligible_users = [p for p in participants if p["rank"] <= int(criteria_value)]
        elif criteria_type == "rank_exact":
            eligible_users = [p for p in participants if p["rank"] == int(criteria_value)]
        elif criteria_type == "min_points":
            eligible_users = [p for p in participants if p["points"] >= float(criteria_value)]

        for user in eligible_users:
            cid = user["client_id"]
            if cid in rewarded_clients:
                continue
            rewarded_clients.add(cid)
            payouts.append(
                {
                    "sequence": len(payouts) + 1,
                    "rank": user["rank"],
                    "username": user.get("username"),
                    "client_id": cid,
                    "points": user["points"],
                    "reward_type": rule_type,
                    "amount": amount,
                    "criteria_type": criteria_type,
                    "criteria_value": criteria_value,
                    "partner_bonus_id": rule.get("partner_bonus_id"),
                }
            )

    leaderboard_rows = [
        {
            "rank": p["rank"],
            "username": p.get("username"),
            "client_id": p["client_id"],
            "points": p["points"],
            "coupon_count": p.get("coupon_count", 0),
            "receives_payout": p["client_id"] in rewarded_clients,
        }
        for p in participants
    ]

    return {
        "event_id": event.id,
        "event_name": event.name,
        "event_slug": event.slug,
        "rules_count": len(rewards),
        "participant_count": len(participants),
        "payout_count": len(payouts),
        "leaderboard": leaderboard_rows,
        "payouts": payouts,
        "skipped_unsupported_rule_types": skipped_rules,
    }
