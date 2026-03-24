import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from shared.logging_config import setup_logging
from shared.domain.scoring_engine import process_coupons

# Logging setup
logger = setup_logging("worker")

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
    scheduler.add_job(
        process_coupons,
        trigger=CronTrigger(minute='*/15', timezone='Europe/Istanbul'),
        id='process_coupons',
        kwargs={"scan_hours": 1},
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
    await process_coupons()


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
