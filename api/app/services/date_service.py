from datetime import date
from calendar import monthrange


def get_current_month_range():
    today = date.today()

    first_day = today.replace(day=1)
    last_day = today.replace(
        day=monthrange(today.year, today.month)[1]
    )

    return first_day, last_day
