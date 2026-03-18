"""
Event 70 için deposit backfill: 10.03.2026 12:00 (TR) - bugüne kadar tüm katılımcıların
katılımdan sonraki yatırımlarını toplar ve event_participant_deposits tablosuna yazar.

Kullanım:
  python scripts/backfill_deposits_event70.py

SSH üzerinden yavaş çeker (sayfalar arası 4 sn).
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from shared.database import SessionLocal
from shared.models.event import Event
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.models.event_participant_deposit import EventParticipantDeposit
from shared.services.deposit_report import fetch_deposits_bulk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EVENT_ID = 70
# 10.03.2026 12:00 TR (UTC+3) -> 09:00 UTC
FROM_DT = datetime(2026, 3, 10, 9, 0, 0, tzinfo=timezone.utc)


async def main():
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == EVENT_ID).first()
        if not event:
            logger.error(f"Event {EVENT_ID} bulunamadı!")
            return

        enrollments = db.query(EventParticipant).filter(EventParticipant.event_id == EVENT_ID).all()
        if not enrollments:
            logger.warning(f"Event {EVENT_ID} için katılımcı yok.")
            return

        participant_ids = list(set(e.participant_id for e in enrollments))
        participants = {p.id: p for p in db.query(Participant).filter(Participant.id.in_(participant_ids)).all()}

        client_to_enrollments: dict[int, list[tuple[int, int, datetime]]] = defaultdict(list)
        for enr in enrollments:
            p = participants.get(enr.participant_id)
            if not p:
                continue
            joined = enr.joined_at
            if joined.tzinfo is None:
                joined = joined.replace(tzinfo=timezone.utc)
            client_to_enrollments[p.client_id].append((enr.event_id, enr.participant_id, joined))

        enrolled_client_ids = set(client_to_enrollments.keys())
        logger.info(f"Event {EVENT_ID} | Katılımcı: {len(enrolled_client_ids)} client")

        to_dt = datetime.now(timezone.utc)
        logger.info(f"Tarih aralığı: {FROM_DT.strftime('%Y-%m-%d %H:%M')} UTC -> {to_dt.strftime('%Y-%m-%d %H:%M')} UTC")
        logger.info("API'den toplu çekim başlıyor (sayfa arası 4 sn)...")

        docs = await fetch_deposits_bulk(from_dt=FROM_DT, to_dt=to_dt)

        totals: dict[tuple[int, int], float] = defaultdict(float)
        for doc in docs:
            cid = doc["client_id"]
            if cid not in enrolled_client_ids:
                continue
            amount = doc["amount"]
            created = doc.get("created_utc")
            if created is None:
                continue
            for event_id, participant_id, joined_at in client_to_enrollments[cid]:
                if created >= joined_at:
                    totals[(event_id, participant_id)] += amount

        now_utc = datetime.now(timezone.utc)
        saved = 0
        for cid, enroll_list in client_to_enrollments.items():
            for event_id, participant_id, _ in enroll_list:
                total_amount = totals.get((event_id, participant_id), 0.0)
                existing = db.query(EventParticipantDeposit).filter(
                    EventParticipantDeposit.event_id == event_id,
                    EventParticipantDeposit.participant_id == participant_id,
                ).first()
                if existing:
                    existing.total_deposit_amount = round(total_amount, 2)
                    existing.last_synced_at = now_utc
                else:
                    db.add(EventParticipantDeposit(
                        event_id=event_id,
                        participant_id=participant_id,
                        total_deposit_amount=round(total_amount, 2),
                        currency_id="TRY",
                        last_synced_at=now_utc,
                    ))
                saved += 1

        db.commit()
        total_deposit = sum(totals.values())
        logger.info(f"Tamamlandı | API kayıt: {len(docs)} | Güncellenen: {saved} | Toplam yatırım: {total_deposit:,.2f} TRY")
    except Exception as e:
        import traceback
        logger.error(f"Hata: {e}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
