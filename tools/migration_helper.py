"""
Alembic Migration Helper Script
================================
Bu script, Alembic migration işlemlerini kolaylaştırmak için tasarlanmıştır.

Kullanım:
    python tools/migration_helper.py create "migration açıklaması"
    python tools/migration_helper.py upgrade
    python tools/migration_helper.py downgrade
    python tools/migration_helper.py status
    python tools/migration_helper.py test
"""

import sys
import os
import subprocess
from datetime import datetime
from pathlib import Path

# Project root
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from shared.settings import settings


class Colors:
    """Terminal renkleri"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(message):
    """Başlık yazdır"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(60)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}\n")


def print_success(message):
    """Başarı mesajı"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")


def print_error(message):
    """Hata mesajı"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")


def print_warning(message):
    """Uyarı mesajı"""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")


def print_info(message):
    """Bilgi mesajı"""
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")


def run_command(cmd, cwd=None):
    """Komutu çalıştır ve çıktıyı göster"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd or PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        if result.stdout:
            print(result.stdout)
        
        if result.returncode != 0:
            print_error(f"Komut başarısız: {cmd}")
            if result.stderr:
                print(result.stderr)
            return False
        
        return True
    except Exception as e:
        print_error(f"Komut çalıştırılamadı: {e}")
        return False


def check_database_connection():
    """Veritabanı bağlantısını kontrol et"""
    print_info("Veritabanı bağlantısı kontrol ediliyor...")
    
    try:
        from shared.database import SessionLocal
        from sqlalchemy import text
        
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        print_success("Veritabanı bağlantısı başarılı")
        return True
    except Exception as e:
        print_error(f"Veritabanı bağlantısı başarısız: {e}")
        print_warning("Lütfen veritabanının çalıştığından emin olun!")
        return False


def create_migration(message):
    """Yeni migration oluştur (autogenerate)"""
    print_header("YENİ MIGRATION OLUŞTURULUYOR")
    
    if not message:
        print_error("Migration açıklaması boş olamaz!")
        print_info("Kullanım: python tools/migration_helper.py create \"açıklama\"")
        return False
    
    # Database bağlantısını kontrol et
    if not check_database_connection():
        return False
    
    print_info(f"Migration açıklaması: {message}")
    print_warning("Autogenerate kullanılıyor - oluşan dosyayı mutlaka kontrol edin!")
    
    cmd = f'alembic revision --autogenerate -m "{message}"'
    
    if run_command(cmd):
        print_success("Migration başarıyla oluşturuldu!")
        print_info("Dosyayı alembic/versions/ dizininde bulabilirsiniz")
        print_warning("⚠ Oluşan migration dosyasını mutlaka kontrol edin!")
        return True
    
    return False


def upgrade_database(target="head"):
    """Veritabanını upgrade et"""
    print_header("VERİTABANI UPGRADE EDİLİYOR")
    
    if not check_database_connection():
        return False
    
    # Mevcut versiyonu göster
    print_info("Mevcut migration durumu:")
    run_command("alembic current")
    
    print_info(f"Hedef: {target}")
    confirm = input(f"\n{Colors.WARNING}Devam etmek istiyor musunuz? (e/h): {Colors.ENDC}")
    
    if confirm.lower() != 'e':
        print_info("İşlem iptal edildi")
        return False
    
    cmd = f"alembic upgrade {target}"
    
    if run_command(cmd):
        print_success(f"Veritabanı başarıyla upgrade edildi: {target}")
        print_info("Yeni durum:")
        run_command("alembic current")
        return True
    
    return False


def downgrade_database(target="-1"):
    """Veritabanını downgrade et"""
    print_header("VERİTABANI DOWNGRADE EDİLİYOR")
    
    if not check_database_connection():
        return False
    
    # Mevcut versiyonu göster
    print_info("Mevcut migration durumu:")
    run_command("alembic current")
    
    print_warning("⚠ DİKKAT: Downgrade işlemi veri kaybına neden olabilir!")
    print_info(f"Hedef: {target}")
    confirm = input(f"\n{Colors.FAIL}Devam etmek istediğinizden EMİN misiniz? (evet/hayır): {Colors.ENDC}")
    
    if confirm.lower() != 'evet':
        print_info("İşlem iptal edildi")
        return False
    
    cmd = f"alembic downgrade {target}"
    
    if run_command(cmd):
        print_success(f"Veritabanı başarıyla downgrade edildi: {target}")
        print_info("Yeni durum:")
        run_command("alembic current")
        return True
    
    return False


def show_status():
    """Migration durumunu göster"""
    print_header("MIGRATION DURUMU")
    
    print_info("Mevcut versiyon:")
    run_command("alembic current")
    
    print_info("\nMigration geçmişi:")
    run_command("alembic history --verbose")
    
    print_info("\nHead revision(s):")
    run_command("alembic heads")
    
    print_info(f"\nVeritabanı: {settings.DATABASE_URL}")
    check_database_connection()


def test_migrations():
    """Migration'ları test et (upgrade -> downgrade -> upgrade)"""
    print_header("MIGRATION TESTİ")
    
    print_warning("Bu işlem veritabanınızı test edecektir.")
    print_warning("Production veritabanında ASLA kullanmayın!")
    confirm = input(f"\n{Colors.WARNING}Devam etmek istiyor musunuz? (e/h): {Colors.ENDC}")
    
    if confirm.lower() != 'e':
        print_info("İşlem iptal edildi")
        return False
    
    if not check_database_connection():
        return False
    
    # 1. Mevcut durumu kaydet
    print_info("1. Mevcut durum kaydediliyor...")
    run_command("alembic current")
    
    # 2. Upgrade to head
    print_info("\n2. Upgrade to head...")
    if not run_command("alembic upgrade head"):
        print_error("Upgrade başarısız!")
        return False
    
    # 3. Downgrade bir adım
    print_info("\n3. Downgrade -1...")
    if not run_command("alembic downgrade -1"):
        print_error("Downgrade başarısız!")
        return False
    
    # 4. Tekrar upgrade
    print_info("\n4. Tekrar upgrade +1...")
    if not run_command("alembic upgrade +1"):
        print_error("Upgrade başarısız!")
        return False
    
    print_success("\n✓ Migration testi başarılı!")
    print_info("Tüm migration'lar sorunsuz çalışıyor")
    return True


