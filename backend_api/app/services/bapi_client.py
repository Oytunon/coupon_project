
import requests
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Optional
from shared.settings import settings

logger = logging.getLogger(__name__)

class BapiClient:
    def __init__(self, base_url: str = "https://backofficewebadmin.betconstruct.com/api", token: Optional[str] = None):
        self.base_url = base_url
        self.token = token or settings.BAPI_TOKEN

    def _get_headers(self):
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        if self.token:
            headers["Authentication"] = f"{self.token}"
        return headers

    def _parse_response(self, response) -> dict:
        """
        BetConstruct backoffice API'si mantıksal hatalarda bile HTTP 200 dönebiliyor
        (gövdede HasError:true + AlertMessage). raise_for_status() bunu yakalamaz,
        o yüzden gövdeyi de kontrol ediyoruz.
        """
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict) and data.get("HasError"):
            raise ValueError(data.get("AlertMessage") or "BAPI error")
        return data.get("Data", data) if isinstance(data, dict) else data

    def send_cash_reward(self, client_id: int, amount: float, info: str = "Reward Distribution", currency: str = "TRY") -> dict:
        """
        Send cash reward to a user via BAPI.
        
        Args:
            client_id: User's external client ID
            amount: Amount to credit
            info: Description/Reason
            currency: Currency code (default TRY)
            
        Returns:
            Response dict or raises exception
        """
        endpoint = "/en/Client/CreateClientPaymentDocument"
        url = f"{self.base_url}{endpoint}"
        
        # Format amount: remove decimals if whole number (e.g. "100.0" -> "100")
        amt_str = str(int(amount)) if float(amount).is_integer() else str(amount)

        payload = {
            "Amount": amt_str,
            "ClientId": client_id,
            "CurrencyId": currency,
            "DocTypeInt": 3,
            "Info": "SPORTURNUVASI",
            "PaymentSystemId": None
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                json_body = json.dumps(payload)
                masked_headers = self._get_headers().copy()
                if "Authorization" in masked_headers:
                    token = masked_headers["Authorization"]
                    masked_headers["Authorization"] = token[:10] + "***" if token else "None"

                logger.info(f"BAPI Request URL: {url}")
                logger.info(f"BAPI Request Headers: {masked_headers}")
                logger.info(f"BAPI Request Body (Raw): {json_body}")
                logger.info(f"Sending cash reward to Client {client_id}: {amount} {currency} (attempt {attempt + 1}/{max_retries})")

                response = requests.post(url, json=payload, headers=self._get_headers(), timeout=15)
                return self._parse_response(response)

            except requests.exceptions.Timeout as e:
                logger.warning(f"BAPI cash reward timeout for Client {client_id} (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # 1s, 2s, 4s
                    continue
                logger.error(f"BAPI cash reward failed after {max_retries} attempts for Client {client_id}")
                raise
            except requests.exceptions.ConnectionError as e:
                logger.warning(f"BAPI cash reward connection error for Client {client_id} (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                logger.error(f"BAPI cash reward failed after {max_retries} attempts for Client {client_id}")
                raise
            except requests.exceptions.HTTPError as e:
                # 503 → geçici sunucu hatası, retry yap. Diğer 4xx/5xx → kalıcı hata, retry etme
                if response.status_code == 503 and attempt < max_retries - 1:
                    logger.warning(f"BAPI cash reward 503 for Client {client_id}, retry {attempt + 1}/{max_retries}")
                    time.sleep(2 ** attempt)
                    continue
                logger.error(f"BAPI cash reward HTTP error for Client {client_id}: {e} - Body: {payload}")
                raise
            except requests.exceptions.RequestException as e:
                logger.error(f"BAPI cash reward failed for Client {client_id}: {e} - Body: {payload}")
                raise
    def add_client_to_bonus(self, client_id: int, amount: float, bonus_id: int, bonus_type: int, note: str = "Reward Distribution") -> dict:
        """
        Add a client to a bonus (Free Spin, Free Bet, etc.) via BAPI.
        
        Args:
            client_id: User's external client ID
            amount: Bonus amount
            bonus_id: PartnerBonusId
            bonus_type: Bonus Type (5 for Free Spin, 6 for Free Bet)
            note: Description/Reason
            
        Returns:
            Response dict or raises exception
        """
        endpoint = "/en/Client/AddClientToBonus"
        url = f"{self.base_url}{endpoint}"
        
        # Format amount: remove decimals if whole number
        amt_str = str(int(amount)) if float(amount).is_integer() else str(amount)

        payload = {
            "Amount": amt_str,
            "ClientId": client_id,
            "Count": None,
            "MessageChannel": None,
            "MessageContent": None,
            "MessageSubject": None,
            "Note": note,
            "PartnerBonusId": bonus_id,
            "Type": bonus_type
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                json_body = json.dumps(payload)
                logger.info(f"BAPI Bonus Request URL: {url}")
                logger.info(f"BAPI Bonus Request Body: {json_body}")
                logger.info(f"Adding Client {client_id} to bonus {bonus_id} (attempt {attempt + 1}/{max_retries})")

                response = requests.post(url, json=payload, headers=self._get_headers(), timeout=15)
                return self._parse_response(response)

            except requests.exceptions.Timeout as e:
                logger.warning(f"BAPI bonus timeout for Client {client_id} (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                logger.error(f"BAPI bonus failed after {max_retries} attempts for Client {client_id}")
                raise
            except requests.exceptions.ConnectionError as e:
                logger.warning(f"BAPI bonus connection error for Client {client_id} (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                logger.error(f"BAPI bonus failed after {max_retries} attempts for Client {client_id}")
                raise
            except requests.exceptions.HTTPError as e:
                if response.status_code == 503 and attempt < max_retries - 1:
                    logger.warning(f"BAPI bonus 503 for Client {client_id}, retry {attempt + 1}/{max_retries}")
                    time.sleep(2 ** attempt)
                    continue
                logger.error(f"BAPI bonus HTTP error for Client {client_id}: {e} - Body: {payload}")
                raise
            except requests.exceptions.RequestException as e:
                logger.error(f"BAPI bonus failed for Client {client_id}: {e} - Body: {payload}")
                raise

    def get_client_balance(self, client_id: int) -> float:
        """Client'ın güncel bakiyesini döner. /Client/GetClients"""
        url = f"{self.base_url}/en/Client/GetClients"
        response = requests.post(url, json={"Id": client_id}, headers=self._get_headers(), timeout=15)
        data = self._parse_response(response)
        objects = (data or {}).get("Objects") or []
        if not objects:
            raise ValueError(f"Client {client_id} bulunamadı (GetClients boş döndü)")
        return float(objects[0].get("Balance", 0))

    def has_active_bet(self, client_id: int) -> bool:
        """Son 7 günde aktif (State=1, bekleyen) bahsi var mı? /Report/GetBetHistory"""
        url = f"{self.base_url}/en/Report/GetBetHistory"
        now = datetime.utcnow() + timedelta(hours=3)  # Türkiye saati
        start_date = now - timedelta(days=7)
        payload = {
            "State": 1,
            "SkeepRows": 0,
            "MaxRows": 10,
            "IsLive": None,
            "StartDateLocal": start_date.strftime("%d-%m-%y - %H:%M:%S"),
            "EndDateLocal": now.strftime("%d-%m-%y - %H:%M:%S"),
            "CalcStartDateLocal": None,
            "CalcEndDateLocal": None,
            "ClientId": client_id,
            "CurrencyId": "TRY",
            "IsBonusBet": None,
            "BetId": None,
            "ToCurrencyId": "TRY",
        }
        response = requests.post(url, json=payload, headers=self._get_headers(), timeout=15)
        data = self._parse_response(response)
        bets = ((data or {}).get("BetData") or {}).get("Objects") or []
        return len(bets) > 0

    def has_usable_bonus(self, client_id: int) -> bool:
        """Zaten bekleyen/kullanılmamış (ResultType=0) bir bonusu var mı? /Client/GetClientBonuses"""
        url = f"{self.base_url}/en/Client/GetClientBonuses"
        response = requests.post(url, json={"AcceptanceType": 0, "ClientId": client_id}, headers=self._get_headers(), timeout=15)
        data = self._parse_response(response)
        bonuses = data if isinstance(data, list) else []
        return any((b or {}).get("ResultType") == 0 for b in bonuses)

    def has_pending_withdrawal(self, client_id: int) -> bool:
        """Son 2 günde reddedilmemiş bir çekim talebi var mı? /Client/GetClientTransactionsV1

        Not: Onaylanan/ödenen çekimler işlem defterinde ayrı bir kayıt bırakmıyor — sadece
        reddedilenler "Rejected withdrawal request" (DocumentTypeId=8) kaydı oluşturuyor.
        Yani "Withdrawal request" (DocumentTypeId=1) sonrası red kaydı yoksa talep ya hâlâ
        bekliyor ya da zaten ödenmiş olabilir; bunu ayırt edemediğimiz için dar bir zaman
        penceresiyle sınırlıyoruz (pencere dışındaki eski, reddedilmemiş talepler muhtemelen
        zaten ödenmiştir).

        Not: bu uç sıralama garantisi vermiyor (IsOrderedDesc yok) ve DocumentTypeIds
        filtresinin sunucu tarafında gerçekten daraltıp daraltmadığı canlıda doğrulanmadı —
        çok işlem geçmişi olan bir client'ta gerçek bir bekleyen çekim kaçabilir teorik olarak.
        """
        url = f"{self.base_url}/en/Client/GetClientTransactionsV1"
        now = datetime.utcnow() + timedelta(hours=3)  # Türkiye saati
        start = now - timedelta(days=2)
        payload = {
            "ClientId": client_id,
            "CurrencyId": "TRY",
            "StartTimeLocal": start.strftime("%Y-%m-%dT00:00:00"),
            "EndTimeLocal": now.strftime("%Y-%m-%dT23:59:59"),
            "DocumentTypeIds": [1, 8],
            "MaxRows": 50,
            "SkipRows": 0,
            "ByPassTotals": False,
        }
        response = requests.post(url, json=payload, headers=self._get_headers(), timeout=15)
        data = self._parse_response(response)
        items = (data or {}).get("Objects") or []
        latest_request = max((it.get("CreatedLocal") or "" for it in items if it.get("DocumentTypeId") == 1), default="")
        latest_rejected = max((it.get("CreatedLocal") or "" for it in items if it.get("DocumentTypeId") == 8), default="")
        return bool(latest_request) and latest_request > latest_rejected
