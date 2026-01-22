"""
Bcrypt-compatible password reset script
Passlib + bcrypt 5.0 uyumsuzluğunu aşmak için direkt bcrypt kullanıyoruz
"""
import bcrypt
from sqlalchemy import text
from shared.database import engine

def reset_admin_password():
    username = "admin"
    new_password = "admin123"
    
    # Bcrypt ile direkt hash oluştur
    password_bytes = new_password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    hashed_str = hashed.decode('utf-8')
    
    # Veritabanına direkt yaz
    with engine.connect() as conn:
        result = conn.execute(
            text("UPDATE admin_users SET hashed_password = :pwd WHERE username = :user"),
            {"pwd": hashed_str, "user": username}
        )
        conn.commit()
        
        # Kullanıcı bilgilerini çek
        user = conn.execute(
            text("SELECT username, email, is_active FROM admin_users WHERE username = :user"),
            {"user": username}
        ).fetchone()
        
        if result.rowcount > 0 and user:
            print("\n" + "="*60)
            print("✅ ŞİFRE BAŞARIYLA GÜNCELLENDİ!")
            print("="*60)
            print(f"👤 Kullanıcı: {user[0]}")
            print(f"🔑 Şifre: {new_password}")
            print(f"📧 E-posta: {user[1]}")
            print(f"✅ Aktif: {user[2]}")
            print("="*60)
            print("\n🧪 ŞİFRE DOĞRULAMA TESTİ:")
            # Test et
            test_verify = bcrypt.checkpw(password_bytes, hashed)
            if test_verify:
                print("✅ Şifre hash'i doğru çalışıyor!")
            else:
                print("❌ Hash doğrulama başarısız!")
            print("="*60 + "\n")
        else:
            print(f"❌ '{username}' kullanıcısı bulunamadı!")

if __name__ == "__main__":
    reset_admin_password()