def show_help():
    """Yardım mesajını göster"""
    help_text = f"""
{Colors.BOLD}Alembic Migration Helper{Colors.ENDC}
{'=' * 60}

{Colors.OKGREEN}Kullanılabilir Komutlar:{Colors.ENDC}

  {Colors.OKCYAN}create "açıklama"{Colors.ENDC}
      Yeni bir migration oluşturur (autogenerate)
      Örnek: python tools/migration_helper.py create "add user email"

  {Colors.OKCYAN}upgrade [hedef]{Colors.ENDC}
      Veritabanını upgrade eder
      Hedef belirtilmezse 'head' kullanılır
      Örnek: python tools/migration_helper.py upgrade
              python tools/migration_helper.py upgrade +1

  {Colors.OKCYAN}downgrade [hedef]{Colors.ENDC}
      Veritabanını downgrade eder
      Hedef belirtilmezse '-1' kullanılır
      Örnek: python tools/migration_helper.py downgrade
              python tools/migration_helper.py downgrade -2

  {Colors.OKCYAN}status{Colors.ENDC}
      Migration durumunu gösterir
      Örnek: python tools/migration_helper.py status

  {Colors.OKCYAN}test{Colors.ENDC}
      Migration'ları test eder (upgrade/downgrade/upgrade)
      Örnek: python tools/migration_helper.py test

  {Colors.OKCYAN}help{Colors.ENDC}
      Bu yardım mesajını gösterir

{Colors.WARNING}Notlar:{Colors.ENDC}
  • Production'da kullanmadan önce mutlaka backup alın!
  • Autogenerate oluşan migration dosyasını kontrol edin!
  • Downgrade işlemi veri kaybına neden olabilir!

{Colors.OKBLUE}Dokümantasyon:{Colors.ENDC}
  Detaylı kullanım için: docs/alembic_kullanim.md
"""
    print(help_text)


def main():
    """Ana fonksiyon"""
    if len(sys.argv) < 2:
        show_help()
        return
    
    command = sys.argv[1].lower()
    
    if command == "create":
        if len(sys.argv) < 3:
            print_error("Migration açıklaması gerekli!")
            print_info("Kullanım: python tools/migration_helper.py create \"açıklama\"")
            return
        message = " ".join(sys.argv[2:]).strip('"\'')
        create_migration(message)
    
    elif command == "upgrade":
        target = sys.argv[2] if len(sys.argv) > 2 else "head"
        upgrade_database(target)
    
    elif command == "downgrade":
        target = sys.argv[2] if len(sys.argv) > 2 else "-1"
        downgrade_database(target)
    
    elif command == "status":
        show_status()
    
    elif command == "test":
        test_migrations()
    
    elif command == "help":
        show_help()
    
    else:
        print_error(f"Bilinmeyen komut: {command}")
        show_help()


if __name__ == "__main__":
    main()
