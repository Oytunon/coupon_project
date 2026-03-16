"""
Son 30 dk icin tam mantik testi: API + process_coupons + event_lost_coupons
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

now = datetime.now(timezone.utc)
end_dt = now
start_dt = now - timedelta(minutes=30)
START = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
END = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

EVENT_ID = 70  # veya --event-id ile override


def main():
    event_id = EVENT_ID
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg.startswith("--event-id="):
            event_id = int(arg.split("=", 1)[1])
        elif arg == "--event-id" and i < len(sys.argv) - 1:
            event_id = int(sys.argv[i + 1])

    print("=" * 60)
    print("Son 30 dk TAM MANTIK TESTI")
    print("=" * 60)
    print(f"Event ID: {event_id}")
    print(f"Aralik: {START} -> {END}")
    print()

    from shared.database import SessionLocal
    from shared.models.event_lost_coupon import EventLostCoupon

    db = SessionLocal()
    try:
        before = db.query(EventLostCoupon).filter(EventLostCoupon.event_id == event_id).count()
        print(f"event_lost_coupons ONCE: {before}")
    finally:
        db.close()

    print("\nprocess_coupons calistiriliyor (son 30 dk)...")
    from shared.domain.scoring_engine import process_coupons

    asyncio.run(process_coupons(
        target_event_id=event_id,
        job_id=None,
        scan_hours=24,
        start_date_override=START,
        end_date_override=END,
    ))

    db2 = SessionLocal()
    try:
        after = db2.query(EventLostCoupon).filter(EventLostCoupon.event_id == event_id).count()
        print(f"\nevent_lost_coupons SONRA: {after}")
        print(f"Eklenen: {after - before}")
        if after > before:
            print("\n[OK] Mantik dogru - Lost tabloya yazildi.")
        else:
            print("\n[!] Bu aralikta yeni Lost eklenmedi (zaten vardi veya yok).")
    finally:
        db2.close()

    print("=" * 60)


if __name__ == "__main__":
    main()
