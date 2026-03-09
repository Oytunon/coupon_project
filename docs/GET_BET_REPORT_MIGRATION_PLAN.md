# GetBetReport Worker Entegrasyon Planı

## Özet

**Mevcut:** Her katılımcı için ayrı `GetBetHistory` isteği → N kullanıcı × (1–8 sayfa) = çok sayıda API çağrısı  
**Hedef:** Tek `GetBetReport` isteği ile tüm kuponları çek → 1–20 sayfa (pagination) = ciddi hızlanma

---

## 1. API Karşılaştırması

| Özellik | GetBetHistory (Mevcut) | GetBetReport (Yeni) |
|---------|------------------------|---------------------|
| URL | `/Report/GetBetHistory` | `/Report/GetBetReport` |
| ClientId | Zorunlu (kullanıcı bazlı) | Boş = **tüm kullanıcılar** |
| Tarih formatı | `2026-03-09T00:00:00Z` | `09-03-26 - 00:00:00` |
| Response | `Data.BetData.Objects` | `Data.BetData.Objects` + `Count` |
| Bet ID alanı | `BetId` veya `Id` | `Id` |
| ClientId | İstekte verilir | **Her bet objesinde var** |
| ClientLogin | Yok | **Var** (username eşlemesi için) |

---

## 2. Request Body Yapısı (GetBetReport)

```json
{
  "oCurrencyId": "TRY",
  "byPassTotals": false,
  "filterBet": {
    "AmountFrom": null,
    "AmountTo": null,
    "WinningAmountFrom": null,
    "WinningAmountTo": null,
    "BetTypes": [1, 2],
    "CalcStartDateLocal": "09-03-26 - 00:00:00",
    "CalcEndDateLocal": "10-03-26 - 00:00:00",
    "ClientId": "",
    "IsWithSelections": false,
    "MaxRows": 250,
    "SkeepRows": 0,
    "State": null,
    "IsOrderedDesc": true,
    "IsTest": false
  },
  "filterBetSelection": {
    "SportId": null,
    "RegionId": null,
    "CompetitionId": null,
    "MatchId": null
  },
  "isCalcTime": true,
  "matchFilter": {
    "currentSport": null,
    "currentRegion": null,
    "currentCompetition": null,
    "currentMatch": null
  }
}
```

### Kritik Parametreler

| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| `ClientId` | `""` | Boş = tüm kuponlar |
| `State` | `null` | null = Won + Lost + diğer (4=Won, 3=Lost) |
| `IsWithSelections` | `true`? | **Test edilmeli** – selections dahil mi? |
| `MaxRows` | `250`–`500` | Sayfa boyutu |
| `SkeepRows` | `0`, `250`, `500`… | Pagination için skip |
| `BetTypes` | `[1, 2]` | 1=Single, 2=Multiple |

---

## 3. Response Yapısı

```json
{
  "HasError": false,
  "Data": {
    "BetData": {
      "Count": 4755,
      "Objects": [
        {
          "Id": 6135582261,
          "ClientId": 741967693,
          "ClientLogin": "yigitaybar",
          "Amount": 1000.00,
          "Price": 1.410,
          "State": 4,
          "StateName": "Won",
          "CalcDateLocal": "2026-03-09T20:14:46.49",
          "Created": "2026-03-09T21:11:41.138+04:00",
          "BetSelections": [],
          ...
        }
      ]
    }
  }
}
```

- `BetSelections`: `IsWithSelections: false` iken boş. **`true` ile test edilmeli.**

---

## 4. Uygulama Planı

### Faz 0: Test (Öncelikli)

1. **Test script** oluştur:
   - `IsWithSelections: true` ile istek at
   - `BetSelections` dolu mu kontrol et
   - `State: null` ile hem Won hem Lost geldiğini doğrula
   - `MaxRows: 500` destekleniyor mu?
   - Tarih formatı `DD-MM-YY - HH:MM:SS` doğru çalışıyor mu?

2. **Sonuçlara göre karar:**
   - Selections dahilse → Selection API çağrıları tamamen kaldırılır
   - Selections dahil değilse → Sadece history tarafı optimize edilir, selections yine batch ile çekilir

---

### Faz 1: `fetch_bet_report()` Fonksiyonu

**Dosya:** `shared/services/betconstruct.py`

```python
async def fetch_bet_report(
    start_date: str, 
    end_date: str, 
    max_rows: int = 250,
    include_selections: bool = False,
    state_filter: Optional[int] = None  # null = all, 4=won, 3=lost
) -> Dict[str, Any]:
    """
    GetBetReport API - Tek istekle tüm kuponları çeker.
    ClientId boş = tüm kullanıcılar.
    Pagination: SkeepRows ile sayfa sayfa çeker.
    """
```

