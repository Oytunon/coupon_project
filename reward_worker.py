
import time
import sys
import logging
import json
from datetime import datetime
from threading import Thread

# Paths setup modules
import os
sys.path.append(os.getcwd())

from shared.database import SessionLocal
from shared.models.reward_job import RewardJob
from shared.models.event import Event
from shared.domain.leaderboard import get_event_leaderboard
from backend_api.app.services.bapi_client import BapiClient

# Configure Logging
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
    try:
        job = db.query(RewardJob).filter(RewardJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found!")
            return

        logger.info(f"Starting Job {job_id} for Event {job.event_id}")
        job.status = "processing"
        db.commit()

        event = db.query(Event).filter(Event.id == job.event_id).first()
        if not event:
            raise ValueError(f"Event {job.event_id} not found")

        # Get Leaderboard
        # Leaderboard returns list of dicts sorted by points desc
        participants = get_event_leaderboard(db, event.id)
        
        # Add rank explicitly if not present (assuming get_event_leaderboard might just return list)
        for idx, p in enumerate(participants, 1):
            p['rank'] = idx

        rewards = event.rules.get('rewards', [])
        job_results = job.results or {}
        
        bapi = BapiClient()
        success_count = 0
        fail_count = 0

        for rule in rewards:
            rule_type = rule.get('reward_type')
            amount = rule.get('amount')
            criteria_type = rule.get('criteria_type')
            criteria_value = rule.get('criteria_value')
            
            if rule_type != 'cash':
                logger.warning(f"Skipping unsupported reward type: {rule_type}")
                continue

            # Identify eligible users
            eligible_users = []
            if criteria_type == 'rank':
                eligible_users = [p for p in participants if p['rank'] <= int(criteria_value)]
            elif criteria_type == 'min_points':
                eligible_users = [p for p in participants if p['points'] >= int(criteria_value)]
            
            logger.info(f"Rule {criteria_type}={criteria_value} matched {len(eligible_users)} users")

            for user in eligible_users:
                client_id = user['client_id']
                user_str = str(client_id)
                
                # Check if already processed in this job for this rule? 
                # Ideally we track per rule, but for simplicity we track per user.
                # If user matches multiple rules, they get multiple rewards? 
                # Yes, commonly expected behavior.
                
                # We need a unique key for the result entry to allow multiple rewards
                # But JSON keys must be strings. 
                # Let's append to a list in the results for that user?
                if user_str not in job_results:
                    job_results[user_str] = []

                try:
                    logger.info(f"Distributing {amount} {rule_type} to Client {client_id}")
                    
                    # Call BAPI
                    # Info message formatted for clarity
                    info_msg = f"EventReward:{event.slug} Rank:{user['rank']} Pts:{user['points']}"
                    
                    resp = bapi.send_cash_reward(
                        client_id=client_id, 
                        amount=amount, 
                        info=info_msg
                    )
                    
                    job_results[user_str].append({
                        "rule": rule,
                        "status": "success",
                        "response": resp,
                        "timestamp": datetime.now().isoformat()
                    })
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to reward Client {client_id}: {e}")
                    job_results[user_str].append({
                        "rule": rule,
                        "status": "failed",
                        "error": str(e),
                        "timestamp": datetime.now().isoformat()
                    })
                    fail_count += 1
                
                # Wait 4 seconds between requests to avoid rate limiting
                logger.info("Waiting 4 seconds before next request...")
                time.sleep(4)
        
        # Update job
        job.results = job_results
        job.status = "completed"
        job.completed_at = datetime.now()
        db.commit()
        logger.info(f"Job {job_id} completed. Success: {success_count}, Failed: {fail_count}")

    except Exception as e:
        logger.error(f"Job {job_id} failed with error: {e}")
        try:
            job.status = "failed"
            job.error_message = str(e)
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
                logger.info(f"Found pending job {job.id}")
                # Process in main thread for now to avoid complexity, or spawn thread
                # Since we want to ensure db session safety, separate thread or process is better if parallel.
                # But sequential is safer for now.
                job_id = job.id
                db.close() # Close session before processing
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
