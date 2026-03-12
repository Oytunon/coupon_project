# Manuel Kupon Ekleme Sistemi – Plan

## 1. Amaç

Admin panelden event bazlı manuel kupon ekleme. Worker’ın kaçırdığı veya BAPI’de bulunmayan kuponları elle eklemek için.

---

## 2. Olası Hata Senaryoları (Kullanıcıdan Gelen)

| Hata | Açıklama | Çözüm |
|------|----------|--------|
| **Son 30 günde kupon bulunmadı** | Manuel ekleme max 30 gün geriye BAPI History sorgular; bu aralıkta yoksa BET_NOT_FOUND | Kupon 30 günden eskiyse eklenemez |
| **Kupon kampanya kurallarına uygun değil** | `rules_validator`: min_stake, min_odd, allowed_league_ids vb. | `RULES_NOT_MET` hatası |
| **Kullanıcı ID’de bulunmadı** | Participant yok veya event’e kayıtlı değil | Önce katılım kontrolü; gerekirse katılım oluşturma seçeneği |
| **Bet ID zaten var** | `bet_id` unique | “Bu kupon zaten eklenmiş” mesajı |

---

## 3. Manuel Ekleme Modu – GetBetReport

**Önemli:** Kupon bilgisi **GetBetReport** ile alınır. BetId filtresi ile tek kupon sorgulanır (minimal veri). Max 30 gün geriye dönük.

### Akış

- Admin: Sadece **Bet ID** girer (User ID/username gerekmez – response'ta ClientLogin gelir).
- Backend:
  1. GetBetReport: `filterBet.BetId = bet_id`, tarih aralığı son 30 gün
  2. Bulunamazsa → BET_NOT_FOUND
  3. Response'tan ClientId, ClientLogin alınır → Participant + event enrollment kontrolü
  4. Selection: GetBetReport `IsWithSelections: true` ile gelir; gelmezse `fetch_bet_selections(bet_id)`
  5. rules_validator → Coupon + CouponEventResult
  6. Başarı: `client_login` ile cevap ("Kupon eklendi. Kullanıcı: ayhanextra")

**Not:** GetBetReport'ta `BetId` filtresi ile sadece o kupon döner → minimal veri.

---

## 4. Admin Panel Yerleşimi

### Öneri: Event Detay Sayfası

**Konum:** Kampanyalar → Event seçildiğinde açılan detay ekranı (Liderlik Tablosu’nun üstünde veya yanında)

**Mevcut yapı:**
```
[Kampanyalara Dön]  [EVENT_NAME] [STATUS]

[Katılımcı] [Toplam Kupon] [Toplam Bahis] [Dağıtılan Puan]

[Etkinlik Liderlik Tablosu] [Excel İndir]
```

**Eklenecek:**
```
[+ Manuel Kupon Ekle]  ← Yeni buton
```

Tıklanınca modal açılır:

```
┌─────────────────────────────────────────────────────────┐
│  Manuel Kupon Ekle - {Event Adı}                    [X] │
├─────────────────────────────────────────────────────────┤
│  Bet ID (Kupon ID):        [________________]          │
│  (Sadece Bet ID yeterli – kullanıcı adı response'ta)   │
│                                                         │
│  [İptal]  [Ekle]                                        │
└─────────────────────────────────────────────────────────┘
```

**Admin panel yerleşimi (öneri):**

- **Konum:** Event detay sayfası – "Etkinlik Liderlik Tablosu" kartının header'ında, **Excel İndir** butonunun yanına
- **Kod:** `AdminPage.tsx` → `viewEventId && eventStats` bloğu içinde, `CardTitle` altındaki buton grubuna ekle
- **Görünüm:** `[+ Manuel Kupon Ekle]` – tıklanınca modal açılır (Bet ID input + Ekle butonu)

**Alternatif:** Event kartında (Kuponları Çek, Puanları Yeniden Hesapla yanına) – ancak event seçili değilken event_id bilgisi zaten var, modal açıldığında event_id kullanılır.

---

## 5. API Tasarımı

### Endpoint

```
POST /api/admin/events/{event_id}/coupons/manual
```

### Request Body

```json
{
  "bet_id": "6139043932"
}
```

- Sadece `bet_id` zorunlu – GetBetReport ile sorgulanır

### Response (Başarılı)

```json
{
  "success": true,
  "message": "Kupon eklendi. Kullanıcı: ayhanextra",
  "coupon_id": 42,
  "points_earned": 250.0,
  "client_login": "ayhanextra"
}
```

- `client_login` (kullanıcı adı) GetBetReport response'tan gelir – başarı mesajında gösterilir

### Hata Response’ları

```json
{
  "detail": "Kullanıcı bu kampanyaya kayıtlı değil.",
  "code": "PARTICIPANT_NOT_ENROLLED"
}
```

```json
{
  "detail": "Betconstruct API'de bu kupon bulunamadı (son 30 gün).",
  "code": "BET_NOT_FOUND"
}
```

```json
{
  "detail": "Kupon kampanya kurallarına uygun değil: Stake 50 < 100",
  "code": "RULES_NOT_MET"
}
```

```json
{
  "detail": "Bu Bet ID zaten sistemde kayıtlı.",
  "code": "BET_ID_EXISTS"
}
```

**Ek hata kodları:** `BET_SELECTIONS_MISSING` (seçimler alınamadı), `RATE_LIMITED` (BAPI limit – birkaç dk sonra tekrar deneyin)

**Frontend:** API `detail` alanını toast ile göster.

---

## 6. Backend Akış (Özet)

1. **Participant kontrolü**
   - `client_id` veya `username` ile Participant bul
   - EventParticipant ile event’e kayıtlı mı kontrol et
   - Değilse: `PARTICIPANT_NOT_ENROLLED`

3. **Bet ID kontrolü** → Zaten varsa BET_ID_EXISTS
4. **Participant kontrolü** → ClientId ile EventParticipant; değilse PARTICIPANT_NOT_ENROLLED
5. **Selection** → GetBetReport'ta gelmezse fetch_bet_selections
6. **rules_validator** → Coupon + CouponEventResult
7. **Enrollment güncelleme** + Başarı cevabı: client_login ile mesaj

---

## 7. Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `backend_api/app/routers/events.py` veya `admin.py` | `POST .../coupons/manual` endpoint |
| `shared/services/betconstruct.py` | `fetch_bet_report`'a `bet_id` parametresi ekle |
| `shared/domain/scoring_engine.py` | `add_manual_coupon` benzeri yardımcı fonksiyon (opsiyonel) |
| `admin_frontend/src/pages/AdminPage.tsx` | Modal + form + API çağrısı |

---

## 8. Uygulama Sırası

1. Backend: `POST /admin/events/{id}/coupons/manual` endpoint
2. Betconstruct: GetBetReport (BetId filtresi) + Selection (gerekirse fetch_bet_selections)
3. Admin frontend: Modal + form
4. Hata mesajlarının Türkçe ve net olması

---

## 9. Ek Notlar

- **Katılım yoksa:** İstersen “Önce katılım oluştur” seçeneği eklenebilir (EventParticipant + Participant).
- **Rate limit:** Tek bet sorgusu BAPI’ye az yük bindirir.
- **Audit:** `created_by_admin_id` gibi alan eklenirse manuel kuponlar izlenebilir.