- **Settings:** `BAPI_BET_REPORT_URL` ekle: `https://backofficewebadmin.betconstruct.com/api/en/Report/GetBetReport`
- Tarih formatı dönüşümü: `2026-03-09T00:00:00` → `09-03-26 - 00:00:00`
- Pagination: `Count` değerine göre `SkeepRows` ile döngü
- Response parse: `Data.BetData.Objects` (mevcut GetBetHistory ile uyumlu)

---

### Faz 2: Worker Mantığı Güncellemesi

**Dosya:** `shared/domain/scoring_engine.py`

**Mevcut akış:**
```
for user in participants:
    bets = fetch_bet_history(user.client_id, start, end)
    process(bets, user)
```

**Yeni akış:**
```
all_bets = fetch_bet_report(start, end)  # Tek veya birkaç sayfa
client_ids_enrolled = {p.client_id for p in participants}
bets_by_user = group_by_client_id(all_bets)

for user in participants:
    user_bets = [b for b in all_bets if b["ClientId"] == user.client_id]
    # joined_at, event date filtreleri burada
    process(user_bets, user)
```

**Alternatif (daha verimli):** Tüm bet'leri tek seferde işle, `ClientId` ile filtrele:

```
all_bets = fetch_bet_report(start, end)
enrolled_client_ids = {p.client_id for p in participants}
user_enrollment_map = {...}  # participant_id -> {event_id: joined_at}
client_to_participant = {p.client_id: p for p in participants}

for bet in all_bets:
    client_id = bet.get("ClientId")
    if client_id not in enrolled_client_ids:
        continue
    user = client_to_participant.get(client_id)
    # event/date/joined_at filtreleri
    process_one_bet(bet, user)
```

**Dikkat:** 
- `joined_at` ve event tarih aralığı filtreleri bet bazında yapılmalı
- `ClientLogin` ile eşleşme: Yeni katılan kullanıcıda `client_id` yoksa `ClientLogin` ile Participant bulunabilir

---

### Faz 3: Tarih ve Timezone

- GetBetReport `CalcStartDateLocal` / `CalcEndDateLocal` formatı: `DD-MM-YY - HH:MM:SS`
- Betconstruct GMT+4 kullanıyor (mevcut kodda `bc_offset` var)
- Worker'daki `scan_start_utc`, `scan_end_utc` hesaplaması aynı kalacak, sadece format dönüşümü eklenecek

---

## 5. Veritabanı

**Yeni tablo gerekmez.** Coupon modeli ve akışı aynı kalır. Sadece veri kaynağı değişir (GetBetHistory → GetBetReport).

---

## 6. Riskler ve Önlemler

| Risk | Önlem |
|------|-------|
| GetBetReport rate limit | Mevcut `_wait_if_rate_limited`, `_set_rate_limit_cooldown` kullan |
| Farklı response yapısı | `BetId`/`Id` mapping var. `WinningAmount` → scoring_engine'de `bet_history.get("WinningAmount")` eklenmeli (şu an WinAmount, Payout var) |
| ClientId eşleşmesi | Participant.client_id + ClientLogin fallback |
| Selections yok | `IsWithSelections: true` test; yoksa mevcut `fetch_bet_selections_batch` kullan |

---

## 7. Beklenen Kazanım

- **History istekleri:** N kullanıcı × ~2–8 istek → **1–20 istek** (tüm kuponlar için)
- **Selections:** `IsWithSelections: true` çalışırsa → **0 ek istek**
- **Süre:** Örn. 100 kullanıcı × 3 istek = 300 → 5–10 istek = **~30x hızlanma**

---

## 8. Test Sonuçları (09.03.2026) ✅

**Kritik düzeltme:** `oCurrencyId` değil, **`ToCurrencyId`** kullanılmalı. Tüm null değerler gönderilmeli.

| Test | Sonuç |
|------|-------|
| GetBetReport (ToCurrencyId + tam body) | ✅ Başarılı |
| IsWithSelections=true | ✅ BetSelections dahil |
| MaxRows=250 | ✅ Destekleniyor |
| **MaxRows=null** | ✅ **Tüm kayıtlar tek seferde!** (6937 kupon) |
| Pagination (SkeepRows) | ✅ Çalışıyor |

**Gerekli header'lar:** Origin, Referer (backoffice.betconstruct.com)

---

## 9. Sonraki Adım

Faz 1–2 implementasyonu: `fetch_bet_report()` + worker entegrasyonu.
