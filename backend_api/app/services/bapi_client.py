
import requests
import json
import logging
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
        
        try:
            # Debug: Log exact payload and headers
            import json
            json_body = json.dumps(payload)
            masked_headers = self._get_headers().copy()
            if "Authorization" in masked_headers:
                token = masked_headers["Authorization"]
                masked_headers["Authorization"] = token[:10] + "***" if token else "None"
            
            logger.info(f"BAPI Request URL: {url}")
            logger.info(f"BAPI Request Headers: {masked_headers}")
            logger.info(f"BAPI Request Body (Raw): {json_body}")

            logger.info(f"Sending cash reward to Client {client_id}: {amount} {currency}")
            response = requests.post(url, json=payload, headers=self._get_headers(), timeout=10)
            
            # Raise for status code errors
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"BAPI Request Success Failed: {str(e)} - Body: {payload}")
            raise e
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
        
        try:
            # Debug: Log exact payload
            json_body = json.dumps(payload)
            logger.info(f"BAPI Bonus Request URL: {url}")
            logger.info(f"BAPI Bonus Request Body: {json_body}")

            response = requests.post(url, json=payload, headers=self._get_headers(), timeout=10)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"BAPI Bonus Request Failed: {str(e)} - Body: {payload}")
            raise e
