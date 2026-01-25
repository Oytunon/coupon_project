import asyncio
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Patch JSONB for SQLite compatibility BEFORE importing models
from sqlalchemy.types import JSON
import sqlalchemy.dialects.postgresql
sqlalchemy.dialects.postgresql.JSONB = JSON

from shared.database import Base
from shared.models.event import Event
from shared.models.participant import Participant
from shared.models.enrollment import EventParticipant
from shared.models.coupon import Coupon
# from shared.domain.scoring_engine import process_coupons  <-- This needs to be imported carefully to allow mocking

# Setup In-Memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Mock Data
MOCK_EVENT_ID = 1
USER_A_CLIENT_ID = 1001
USER_B_CLIENT_ID = 1002

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_worker_and_leaderboard_logic(db_session):
    asyncio.run(run_async_worker_test(db_session))

async def run_async_worker_test(db_session):
    # 1. Setup Event and Participants
    event = Event(
        id=MOCK_EVENT_ID,
        name="Test Event",
        slug="test-event",
        start_date=datetime.utcnow() - timedelta(days=1),
        end_date=datetime.utcnow() + timedelta(days=5),
        status="active",
        won_point_multiplier=1.0,
        loss_point_multiplier=0.0,
        rules={"scoring_formula": "odds", "min_odds": 1.1}
    )
    db_session.add(event)
    
    user_a = Participant(client_id=USER_A_CLIENT_ID, username="UserA")
    user_b = Participant(client_id=USER_B_CLIENT_ID, username="UserB")
    db_session.add(user_a)
    db_session.add(user_b)
    db_session.commit()
    
    # Enroll them
    enroll_a = EventParticipant(event_id=MOCK_EVENT_ID, participant_id=user_a.id)
    enroll_b = EventParticipant(event_id=MOCK_EVENT_ID, participant_id=user_b.id)
    db_session.add(enroll_a)
    db_session.add(enroll_b)
    db_session.commit()

    # 2. Mock B-API Responses
    # Scenario: User A has a winning bet (Odds 5.0) -> 5.0 Points
    # Scenario: User B has a winning bet (Odds 2.0) -> 2.0 Points
    
    bet_history_mock_a = {
        "Bets": [
            {
                "BetId": 101,
                "ClientId": USER_A_CLIENT_ID,
                "EquivalentAmount": 100,
                "Type": 1,
                "State": 4, # Won
                "Winning": 500,
                "IsLive": False
            }
        ]
    }
    
    bet_history_mock_b = {
        "Bets": [
            {
                "BetId": 102,
                "ClientId": USER_B_CLIENT_ID,
                "EquivalentAmount": 100,
                "Type": 1,
                "State": 4, # Won
                "Winning": 200,
                "IsLive": False
            }
        ]
    }
    
    selections_mock = {
        "Data": [
             {"Price": 5.0, "CompetitionId": 100} # Matches total odds 5.0
        ]
    }
    selections_mock_b = {
        "Data": [
             {"Price": 2.0, "CompetitionId": 100} # Matches total odds 2.0
        ]
    }

    # Patching dependencies
    # Use side_effect to create NEW sessions for the worker, so it doesn't close our test session
    with patch("shared.domain.scoring_engine.SessionLocal", side_effect=lambda: TestingSessionLocal()):
        with patch("shared.domain.scoring_engine.fetch_bet_history") as mock_fetch:
            with patch("shared.domain.scoring_engine.fetch_bet_selections") as mock_selections:
                
                # Setup Mocks
                def side_effect_fetch(client_id, start, end):
                    if client_id == USER_A_CLIENT_ID: return bet_history_mock_a
                    if client_id == USER_B_CLIENT_ID: return bet_history_mock_b
                    return {}
                
                def side_effect_selections(bet_id):
                    # Bet 101 (User A) -> Odds 5.0
                    if bet_id == 101: return selections_mock
                    # Bet 102 (User B) -> Odds 2.0
                    if bet_id == 102: return selections_mock_b
                    return {}

                mock_fetch.side_effect = side_effect_fetch
                mock_selections.side_effect = side_effect_selections

                # IMPORT and RUN worker
                from shared.domain.scoring_engine import process_coupons
                await process_coupons(target_event_id=MOCK_EVENT_ID)
                
    # Refresh session to see changes made by worker (which used a different session)
    db_session.commit()
    
    coupons = db_session.query(Coupon).all()
    print(f"\n[DEBUG] Coupons count: {len(coupons)}")
    for c in coupons:
        print(f"[DEBUG] Coupon: client={c.client_id} event={c.event_id} calc={c.calculation} state={c.state} overall={c.overall_state}")
                
    # 3. Verify Round 1
    # User A: 5.0 Points
    # User B: 2.0 Points
    # Leaderboard: A (1st), B (2nd)
    
    ep_a = db_session.query(EventParticipant).filter_by(participant_id=user_a.id).first()
    ep_b = db_session.query(EventParticipant).filter_by(participant_id=user_b.id).first()
    
    print(f"\n[Round 1] User A Points: {ep_a.total_points}")
    print(f"[Round 1] User B Points: {ep_b.total_points}")
    
    assert ep_a.total_points == 5.0
    assert ep_b.total_points == 2.0
    
    # Check Leaderboard Order (Manual Query equivalent)
    leaderboard = db_session.query(EventParticipant).filter_by(event_id=MOCK_EVENT_ID).order_by(EventParticipant.total_points.desc()).all()
    assert leaderboard[0].participant_id == user_a.id
    assert leaderboard[1].participant_id == user_b.id
    
    print("[Round 1] Leaderboard Order Verified: A > B")

    # 4. Round 2: User B gets a HUGE win
    # New Bet for B: Odds 10.0 -> Total 12.0
    
    bet_history_mock_b_updated = {
        "Bets": [
            {
                "BetId": 102, # Old bet
                "ClientId": USER_B_CLIENT_ID,
                "EquivalentAmount": 100,
                "Type": 1,
                "State": 4, 
                "Winning": 200,
                "IsLive": False
            },
            {
                "BetId": 103, # NEW bet
                "ClientId": USER_B_CLIENT_ID,
                "EquivalentAmount": 100,
                "Type": 1,
                "State": 4, 
                "Winning": 1000,
                "IsLive": False
            }
        ]
    }
    
    selections_mock_huge = {
        "Data": [
             {"Price": 10.0, "CompetitionId": 100}
        ]
    }

    with patch("shared.domain.scoring_engine.SessionLocal", side_effect=lambda: TestingSessionLocal()):
        with patch("shared.domain.scoring_engine.fetch_bet_history") as mock_fetch:
            with patch("shared.domain.scoring_engine.fetch_bet_selections") as mock_selections:
                
                def side_effect_fetch_2(client_id, start, end):
                    if client_id == USER_A_CLIENT_ID: return bet_history_mock_a # No change
                    if client_id == USER_B_CLIENT_ID: return bet_history_mock_b_updated
                    return {}
                
                def side_effect_selections_2(bet_id):
                    if bet_id == 101: return selections_mock
                    if bet_id == 102: return selections_mock_b
                    if bet_id == 103: return selections_mock_huge # New bet
                    return {}

                mock_fetch.side_effect = side_effect_fetch_2
                mock_selections.side_effect = side_effect_selections_2

                # RUN worker again
                await process_coupons(target_event_id=MOCK_EVENT_ID)

    # Refresh session
    db_session.commit()

    # 5. Verify Round 2
    # User A: 5.0 Points
    # User B: 2.0 + 10.0 = 12.0 Points
    # Leaderboard: B (1st), A (2nd)
    
    db_session.refresh(ep_a)
    db_session.refresh(ep_b)
    
    print(f"\n[Round 2] User A Points: {ep_a.total_points}")
    print(f"[Round 2] User B Points: {ep_b.total_points}")
    
    assert ep_a.total_points == 5.0
    assert ep_b.total_points == 12.0
    
    leaderboard_2 = db_session.query(EventParticipant).filter_by(event_id=MOCK_EVENT_ID).order_by(EventParticipant.total_points.desc()).all()
    assert leaderboard_2[0].participant_id == user_b.id
    assert leaderboard_2[1].participant_id == user_a.id
    
    print("[Round 2] Leaderboard Order Verified: B > A")

if __name__ == "__main__":
    import sys
    # Run with pytest if executed directly (helper for local run)
    sys.exit(pytest.main(["-v", __file__]))
