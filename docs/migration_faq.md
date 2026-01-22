# Database Migration ile İlgili SSS (Sık Sorulan Sorular)

## 🤔 Genel Sorular

### S: `Base.metadata.create_all()` yerine neden Alembic kullanıyoruz?

**C:** `create_all()` sadece tabloları oluşturur, ama:
- ❌ Mevcut tablolarda değişiklik yapamaz
- ❌ Veri kaybı riski yüksek
- ❌ Geri alma (rollback) imkanı yok
- ❌ Takım çalışmasında senkronizasyon sorunu

Alembic ile:
- ✅ Tüm değişiklikler versiyonlanır
- ✅ İstediğiniz zaman geri alabilirsiniz
- ✅ Veri transformasyonu yapabilirsiniz
- ✅ Production güvenliği artar

---

### S: İlk defa projeyi çalıştırıyorum, ne yapmalıyım?

**C:**
```bash
# 1. Virtual environment aktivasyonu
.\.venv\Scripts\Activate.ps1

# 2. Database başlat (Docker kullanıyorsanız)
docker-compose up -d postgres

# 3. Migration'ları çalıştır
alembic upgrade head

# 4. Backend'i başlat
uvicorn backend_api.app.main:app --reload
```

---

### S: Yeni bir model alanı ekledim, ne yapmalıyım?

**C:**
```bash
# 1. Migration oluştur
python tools/migration_helper.py create "add my_field to my_table"

# 2. Migration dosyasını kontrol et
# alembic/versions/xxxx_add_my_field_to_my_table.py

# 3. Uygula
alembic upgrade head
```

---

## 🔧 Teknik Sorular

### S: "Target database is not up to date" hatası alıyorum

**C:** Veritabanınız migration'larla senkronize değil.

```bash
# Mevcut durumu gör
alembic current

# En son versiyona güncelle
alembic upgrade head
```

---

### S: Migration dosyası oluşturdum ama veritabanında uygulanmadı

**C:** Migration oluşturmak != migration uygulamak

```bash
# Sadece dosya oluşturur
alembic revision --autogenerate -m "mesaj"

# Uygulamak için:
alembic upgrade head
```

---

### S: Migration'ı geri almak istiyorum

**C:**
```bash
# Bir adım geri
alembic downgrade -1

# Belirli bir versiyona geri
alembic downgrade abc123

# Tümünü geri al (TEHLİKELİ!)
alembic downgrade base
```

**Uyarı:** Veri kaybı olabilir! Production'da dikkatli kullanın.

---

### S: autogenerate bazı değişiklikleri görmedi

**C:** Autogenerate her şeyi algılayamaz. Manuel kontrol edin:

**Algılar:**
- ✅ Yeni tablolar
- ✅ Yeni kolonlar
- ✅ Kolon tipi değişiklikleri (çoğu)
- ✅ Index'ler

**Algılamaz:**
- ❌ Kolon ismi değişiklikleri (siler ve yeniden oluşturur)
- ❌ Veri dönüşümleri
- ❌ Trigger'lar, stored procedure'ler
- ❌ Enum değer değişiklikleri (bazı durumlarda)

Manuel migration yazmanız gerekebilir!

---

### S: SQLite kullanıyorum, "cannot add column" hatası alıyorum

**C:** SQLite bazı ALTER TABLE komutlarını desteklemez.

**Çözüm:** `env.py` dosyamız `render_as_batch=True` ile yapılandırıldı, otomatik çözümlenmeli.

Sorun devam ederse migration'da batch mode kullanın:

```python
def upgrade():
    with op.batch_alter_table('my_table') as batch_op:
        batch_op.add_column(sa.Column('new_field', sa.String()))
```

---

### S: Production'da migration uygularken hata aldım, ne yapmalıyım?

**C:**

1. **Panik yapmayın!** ⚠️
2. Hata mesajını kaydedin
3. Eğer migration yarım kaldıysa:

```bash
# Mevcut durumu gör
alembic current

# Eğer migration başlamışsa ama tamamlanmamışsa
# Önce downgrade deneyin
alembic downgrade -1

# Sorunu düzeltin ve tekrar deneyin
alembic upgrade head
```

4. Backup'ınızı kullanın (mutlaka backup almalıydınız!)

---

### S: Birden fazla kişi aynı anda migration oluşturdu, conflict!

**C:** Git merge conflict gibi çözülür.

```bash
# Head'leri gör
alembic heads

# Merge migration oluştur
alembic merge heads -m "merge migrations"

# Çözümlenmiş migration'ı uygula
alembic upgrade head
```

---

### S: Test database kullanmak istiyorum

**C:**

