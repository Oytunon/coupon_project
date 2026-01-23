import sys
import os

# Add the parent directory to sys.path to resolve 'shared' and 'backend_api'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from getpass import getpass
from sqlalchemy.orm import Session
from shared.database import SessionLocal
from shared.models.admin import AdminUser
from backend_api.app.security import get_password_hash
import re

def is_valid_email(email):
    regex = r'^[a-z0-9]+[\._]?[a-z0-9]+[@]\w+[.]\w{2,3}$'
    return re.search(regex, email)

def main():
    print("==========================================")
    print("      ADMIN USER SETUP WIZARD             ")
    print("==========================================")
    
    db: Session = SessionLocal()
    
    try:
        # 1. Get Username
        while True:
            username = input("Enter Username (e.g. admin): ").strip()
            if username:
                break
            print("Username cannot be empty.")

        # Check if exists
        existing_user = db.query(AdminUser).filter(AdminUser.username == username).first()
        if existing_user:
            print(f"(!) User '{username}' already exists.")
            choice = input(f"Do you want to update the password for '{username}'? (y/n): ").lower()
            if choice != 'y':
                print("Operation cancelled.")
                return
        
        # 2. Get Email
        if not existing_user:
            while True:
                email = input("Enter Email (e.g. admin@example.com): ").strip()
                if is_valid_email(email):
                    break
                print("Invalid email format. Please try again.")
        else:
            email = existing_user.email
            print(f"Using existing email: {email}")

        # 3. Get Password
        while True:
            password = getpass("Enter Password: ")
            if len(password) < 6:
                print("Password must be at least 6 characters.")
                continue
            confirm = getpass("Confirm Password: ")
            if password != confirm:
                print("Passwords do not match. Try again.")
            else:
                break
        
        # 4. Create or Update
        if existing_user:
            print(f"Updating password for '{username}'...")
            existing_user.hashed_password = get_password_hash(password)
            # Ensure it's active and admin
            existing_user.is_active = True
            existing_user.role = "admin" # Set to default admin role
        else:
            print(f"Creating new user '{username}'...")
            new_user = AdminUser(
                username=username,
                email=email,
                hashed_password=get_password_hash(password),
                role="admin",
                is_active=True
            )
            db.add(new_user)
        
        db.commit()
        print("\nSUCCESS! User operation completed successfully.")
        print(f"You can now login with '{username}' at the Admin Panel.")

    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
    except Exception as e:
        print(f"\nERROR: An unexpected error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
