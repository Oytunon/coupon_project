# 🚀 Canlıya Geçiş ve Test Rehberi (Deployment Guide)

Bu doküman, sistemi geliştirme ortamından (Localhost) **Canlı Sunucuya (Production)** taşımak ve test etmek için gerekli adımları içerir.

---

## 📋 1. Ön Hazırlıklar

Sunucunuzda (Linux/Ubuntu veya Windows Server) aşağıdakilerin kurulu olduğundan emin olun:
*   **Python 3.10+**
*   **Node.js 18+ & npm**
*   **PostgreSQL** (Veritabanı)

### 🌍 Ortam Değişkenleri (.env)
Projeyi sunucuya çektikten sonra ilk iş olarak ayar dosyalarını oluşturun:

1.  **Ana Dizin (`/`):**
    ```bash
    cp .env.example .env
    nano .env
    # DATABASE_URL, MAILGUN ayarları ve BAPI_TOKEN'ı girin.
    # CORS_ORIGINS kısmına kendi domaininizi ekleyin (örn: https://admin.sitem.com,https://sitem.com)
    ```

2.  **Client Frontend (`/client_frontend`):**
    ```bash
    cp .env.example .env
    nano .env
    # VITE_API_URL=https://api.sitem.com (Backend adresiniz)
    ```

3.  **Admin Frontend (`/admin_frontend`):**
    ```bash
    cp .env.example .env
    nano .env
    # VITE_API_URL=https://api.sitem.com (Backend adresiniz)
    ```

---

## 📦 2. Backend API Kurulumu

Backend servisini "Production Mode"da çalıştırmalıyız.

1.  **Bağımlılıkları Yükle:**
    ```bash
    pip install -r requirements.txt
    ```
2.  **Veritabanını Güncelle (Migration):**
    ```bash
    alembic upgrade head
    ```
3.  **Servisi Başlat (Linux/Gunicorn Örneği):**
    ```bash
    # 4 Worker process ile başlatır (Yüksek performans için)
    gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend_api.app.main:app --bind 0.0.0.0:8000
    ```

3.  **Admin Kullanıcısı Oluştur (Wizard):**
    Artık veritabanımız hazır olduğuna göre ilk yöneticiyi oluşturabiliriz.
    ```bash
    python tools/admin_setup_wizard.py
    # Sırasıyla kullanıcı adı, e-posta ve şifrenizi girin.
    ```

---

## ⚙️ 3. Otomasyon (Worker) Kurulumu

Worker'ın **her 4 saatte bir** çalışması ve asla durmaması gerekir.

**Linux Systemd Servis Örneği (`/etc/systemd/system/coupon-worker.service`):**
```ini
[Unit]
Description=Coupon Project Worker
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/coupon_project
ExecStart=/usr/bin/python3 worker/main.py
Restart=always

[Install]
WantedBy=multi-user.target
```
*Servisi aktif etmek için:* `sudo systemctl enable --now coupon-worker`

---

## 🎨 4. Frontend Kurulumu (Build)

Frontend kodları tarayıcıda çalışır. Önce "Derleme" (Build) işlemi yapıp çıkan `dist` klasörünü sunucuya (Nginx/Apache) göstermelisiniz.

1.  **Client Uygulaması:**
    ```bash
    cd client_frontend
    npm install
    npm run build
    # Oluşan 'dist' klasörünü ana domainde yayınlayın (örn: sitem.com)
    ```

2.  **Admin Paneli:**
    ```bash
    cd admin_frontend
    npm install
    npm run build
    # Oluşan 'dist' klasörünü alt domainde yayınlayın (örn: admin.sitem.com)
    ```

---

## 🧪 5. Canlı Test Stratejisi (Sanity Check)

Canlıya geçtikten sonra sistemi kullanıcıya açmadan önce şu testi yapın:

1.  **Gizli Test Etkinliği Oluşturun:**
    *   Admin panelinden yeni bir event açın, adını "Test Event" yapın.
    *   Durumu "Active" olsun ama linki kimseye atmayın.

2.  **Katılım Testi:**
    *   Gerçek bir kullanıcı (örn: Vahit47) ile katılmayı deneyin.
    *   Yatırım şartı hatası alıyorsanız veya katılıyorsanız bağlantı başarılıdır.

3.  **Kupon Testi:**
    *   Gerçek siteden ufak bir kupon yapın.
    *   Müsabaka bitince puanın sisteme düşüp düşmediğini "Kuponlarım" sekmesinden kontrol edin.

---

### ✅ Hazırız!
Bu adımları tamamladığınızda sisteminiz güvenli, performanslı ve test edilmiş olarak yayına girmiş olacaktır.
