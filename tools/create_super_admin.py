
from sqlalchemy.orm import Session
from shared.database import SessionLocal
from shared.models.admin import AdminUser
from backend_api.app.security import get_password_hash

def create_super_admin():
    db: Session = SessionLocal()
    try:
        username = "superadmin"
        password = "superpassword"
        email = "superadmin@example.com"
        
        # Check if exists
        existing_user = db.query(AdminUser).filter(AdminUser.username == username).first()
        if existing_user:
            print(f"User '{username}' already exists. Updating password...")
            existing_user.hashed_password = get_password_hash(password)
            existing_user.is_active = True
            existing_user.role = "admin"
        else:
            print(f"Creating user '{username}'...")
            new_user = AdminUser(
                username=username,
                email=email,
                hashed_password=get_password_hash(password),
                role="admin",
                is_active=True
            )
            db.add(new_user)
        
        db.commit()
        print(f"Super admin created/updated successfully.")
        print(f"Username: {username}")
        print(f"Password: {password}")
        
    except Exception as e:
        print(f"Error creating user: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_super_admin()