1. `.env.test` dosyası oluşturun:
```ini
DATABASE_URL=postgresql://test_user:test_pass@localhost/test_db
```

2. Test database'de migration çalıştırın:
```bash
# Test database'i işaret et
set DATABASE_URL=postgresql://test_user:test_pass@localhost/test_db

# Migration'ları uygula
alembic upgrade head

# Test et
pytest
```

---

### S: Migration dosyasını yanlışlıkla sildim!

**C:**

**Eğer Git'e commit ettiyseniz:**
```bash
git checkout HEAD -- alembic/versions/abc123_my_migration.py
```

**Eğer commit etmediyseniz:**
- Migration'ı yeniden oluşturun
- Ya da veritabanını sıfırlayın:

```bash
# TEHLİKELİ: Tüm data kaybolur!
alembic downgrade base
alembic upgrade head
```

---

## 🚨 Acil Durum Senaryoları

### Senaryo 1: Production'da migration başarısız oldu!

**Adımlar:**

1. **Hemen backup'tan dön:**
```bash
# PostgreSQL
pg_restore -d coupon_db backup_file.sql

# SQLite
cp coupon_backup.db coupon.db
```

2. **Sorunu lokal'de çöz:**
- Migration dosyasını düzelt
- Test veritabanında dene
- Testi geçtikten sonra production'a tekrar uygula

3. **Downgrade dene (SADECE küçük sorunlarda):**
```bash
alembic downgrade -1
```

---

### Senaryo 2: Migration uygulandı ama veriler kayboldu!

**Adımlar:**

1. **Hemen backup'ı geri yükle!**
2. **Migration'ı incele:**
   - `downgrade()` fonksiyonu veri kaybına neden olduysa
   - `upgrade()` fonksiyonunda DROP kolon/tablo varsa
3. **Düzelt ve tekrar uygula**

**Önlem:** Data migration yaparken ÖNCE backup tablo oluşturun:

```python
def upgrade():
    # 1. Backup oluştur
    op.execute("CREATE TABLE participants_backup AS SELECT * FROM participants")
    
    # 2. İşlemi yap
    op.drop_column('participants', 'old_field')

def downgrade():
    # Backup'tan geri yükle
    op.execute("""
        ALTER TABLE participants 
        ADD COLUMN old_field TEXT;
        
        UPDATE participants p
        SET old_field = (SELECT old_field FROM participants_backup b WHERE b.id = p.id)
    """)
```

---

### Senaryo 3: "Multiple head revisions" hatası

**Sebep:** İki migration aynı parent revision'dan türedi.

**Çözüm:**
```bash
# Merge migration oluştur
alembic merge heads -m "merge conflicting migrations"

# Oluşan merge migration dosyasını kontrol et
# Sonra uygula
alembic upgrade head
```

---

## 💡 İpuçları ve Best Practices

### ✅ Yapılması Gerekenler

1. **Her zaman backup alın** (özellikle production'da)
2. **Migration'ları Git'e commit edin**
3. **Downgrade fonksiyonunu eksiksiz yazın**
4. **Test veritabanında deneyin**
5. **Descriptive migration mesajları kullanın**
6. **Büyük data migration'ları batch'lerde yapın**

### ❌ Yapılmaması Gerekenler

1. **Production'da deneme yapmayın**
2. **Migration dosyalarını manuel düzenlerken dikkatli olun**
3. **Downgrade'i boş bırakmayın**
4. **Önemli verileri backup almadan silmeyin**
5. **Migration'ları silerken dikkatli olun**

---

## 📞 Yardım Kaynakları

- [Alembic Kullanım Kılavuzu](alembic_kullanim.md)
- [Migration Workflow](migration_workflow.md)
- [Alembic Resmi Dökümanı](https://alembic.sqlalchemy.org/)
- [Migration Helper Script](../tools/migration_helper.py)

---

## 🔍 Hızlı Komut Referansı

```bash
# Durum kontrolü
alembic current                              # Mevcut versiyon
alembic history                              # Geçmiş
python tools/migration_helper.py status      # Detaylı durum

# Migration oluştur
python tools/migration_helper.py create "mesaj"
alembic revision --autogenerate -m "mesaj"

# Uygula
alembic upgrade head                         # En sona
alembic upgrade +1                           # Bir adım
python tools/migration_helper.py upgrade     # Helper ile

# Geri al  
alembic downgrade -1                         # Bir adım geri
python tools/migration_helper.py downgrade   # Helper ile

# Test
python tools/migration_helper.py test        # Full test
alembic upgrade head --sql                   # SQL'i göster
```

---

**Son güncelleme:** 2026-01-18
