"""
SSH üzerinden event puanlarını yeniden hesaplar.
Admin panel yerine doğrudan sunucuda çalıştır - timeout/connection limit atlanır.

Kullanım:
  docker exec -it coupon_worker_prod python scripts/recalculate_event_points.py 70

  veya (sunucuda):
  cd ~/app && docker exec -it coupon_worker_prod python scripts/recalculate_event_points.py 70
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    if len(sys.argv) < 2:
        print("Kullanım: python scripts/recalculate_event_points.py <event_id>")
        print("Örnek: python scripts/recalculate_event_points.py 70")
        sys.exit(1)

    event_id = int(sys.argv[1])

    from shared.database import SessionLocal
    from shared.models.event import Event
    from shared.models.coupon import Coupon
    from shared.models.coupon_event_result import CouponEventResult
    from shared.models.participant import Participant
    from shared.models.enrollment import EventParticipant
    from shared.domain.scoring_engine import calculate_points_for_event
    from sqlalchemy import func

    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            print(f"Event {event_id} bulunamadı.")
            sys.exit(1)

        print(f"Event {event_id} ({event.name}) - Puanlar yeniden hesaplanıyor...")

        results = db.query(CouponEventResult).filter(
            CouponEventResult.event_id == event_id,
            CouponEventResult.is_eligible == True
        ).all()

        recalculated_count = 0
        errors = []
        for cer in results:
            try:
                coupon = db.query(Coupon).filter(Coupon.id == cer.coupon_id).first()
                if not coupon:
                    errors.append(f"Coupon id={cer.coupon_id} bulunamadı")
                    continue
                new_points, calculation = calculate_points_for_event(coupon, event)
                cer.points_earned = new_points
                cer.points_calculation = calculation
                cer.evaluated_at = datetime.utcnow()
                recalculated_count += 1
            except Exception as e:
                errors.append(f"Coupon id={cer.coupon_id}: {str(e)}")

        enrollments = db.query(EventParticipant).filter(EventParticipant.event_id == event_id).all()
        for ep in enrollments:
            participant = db.query(Participant).filter(Participant.id == ep.participant_id).first()
            if participant:
                total = db.query(func.sum(CouponEventResult.points_earned)).filter(
                    CouponEventResult.event_id == event_id,
                    CouponEventResult.coupon_id.in_(
                        db.query(Coupon.id).filter(Coupon.client_id == participant.client_id)
                    ),
                    CouponEventResult.is_eligible == True
                ).scalar() or 0.0
                ep.total_points = total

        db.commit()
        print(f"Tamamlandı. {recalculated_count} CER güncellendi, {len(enrollments)} katılımcı total_points güncellendi.")
        if errors:
            print(f"Uyarı: {len(errors)} hata -", "; ".join(errors[:3]))
    except Exception as e:
        db.rollback()
        print(f"HATA: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
