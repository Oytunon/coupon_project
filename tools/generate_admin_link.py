import sys
import os
sys.path.append(os.getcwd())

from shared.database import SessionLocal
from shared.models.admin import AdminUser
from backend_api.app.security import create_magic_link
from datetime import timedelta

db = SessionLocal()
try:
    # Get or create admin user
    email = "admin@extrabet.com"
    admin = db.query(AdminUser).filter(AdminUser.email == email).first()
    
    if not admin:
        print("Admin user not found. Creating temporary admin...")
        # Since hash is needed, we skip creation here to avoid dependency issues if possible
        # accessing existing user is better. The user said they are in admin panel.
        # Let's list users first.
        admins = db.query(AdminUser).all()
        if admins:
            admin = admins[0]
            email = admin.email
            print(f"Using existing admin: {admin.username} ({email})")
        else:
             print("No admin user found! Cannot generate link.")
             exit(1)

    # Convert email to string explicitly if it's a Pydantic email type or similar, though in DB it's string.
    link = create_magic_link(str(email))
    print(f"\nMAGIC LINK: {link}\n")

finally:
    db.close()
