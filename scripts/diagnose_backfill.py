"""
Backfill neden event_lost_coupons'a yazmıyor - teşhis scripti.
stdout'a yazar, docker exec ile çalıştırınca terminalde görürsün.
"""
import asyncio
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

EVENT_ID = 70
# Tek aralık test
START = "2026-03-10T20:45:00"
END = "2026-03-11T03:00:00"


def main():
    print("=" * 60)
    print("BACKFILL TEŞHİS - Event 70")
    print("=" * 60)

    from shared.database import SessionLocal
    from shared.models.event import Event
    from shared.models.enrollment import EventParticipant
    from shared.models.event_lost_coupon import EventLostCoupon

    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == EVENT_ID).first()
        if not event:
            print(f"HATA: Event {EVENT_ID} bulunamadi!")
            return
        part_count = db.query(EventParticipant).filter(EventParticipant.event_id == EVENT_ID).count()
        lost_count_before = db.query(EventLostCoupon).filter(EventLostCoupon.event_id == EVENT_ID).count()
    except Exception as e:
        lost_count_before = 0
        part_count = 0
        event = None
        print(f"DB okuma hatasi: {e}")
    finally:
        db.close()

    if event:
        print(f"Event 70: {event.name}")
        print(f"  start_date: {event.start_date}")
        print(f"  end_date:   {event.end_date}")
        print(f"  loss_point_multiplier: {getattr(event, 'loss_point_multiplier', 0)}")
    print(f"Katilimci sayisi: {part_count}")
    print(f"event_lost_coupons ONCE: {lost_count_before}")
    print()

    if part_count == 0:
        print("UYARI: Event 70'te hic katilimci yok! Backfill ise yaramaz.")
        return

    # API test - Lost geliyor mu?
    print("API testi (son 30 dk yerine backfill araligi)...")
    from shared.services.betconstruct import fetch_bet_report

    async def api_test():
        data = await fetch_bet_report(START, END, include_selections=False, state_filter=None, max_rows=500, page_delay_seconds=2)
        bets = data.get("Bets", []) or []
        won = sum(1 for b in bets if b.get("State") == 4 or "won" in str(b.get("StateName", "")).lower())
        lost = sum(1 for b in bets if b.get("State") == 3 or "lost" in str(b.get("StateName", "")).lower())
        return len(bets), won, lost

    n_bets, n_won, n_lost = asyncio.run(api_test())
    print(f"  API donen: {n_bets} kupon | Won: {n_won} | Lost: {n_lost}")
    if n_lost == 0:
        print("  Bu aralikta API Lost donmuyor - normal worker da yazamaz.")
    print()

    # process_coupons calistir
    print("process_coupons calistiriliyor...")
    from shared.domain.scoring_engine import process_coupons

    asyncio.run(process_coupons(
        target_event_id=EVENT_ID,
        job_id=None,
        scan_hours=24,
        start_date_override=START,
        end_date_override=END,
    ))

    # Sonra say
    db2 = SessionLocal()
    try:
        lost_count_after = db2.query(EventLostCoupon).filter(EventLostCoupon.event_id == EVENT_ID).count()
        print(f"event_lost_coupons SONRA: {lost_count_after}")
        print(f"Eklenen: {lost_count_after - lost_count_before}")
    finally:
        db2.close()

    print("=" * 60)


if __name__ == "__main__":
    main()
