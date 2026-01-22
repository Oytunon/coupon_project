from sqlalchemy.orm import Session
from datetime import datetime
from shared.models.participant import Participant
from shared.models.coupon import Coupon

def get_global_stats(db: Session):
    total_participants = db.query(Participant).count()
    total_coupons = db.query(Coupon).count()
    
    # Bugünün kuponları
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_coupons = db.query(Coupon).filter(Coupon.inserted_at >= today).count()
    
    # Bekleyen kuponlar
    pending_coupons = db.query(Coupon).filter(Coupon.state == "open").count()

    return {
        "total_participants": total_participants,
        "total_coupons": total_coupons,
        "today_coupons": today_coupons,
        "pending_coupons": pending_coupons
    }
