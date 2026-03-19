"""
Event 70 için deposit backfill: 10.03.2026 12:00 (TR) - bugüne kadar tüm katılımcıların
katılımdan sonraki yatırımlarını toplar ve event_participant_deposits tablosuna yazar.

504 timeout önleme: Tarih aralığı 2 günlük parçalara bölünür, her parça ayrı çekilir.

Kullanım:
  python scripts/backfill_deposits_event70.py
  python scripts/backfill_deposits_event70.py --chunk-days 1   # 1 günlük parça
  python scripts/backfill_deposits_event70.py --chunk-days 0.5 # 12 saat (504 sık geliyorsa)
  python scripts/backfill_deposits_event70.py --from-date 2026-03-15  # Parça 5'ten devam (504 koptuysa)
"""
import argparse
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
CHUNK_DAYS_DEFAULT = 1  # 504 önleme: 1 günlük parçalar (0.5 = 12 saat)


async def main(chunk_days: float = CHUNK_DAYS_DEFAULT, from_date: str | None = None):
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
        to_dt = datetime.now(timezone.utc)

        # --from-date: Kaldığı yerden devam (DB'deki mevcut toplamları yükle)
        totals: dict[tuple[int, int], float] = defaultdict(float)
        total_docs = 0
        if from_date:
            try:
                from_dt_parsed = datetime.strptime(from_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                logger.error(f"Geçersiz --from-date: {from_date} (YYYY-MM-DD olmalı)")
                return
            chunk_start = from_dt_parsed
            # DB'deki mevcut toplamları yükle
            for ep in db.query(EventParticipantDeposit).filter(EventParticipantDeposit.event_id == EVENT_ID).all():
                totals[(ep.event_id, ep.participant_id)] = ep.total_deposit_amount
            existing_sum = sum(totals.values())
            logger.info(f"[Backfill] --from-date {from_date} | DB'den yüklendi: {existing_sum:,.2f} TRY (devam)")
        else:
            chunk_start = FROM_DT

        # Uzun API çekimi öncesi DB'yi kapat (Supabase idle timeout)
        db.close()

        logger.info(f"[Backfill] Event {EVENT_ID} | Katılımcı: {len(enrolled_client_ids)} client")
        logger.info(f"[Backfill] Tarih aralığı: {chunk_start.strftime('%Y-%m-%d %H:%M')} UTC -> {to_dt.strftime('%Y-%m-%d %H:%M')} UTC")
        logger.info(f"[Backfill] Parça boyutu: {chunk_days} gün | Parça bitince DB'ye yazılacak (koparsa öncekiler kalır)")

        chunk_num = 0
        while chunk_start < to_dt:
            chunk_num += 1
            chunk_end = min(chunk_start + timedelta(days=chunk_days), to_dt)
            logger.info(f"[Backfill] Parça {chunk_num}: {chunk_start.strftime('%Y-%m-%d')} -> {chunk_end.strftime('%Y-%m-%d')}")

            # MaxRows=200, 4sn gecikme
            chunk_docs = await fetch_deposits_bulk(
                from_dt=chunk_start, to_dt=chunk_end,
                max_rows=200, page_delay=4.0
            )
            total_docs += len(chunk_docs)

            for doc in chunk_docs:
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

            # Her parça bitince hemen DB'ye yaz (koparsa öncekiler kalsın)
            write_db = SessionLocal()
            try:
                now_utc = datetime.now(timezone.utc)
                for cid, enroll_list in client_to_enrollments.items():
                    for event_id, participant_id, _ in enroll_list:
                        total_amount = totals.get((event_id, participant_id), 0.0)
                        existing = write_db.query(EventParticipantDeposit).filter(
                            EventParticipantDeposit.event_id == event_id,
                            EventParticipantDeposit.participant_id == participant_id,
                        ).first()
                        if existing:
                            existing.total_deposit_amount = round(total_amount, 2)
                            existing.last_synced_at = now_utc
                        else:
                            write_db.add(EventParticipantDeposit(
                                event_id=event_id,
                                participant_id=participant_id,
                                total_deposit_amount=round(total_amount, 2),
                                currency_id="TRY",
                                last_synced_at=now_utc,
                            ))
                write_db.commit()
                running_total = sum(totals.values())
                logger.info(f"[Backfill] Parça {chunk_num} kaydedildi | Toplam: {total_docs} kayıt | Ara toplam yatırım: {running_total:,.2f} TRY")
            except Exception as we:
                logger.error(f"[Backfill] Parça {chunk_num} DB yazma hatası: {we}")
                write_db.rollback()
                raise
            finally:
                write_db.close()

            chunk_start = chunk_end
            if chunk_start < to_dt:
                await asyncio.sleep(5)

        total_deposit = sum(totals.values())
        matched = sum(1 for v in totals.values() if v > 0)
        logger.info(f"[Backfill] Tamamlandı | API kayıt: {total_docs} | Eşleşen katılımcı: {matched} | Toplam yatırım: {total_deposit:,.2f} TRY")
    except Exception as e:
        import traceback
        logger.error(f"[Backfill] Hata: {e}")
        traceback.print_exc()
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        try:
            db.close()
        except Exception:
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--chunk-days", type=float, default=CHUNK_DAYS_DEFAULT, help="Tarih parça boyutu (gün, 0.5=12sa), 504 önleme")
    parser.add_argument("--from-date", type=str, default=None, help="Bu tarihten devam et (YYYY-MM-DD), 504 koptuysa kullan")
    args = parser.parse_args()
    asyncio.run(main(chunk_days=args.chunk_days, from_date=args.from_date))
