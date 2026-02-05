
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
            "Content-Type": "application/json"
        }
        if self.token:
            headers["Authorization"] = f"{self.token}"
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
            "Info": info,
            "PaymentSystemId": None
        }
        
        try:
            logger.info(f"Sending cash reward to Client {client_id}: {amount} {currency}")
            response = requests.post(url, json=payload, headers=self._get_headers(), timeout=10)
            
            # Raise for status code errors
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"BAPI Request Success Failed: {str(e)} - Body: {payload}")
            raise e
