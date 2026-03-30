
import requests
import json
import logging
import time
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
                response.raise_for_status()
                return response.json()

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
                response.raise_for_status()
                return response.json()

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
