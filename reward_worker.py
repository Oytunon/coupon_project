
import time
import sys
import logging
import json
from datetime import datetime
from threading import Thread

# Proje kök dizinini path'e ekle
import os
sys.path.append(os.getcwd())

from shared.database import SessionLocal
from shared.models.reward_job import RewardJob
from shared.models.event import Event
from shared.models.worker_log import WorkerLog
from shared.domain.leaderboard import get_event_leaderboard
from backend_api.app.services.bapi_client import BapiClient

# Loglama Ayarları
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("reward_worker.log", encoding='utf-8')
    ]
)
logger = logging.getLogger("reward_worker")

def process_job(job_id: int):
    db = SessionLocal()
    # Create a progress log entry in WorkerLog for visibility in Admin Panel
    worker_log = WorkerLog(status="running")
    try:
        job = db.query(RewardJob).filter(RewardJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found!")
            worker_log.status = "failed"
            worker_log.error_message = f"RewardJob {job_id} not found"
            db.add(worker_log)
            db.commit()
            return

        worker_log.event_id = job.event_id
        db.add(worker_log)
        db.commit()
        db.refresh(worker_log)

        logger.info(f"Starting Job {job_id} for Event {job.event_id}")
        job.status = "processing"
        db.commit()

        event = db.query(Event).filter(Event.id == job.event_id).first()
        if not event:
            raise ValueError(f"Event {job.event_id} not found")

        # Lider Tablosunu Getir
        participants = get_event_leaderboard(db, event.id)
        
        for idx, p in enumerate(participants, 1):
            p['rank'] = idx

        rewards = event.rules.get('rewards', [])
        job_results = job.results or {}
        
        bapi = BapiClient()
        success_count = 0
        fail_count = 0
        rewarded_clients = set()

        # Update initial count expectation
        worker_log.processed_count = 0
        db.commit()

        for rule in rewards:
            rule_type = rule.get('reward_type')
            amount = rule.get('amount')
            criteria_type = rule.get('criteria_type')
            criteria_value = rule.get('criteria_value')
            
            if rule_type not in ['cash', 'spin', 'freebet']:
                logger.warning(f"Skipping unsupported reward type: {rule_type}")
                continue

            eligible_users = []
            if criteria_type == 'rank':
                eligible_users = [p for p in participants if p['rank'] <= int(criteria_value)]
            elif criteria_type == 'rank_exact':
                eligible_users = [p for p in participants if p['rank'] == int(criteria_value)]
            elif criteria_type == 'min_points':
                eligible_users = [p for p in participants if p['points'] >= int(criteria_value)]
            
            logger.info(f"Rule {rule_type} {criteria_type}={criteria_value} matched {len(eligible_users)} users")

            for user in eligible_users:
                client_id = user['client_id']
                user_str = str(client_id)
                
                if client_id in rewarded_clients:
                    logger.info(f"Client {client_id} already rewarded in this job. Skipping.")
                    continue
                
                rewarded_clients.add(client_id)
                worker_log.processed_count += 1
                db.commit()
                
                if user_str not in job_results:
                    job_results[user_str] = []

                try:
                    logger.info(f"Distributing {amount} {rule_type} to Client {client_id}")
                    event_context = event.slug if event else (job.event_name_snapshot or "DeletedEvent")
                    info_msg = f"EventReward:{event_context} Type:{rule_type} Rank:{user['rank']} Pts:{user['points']}"
                    
                    if rule_type == 'cash':
                        resp = bapi.send_cash_reward(
                            client_id=client_id, 
                            amount=amount, 
                            info=info_msg
                        )
                    elif rule_type in ['spin', 'freebet']:
                        bonus_id = rule.get('partner_bonus_id')
                        if not bonus_id:
                            logger.error(f"Missing partner_bonus_id for {rule_type} rule!")
                            raise ValueError(f"Missing partner_bonus_id for {rule_type}")
                        
                        bonus_type = 5 if rule_type == 'spin' else 6
                        resp = bapi.add_client_to_bonus(
                            client_id=client_id,
                            amount=amount,
                            bonus_id=bonus_id,
                            bonus_type=bonus_type,
                            note=info_msg
                        )
                    
                    job_results[user_str].append({
                        "rule": rule,
                        "status": "success",
                        "response": resp,
                        "timestamp": datetime.now().isoformat()
                    })
                    success_count += 1
                    worker_log.saved_count = success_count
                    db.commit()
                    
                except Exception as e:
                    logger.error(f"Failed to reward Client {client_id}: {e}")
                    job_results[user_str].append({
                        "rule": rule,
                        "status": "failed",
                        "error": str(e),
                        "timestamp": datetime.now().isoformat()
                    })
                    fail_count += 1
                
                # Rate limit koruması
                logger.info("4 saniye bekleniyor...")
                time.sleep(4)
        
        # İş durumu güncelle (Tamamlandı)
        job.results = job_results
        job.status = "completed"
        job.completed_at = datetime.now()
        
        worker_log.status = "completed"
        worker_log.completed_at = datetime.now()
        db.commit()
        logger.info(f"Job {job_id} completed. Success: {success_count}, Failed: {fail_count}")

    except Exception as e:
        logger.error(f"Job {job_id} failed with error: {e}")
        try:
            job.status = "failed"
            job.error_message = str(e)
            worker_log.status = "failed"
            worker_log.error_message = str(e)
            db.commit()
        except:
            pass
    finally:
        db.close()

def run_worker():
    logger.info("Reward Worker Started. Polling for jobs...")
    while True:
        db = SessionLocal()
        try:
            # Find pending job
            job = db.query(RewardJob).filter(RewardJob.status == "pending").first()
            if job:
                logger.info(f"Bekleyen iş bulundu: {job.id}")
                # Veritabanı oturumunu kapatıp işlemi başlat
                job_id = job.id
                db.close() 
                process_job(job_id)
            else:
                db.close()
                time.sleep(5)
        except Exception as e:
            logger.error(f"Worker Loop Error: {e}")
            if db: db.close()
            time.sleep(5)

if __name__ == "__main__":
    run_worker()
