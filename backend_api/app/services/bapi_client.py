
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
                if "Authentication" in masked_headers:
                    token = masked_headers["Authentication"]
                    masked_headers["Authentication"] = token[:10] + "***" if token else "None"

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
                # 500/503 → geçici sunucu hatası, retry yap. Diğer 4xx/5xx (401/403 dahil) →
                # kalıcı/rate-limit hatası, burada retry etme - reward_worker.py dış katmanda
                # auth/rate-limit'e özel cooldown uyguluyor (bkz. reward_worker.py _is_auth_error
                # / _is_cooldown_error).
                if response.status_code in (500, 503) and attempt < max_retries - 1:
                    logger.warning(f"BAPI cash reward {response.status_code} for Client {client_id}, retry {attempt + 1}/{max_retries}")
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
                # 500/503 → geçici sunucu hatası, retry yap (bkz. send_cash_reward'daki not)
                if response.status_code in (500, 503) and attempt < max_retries - 1:
                    logger.warning(f"BAPI bonus {response.status_code} for Client {client_id}, retry {attempt + 1}/{max_retries}")
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

    # Gerçekten hâlâ karara bağlanmamış sayılan durumlar (BAPI State alanı — bkz.
    # /Client/GetClientWithdrawalRequestsWithTotals): Pending=0, Allowed=1, Awaiting=2.
    # Paid=3 ve reddedilenler bilerek dışarıda bırakılıyor, artık "bekliyor" sayılmıyor.
    _OPEN_WITHDRAWAL_STATES = [0, 1, 2]

    def has_pending_withdrawal(self, client_id: int) -> bool:
        """Gerçekten hâlâ karara bağlanmamış (State: Pending/Allowed/Awaiting) bir çekim
        talebi var mı? /Client/GetClientWithdrawalRequestsWithTotals

        Not: Daha önce burada GetClientTransactionsV1 (ham işlem defteri) kullanılıyordu;
        o uçta onaylanıp ödenen çekimler için ayrı bir kayıt/durum yoktu (DocumentState hep
        sabit 10, canlıda 0-29 arası tüm DocumentTypeId'ler tarandı, "ödendi" için ayrı bir
        tip yoktu) — bu yüzden reddedilmemiş HER talep, ödenmiş olsa bile 2 gün boyunca
        "bekliyor" sayılıyordu (bkz. Arslankral şikayeti, client_id=1467650500: talep
        2026-09-01T15:37, State=3/Paid, PaymentCreatedLocal=2026-09-01T15:50 — 13 dakikada
        ödenmiş ama eski kod 2 gün boyunca engelliyordu).

        Bu uç (BetConstruct'ın "Client Requests" ekranının kullandığı gerçek uç — bkz. kardeş
        bonus-cashback/betconstruct-gateway repoları) gerçek bir State/StateName alanı
        döndürüyor, o yüzden artık zaman penceresi/tahmine gerek yok: sadece StateList ile
        filtreliyoruz.
        """
        url = f"{self.base_url}/en/Client/GetClientWithdrawalRequestsWithTotals"
        payload = {
            "Id": None,
            "ClientId": str(client_id),
            "StateList": self._OPEN_WITHDRAWAL_STATES,
            "FromDateLocal": None,
            "ToDateLocal": None,
        }
        response = requests.post(url, json=payload, headers=self._get_headers(), timeout=15)
        data = self._parse_response(response)
        open_requests = (data or {}).get("ClientRequests") or []
        return len(open_requests) > 0
