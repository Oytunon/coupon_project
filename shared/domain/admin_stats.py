import time
from sqlalchemy.orm import Session
from shared.models.participant import Participant
from shared.models.coupon import Coupon

# Kupon tablosunda tam sayım yapıldığı için ağır; Genel Bakış için 60 sn eski veri yeterli
_STATS_CACHE_SECONDS = 60
_stats_cache: dict = {"at": 0.0, "value": None}


def get_global_stats(db: Session):
    if _stats_cache["value"] is not None and time.monotonic() - _stats_cache["at"] < _STATS_CACHE_SECONDS:
        return _stats_cache["value"]

    total_participants = db.query(Participant).count()
    total_coupons = db.query(Coupon).count()

    # Bekleyen kuponlar
    pending_coupons = db.query(Coupon).filter(Coupon.state == "open").count()

    # "today_coupons" kaldırıldı: hiçbir ekranda gösterilmiyordu, indekssiz inserted_at taraması ~3 sn sürüyordu
    result = {
        "total_participants": total_participants,
        "total_coupons": total_coupons,
        "pending_coupons": pending_coupons
    }
    _stats_cache.update(at=time.monotonic(), value=result)
    return result
