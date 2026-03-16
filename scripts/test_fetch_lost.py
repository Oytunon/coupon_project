"""
Lost kuponların API'den gelip gelmediğini test eder.
Sadece fetch_bet_report çağrısı - DB veya process_coupons yok.

Çalıştırma:
  python scripts/test_fetch_lost.py
  veya Docker: docker exec -it coupon_worker_prod python scripts/test_fetch_lost.py
"""
import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.services.betconstruct import fetch_bet_report

# Son 30 dakika
now = datetime.now(timezone.utc)
end_dt = now
start_dt = now - timedelta(minutes=30)
START = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
END = end_dt.strftime("%Y-%m-%dT%H:%M:%S")


async def main():
    print("=" * 60)
    print("Lost Kupon Testi - fetch_bet_report (state_filter=None = Won+Lost)")
    print("=" * 60)
    print(f"Aralık: Son 30 dk | {START} -> {END}")
    print()

    # state_filter=None → hem Won (4) hem Lost (3) çeker
    data = await fetch_bet_report(
        START, END,
        include_selections=False,
        state_filter=None,
        max_rows=500,
        page_delay_seconds=4,
    )
    bets = data.get("Bets", []) or []
    won = sum(1 for b in bets if b.get("State") == 4 or "won" in str(b.get("StateName", "")).lower())
    lost = sum(1 for b in bets if b.get("State") == 3 or "lost" in str(b.get("StateName", "")).lower())
    other = len(bets) - won - lost

    print(f"Toplam kupon: {len(bets)}")
    print(f"  Won:  {won}")
    print(f"  Lost: {lost}")
    print(f"  Diğer (cashout vb): {other}")
    print()
    if lost > 0:
        print("[OK] Lost kuponlar API'den geliyor.")
    else:
        print("[!] Bu aralikta Lost kupon yok veya API Lost donmuyor.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
