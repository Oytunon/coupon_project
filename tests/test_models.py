from shared.models.participant import Participant
from shared.models.coupon import Coupon
from datetime import datetime

def test_create_participant(db_session):
    p = Participant(client_id=12345, username="testuser")
    db_session.add(p)
    db_session.commit()
    
    saved_p = db_session.query(Participant).filter_by(client_id=12345).first()
    assert saved_p is not None
    assert saved_p.username == "testuser"
    assert saved_p.id is not None

def test_create_coupon(db_session):
    c = Coupon(
        client_id=12345,
        bet_id="bet123",
        created_at=datetime.now(),
        stake=100.0,
        odds=1.5
    )
    db_session.add(c)
    db_session.commit()
    
    saved_c = db_session.query(Coupon).filter_by(bet_id="bet123").first()
    assert saved_c is not None
    assert saved_c.state == "open"  # Default value
    assert saved_c.is_live is False # Default value
