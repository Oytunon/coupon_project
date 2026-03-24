# Kupon Sistemi — Operasyon Notları

Kısa referans: veritabanı, worker’lar ve periyodik işler.

## Servisler

| Servis | Rol |
|--------|-----|
| **API** | REST, admin ve client |
| **Worker** | Kupon skorlama, event süresi dolunca `ended`, magic token / worker log temizliği (zamanlama aşağıda) |
| **Reward Worker** | Bekleyen ödül job’larını BAPI ile işler; job yoksa kısa aralıklarla bekler |

## Veritabanı

- Üretimde **Supabase pooler** için `DATABASE_URL` içinde **6543** (transaction mode) tercih edilir; 5432 kullanılıyorsa pool ayarları kodda tanımlıdır.
- `.env` değişince API/worker container’larının yeniden başlatılması gerekir.

## Zamanlanmış işler (worker)

| İş | Sıklık |
|----|--------|
| `process_coupons` | ~15 dk |
| `auto_expire_events` | ~15 dk |
| Magic token temizliği | Her gece 01:00 |
| Eski worker logları (30 gün üstü) | Her Pazar 02:00 |
| ExcludedBetCache | `process_coupons` içinde 72 saatten eski kayıtlar temizlenir |

## İsteğe bağlı iyileştirmeler

- Çok sayıda event varsa admin `GET /admin/events` için ileride pagination düşünülebilir.
- Reward worker’da ödüller arası bekleme (`reward_worker.py`) BAPI limitine göre ayarlanır; gerekirse kod veya env ile değiştirilebilir.

## Deploy sonrası hızlı kontrol

```bash
docker exec coupon_api_prod env | grep DATABASE
docker logs coupon_worker_prod --tail 30
```

`DATABASE_URL` içinde kullanılan host/portun beklentinizle uyumlu olduğunu doğrulayın.
