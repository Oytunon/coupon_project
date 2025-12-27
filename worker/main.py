import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from common.database import get_db_session, check_database_health
from common.settings import settings
from worker.services.betconstruct import fetch_bet_history, fetch_bet_selections, get_date_range
from worker.services.rules import is_valid_bet_history_entry, is_valid_bet_selections

from common.models.participant import Participant
from common.models.coupon import Coupon

# Logging yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def process_coupons():
    """Kuponları kontrol eder ve uygun olanları kaydeder."""
    
    if not check_database_health():
        logger.error("Database bağlantısı başarısız!")
        return
    
    db: Session = get_db_session()

    try:
        participants = db.query(Participant).all()
        logger.info(f"{len(participants)} katılımcı kontrol ediliyor...")

        # Tarih aralığı (Dün 00:00 - Bugün 00:00)
        start_date, end_date = get_date_range()
        logger.info(f"Tarih aralığı: {start_date} - {end_date}")

        total_processed = 0
        total_saved = 0

        for user in participants:
            try:
                logger.info(f"Client {user.client_id} için kuponlar çekiliyor...")
                
                # Bet history çek
                bet_history_data = await fetch_bet_history(
                    client_id=user.client_id,
                    start_date=start_date,
                    end_date=end_date,
                    skip=0,
                    max_rows=100
                )
                
                data_field = bet_history_data.get("Data", {})
                if isinstance(data_field, dict) and "BetData" in data_field:
                    bets = data_field.get("BetData", {}).get("Objects", [])
                else:
                    bets = data_field.get("Objects") if isinstance(data_field, dict) else []
                
                if not bets:
                    bets = bet_history_data.get("Bets", [])

                logger.info(f" {len(bets)} kupon bulundu")

                for bet_history in bets:
                    total_processed += 1
                    bet_id = bet_history.get("BetId") or bet_history.get("Id")
                    
                    if not bet_id:
                        continue
                    
                    exists = db.query(Coupon).filter(
                        Coupon.bet_id == str(bet_id)
                    ).first()

                    if exists:
                        continue

                    # Temel kurallar (Kombine & Stake)
                    if not is_valid_bet_history_entry(bet_history):
                        continue

                    # Detaylı kurallar (Oran & Lig)
                    selections_data = await fetch_bet_selections(bet_id)
                    
                    if not selections_data:
                        logger.warning(f"Kupon {bet_id} detayları çekilemedi")
                        continue

                    if not is_valid_bet_selections(selections_data):
                        continue

                    created_at_str = bet_history.get("Created") or bet_history.get("CreatedDate") or bet_history.get("Date")
                    created_at = datetime.now()
                    
                    if created_at_str:
                        try:
                            if isinstance(created_at_str, datetime):
                                created_at = created_at_str
                            elif isinstance(created_at_str, str):
                                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d-%m-%Y %H:%M:%S", "%Y-%m-%d"]:
                                    try:
                                        created_at = datetime.strptime(created_at_str.split('.')[0], fmt)
                                        break
                                    except (ValueError, AttributeError):
                                        continue
                        except Exception as e:
                            logger.debug(f"Tarih parse hatası: {e}")

                    # Oran hesapla
                    data_field = selections_data.get("Data", [])
                    if isinstance(data_field, list):
                        selections = data_field
                    elif isinstance(data_field, dict):
                        selections = data_field.get("Objects", []) or data_field.get("Selections", []) or []
                    else:
                        selections = []
                        
                    if not selections:
                        selections = selections_data.get("Selections", []) or []

                    total_odds = 1.0
                    for sel in selections:
                        price = float(sel.get("Price", 1.0) or 1.0)
                        total_odds *= price

                    state_value = bet_history.get("State") or bet_history.get("Status") or "open"
                    if isinstance(state_value, str):
                        state_value = state_value.lower()
                    else:
                        state_value = "open"

                    coupon = Coupon(
                        client_id=user.client_id,
                        bet_id=str(bet_id),
                        created_at=created_at,
                        stake=float(bet_history.get("EquivalentAmount", 0.0) or 0.0),
                        odds=float(total_odds),
                        combination_count=int(bet_history.get("Type", 0) or 0),
                        is_live=bool(bet_history.get("IsLive", False) or False),
                        state=state_value,
                        winning=float(bet_history.get("Winning", 0.0) or 0.0),
                        calculation=bool(bet_history.get("Calculation", False) or False)
                    )

                    db.add(coupon)
                    total_saved += 1
                    logger.info(f"Kupon {bet_id} eklendi (Stake: {coupon.stake} TL)")

                db.commit()
                
                if user != participants[-1]:
                    await asyncio.sleep(4) # Rate limit

            except Exception as e:
                logger.error(f"Error processing user {user.client_id}: {e}")
                db.rollback()
                continue

        logger.info(f"İşlem tamamlandı. {total_saved} yeni kupon.")

    except Exception as e:
        logger.error(f"Worker error: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """APScheduler başlatıcısı."""
    scheduler = AsyncIOScheduler()
    trigger = CronTrigger(hour=0, minute=0)
    
    scheduler.add_job(
        process_coupons,
        trigger=trigger,
        id='process_coupons',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Worker scheduler 00:00 için başlatıldı.")
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
            logger.info("⏳ Scheduler çalışıyor, her gün gece 00:00'de otomatik çalışacak. Çıkmak için Ctrl+C...")
            asyncio.get_event_loop().run_forever()
        except KeyboardInterrupt:
            logger.info("🛑 Scheduler durduruluyor...")
            scheduler.shutdown()
            logger.info("✅ Scheduler durduruldu")
