from shared.database import SessionLocal
from shared.models.coupon_event_result import CouponEventResult
from shared.models.enrollment import EventParticipant
from shared.models.coupon import Coupon
from shared.models.event import Event
from shared.domain.scoring_engine import calculate_points_for_event
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def recalculate_all_scores():
    db = SessionLocal()
    try:
        results = db.query(CouponEventResult).all()
        logger.info(f"Checking {len(results)} coupon results...")
        
        for res in results:
            coupon = db.query(Coupon).filter(Coupon.id == res.coupon_id).first()
            event = db.query(Event).filter(Event.id == res.event_id).first()
            
            if not coupon or not event:
                continue
                
            # Use the newly updated calculation logic
            new_points, new_details = calculate_points_for_event(coupon, event)
            
            if res.points_earned != new_points:
                logger.info(f"Updating Bet {coupon.bet_id}: {res.points_earned} -> {new_points}")
                res.points_earned = new_points
                res.points_calculation = new_details
        
        db.commit()
        logger.info("Coupon results updated. Recalculating totals...")
        
        # Update EventParticipant totals
        participants = db.query(EventParticipant).all()
        for ep in participants:
            total = sum(
                r.points_earned for r in db.query(CouponEventResult).filter(
                    CouponEventResult.event_id == ep.event_id,
                    CouponEventResult.coupon_id.in_(
                        db.query(Coupon.id).filter(Coupon.client_id == ep.participant.client_id)
                    )
                ).all()
            )
            if ep.total_points != total:
                logger.info(f"Updating User {ep.participant.username} total: {ep.total_points} -> {total}")
                ep.total_points = total
        
        db.commit()
        logger.info("Recalculation complete!")
        
    except Exception as e:
        logger.error(f"Error during recalculation: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    recalculate_all_scores()
