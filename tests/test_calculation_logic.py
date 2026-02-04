from shared.domain.scoring_engine import calculate_points_for_event
from unittest.mock import MagicMock

def test_stake_times_odds():
    # Mock Event
    event = MagicMock()
    event.rules = {"scoring_formula": "stake_times_odds"}
    event.won_point_multiplier = 1.0
    event.loss_point_multiplier = 0.0
    
    # Mock Coupon
    coupon = MagicMock()
    coupon.state = "won"
    coupon.stake = 100.0
    coupon.odds = 2.5
    coupon.combination_count = 1
    
    # Calculate
    points, details = calculate_points_for_event(coupon, event)
    
    print(f"--- Test Case: Stake * Odds ---")
    print(f"Stake: {coupon.stake}")
    print(f"Odds: {coupon.odds}")
    print(f"Expected: 100 * 2.5 = 250.0")
    print(f"Actual: {points}")
    print(f"Details: {details}")
    
    if points == 250.0:
        print("✅ SUCCESS")
    else:
        print("❌ FAILURE")

def test_simple_odds():
    # Mock Event
    event = MagicMock()
    event.rules = {"scoring_formula": "simple"}
    event.won_point_multiplier = 1.0
    
    # Mock Coupon
    coupon = MagicMock()
    coupon.state = "won"
    coupon.stake = 100.0
    coupon.odds = 2.5
    coupon.combination_count = 1
    
    # Calculate
    points, details = calculate_points_for_event(coupon, event)
    
    print(f"\n--- Test Case: Simple Odds ---")
    print(f"Expected: 2.5")
    print(f"Actual: {points}")
    
    if points == 2.5:
        print("✅ SUCCESS")
    else:
        print("❌ FAILURE")

if __name__ == "__main__":
    test_stake_times_odds()
    test_simple_odds()
