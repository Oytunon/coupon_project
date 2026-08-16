import os
import sys
import asyncio
import logging

# Proje kök dizinini path'e ekle
sys.path.append(os.getcwd())

from shared.database import SessionLocal, get_retrying_session
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
        db = get_retrying_session()
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
                
                import json
                
                event = db.query(Event).filter(Event.id == event_id).first()
                start_date_utc3 = None
                end_date_utc3 = None
                
                # Default event dates
                if event and event.start_date and event.end_date:
                    # Betconstruct Local = UTC+3 
                    tr_offset = timedelta(hours=3)
                    start_date_utc3 = event.start_date
                    end_date_utc3 = event.end_date
                
                # Manual overrides pass in via error_message temporarily
                if job.error_message:
                    try:
                        params = json.loads(job.error_message)
                        if "start_date" in params and params["start_date"]:
                            from datetime import datetime
                            # expected format e.g. 2026-03-31T03:38:00Z -> parse to naive UTC
                            dt = datetime.fromisoformat(params["start_date"].replace("Z", "+00:00"))
                            # Convert to naive without tz to match event.start_date
                            start_date_utc3 = dt.replace(tzinfo=None)
                        if "end_date" in params and params["end_date"]:
                            from datetime import datetime
                            dt = datetime.fromisoformat(params["end_date"].replace("Z", "+00:00"))
                            end_date_utc3 = dt.replace(tzinfo=None)
                    except Exception as e:
                        logger.warning(f"Failed to parse override params: {e}")
                    
                    # Clear out the temporary storage 
                    job.error_message = None
                    db.commit()
                    
                # To string after override check (for the coupon worker step 2 which expects string UTC+3)
                start_date_utc3_str = None
                end_date_utc3_str = None
                if start_date_utc3 and end_date_utc3:
                    if 'tr_offset' not in locals():
                        tr_offset = timedelta(hours=3)
                    start_date_utc3_str = (start_date_utc3 + tr_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
                    end_date_utc3_str = (end_date_utc3 + tr_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
                    
                db.close() 

                cancel_event = asyncio.Event()

                async def cancellation_poller(j_id, c_event):
                    try:
                        while not c_event.is_set():
                            local_db = get_retrying_session()
                            try:
                                from shared.models.worker_log import WorkerLog
                                current_job = local_db.query(WorkerLog).filter(WorkerLog.id == j_id).first()
                                if current_job and current_job.status in ("cancelled", "completed", "failed"):
                                    c_event.set()
                                    logger.warning(f"Stats Worker JobID={j_id} durumu '{current_job.status}' oldu, işlem iptal ediliyor.")
                            except Exception as ex:
                                pass
                            finally:
                                local_db.close()
                            await asyncio.sleep(5)
                    except asyncio.CancelledError:
                        pass
                
                poller_task = asyncio.create_task(cancellation_poller(job_id, cancel_event))
                
                # 1. Deposit motorunu Manuel Tam Tarama modunda çalıştır (GÜN GÜN BÖLÜNEREK)
                # İlk parça: REPLACE (sıfırdan başla), sonraki parçalar: ADD (var olana ekle) → eski veri kaybolmaz!
                logger.info(f"Adım 1: Yatırım (Deposit) Çekimi Başlatılıyor... [JobID={job_id}] (GÜN GÜN BÖLÜNEREK)")
                if start_date_utc3 and end_date_utc3:
                    from datetime import timedelta
                    import gc
                    current_dep_dt = start_date_utc3
                    dep_end_dt = end_date_utc3
                    dep_chunk_index = 1

                    while current_dep_dt < dep_end_dt:
                        if cancel_event.is_set():
                            break

                        next_dep_dt = min(current_dep_dt + timedelta(days=1), dep_end_dt)
                        logger.info(f" -> [Deposit Parça {dep_chunk_index}] Günlük Çekiliyor: {current_dep_dt.strftime('%Y-%m-%d')} - {next_dep_dt.strftime('%Y-%m-%d')}")

                        await process_deposits(
                            target_event_id=event_id,
                            job_id=job_id,
                            scan_hours=None,
                            cancel_event=cancel_event,
                            start_override=current_dep_dt,
                            end_override=next_dep_dt,
                            skip_completion=True,
                            force_incremental=True  # Her zaman ADD - eski veriyi silme
                        )
                        gc.collect()
                        await asyncio.sleep(2)

                        current_dep_dt = next_dep_dt
                        dep_chunk_index += 1
                else:
                    await process_deposits(
                        target_event_id=event_id,
                        job_id=job_id,
                        scan_hours=None,
                        cancel_event=cancel_event,
                        skip_completion=True
                    )
                if cancel_event.is_set():
                    logger.warning(f"[JobID={job_id}] İşlem iptal edildiğinden Adım 2 (Kayıp Kupon) atlanıyor.")
                elif start_date_utc3 and end_date_utc3:
                    # 2. Kayıp Kuponları (State=3) çek - Gün gün bölerek, RAM tasarrufu için
                    from datetime import timedelta
                    import gc
                    from shared.domain.scoring_engine import process_coupons
                    
                    logger.info(f"Adım 2: Kayıp Kupon (State=3) Çekimi Başlatılıyor... (GÜN GÜN BÖLÜNEREK)")
                    try:
                        current_dt = start_date_utc3
                        end_dt = end_date_utc3
                        tr_offset = timedelta(hours=3)

                        # Başlangıç == bitiş: while'e hiç girilmezdi; tek pencerede çek
                        if current_dt >= end_dt and not cancel_event.is_set():
                            chunk_start_utc3 = (start_date_utc3 + tr_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
                            chunk_end_utc3 = (end_date_utc3 + tr_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
                            logger.info(f" -> [Parça 1] Tek aralık: {chunk_start_utc3} - {chunk_end_utc3}")
                            await process_coupons(
                                target_event_id=event_id,
                                job_id=job_id,
                                start_date_override=chunk_start_utc3,
                                end_date_override=chunk_end_utc3,
                                state_filter=3,
                                skip_concurrency_check=True,
                                skip_deposits=True,
                                skip_job_finalize=False,
                            )
                        else:
                            chunk_index = 1
                            while current_dt < end_dt:
                                if cancel_event.is_set():
                                    logger.warning(f"[{job_id}] Kayıp kupon çekimi kullanıcı tarafından iptal edildi.")
                                    break

                                next_dt = min(current_dt + timedelta(days=1), end_dt)

                                chunk_start_utc3 = (current_dt + tr_offset).strftime("%Y-%m-%dT%H:%M:%SZ")
                                chunk_end_utc3 = (next_dt + tr_offset).strftime("%Y-%m-%dT%H:%M:%SZ")

                                logger.info(f" -> [Parça {chunk_index}] Günlük Çekiliyor: {chunk_start_utc3} - {chunk_end_utc3}")
                                # Aynı job_id ile gün gün çağrı: ara parçalarda completed yazma — yoksa iptal polleri
                                # "completed" görüp cancel_event set ediyor, kalan günler atlanıyordu.
                                is_last_lost_chunk = next_dt >= end_dt
                                await process_coupons(
                                    target_event_id=event_id,
                                    job_id=job_id,
                                    start_date_override=chunk_start_utc3,
                                    end_date_override=chunk_end_utc3,
                                    state_filter=3,
                                    skip_concurrency_check=True, # Zaten izole worker
                                    skip_deposits=True, # Deposit az önce çekildi
                                    skip_job_finalize=not is_last_lost_chunk,
                                )
                                gc.collect()
                                await asyncio.sleep(2)

                                current_dt = next_dt
                                chunk_index += 1

                        logger.info("İstatistik İşlemleri (Deposit + Kayıp Kuponlar GÜN GÜN) başarıyla tamamlandı.")
                    except Exception as pc_err:
                        logger.error(f"Kayıp Kupon Çekimi Sırasında Hata: {pc_err}")
                else:
                    logger.warning("Event verisi bulunamadı, Kayıp kupon çekimi atlandı.")

                if poller_task and not poller_task.done():
                    poller_task.cancel()

                # Deposit skip_completion=True veya kayıp döngüsü hiç girmediyse job "running" kalabilir;
                # son parça process_coupons zaten completed yazmış olabilir.
                if not cancel_event.is_set():
                    from datetime import datetime as _dt_utc
                    fin_db = get_retrying_session()
                    try:
                        j = fin_db.query(WorkerLog).filter(WorkerLog.id == job_id).first()
                        if j and j.status == "running":
                            j.status = "completed"
                            j.completed_at = _dt_utc.utcnow()
                            fin_db.commit()
                            logger.info(f"[JobID={job_id}] Stats görevi tamamlandı (running → completed).")
                    finally:
                        fin_db.close()
                
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
