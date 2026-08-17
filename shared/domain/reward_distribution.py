"""
Ödül dağıtım planı: reward_worker ile aynı kural sırası ve 'kullanıcı başına tek ödül' mantığı.
"""
from typing import Any, Dict, List, Set

from sqlalchemy.orm import Session

from shared.models.event import Event
from shared.domain.leaderboard import get_event_leaderboard


def apply_reward_overrides(
    overrides: Dict[str, Any],
    participants: List[Dict[str, Any]],
    payouts: List[Dict[str, Any]],
    rewarded_clients: Set[Any],
) -> List[str]:
    """
    Admin'in önizlemede yaptığı manuel düzenlemeleri (miktar değiştir / çıkar / ekle)
    kural bazlı sonucun üzerine uygular. payouts ve rewarded_clients yerinde değiştirilir.
    Uygulanamayan override'ların client_id'lerini (örn. 'add' için participant bulunamadı) döner.
    """
    participants_by_cid = {p["client_id"]: p for p in participants}
    skipped: List[str] = []

    for cid_str, ov in (overrides or {}).items():
        try:
            cid = int(cid_str)
        except (TypeError, ValueError):
            skipped.append(str(cid_str))
            continue

        action = (ov or {}).get("action")

        if action == "remove":
            if cid in rewarded_clients:
                rewarded_clients.discard(cid)
                payouts[:] = [p for p in payouts if p["client_id"] != cid]

        elif action == "adjust":
            if cid in rewarded_clients:
                for p in payouts:
                    if p["client_id"] == cid:
                        p["amount"] = ov.get("amount", p["amount"])
                        p["reward_type"] = ov.get("reward_type", p["reward_type"])
                        p["partner_bonus_id"] = ov.get("partner_bonus_id", p.get("partner_bonus_id"))
                        p["criteria_type"] = "manual_adjust"
                        p["manual_note"] = ov.get("note")
                        break
            else:
                skipped.append(cid_str)

        elif action == "add":
            if cid not in rewarded_clients:
                user = participants_by_cid.get(cid)
                if not user:
                    skipped.append(cid_str)
                    continue
                rewarded_clients.add(cid)
                payouts.append(
                    {
                        "sequence": len(payouts) + 1,
                        "rank": user["rank"],
                        "username": user.get("username"),
                        "client_id": cid,
                        "points": user["points"],
                        "reward_type": ov.get("reward_type"),
                        "amount": ov.get("amount"),
                        "criteria_type": "manual_add",
                        "criteria_value": None,
                        "partner_bonus_id": ov.get("partner_bonus_id"),
                        "manual_note": ov.get("note"),
                    }
                )
        else:
            skipped.append(cid_str)

    return skipped


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

        # Sıralamada yer alsa bile hiç puanı olmayan (kupon oynamamış) katılımcı ödül alamaz.
        eligible_users: List[dict] = []
        if criteria_type == "rank":
            eligible_users = [p for p in participants if p["rank"] <= int(criteria_value) and p["points"] > 0]
        elif criteria_type == "rank_exact":
            eligible_users = [p for p in participants if p["rank"] == int(criteria_value) and p["points"] > 0]
        elif criteria_type == "min_points":
            eligible_users = [p for p in participants if p["points"] >= float(criteria_value) and p["points"] > 0]

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

    overrides = event.rules.get("reward_overrides", {}) or {}
    skipped_overrides = apply_reward_overrides(overrides, participants, payouts, rewarded_clients)

    # Dağıtım sırası her zaman liderlik sırasıyla (rank) birebir eşleşsin - kuralların
    # event.rules["rewards"] içinde hangi sırayla girildiğine bağlı kalmasın. Admin panelinde
    # "Liderlik Sırası" ile "Gerçek Dağıtım Sırası" aynı sırada görünür, worker de aynı
    # sırayla işler (rank sırası, doğruluğu etkilemez, sadece okunabilirlik/öngörülebilirlik).
    payouts.sort(key=lambda p: p["rank"])

    # remove/add sequence numaralarını bozabileceği için son hâliyle yeniden numaralandır.
    for idx, p in enumerate(payouts, 1):
        p["sequence"] = idx

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
        "reward_overrides": overrides,
        "skipped_overrides": skipped_overrides,
    }
