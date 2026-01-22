
from shared.database import SessionLocal
from shared.models.admin import AdminUser
from shared.auth import get_password_hash

db = SessionLocal()
try:
    # Check if we have an admin
    admin = db.query(AdminUser).filter(AdminUser.username == "temp_admin").first()
    if not admin:
        admin = AdminUser(
            username="temp_admin",
            email="temp_admin@example.com",
            hashed_password=get_password_hash("temp_pass"),
            role="superadmin"
        )
        db.add(admin)
        db.commit()
        print("Created temp_admin / temp_pass")
    else:
        # Update password
        admin.hashed_password = get_password_hash("temp_pass")
        db.commit()
        print("Updated temp_admin password")

except Exception as e:
    print(e)
finally:
    db.close()
