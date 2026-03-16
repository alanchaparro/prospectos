# Utilidades de fechas para períodos (día, semana, mes)
from datetime import datetime, timedelta
from typing import Union

LOCALE_MESES = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")


def to_date(d: Union[datetime, str]) -> datetime:
    if isinstance(d, datetime):
        return d
    if isinstance(d, str):
        return datetime.fromisoformat(d.replace("Z", "+00:00"))
    return datetime.fromisoformat(str(d))


def get_period_start(date: Union[datetime, str], granularity: str) -> datetime:
    d = to_date(date)
    if granularity == "day":
        return d.replace(hour=0, minute=0, second=0, microsecond=0)
    if granularity == "week":
        # Lunes como inicio de semana
        weekday = d.weekday()
        start = d - timedelta(days=weekday)
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
    # month
    return d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def get_period_end(date: Union[datetime, str], granularity: str) -> datetime:
    d = to_date(date)
    if granularity == "day":
        start = d.replace(hour=0, minute=0, second=0, microsecond=0)
        return start + timedelta(days=1) - timedelta(microseconds=1)
    if granularity == "week":
        start = get_period_start(d, "week")
        return start + timedelta(days=7) - timedelta(microseconds=1)
    # month: último día del mes
    if d.month == 12:
        next_month = d.replace(year=d.year + 1, month=1, day=1)
    else:
        next_month = d.replace(month=d.month + 1, day=1)
    return next_month - timedelta(microseconds=1)


def period_key(date: Union[datetime, str], granularity: str) -> str:
    start = get_period_start(date, granularity)
    if granularity == "day":
        return start.strftime("%Y-%m-%d")
    if granularity == "week":
        iso = start.isocalendar()
        return f"{start.year}-W{iso[1]}"
    return start.strftime("%Y-%m")


def period_label(date: Union[datetime, str], granularity: str) -> str:
    start = get_period_start(date, granularity)
    if granularity == "day":
        return start.strftime("%d/%m/%Y")
    if granularity == "week":
        return f"Sem {start.isocalendar()[1]} {start.year}"
    return f"{LOCALE_MESES[start.month - 1]} {start.year}"


def is_within_interval(d: datetime, start: datetime, end: datetime) -> bool:
    return start <= d <= end
