import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_
from shared.models.magic_token import MagicToken
from shared.database import SessionLocal

logger = logging.getLogger(__name__)

async def cleanup_expired_magic_tokens(retention_days: int = 7):
    db: Session = SessionLocal()
    try:
        threshold = datetime.utcnow() - timedelta(days=retention_days)
        deleted_count = db.query(MagicToken).filter(
            or_(
                MagicToken.is_used == True,
                MagicToken.expires_at < threshold
            )
        ).delete(synchronize_session=False)
        db.commit()
        if deleted_count > 0:
            logger.info(f"🗑️  {deleted_count} magic tokens cleaned up.")
        return deleted_count
    except Exception as e:
        logger.error(f"Magic token cleanup error: {e}")
        db.rollback()
        raise
        raise
    finally:
        db.close()

async def auto_expire_events():
    """Bitiş tarihi geçmiş, 'active' statüsündeki eventleri 'ended' yapar."""
    from shared.models.event import Event
    db: Session = SessionLocal()
    try:
        # DB'deki tarihler Türkiye Saati (UTC+3) olarak tutuluyor.
        # Bu yüzden sunucunun UTC saatiyle karşılaştırmak yerine 3 saat ekliyoruz.
        now_tr = datetime.utcnow() + timedelta(hours=3)
        expired_events = db.query(Event).filter(
            Event.status == "active",
            Event.end_date < now_tr
        ).all()
        
        expired_count = len(expired_events)
        if expired_count > 0:
            for event in expired_events:
                event.status = "ended"
            db.commit()
            logger.info(f"⏳ {expired_count} event otomatik olarak 'ended' statüsüne geçirildi.")
        
        return expired_count
    except Exception as e:
        logger.error(f"Event auto-expiration error: {e}")
        db.rollback()
        raise
    finally:
        db.close()
