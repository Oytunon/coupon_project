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
    """Betconstruct API rate limit (403) - 2 dk sonra tekrar deneyin."""
    pass
