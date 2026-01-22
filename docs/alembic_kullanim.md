# Alembic Migration Sistemi - Eksiksiz Kullanım Kılavuzu

## 📚 İçindekiler
1. [Alembic Nedir?](#alembic-nedir)
2. [Temel Kavramlar](#temel-kavramlar)
3. [Kurulum](#kurulum)
4. [Temel Komutlar](#temel-komutlar)
5. [Migration Oluşturma](#migration-oluşturma)
6. [İleri Seviye Kullanım](#ileri-seviye-kullanım)
7. [Sık Karşılaşılan Hatalar](#sık-karşılaşılan-hatalar)
8. [En İyi Uygulamalar](#en-iyi-uygulamalar)

---

## Alembic Nedir?

**Alembic**, SQLAlchemy için geliştirilmiş bir **database migration** (veritabanı göç) aracıdır. 

### Neden Migration Kullanırız?

Eskiden veritabanı değişikliklerini şöyle yapıyorduk:
```python
# ❌ ESKİ YÖNTEM - Tehlikeli ve esnek değil!
Base.metadata.create_all(bind=engine)
```

**Sorunları:**
- ✗ Mevcut tablolarda değişiklik yapamaz
- ✗ Veri kaybı riski yüksek
- ✗ Geri alma (rollback) imkanı yok
- ✗ Production'daki değişiklikleri takip edemezsiniz
- ✗ Ekip çalışmasında senkronizasyon sorunu

**Alembic ile:**
- ✓ Tüm değişiklikler **versiyonlanır** ve **takip edilir**
- ✓ İstediğiniz zaman **geri alabilirsiniz** (downgrade)
- ✓ **Veri transformasyonu** yapabilirsiniz
- ✓ **Production güvenliği** artar
- ✓ Ekip arkadaşlarınızla **senkronize** çalışırsınız

---

## Temel Kavramlar

### Migration (Göç)
Veritabanı şemasında yapılan bir değişiklik. Her migration iki fonksiyon içerir:
- `upgrade()` - İleri gitmek için (yeni özellik ekle)
- `downgrade()` - Geri dönmek için (değişikliği iptal et)

### Revision (Revizyon)
Her migration'ın benzersiz bir ID'si vardır. Örnek: `add_event_tables_001`

### Head
En son migration versiyonuna verilen isim.

### Autogenerate
Alembic'in model değişikliklerinizi otomatik algılayıp migration oluşturması.

---

## Kurulum

### 1. Gereksinimler

Projenizde zaten kurulu:
```bash
pip install alembic==1.13.1  # requirements.txt'de zaten var
```

### 2. Yapılandırma

Bu projede Alembic zaten yapılandırılmış:
- ✅ `alembic.ini` - Ana konfigürasyon
- ✅ `alembic/env.py` - Alembic çalışma ortamı
- ✅ `alembic/versions/` - Migration dosyaları burada

---

## Temel Komutlar

### 🔍 İnceleme Komutları

#### Mevcut Migration Versiyonunu Görme
```bash
alembic current
```
**Çıktı:**
```
add_event_id_002 (head)
```

#### Migration Geçmişini Görme
```bash
alembic history
```
**Çıktı:**
```
add_event_id_002 -> add_event_tables_001 (head), add event_id to coupons table
add_event_tables_001 -> <base>, Add event-based tables
```

#### Detaylı Geçmiş
```bash
alembic history --verbose
```

---

### ⬆️ Upgrade (İleri) Komutları

#### En Son Versiyona Güncelleme
```bash
alembic upgrade head
```
**Ne yapar:** Tüm migration'ları çalıştırır ve veritabanını en güncel haline getirir.

#### Bir Adım İleri
```bash
alembic upgrade +1
```

#### Belirli Bir Versiyona Güncelleme
```bash
alembic upgrade add_event_tables_001
```

---

### ⬇️ Downgrade (Geri) Komutları

#### Bir Adım Geri
```bash
alembic downgrade -1
```
**Uyarı:** Veri kaybı olabilir! Production'da dikkatli kullanın.

#### Tüm Migration'ları Geri Alma (Sıfırlama)
```bash
alembic downgrade base
```

#### Belirli Bir Versiyona Geri Dönme
```bash
alembic downgrade add_event_tables_001
```

---

## Migration Oluşturma

### 🤖 Otomatik Migration (Autogenerate) - Önerilen!

**Senaryo:** `Participant` modeline yeni bir alan eklediniz:

```python
# common/models/participant.py
class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(Integer, primary_key=True)
    username = Column(String)
    # ✨ YENİ ALAN
    email = Column(String, nullable=True)  # Şimdi ekledik!
```

**Migration oluşturma:**
```bash
alembic revision --autogenerate -m "add email to participants"
```

**Çıktı:**
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.autogenerate.compare] Detected added column 'participants.email'
  Generating alembic\versions\abc123_add_email_to_participants.py ...  done
```

**Oluşan dosya:**
```python
# alembic/versions/abc123_add_email_to_participants.py
def upgrade():
    op.add_column('participants', sa.Column('email', sa.String(), nullable=True))

def downgrade():
    op.drop_column('participants', 'email')
```

**Migration'ı uygulama:**
```bash
alembic upgrade head
```

---

### ✍️ Manuel Migration (Data Migration)

Bazen autogenerate yeterli olmaz. Örneğin veri dönüşümü gerektiğinde:

```bash
alembic revision -m "migrate old points to new system"
```

**Manuel düzenleme:**
```python
def upgrade():
    # 1. Yeni kolon ekle
    op.add_column('participants', sa.Column('new_points', sa.Float(), default=0.0))
    
    # 2. Eski veriden yeni kolona taşı (Data migration)
    from sqlalchemy import table, column
    from sqlalchemy.sql import select
    
    participants = table('participants',
        column('id', sa.Integer),
        column('old_points', sa.Float),
        column('new_points', sa.Float)
    )
    
    # Eski puanları yeni sisteme çevir (örnek: x2 yap)
    op.execute(
        participants.update().values(new_points=participants.c.old_points * 2)
    )
    
    # 3. Eski kolonu kaldır
    op.drop_column('participants', 'old_points')

def downgrade():
    # Geri alma işlemi
    op.add_column('participants', sa.Column('old_points', sa.Float()))
    op.execute(
        participants.update().values(old_points=participants.c.new_points / 2)
    )
    op.drop_column('participants', 'new_points')
```

---

## İleri Seviye Kullanım

### 📊 Batch Operations (SQLite için kritik!)

SQLite bazı ALTER TABLE komutlarını desteklemez. Alembic bu durumda **batch mode** kullanır:

```python
def upgrade():
    with op.batch_alter_table('participants') as batch_op:
        batch_op.add_column(sa.Column('email', sa.String()))
        batch_op.create_index('ix_participants_email', ['email'])
```

Projenizdeki `env.py` bunu otomatik algılar.

---

### 🔀 Birden Fazla Veritabanı

Eğer PostgreSQL ve SQLite arasında geçiş yapıyorsanız:

```python
from alembic import op
import sqlalchemy as sa

def upgrade():
    # PostgreSQL için JSONB, SQLite için TEXT
    if op.get_bind().dialect.name == 'postgresql':
        op.add_column('events', sa.Column('rules', sa.dialects.postgresql.JSONB()))
    else:
        op.add_column('events', sa.Column('rules', sa.Text()))
```

---

### 🧪 Test Veritabanında Deneme

Production'a uygulamadan önce **mutlaka test edin:**

```bash
# .env dosyanızı test veritabanına işaret ettirin
DATABASE_URL=postgresql://test_user:test_pass@localhost/test_db

# Migration'ı test et
alembic upgrade head

# Geri almayı test et
alembic downgrade -1

# Tekrar ileri
alembic upgrade head
```

---

## Sık Karşılaşılan Hatalar

### ❌ Hata: "Target database is not up to date"

**Sebep:** Veritabanınız migration'larla senkronize değil.

**Çözüm:**
```bash
# Mevcut durumu kontrol et
alembic current

# En son versiyona güncelle
alembic upgrade head
```

---

### ❌ Hata: "Can't locate revision identified by 'abc123'"

**Sebep:** Migration dosyası silinmiş veya `alembic_version` tablosu bozuk.

**Çözüm:**
```bash
# alembic_version tablosunu kontrol et
# PostgreSQL
psql -d coupon_db -c "SELECT * FROM alembic_version;"

# Manuel düzeltme
alembic stamp head  # Mevcut durumu kaydet
```

---

### ❌ Hata: "FAILED: Target database is not empty"

**Sebep:** Veritabanında tablolar var ama `alembic_version` tablosu yok.

**Çözüm:**
```bash
# Mevcut tabloları migration yapılmış gibi işaretle
alembic stamp head
```

---

### ❌ Hata: "Multiple head revisions are present"

**Sebep:** Branch oluşmuş (birden fazla migration aynı revision'dan türemiş).

**Çözüm:**
```bash
# Mevcut head'leri gör
alembic heads

# Merge migration oluştur
alembic merge heads -m "merge branches"
```

---

## En İyi Uygulamalar

### ✅ 1. Migration Dosyalarını Git'e Ekleyin
```bash
git add alembic/versions/
git commit -m "Add new migration for event tables"
```

### ✅ 2. Her Zaman Downgrade Fonksiyonu Yazın
```python
def downgrade():
    # ❌ KÖTÜ
    pass
    
    # ✅ İYİ
    op.drop_table('new_table')
```

### ✅ 3. Production'da Migration Öncesi Backup Alın
```bash
# PostgreSQL
pg_dump coupon_db > backup_$(date +%Y%m%d_%H%M%S).sql

# SQLite
cp coupon.db coupon_backup_$(date +%Y%m%d_%H%M%S).db
```

### ✅ 4. Destructive Migration'larda Dikkatli Olun
```python
def upgrade():
    # ⚠️ DİKKAT: Bu kolon VERİLERİYLE birlikte silinecek!
    op.drop_column('participants', 'old_score')
```

**Daha güvenli:**
```python
def upgrade():
    # Önce yedekle
    op.execute("""
        CREATE TABLE participants_old_score_backup AS 
        SELECT id, old_score FROM participants
    """)
    
    # Sonra sil
    op.drop_column('participants', 'old_score')
```

### ✅ 5. NULL/NOT NULL Değişikliklerinde Veri Kontrolü
```python
def upgrade():
    # Önce mevcut NULL değerleri doldur
    op.execute("UPDATE participants SET email = 'unknown@example.com' WHERE email IS NULL")
    
    # Sonra kolonu NOT NULL yap
    op.alter_column('participants', 'email', nullable=False)
```

### ✅ 6. Foreign Key Eklerken Sıralama Önemli
```python
def upgrade():
    # 1. Önce referenced tablo (events)
    op.create_table('events', ...)
    
    # 2. Sonra referencing tablo (coupons)
    op.add_column('coupons', sa.Column('event_id', sa.Integer()))
    op.create_foreign_key('fk_coupons_event', 'coupons', 'events', ['event_id'], ['id'])

def downgrade():
    # Ters sırada sil!
    op.drop_constraint('fk_coupons_event', 'coupons')
    op.drop_column('coupons', 'event_id')
    op.drop_table('events')
```

### ✅ 7. Büyük Tablolarda Index Ekleme
```python
def upgrade():
    # Concurrent index (PostgreSQL) - Production'da kilitleme yapmaz
    op.create_index(
        'ix_coupons_client_id', 
        'coupons', 
        ['client_id'],
        postgresql_concurrently=True  # PostgreSQL için
    )
```

---

## 🚀 Hızlı Referans - Sık Kullanılan Komutlar

```bash
# Durum kontrolü
alembic current
alembic history

# Yeni migration oluştur (otomatik)
alembic revision --autogenerate -m "açıklama"

# Yeni migration oluştur (manuel)
alembic revision -m "açıklama"

# İleri git
alembic upgrade head      # En sona
alembic upgrade +1        # Bir adım
alembic upgrade abc123    # Belirli versiyona

# Geri git
alembic downgrade -1      # Bir adım geri
alembic downgrade abc123  # Belirli versiyona geri
alembic downgrade base    # Sıfırla (TEHLİKELİ!)

# Mevcut durumu işaretle
alembic stamp head

# SQL çıktısını göster (çalıştırmadan)
alembic upgrade head --sql
```

---

## 📞 Yardım

### Debug Modu
```bash
alembic -c alembic.ini upgrade head --verbose
```

### SQL Çıktısını Görmek
```bash
alembic upgrade head --sql
```

### Offline SQL Script Oluşturma
```bash
alembic upgrade head --sql > migration.sql
# Bu SQL'i manuel çalıştırabilirsiniz
```

---

## 🎯 Özet

1. **Model değişikliği yap** → `common/models/`
2. **Migration oluştur** → `alembic revision --autogenerate -m "açıklama"`
3. **Kontrol et** → Migration dosyasını manuel incele
4. **Test et** → Test veritabanında `alembic upgrade head`
5. **Production** → Backup al + migration uygula

**Unutmayın:** Alembic kullanmak `Base.metadata.create_all()` kullanmaktan **kat kat daha güvenli ve profesyoneldir!** 🎉
