# Configuración y utilidades para parseo de fechas y columnas
import re
from datetime import datetime
from typing import Optional

MESES_ES = {
    "enero": 0, "febrero": 1, "marzo": 2, "abril": 3, "mayo": 4, "junio": 5,
    "julio": 6, "agosto": 7, "septiembre": 8, "octubre": 9, "noviembre": 10, "diciembre": 11,
}


def _normalize_key(s: str) -> str:
    return (s or "").strip().lower()


def find_column_key(columns: list, keys: list) -> Optional[str]:
    """Primera columna que coincida (case-insensitive)."""
    lower_cols = {_normalize_key(c): c for c in columns}
    for k in keys:
        n = _normalize_key(k)
        if n in lower_cols:
            return lower_cols[n]
    return None


def find_column_contains(columns: list, substrings: list) -> Optional[str]:
    """Primera columna cuyo nombre contenga alguna subcadena."""
    for sub in substrings:
        sub_lower = _normalize_key(sub)
        for c in columns:
            if sub_lower in _normalize_key(c):
                return c
    return None


def parse_date(value) -> Optional[datetime]:
    """Parsea fecha desde Excel (serie, ISO, DD/MM/YYYY, mes español)."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        # Excel serial (días desde 1900-01-01)
        try:
            from datetime import timedelta
            base = datetime(1899, 12, 30)
            return base + timedelta(days=int(value))
        except Exception:
            return None
    s = str(value).strip()
    # ISO YYYY-MM-DD [HH:mm:ss]
    m = re.match(r"^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)) - 1, int(m.group(3))
        h = int(m.group(4)) if m.group(4) else 0
        mi = int(m.group(5)) if m.group(5) else 0
        sec = int(m.group(6)) if m.group(6) else 0
        if 0 <= mo <= 11 and 1 <= d <= 31:
            try:
                return datetime(y, mo + 1, d, h, mi, sec)
            except ValueError:
                pass
    # Mes español "febrero 2026"
    m = re.search(r"(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(\d{4})", s, re.I)
    if m:
        mes = MESES_ES.get(m.group(1).lower())
        anio = int(m.group(2))
        if mes is not None:
            try:
                return datetime(anio, mes + 1, 1)
            except ValueError:
                pass
    # DD/MM/YYYY
    m = re.match(r"^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)) - 1, int(m.group(3))
        if 0 <= mo <= 11 and 1 <= d <= 31:
            try:
                return datetime(y, mo + 1, d)
            except ValueError:
                pass
    # Fecha embebida
    m = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})", s)
    if m:
        d, mo = int(m.group(1)), int(m.group(2)) - 1
        yr = int(m.group(3))
        if yr < 100:
            yr += 2000 if yr < 50 else 1900
        if 0 <= mo <= 11 and 1 <= d <= 31:
            try:
                return datetime(yr, mo + 1, d)
            except ValueError:
                pass
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt
    except Exception:
        pass
    return None


def id_cliente_canonico(val) -> str:
    """253642, '253642', '253642.0' -> '253642'."""
    if val is None and val != 0:
        return ""
    s = str(val).strip()
    try:
        n = float(s)
        if n == int(n):
            return str(int(n))
    except ValueError:
        pass
    return s


def normalizar_linea(s: Optional[str]) -> str:
    """Quita acentos para comparar Línea."""
    if not s:
        return ""
    s = str(s).strip().lower()
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalizar_telefono(t) -> str:
    """Solo dígitos, últimos 9."""
    if not t:
        return ""
    d = re.sub(r"\D", "", str(t))
    return d[-9:] if len(d) > 9 else d
