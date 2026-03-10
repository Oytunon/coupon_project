class CouponAppException(Exception):
    def __init__(self, message: str, code: str = None):
        self.message = message
        self.code = code
        super().__init__(self.message)

class AuthException(CouponAppException):
    pass

class NotFoundException(CouponAppException):
    pass

class ValidationException(CouponAppException):
    pass


class BAPIRateLimitError(Exception):
    """Betconstruct API rate limit (403) veya proaktif throttle."""
    def __init__(self, retry_after_seconds: int = 130):
        self.retry_after_seconds = retry_after_seconds
        super().__init__(f"Rate limit, {retry_after_seconds}s sonra tekrar deneyin")
