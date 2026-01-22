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
    finally:
        db.close()
