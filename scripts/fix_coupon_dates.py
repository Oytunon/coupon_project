"""
fix_coupon_dates.py
====================
BetConstruct CalcDate timezone hatası düzeltmesi.

Sorun: Tüm kuponların created_at alanı CalcDate (UTC+4) baz alınarak
       kaydedildi. Doğrusu CalcDateLocal (TR saati = UTC+3) olmalıydı.
       Bu yüzden tüm created_at değerleri 1 saat ileri kaydırılmış durumda.

Bu script:
  1. Tüm coupons.created_at değerlerini -1 saat günceller.
  2. Artık event başlangıcından ÖNCE kalan (hatalı kabul edilmiş) kuponları
     CouponEventResult tablosundan siler.
  3. EventParticipant.total_points değerlerini yeniden hesaplar.

Çalıştırma (sunucuda, proje kök dizininde):
  python scripts/fix_coupon_dates.py

--dry-run bayrağı ile önce ne yapacağını görebilirsiniz:
  python scripts/fix_coupon_dates.py --dry-run
"""

import sys
import os

# Proje kök dizinini path'e ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import timedelta
from sqlalchemy import func
from shared.database import SessionLocal
from shared.models.coupon import Coupon
from shared.models.coupon_event_result import CouponEventResult
from shared.models.enrollment import EventParticipant
from shared.models.event import Event

DRY_RUN = "--dry-run" in sys.argv


def main():
    db = SessionLocal()
    try:
        print("=" * 60)
        print(f"{'[DRY RUN] ' if DRY_RUN else ''}Coupon Tarih Düzeltme Scripti")
        print("=" * 60)

        # ── ADIM 1: Tüm created_at'leri -1 saat güncelle ──────────────
        all_coupons = db.query(Coupon).all()
        print(f"\n[ADIM 1] Toplam {len(all_coupons)} kupon bulundu.")
        print(f"         created_at değerleri -1 saat güncelleniyor...")

        updated_count = 0
        for coupon in all_coupons:
            if coupon.created_at:
                old = coupon.created_at
                new = old - timedelta(hours=1)
                if not DRY_RUN:
                    coupon.created_at = new
                updated_count += 1

        if not DRY_RUN:
            db.commit()
            print(f"         ✅ {updated_count} kuponun created_at değeri güncellendi.")
        else:
            print(f"         [DRY RUN] {updated_count} kupon güncellenecekti.")

        # ── ADIM 2: Artık event öncesine düşen CouponEventResult'ları sil ──
        print(f"\n[ADIM 2] Event öncesi (hatalı kabul edilmiş) kuponlar kontrol ediliyor...")

        invalid_cer_ids = []
        events = db.query(Event).all()
        event_map = {e.id: e for e in events}

        all_cer = db.query(CouponEventResult).all()
        for cer in all_cer:
            coupon = db.query(Coupon).filter(Coupon.id == cer.coupon_id).first()
            event = event_map.get(cer.event_id)
            if not coupon or not event:
                continue
            if coupon.created_at and coupon.created_at < event.start_date:
                invalid_cer_ids.append(cer.id)
                if DRY_RUN:
                    print(f"         [DRY RUN] Silinecek → CER id={cer.id} | "
                          f"Kupon {coupon.bet_id} | created_at={coupon.created_at} | "
                          f"Event start={event.start_date}")

        if not DRY_RUN:
            if invalid_cer_ids:
                db.query(CouponEventResult).filter(
                    CouponEventResult.id.in_(invalid_cer_ids)
                ).delete(synchronize_session=False)
                db.commit()
                print(f"         ✅ {len(invalid_cer_ids)} hatalı CouponEventResult silindi.")
            else:
                print(f"         ✅ Silinecek hatalı kayıt yok.")
        else:
            print(f"         [DRY RUN] {len(invalid_cer_ids)} CouponEventResult silinecekti.")

        # ── ADIM 3: EventParticipant.total_points yeniden hesapla ──────
        print(f"\n[ADIM 3] Katılımcı puanları yeniden hesaplanıyor...")

        enrollments = db.query(EventParticipant).all()
        recalc_count = 0
        for enr in enrollments:
            total = db.query(func.sum(CouponEventResult.points_earned)).filter(
                CouponEventResult.event_id == enr.event_id,
                CouponEventResult.coupon_id.in_(
                    db.query(Coupon.id).filter(Coupon.client_id == (
                        db.query(Coupon.client_id).filter(Coupon.id == CouponEventResult.coupon_id).correlate(CouponEventResult).scalar_subquery()
                    ))
                ),
                CouponEventResult.is_eligible == True
            ).scalar()

            # Daha basit query: enrollment'a göre doğrudan hesapla
            from shared.models.participant import Participant
            participant = db.query(Participant).filter(Participant.id == enr.participant_id).first()
            if not participant:
                continue

            new_total = db.query(func.sum(CouponEventResult.points_earned)).filter(
                CouponEventResult.event_id == enr.event_id,
                CouponEventResult.coupon_id.in_(
                    db.query(Coupon.id).filter(Coupon.client_id == participant.client_id)
                ),
                CouponEventResult.is_eligible == True
            ).scalar() or 0.0

            if not DRY_RUN:
                enr.total_points = new_total
            recalc_count += 1

        if not DRY_RUN:
            db.commit()
            print(f"         ✅ {recalc_count} katılımcının puanı güncellendi.")
        else:
            print(f"         [DRY RUN] {recalc_count} katılımcı puanı güncellenecekti.")

        print("\n" + "=" * 60)
        print(f"{'[DRY RUN] ' if DRY_RUN else ''}İşlem tamamlandı!")
        if DRY_RUN:
            print("Gerçek düzeltme için: python scripts/fix_coupon_dates.py")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n❌ HATA: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
