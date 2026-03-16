"""
backfill_historical_coupons.py
=============================
Belirli tarih aralıklarını tarayarak geçmiş kuponları (kazanan + kaybeden) işler.
event_lost_coupons ve diğer verileri doldurur.

Tarih formatı: DD-MM-YY HH:MM (Türkiye saati, Betconstruct Local)
Örnek: "10-03-26 20:45" = 10 Mart 2026 20:45

Çalıştırma (proje kök dizininde):
  python scripts/backfill_historical_coupons.py

--dry-run: Sadece hangi aralıkların taranacağını gösterir, API çağrısı yapmaz.
--event-id N: Sadece belirtilen event_id için tara (opsiyonel).
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.domain.scoring_engine import process_coupons

# Tarih aralıkları: (başlangıç, bitiş) - DD-MM-YY HH:MM formatında
# Worker bu aralıkları MaxRows=500 ile sayfalayarak tarayacak
DATE_RANGES = [
    ("10-03-26 20:45", "11-03-26 03:00"),
    ("11-03-26 20:45", "12-03-26 03:00"),
    ("12-03-26 20:45", "13-03-26 03:00"),
]


def _ddmmyy_to_iso(s: str) -> str:
    """DD-MM-YY HH:MM -> YYYY-MM-DDTHH:MM:00"""
    s = s.strip()
    try:
        if " " in s:
            date_part, time_part = s.split(None, 1)
            d, m, y = date_part.split("-")
            year = 2000 + int(y) if len(y) == 2 else int(y)
            h, min_part = time_part.split(":")[:2]
            min_part = min_part[:2] if len(min_part) >= 2 else "00"
            return f"{year:04d}-{int(m):02d}-{int(d):02d}T{int(h):02d}:{int(min_part):02d}:00"
        return s
    except (ValueError, IndexError):
        return s


def main():
    dry_run = "--dry-run" in sys.argv
    event_id = None
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg.startswith("--event-id="):
            event_id = int(arg.split("=", 1)[1])
        elif arg == "--event-id" and i < len(sys.argv) - 1:
            event_id = int(sys.argv[i + 1])

    print("=" * 60)
    print(f"{'[DRY RUN] ' if dry_run else ''}Geçmiş Kupon Tarama (Backfill)")
    print("=" * 60)
    print(f"Aralık sayısı: {len(DATE_RANGES)}")
    if event_id:
        print(f"Event ID: {event_id}")
    print()

    for i, (start_raw, end_raw) in enumerate(DATE_RANGES, 1):
        start_iso = _ddmmyy_to_iso(start_raw)
        end_iso = _ddmmyy_to_iso(end_raw)
        print(f"  [{i}] {start_raw} -> {end_raw}")
        print(f"      ISO: {start_iso} -> {end_iso}")

    if not event_id:
        print("\nUYARI: --event-id belirtilmedi. Sadece şu an aktif eventler taranacak.")
        print("Geçmiş tarih için: python scripts/backfill_historical_coupons.py --event-id <ID>")
        print()

    if dry_run:
        print("\n[DRY RUN] Çıkılıyor. Gerçek tarama için --dry-run olmadan çalıştırın.")
        return

    print("\nTarama başlıyor... (MaxRows=500, sayfalar arası 4sn)")
    for i, (start_raw, end_raw) in enumerate(DATE_RANGES, 1):
        start_iso = _ddmmyy_to_iso(start_raw)
        end_iso = _ddmmyy_to_iso(end_raw)
        print(f"\n--- Aralık {i}/{len(DATE_RANGES)}: {start_raw} - {end_raw} ---")
        try:
            asyncio.run(process_coupons(
                target_event_id=event_id,
                job_id=None,
                scan_hours=24,
                start_date_override=start_iso,
                end_date_override=end_iso,
            ))
            print(f"  Tamamlandı.")
        except Exception as e:
            print(f"  HATA: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print("Tüm aralıklar işlendi.")
    print("=" * 60)


if __name__ == "__main__":
    main()
