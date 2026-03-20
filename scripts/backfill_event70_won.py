"""
backfill_event70_won.py
========================
16 Mart'tan bugüne kadar Event 70 için sadece Won kuponları tarar.
Kullanıcı katılım tarihleri (joined_at) dikkate alınır - sadece katılımdan sonra
oynanan kuponlar işlenir. Eksik kuponlar DB'ye kaydedilir.

Event 70 aktif olmasa bile çalışır.

Çalıştırma (proje kök dizininde):
  python scripts/backfill_event70_won.py

--dry-run: Sadece taranacak aralıkları gösterir, API çağrısı yapmaz.
"""

import asyncio
import sys
import os
import logging
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.logging_config import setup_logging
from shared.domain.scoring_engine import process_coupons

logger = setup_logging("backfill_event70_won")

EVENT_ID = 70
# 16 Mart 2025 00:00 TR = 15 Mart 21:00 UTC
FROM_DATE_UTC = datetime(2025, 3, 15, 21, 0, 0, tzinfo=timezone.utc)


def _generate_date_ranges():
    """16 Mart 00:00 TR'den bugüne kadar günlük aralıklar üretir."""
    now_utc = datetime.now(timezone.utc)
    # Betconstruct Local = Türkiye (UTC+3)
    tr_offset = timedelta(hours=3)
    from_utc = FROM_DATE_UTC
    ranges = []
    current = from_utc
    while current < now_utc:
        next_day = current + timedelta(days=1)
        end = min(next_day + timedelta(hours=3), now_utc + timedelta(minutes=5))
        # ISO format: YYYY-MM-DDTHH:MM:SS
        start_str = (current + tr_offset).strftime("%Y-%m-%dT%H:%M:%S")
        end_str = (end + tr_offset).strftime("%Y-%m-%dT%H:%M:%S")
        ranges.append((start_str, end_str))
        current = next_day
    return ranges


def main():
    dry_run = "--dry-run" in sys.argv
    date_ranges = _generate_date_ranges()

    logger.info("=" * 60)
    logger.info(f"{'[DRY RUN] ' if dry_run else ''}Event 70 Won Backfill (16 Mart - Bugün)")
    logger.info("=" * 60)
    logger.info(f"Event ID: {EVENT_ID} | Aralık sayısı: {len(date_ranges)}")
    for i, (start_iso, end_iso) in enumerate(date_ranges, 1):
        logger.info(f"  [{i}] {start_iso} -> {end_iso}")
    logger.info("Sadece katılım tarihinden (joined_at) sonra oynanan kuponlar işlenir.")

    if dry_run:
        logger.info("[DRY RUN] Çıkılıyor. Gerçek tarama için --dry-run olmadan çalıştırın.")
        return

    logger.info("Tarama başlıyor... (MaxRows=500, sayfalar arası 4sn)")
    for i, (start_iso, end_iso) in enumerate(date_ranges, 1):
        logger.info(f"--- Aralık {i}/{len(date_ranges)}: {start_iso} - {end_iso} ---")
        try:
            asyncio.run(process_coupons(
                target_event_id=EVENT_ID,
                job_id=None,
                scan_hours=24,
                start_date_override=start_iso,
                end_date_override=end_iso,
                state_filter=4,  # Sadece Won
            ))
            logger.info(f"Aralık {i}/{len(date_ranges)} tamamlandı.")
        except Exception as e:
            logger.error(f"Aralık {i} HATA: {e}", exc_info=True)

    logger.info("=" * 60)
    logger.info("Tüm aralıklar işlendi.")


if __name__ == "__main__":
    main()
