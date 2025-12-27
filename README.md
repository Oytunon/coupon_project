# Coupon Project

Bu proje, Betconstruct API'si üzerinden kullanıcıların kuponlarını takip eden, belirli kurallara uyan kuponları kaydeden ve kullanıcıların turnuvaya katılımını yöneten bir sistemdir.

## Proje Yapısı

- `api/`: FastAPI tabanlı backend servisi. Katılım işlemlerini yönetir.
- `worker/`: Arka planda çalışan ve kuponları kontrol eden servis.
- `common/`: API ve Worker arasında paylaşılan modeller ve ayarlar.
- `frontend/`: Vite + React + Tailwind tabanlı kullanıcı arayüzü.
- `tools/`: Geliştirme sürecinde kullanılan yardımcı scriptler ve test araçları.

## Gereksinimler

- Docker ve Docker Compose
- Python 3.11+
- Node.js 18+

## Hızlı Başlangıç (Docker)

Tüm sistemi (PostgreSQL, API, Worker) Docker ile ayağa kaldırmak için:

1. `.env.example` dosyasını `.env` olarak kopyalayın ve gerekli `BAPI_TOKEN` değerini girin.
2. Komutu çalıştırın:
   ```bash
   docker-compose up --build
   ```

## Manuel Kurulum

 Her servis için kendi dizininde `requirements.txt` dosyası mevcuttur.

### API & Worker Kurulumu
```bash
# Sanal ortam oluşturun
python -m venv venv
# Bağımlılıkları yükleyin
pip install -r requirements.txt
# API'yi başlatın
uvicorn api.app.main:app --reload
# Worker'ı başlatın
python worker/main.py
```

### Frontend Kurulumu
```bash
cd frontend
npm install
npm run dev
```

## Ayarlar

Konfigürasyon `common/settings.py` üzerinden yönetilir. Çevresel değişkenler şunlardır:

- `DATABASE_URL`: PostgreSQL bağlantı adresi.
- `BAPI_TOKEN`: Betconstruct API erişim anahtarı.
- `MIN_STAKE`: Minimum kupon tutarı (Varsayılan: 100 TL).
- `MIN_ODD`: Minimum oran (Varsayılan: 1.50).
- `MIN_COMBINATION`: Minimum kombine sayısı (Varsayılan: 2).
