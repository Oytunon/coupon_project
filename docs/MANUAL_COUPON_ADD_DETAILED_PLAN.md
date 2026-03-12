# Manuel Kupon Ekleme – Detaylı Planlama

Bu doküman, `MANUAL_COUPON_ADD_PLAN.md` ile birlikte kullanılır. **Manuel ekleme modunda** kupon bilgisi **GetBetReport** ile alınır.

**Önemli:** Admin sadece User ID ve Coupon ID girer. Stake, odds, selections vb. BAPI'den çekilir.

**GetBetReport:** `filterBet.BetId = bet_id` ile tek kupon sorgulanır → minimal veri. GetBetHistory veya Selection ayrı değil.

---

## 1. Genel Akış (Event Bazlı)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EVENT SEÇİLDİ (Admin Panel)                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  [+ Manuel Kupon Ekle] butonu                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  MODAL: Sadece Bet ID (Coupon ID)                                          │
│  (User ID/username gerekmez – response'ta ClientLogin gelir)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BAPI: GetBetReport (filterBet.BetId = bet_id, date_range)                   │
│  BetId filtresi ile tek kupon – minimal veri                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Selection: GetBetReport'ta gelir (IsWithSelections); yoksa fetch_bet_selections │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  rules_validator + Coupon + CouponEventResult oluştur                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Sadece Bet ID Girişi

| Alan | Zorunlu | Açıklama |
|------|---------|----------|
| **Bet ID** | Evet | Tek alan – BAPI `filterBet.BetId` |

**User ID/username gerekmez.** GetBetReport response'ta `ClientLogin` ve `ClientId` gelir.

**Backend akışı:**
- Admin sadece Bet ID girer
- GetBetReport → Response'tan `ClientId`, `ClientLogin` alınır
- `ClientId` ile Participant + EventParticipant kontrolü
- Başarılı cevapta `ClientLogin` (kullanıcı adı) döndürülür → "Kupon eklendi. Kullanıcı: ayhanextra"

---

## 3. BAPI Kurallarına Uygunluk Kontrolü

### 3.1 `rules_validator.is_valid_for_event()` Girdileri

| Parametre | Kaynak | Açıklama |
|-----------|--------|----------|
| `bet_history` | GetBetReport response | `Type`, `EquivalentAmount`, `Selections` veya `BetSelections` |
| `selections_data` | GetBetReport veya `fetch_bet_selections` | `Selections` listesi – her biri `Price`, `CompetitionId` içerir |
| `event` | DB | Event kuralları (`rules` JSON) |

### 3.2 Kontrol Edilen Kurallar

| Kural | Bet History Alanı | Selection Alanı |
|-------|-------------------|-----------------|
| `min_combination` | `Type` (kombine sayısı) | - |
| `max_combination` | `Type` | - |
| `min_stake` | `EquivalentAmount` | - |
| `min_odd` | - | Her selection: `Price` |
| `allowed_league_ids` | - | Her selection: `CompetitionId` |

### 3.3 Selection Eksikse

- GetBetReport response'ta `Selections` / `BetSelections` boşsa → `fetch_bet_selections(bet_id)` çağrılır
- Hâlâ boşsa → `BET_SELECTIONS_MISSING` hatası

---

## 4. GetBetReport – İstek Yapısı

**Request (sadece BetId yeterli):**

```json
{
  "ToCurrencyId": "TRY",
  "byPassTotals": false,
  "filterBet": {
    "BetId": "6139043932",
    "CalcStartDateLocal": "10-02-26 - 00:00:00",
    "CalcEndDateLocal": "13-03-26 - 00:00:00",
    "ClientId": "",
    "IsWithSelections": true,
    "MaxRows": 20,
    "SkeepRows": 0,
    "State": null,
    "IsOrderedDesc": true,
    "IsTest": false,
    ...
  },
  "filterBetSelection": {...},
  "isCalcTime": true,
  "matchFilter": {...}
}
```

**Response:** `Data.BetData.Objects[0]` → `ClientId`, `ClientLogin`, `Amount`, `Price`, `State`, `EquivalentAmount`, `BetSelections` (IsWithSelections: true ile gelir; boşsa fetch_bet_selections)

**Başarı cevabı:** `ClientLogin` (kullanıcı adı) ile geri dönüş – örn. "Kupon eklendi. Kullanıcı: ayhanextra"

---

## 2.1 Kupon Kaydı – Scoring Engine ile Aynı Mantık

Manuel ekleme, **scoring_engine** ile aynı şekilde kaydeder. Böylece kupon sistemde worker tarafından eklenmiş gibi görünür.

**Coupon alanları (GetBetReport → DB):**

| Coupon alanı | GetBetReport kaynağı |
|--------------|----------------------|
| `client_id` | `ClientId` |
| `bet_id` | `Id` (string) |
| `event_id` | Hedef event_id |
| `stake` | `Amount` |
| `odds` | `Price` |
| `state` | `State` 4→"won", 3→"lost" |
| `winning` | `WinningAmount` |
| `combination_count` | `SelectionCount` veya `Type` |
| `is_live` | `IsLive` |
| `bet_data` | Tam bet objesi (Selections dahil) |
| `created_at` | `Created` veya `CalcDateLocal` (parse) |
| `is_processed` | `True` |
| `processed_at` | `datetime.utcnow()` |

**CouponEventResult:**
- `calculate_points_for_event(coupon, event)` ile puan hesapla
- `is_eligible=True`, `coupon_state`, `points_earned`, `points_calculation`

**EventParticipant güncelleme:**
- İlgili katılımcının `total_points` değeri yeniden hesaplanır (scoring_engine'deki gibi)

---

## 5. Selection Akışı (Detaylı)

```
GetBetReport(bet_id=..., include_selections=True)
        │
        ▼
   Response.Bets[0]  (tek kupon)
        │
        ├── Selections / BetSelections VAR? ──► rules_validator'a gönder
        │
        └── YOK? ──► fetch_bet_selections(bet_id)
                            │
                            ▼
                     Selections VAR? ──► rules_validator'a gönder
                            │
                            └── YOK? ──► BET_SELECTIONS_MISSING
```

**Mevcut kod:** `fetch_bet_report` var; `bet_id` parametresi eklenecek. `fetch_bet_selections` yedek olarak.

---

## 6. Önerilen Uygulama Sırası

| Sıra | Görev | Dosya |
|------|-------|-------|
| 1 | `fetch_bet_report`'a `bet_id` parametresi ekle (filterBet.BetId set) | `shared/services/betconstruct.py` |
| 2 | `add_manual_coupon()` – GetBetReport + rules_validator | `shared/domain/` veya `scoring_engine.py` |
| 3 | `POST /api/admin/events/{event_id}/coupons/manual` endpoint | `backend_api/app/routers/` |
| 4 | Admin frontend: Modal (sadece Bet ID) | `admin_frontend/` |
| 5 | (Opsiyonel) Ön kontrol endpoint: `GET .../coupons/manual/validate?client_id=&bet_id=` | Aynı router |

---

## 7. Admin Panel Yerleşimi

**Konum:** Event detay sayfası – Kampanya seçildiğinde açılan ekran (Liderlik Tablosu görünürken)

**Dosya:** `admin_frontend/src/pages/AdminPage.tsx`

**Yer:** `viewEventId && eventStats` bloğu içinde, "Etkinlik Liderlik Tablosu" kartının header'ı:

```
[Etkinlik Liderlik Tablosu]     [Excel İndir] [+ Manuel Kupon Ekle]
```

- **Excel İndir** butonunun yanına `[+ Manuel Kupon Ekle]` eklenir
- Tıklanınca modal açılır: Bet ID input + Ekle butonu
- Başarı: toast "Kupon eklendi. Kullanıcı: {client_login}"
- Hata: toast `detail` ile (destructive variant)

---

## 8. Ön Kontrol Endpoint (Opsiyonel)

Eklemeden önce "Bu kupon eklenebilir mi?" sorusuna cevap vermek için:

```
GET /api/admin/events/{event_id}/coupons/manual/validate?bet_id=6139043932
```

**Response örnekleri:**
- `{ "can_add": true, "source": "bapi", "client_login": "ayhanextra", "preview": { "stake": 100, "odds": 2.5, "state": "won" } }`
- `{ "can_add": false, "reason": "BET_NOT_FOUND", "detail": "GetBetReport ile bulunamadı (son 30 gün)" }`
- `{ "can_add": false, "reason": "RULES_NOT_MET", "detail": "Stake 50 < min_stake 100" }`

Bu sayede frontend, kullanıcıya eklemeden önce bilgi verebilir.
