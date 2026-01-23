# 🎫 Kupon Turnuvası Sistemi 

Bu proje, bahis severlerin kuponlarıyla yarışarak puan topladığı, dinamik kurallara sahip, güvenli ve ölçeklenebilir bir **Turnuva Yönetim Sistemi**dir.

Modern mikroservis benzeri bir mimariyle tasarlanmış olup, arka planda gelişmiş bir veri işleme motoru (worker) çalışır.

---

## 🏗️ Sistem Mimarisi ve Teknoloji Yığını

Sistem, birbirleriyle entegre çalışan üç ana katmandan oluşur:

### 1. Backend API 
*   **Teknoloji:** Python 3.10+, FastAPI, Pydantic, SQLAlchemy (Async).
*   **Veritabanı:** PostgreSQL.
*   **Görevi:**
    *   RESTful API servislerini sunar.
    *   Kullanıcı kimlik doğrulama (JWT) ve oturum yönetimini sağlar.
    *   BetConstruct (B-API) ile entegre olarak kullanıcı verilerini doğrular.
    *   Hız sınırlama (Rate Limiting) ve CORS gibi güvenlik önlemlerini barındırır.

### 2. Otomasyon Servisi - Worker 
*   **Teknoloji:** Python (APScheduler), AsyncIO.
*   **Çalışma Prensibi:**
    *   Sistemden bağımsız, arka planda çalışan bir servistir.
    *   **Her 4 saatte bir** (00:00, 04:00, 08:00...) otomatik olarak tetiklenir.
    *   B-API'den tüm katılımcıların son işlem geçmişini çeker.
    *   **Dinamik Kural Motoru:** Her turnuvanın kendi kurallarına (Min Oran, Min Yatırım, Lig Kısıtlaması vb.) göre kuponları süzer.
    *   Geçerli kuponları puanlayarak (`Oran * Katsayı`) liderlik tablosunu günceller.

### 3. Frontend Uygulamaları 
*   **Client App:** Son kullanıcıların turnuvaya katıldığı, sıralamasını gördüğü modern arayüz. (React, Vite, TailwindCSS)
*   **Admin Panel:** Yöneticilerin turnuva oluşturduğu, kuralları belirlediği ve Excel raporları aldığı yönetim paneli.

---

## 🚀 Kurulum ve Canlıya Geçiş

Bu projeyi kendi sunucunuza kurmak için detaylı hazırlanmış **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** dosyasını referans alınız.

### Temel Adımlar:
1.  **Hazırlık:** Gerekli `.env` dosyalarını `.env.example` şablonlarından oluşturun.
2.  **Backend:** `pip install -r requirements.txt` ile bağımlılıkları yükleyin.
3.  **Frontend:** `npm run build` komutuyla React projelerini derleyin.
4.  **Worker:** Servisi systemd veya görev zamanlayıcı ile arka planda çalıştırın.


---

## 📁 Proje Yapısı

*   `/backend_api` - API Kaynak kodları
*   `/worker` - Otomasyon servisi kodları
*   `/client_frontend` - Kullanıcı arayüzü
*   `/admin_frontend` - Yönetim paneli
*   `/shared` - Ortak kullanılan modeller ve servisler
*   `/docs` - Teknik dokümantasyonlar

---

*Geliştirme: Oytunon*
