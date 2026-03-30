import os
import sys
import asyncio
import logging

# Proje kök dizinini path'e ekle
sys.path.append(os.getcwd())

from shared.database import SessionLocal
from shared.models.worker_log import WorkerLog
from shared.domain.deposit_worker import process_deposits

# Loglama Ayarları
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("stats_worker.log", encoding='utf-8')
    ]
)
logger = logging.getLogger("stats_worker")

async def run_worker():
    logger.info("Stats Worker Başlatıldı. 'stats' türündeki görevler bekleniyor...")
    while True:
        db = SessionLocal()
        try:
            # Stats (İstatistik/Deposit) işlerinden "pending" olanı bul
            job = db.query(WorkerLog).filter(
                WorkerLog.status == "pending",
                WorkerLog.job_type == "stats"
            ).first()
            
            if job:
                logger.info(f"Bekleyen istatistik işi bulundu: JobID={job.id}, EventID={job.event_id}")
                
                # Değişkenleri kopyalayıp DB session'ı hemen kapatıyoruz (timeout yememek için)
                job_id = job.id
                event_id = job.event_id
                
                # Tarihleri al (Turnuva başlangıç ve bitiş)
                from shared.models.event import Event
                from datetime import timedelta
                
                event = db.query(Event).filter(Event.id == event_id).first()
                start_date_utc3 = None
                end_date_utc3 = None
                if event:
                    # Betconstruct Local = UTC+3 
                    tr_offset = timedelta(hours=3)
                    start_date_utc3 = (event.start_date + tr_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
                    end_date_utc3 = (event.end_date + tr_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
                    
                db.close() 
                
                # 1. Deposit motorunu Manuel Tam Tarama modunda çalıştır (scan_hours=None)
                logger.info(f"Adım 1: Yatırım (Deposit) Çekimi Başlatılıyor... [JobID={job_id}]")
                await process_deposits(target_event_id=event_id, job_id=job_id, scan_hours=None)
                
                # 2. Kayıp Kuponları (State=3) çek - Deposit tamamlandıktan hemen sonra
                if start_date_utc3 and end_date_utc3:
                    logger.info(f"Adım 2: Kayıp Kupon (State=3) Çekimi Başlatılıyor... Tarih: {start_date_utc3} - {end_date_utc3}")
                    from shared.domain.scoring_engine import process_coupons
                    try:
                        # process_coupons içindeki pagination (max_rows=500 ve page_delay=4.0s) kullanılarak güvenle çekilir.
                        await process_coupons(
                            target_event_id=event_id,
                            job_id=job_id,
                            start_date_override=start_date_utc3,
                            end_date_override=end_date_utc3,
                            state_filter=3,
                            skip_concurrency_check=True, # Zaten izole worker
                            skip_deposits=True # Deposit az önce çekildi
                        )
                        logger.info("İstatistik İşlemleri (Deposit + Kayıp Kuponlar) başarıyla tamamlandı.")
                    except Exception as pc_err:
                        logger.error(f"Kayıp Kupon Çekimi Sırasında Hata: {pc_err}")
                else:
                    logger.warning("Event verisi bulunamadı, Kayıp kupon çekimi atlandı.")
                
            else:
                db.close()
                await asyncio.sleep(5)
                
        except Exception as e:
            logger.error(f"Worker Ana Döngü Hatası: {e}")
            try:
                if db: db.close()
            except:
                pass
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(run_worker())
