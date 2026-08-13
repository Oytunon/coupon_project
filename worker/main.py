import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from shared.logging_config import setup_logging
from shared.domain.scoring_engine import process_coupons
from shared.database import SessionLocal
from shared.models.event import Event

# Logging setup
logger = setup_logging("worker")


async def run_worker_pipeline(scan_hours: int, report_auth_mode: str):
    """
    15 dk cron: önce mevcut process_coupons taraması sıralı (await) olarak tamamlanır,
    ardından — varsa — sadece futbol (stake_floor_thousand formüllü) event'ler için ayrı,
    izole bir GetBetReport çağrısı yapılır. Bu ikinci adım try/except ile sarmalı: hata
    olursa sadece loglanır, ilk taramanın sonuçlarını etkilemez.
    """
    await process_coupons(scan_hours=scan_hours, report_auth_mode=report_auth_mode)
    try:
        db = SessionLocal()
        try:
            football_score_events = [
                e for e in db.query(Event).filter(Event.status == "active").all()
                if (e.rules or {}).get("scoring_formula") == "stake_floor_thousand"
            ]
        finally:
            db.close()
        for e in football_score_events:
            await process_coupons(
                target_event_id=e.id,
                scan_hours=scan_hours,
                report_auth_mode=report_auth_mode,
                sport_id=1,
            )
    except Exception:
        logger.exception("[Worker] Futbol puan pipeline hata verdi, mevcut tarama etkilenmedi.")


def start_scheduler():
    """APScheduler başlatıcısı."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    scheduler = AsyncIOScheduler(event_loop=loop)
    from shared.domain.cleanup import cleanup_expired_magic_tokens, auto_expire_events, cleanup_old_worker_logs
    
    # Her 15 dakikada bir son 1 saati tara (katılımdan sonra kupon kaçırma riski min)
    # Ardından (sıralı, aynı job içinde) varsa futbol-puan event'leri ayrı işlenir.
    scheduler.add_job(
        run_worker_pipeline,
        trigger=CronTrigger(minute='*/15', timezone='Europe/Istanbul'),
        id='process_coupons',
        kwargs={"scan_hours": 1, "report_auth_mode": "bapi_only"},
        replace_existing=True
    )

    # Her 15 dakikada bir süresi dolan active eventleri temizle
    scheduler.add_job(
        auto_expire_events,
        trigger=CronTrigger(minute='*/15', timezone='Europe/Istanbul'),
        id='auto_expire_events',
        replace_existing=True
    )

    # Her gece 01:00'de (TR) eski tokenları temizle
    scheduler.add_job(
        cleanup_expired_magic_tokens,
        trigger=CronTrigger(hour=1, minute=0, timezone='Europe/Istanbul'),
        id='cleanup_tokens',
        replace_existing=True
    )

    # Her Pazar 02:00'de eski worker logları temizle (son 30 gün tutulur)
    scheduler.add_job(
        cleanup_old_worker_logs,
        trigger=CronTrigger(day_of_week='sun', hour=2, minute=0, timezone='Europe/Istanbul'),
        id='cleanup_worker_logs',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Worker scheduler başlatıldı: process_coupons+auto_expire (15dk), cleanup_tokens (01:00), cleanup_worker_logs (Pazar 02:00).")
    return scheduler


async def run_worker_once():
    """
    Worker'ı bir kez çalıştırır (test için).
    """
    await run_worker_pipeline(scan_hours=1, report_auth_mode="bapi_only")


if __name__ == "__main__":
    import sys
    
    # Eğer --once parametresi verilmişse, sadece bir kez çalıştır
    if "--once" in sys.argv:
        logger.info("🔄 Worker tek seferlik çalıştırılıyor...")
        asyncio.run(run_worker_once())
    else:
        # Normal mod: scheduler ile sürekli çalış
        logger.info("🔄 Worker scheduler modunda başlatılıyor...")
        scheduler = start_scheduler()
        
        try:
            # Scheduler'ı çalışır durumda tut
            logger.info("⏳ Scheduler çalışıyor, her 15 dk'da bir otomatik çalışacak. Çıkmak için Ctrl+C...")
            asyncio.get_event_loop().run_forever()
        except (KeyboardInterrupt, SystemExit):
            pass
