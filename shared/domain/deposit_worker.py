"""
Deposit worker: Katılımcıların turnuvaya katıldıktan sonraki toplam yatırımlarını senkronize eder.
TOPLU çekim: API'den tek seferde (pagination ile) tüm yatırımlar alınır, katılımcılara göre filtre/toplam yapılır.

- scan_hours verilirse (otomatik): Son N saat incremental - last_synced_at'tan bugüne ekler. İlk run'da max N saat geriye gider.
- scan_hours verilmezse (manuel): min_joined'tan bugüne tam tarama, REPLACE.
"""
import logging
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from shared.database import SessionLocal
from shared.models.event import Event
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.models.event_participant_deposit import EventParticipantDeposit
from shared.models.worker_log import WorkerLog
from shared.domain.rules_validator import get_active_events
from shared.services.deposit_report import fetch_deposits_bulk, MANUAL_MAX_ROWS, MANUAL_PAGE_DELAY_SEC
from shared.services.betconstruct import WorkerCancelledException

logger = logging.getLogger(__name__)


import asyncio

async def process_deposits(
    target_event_id: Optional[int] = None,
    job_id: Optional[int] = None,
    scan_hours: Optional[int] = None,
    cancel_event: Optional[asyncio.Event] = None,
    start_override: Optional[datetime] = None,
    end_override: Optional[datetime] = None
):
    """
    Event katılımcılarının joined_at sonrası toplam yatırımlarını toplu çeker ve event_participant_deposits'e yazar.
    scan_hours: Otomatik run'da son N saat (örn. 1). İncremental ekleme, geriye çok gitmez.
    scan_hours=None: Manuel run, min_joined'tan bugüne tam tarama (REPLACE).
    """
    db = SessionLocal()

    def update_job_status(status: str, processed: int = 0, saved: int = 0, error: Optional[str] = None, total: int = 0, _db=None):
        if not job_id:
            return
        max_retries = 3 if status in ("completed", "failed", "cancelled") else 1
        for attempt in range(max_retries):
            log_db = _db if (_db is not None and attempt == 0) else SessionLocal()
            own = _db is None or attempt > 0
            try:
                job = log_db.query(WorkerLog).filter(WorkerLog.id == job_id).first()
                if job:
                    job.status = status
                    job.processed_count += processed
                    job.saved_count += saved
                    if total > 0:
                        job.total_count = total
                    if error:
                        job.error_message = str(error)
                    if status in ("completed", "failed", "cancelled"):
                        job.completed_at = datetime.now(timezone.utc)
                    log_db.commit()
                break
            except Exception as ex:
                logger.error(f"Deposit job update error (attempt {attempt + 1}/{max_retries}): {ex}")
                if attempt < max_retries - 1 and status in ("completed", "failed", "cancelled"):
                    time.sleep(2)
                else:
                    break
            finally:
                if own:
                    try:
                        log_db.close()
                    except Exception:
                        pass

    try:
        if not job_id:
            cron_job = WorkerLog(event_id=target_event_id, status="pending")
            db.add(cron_job)
            db.commit()
            db.refresh(cron_job)
            job_id = cron_job.id
            logger.info(f"[Deposit Worker] Job oluşturuldu: job_id={job_id}")

        if job_id:
            update_job_status("running", _db=db)

        if target_event_id:
            event = db.query(Event).filter(Event.id == target_event_id).first()
            active_events = [event] if event else []
        else:
            active_events = get_active_events(db=db)

        if not active_events:
            if job_id:
                update_job_status("completed", _db=db)
            return

        enrollments = db.query(EventParticipant).filter(
            EventParticipant.event_id.in_([e.id for e in active_events])
        ).all()

        if not enrollments:
            if job_id:
                update_job_status("completed", _db=db)
            return

        participant_ids = list(set(e.participant_id for e in enrollments))
        participants = {p.id: p for p in db.query(Participant).filter(Participant.id.in_(participant_ids)).all()}

        # client_id -> [(event_id, participant_id, joined_at_utc), ...]
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
        if not enrolled_client_ids:
            if job_id:
                update_job_status("completed", _db=db)
            return

        min_joined = min(ja for per_client in client_to_enrollments.values() for _, _, ja in per_client)
        now_utc = datetime.now(timezone.utc)
        
        # En geç biten etkinliğin bitiş tarihini bul (Etkinlik bitmişse, bittikten sonrasını aramaya gerek yok)
        max_end_date = max(e.end_date for e in active_events)
        if max_end_date.tzinfo is None:
            max_end_date = max_end_date.replace(tzinfo=timezone.utc)
        
        # Taramayı şu an ile etkinlik bitiş tarihi (hangisi daha erkense) ile sınırla
        to_dt = min(now_utc, max_end_date)

        # Tarih aralığı: scan_hours varsa incremental (son N saat), yoksa tam tarama
        event_ids = [e.id for e in active_events]
        existing_deposits = {
            (ep.event_id, ep.participant_id): ep
            for ep in db.query(EventParticipantDeposit).filter(
                EventParticipantDeposit.event_id.in_(event_ids)
            ).all()
        }
        participant_keys = {(eid, pid) for cid, enroll_list in client_to_enrollments.items() for eid, pid, _ in enroll_list}
        synced_ats = [
            ep.last_synced_at for (eid, pid), ep in existing_deposits.items()
            if (eid, pid) in participant_keys and ep.last_synced_at
        ]
        if start_override and end_override:
            if start_override.tzinfo is None:
                start_override = start_override.replace(tzinfo=timezone.utc)
            if end_override.tzinfo is None:
                end_override = end_override.replace(tzinfo=timezone.utc)
            from_dt = start_override
            to_dt = min(to_dt, end_override)
            incremental = False
        elif scan_hours is not None and synced_ats:
            min_synced = min(synced_ats)
            if min_synced.tzinfo is None:
                min_synced = min_synced.replace(tzinfo=timezone.utc)
            from_dt = max(min_synced, now_utc - timedelta(hours=scan_hours))  # Cap: max scan_hours geriye
            incremental = True
        elif scan_hours is not None:
            from_dt = max(min_joined, now_utc - timedelta(hours=scan_hours))
            incremental = True
        else:
            from_dt = min_joined
            incremental = False

        db.close()  # Uzun API çekimi öncesi kapat (Supabase idle timeout)

        logger.info(f"[Deposit Worker] Event(ler): {event_ids} | Katılımcı: {len(enrolled_client_ids)} | Tarih: {from_dt.strftime('%Y-%m-%d %H:%M')} - {to_dt.strftime('%Y-%m-%d %H:%M')} UTC | {'incremental' if incremental else 'full'}")

        if job_id:
            update_job_status("running", total=len(enrolled_client_ids))

        # Manuel (full): MaxRows=500, 2sn gecikme → ~183 sayfa, ~6 dk. Otomatik: 200, 4sn.
        max_rows = None if incremental else MANUAL_MAX_ROWS
        page_delay = None if incremental else MANUAL_PAGE_DELAY_SEC
        docs = await fetch_deposits_bulk(from_dt=from_dt, to_dt=to_dt, max_rows=max_rows, page_delay=page_delay, cancel_event=cancel_event)

        if cancel_event and cancel_event.is_set():
            logger.info("[Deposit Worker] İşlem iptal edildiği için kayıtlar veritabanına işlenmiyor.")
            if job_id:
                update_job_status("cancelled")
            return

        db = SessionLocal()  # Yazma için yeni session (önceki ~30 dk idle kalmıştı)

        new_totals: dict[tuple[int, int], float] = defaultdict(float)
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
                    new_totals[(event_id, participant_id)] += amount

        now_utc = datetime.now(timezone.utc)
        saved = 0
        total_deposit_sum = 0.0

        for cid, enroll_list in client_to_enrollments.items():
            for event_id, participant_id, _ in enroll_list:
                new_sum = new_totals.get((event_id, participant_id), 0.0)
                existing = db.query(EventParticipantDeposit).filter(
                    EventParticipantDeposit.event_id == event_id,
                    EventParticipantDeposit.participant_id == participant_id,
                ).first()
                if incremental:
                    base = existing.total_deposit_amount if existing else 0.0
                    total_amount = base + new_sum
                else:
                    total_amount = new_sum
                total_deposit_sum += total_amount
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
        if job_id:
            update_job_status("completed", processed=len(docs), saved=saved, _db=db)
        logger.info(f"[Deposit Worker] Tamamlandı | API kayıt: {len(docs)} | Güncellenen: {saved} | Toplam yatırım: {total_deposit_sum:,.2f} TRY")

    except WorkerCancelledException:
        try:
            db.rollback()
        except Exception:
            pass
        if job_id:
            update_job_status("cancelled")
        logger.info("[Deposit Worker] İptal edildi")
    except Exception as e:
        import traceback
        logger.error(f"[Deposit Worker] Hata: {e}")
        logger.error(traceback.format_exc())
        try:
            db.rollback()
        except Exception:
            pass
        if job_id:
            update_job_status("failed", error=str(e))
    finally:
        try:
            db.close()
        except Exception:
            pass
