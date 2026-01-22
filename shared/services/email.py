import httpx
import logging
from shared.settings import settings

logger = logging.getLogger(__name__)

async def send_magic_link_email(to_email: str, magic_link: str):
    """Mailgun API kullanarak magic link email'i gönderir."""
    
    if not settings.MAILGUN_API_KEY or not settings.MAILGUN_DOMAIN:
        logger.warning(f"Mailgun not configured. Link for {to_email}: {magic_link}")
        return

    url = f"{settings.MAILGUN_BASE_URL}/v3/{settings.MAILGUN_DOMAIN}/messages"
    auth = ("api", settings.MAILGUN_API_KEY)
    
    data = {
        "from": f"{settings.MAILGUN_FROM_NAME} <{settings.MAILGUN_FROM_EMAIL}>",
        "to": to_email,
        "subject": "Admin Panel Giriş Linki",
        "text": f"Giriş yapmak için şu linke tıklayın: {magic_link}\nBu link 24 saat geçerlidir.",
        "html": f"""
            <h3>Admin Panel Girişi</h3>
            <p>Giriş yapmak için aşağıdaki butona tıklayın:</p>
            <a href="{magic_link}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Giriş Yap</a>
            <p>Veya şu linki tarayıcınıza yapıştırın:</p>
            <p>{magic_link}</p>
            <p>Bu link 24 saat geçerlidir.</p>
        """
    }

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(url, auth=auth, data=data)
            r.raise_for_status()
            logger.info(f"Magic link email sent to {to_email}")
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            raise
