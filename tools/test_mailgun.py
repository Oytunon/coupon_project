import asyncio
import logging
import sys
import os

# Add /app to sys.path to ensure imports work correctly inside container
sys.path.append('/app')

from shared.services.email import send_magic_link_email
from shared.settings import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_mail():
    test_email = "alper_onat12@hotmail.com"
    test_link = "http://localhost:3000/verify-magic-link?token=TEST_TOKEN_123"
    
    print(f"--- Mailgun Test Config ---")
    print(f"Domain: {settings.MAILGUN_DOMAIN}")
    print(f"Base URL: {settings.MAILGUN_BASE_URL}")
    print(f"From: {settings.MAILGUN_FROM_NAME} <{settings.MAILGUN_FROM_EMAIL}>")
    print(f"API Key: {'configured' if settings.MAILGUN_API_KEY else 'MISSING'}")
    print(f"---------------------------")
    
    print(f"Sending test email to {test_email}...")
    try:
        await send_magic_link_email(test_email, test_link)
        print("✅ SUCCESS: Test email request completed.")
        print("Please check your inbox (and spam folder) or the container logs.")
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_mail())
