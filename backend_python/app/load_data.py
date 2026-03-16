# Carga de Excel y normalización (pandas)
import os
import re
from pathlib import Path
from typing import Optional

import pandas as pd

from .config import (
    find_column_contains,
    find_column_key,
    id_cliente_canonico,
    normalizar_linea,
    normalizar_telefono,
    parse_date,
)

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data"))


def _read_sheet(path: Path, sheet: int = 0, header: int = 0) -> pd.DataFrame:
    try:
        df = pd.read_excel(path, sheet_name=sheet, header=header)
        return df
    except Exception:
        return pd.DataFrame()


def _resolve_linea_column(df: pd.DataFrame) -> Optional[str]:
    """Columna de categoría (Odontología, etc.), no teléfono."""
    cols = [c for c in df.columns if re.search(r"l[ií]nea|producto|categoria|odontolog", str(c), re.I)]
    if not cols:
        return None
    if len(cols) == 1:
        return cols[0]
    # Elegir la que tiene valores tipo categoría (texto)
    def looks_like_category(v):
        if pd.isna(v) or v == "":
            return False
        s = str(v).strip()
        if len(s) > 15:
            return False
        return bool(re.search(r"[a-zA-Záéíóú]", s)) or len(s) < 10

    best = cols[0]
    best_score = 0
    for col in cols:
        score = df[col].dropna().astype(str).apply(lambda x: looks_like_category(x)).sum()
        if score > best_score:
            best_score = score
            best = col
    return best


def _find_telefono_col_pautas(df: pd.DataFrame, linea_col: Optional[str]) -> Optional[str]:
    cols = list(df.columns)
    linea_like = [c for c in cols if re.match(r"^l[ií]nea$", str(c).strip(), re.I)]
    if len(linea_like) >= 2:
        other = next((c for c in linea_like if c != linea_col), None)
        if other:
            return other
    if len(linea_like) == 1 and linea_like[0] != linea_col:
        col = linea_like[0]
        sample = df[col].dropna().astype(str).str.replace(r"\D", "", regex=True)
        if (sample.str.len() >= 8).sum() > 10:
            return col
    by_name = find_column_key(cols, ["telefono", "teléfono", "phone", "celular", "Linea"]) or find_column_contains(cols, ["telefono", "tel", "phone", "celular"])
    if by_name and by_name != linea_col:
        return by_name
    for c in cols:
        if c == linea_col:
            continue
        sample = df[c].dropna().astype(str).str.replace(r"\D", "", regex=True)
        if (sample.str.len().between(8, 15)).sum() >= 20:
            return c
    return None


def load_pautas() -> Optional[pd.DataFrame]:
    path = DATA_DIR / "Pautas-ThinkChat-2025-2026.xlsx"
    if not path.exists():
        return None
    df = _read_sheet(path)
    if df.empty or len(df.columns) < 3:
        df = _read_sheet(path, header=1)
    if df.empty:
        return None

    date_substr = re.compile(r"fecha|ingreso|date|creacion|alta|fech|ultimo|último", re.I)
    date_cols = [c for c in df.columns if date_substr.search(str(c))]
    if not date_cols:
        date_cols = list(df.columns)

    linea_col = _resolve_linea_column(df)
    tel_col = _find_telefono_col_pautas(df, linea_col)

    def get_fecha(row):
        for col in date_cols:
            v = row.get(col)
            if pd.notna(v) and v != "":
                d = parse_date(v)
                if d is not None:
                    return d
        for col in df.columns:
            d = parse_date(row.get(col))
            if d is not None:
                return d
        return None

    rows = []
    for i, row in df.iterrows():
        fecha = get_fecha(row)
        if fecha is None:
            continue
        r = {"id_prospecto": f"fila_{i}", "fecha_contacto": fecha}
        if linea_col and pd.notna(row.get(linea_col)):
            r["linea"] = str(row[linea_col]).strip()
        if tel_col and pd.notna(row.get(tel_col)) and str(row[tel_col]).strip():
            tel = normalizar_telefono(str(row[tel_col]))
            if len(tel) >= 8:
                r["telefono"] = tel
        if "telefono" not in r:
            for col in df.columns:
                if re.search(r"fecha|date|meta|id|#", str(col), re.I):
                    continue
                v = row.get(col)
                if pd.isna(v) or v == "":
                    continue
                d = re.sub(r"\D", "", str(v))
                if 8 <= len(d) <= 15:
                    r["telefono"] = normalizar_telefono(v)
                    break
        rows.append(r)
    if not rows:
        return None
    return pd.DataFrame(rows)


def _normalizar_linea_agendamiento(val) -> str:
    if not val or not isinstance(val, str):
        return str(val).strip() if val else ""
    s = str(val).strip().upper()
    if s in ("ODONTOL", "ODONTOLOGIA"):
        return "Odontologia"
    if s == "EPEM":
        return "Epem"
    return str(val).strip()


def _es_estado_atendido(val) -> bool:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return False
    s = str(val).strip().lower()
    import unicodedata
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return "atendido" in s or "asistido" in s or s in ("atendida", "atendidas")


def _es_prospecto(val) -> bool:
    if val is None and val != 0:
        return False
    s = str(val).strip().lower()
    return s in ("si", "sí", "yes", "1", "true", "s")


def load_agendamientos() -> Optional[pd.DataFrame]:
    path = DATA_DIR / "agendamientos-prospectos.xlsx"
    if not path.exists():
        return None
    df = _read_sheet(path)
    if df.empty:
        return None

    cols = list(df.columns)
    estado_col = find_column_key(cols, ["status_nombre", "status", "estado"]) or find_column_contains(cols, ["estado", "status"])
    prospecto_col = find_column_key(cols, ["prospe", "prospecto"]) or find_column_contains(cols, ["prospe", "prospecto"])
    unidad_col = find_column_key(cols, ["unidad", "unidad de negocio"]) or find_column_contains(cols, ["unidad", "negocio", "linea"])
    fecha_col = find_column_key(cols, ["fecha_agendamiento", "fecha_agendamien", "fecha"]) or find_column_contains(cols, ["fecha", "agendamiento", "turno"])
    id_col = find_column_key(cols, ["client_i", "client_id", "id_prospecto", "email", "id"]) or find_column_contains(cols, ["client", "id"])

    if estado_col:
        mask = df[estado_col].apply(_es_estado_atendido)
        if mask.sum() == 0:
            pass
        else:
            df = df[mask].copy()
    if prospecto_col:
        df = df[df[prospecto_col].apply(_es_prospecto)].copy()

    if df.empty:
        return None

    out = []
    for i, row in df.iterrows():
        fecha_val = row.get(fecha_col) if fecha_col else None
        fecha = parse_date(fecha_val) if fecha_val is not None else None
        if fecha is None:
            continue
        id_val = row.get(id_col) if id_col else None
        pid = id_cliente_canonico(id_val) if id_val is not None else f"ag_{i}"
        if not pid:
            pid = f"ag_{i}"
        r = {"id_prospecto": pid, "fecha_agendamiento": fecha}
        if unidad_col and pd.notna(row.get(unidad_col)):
            r["linea"] = _normalizar_linea_agendamiento(str(row[unidad_col]))
        out.append(r)
    return pd.DataFrame(out) if out else None


def _es_estado_presupuesto_valido(val) -> bool:
    if val is None and val != 0:
        return False
    try:
        n = int(float(val))
        return n in (5, 10, 15)
    except (ValueError, TypeError):
        return str(val).strip() in ("5", "10", "15")


def load_presupuestos_contratos() -> Optional[pd.DataFrame]:
    path = DATA_DIR / "Presupuestos y contratos.xlsx"
    if not path.exists():
        return None
    df = _read_sheet(path)
    if df.empty:
        return None

    cols = list(df.columns)
    estado_col = find_column_key(cols, ["estado", "Estado", "status"]) or find_column_contains(cols, ["estado", "status"])
    id_col = find_column_key(cols, ["client_id", "client_i", "id_cliente", "id_prospecto"]) or find_column_contains(cols, ["client", "id_cliente"])
    fp_col = find_column_key(cols, ["fecha_presupuesto", "fecha presupuesto", "fecha"]) or find_column_contains(cols, ["fecha", "presupuesto"])
    fc_col = find_column_key(cols, ["fecha_contrato", "fecha_firma"]) or find_column_contains(cols, ["fecha_contrato", "contrato"])

    if estado_col:
        mask = df[estado_col].apply(_es_estado_presupuesto_valido)
        if mask.sum() > 0:
            df = df[mask].copy()

    out = []
    for _, row in df.iterrows():
        pid = row.get(id_col)
        if pd.isna(pid):
            continue
        pid = id_cliente_canonico(pid)
        fp = parse_date(row.get(fp_col)) if fp_col else None
        fc = parse_date(row.get(fc_col)) if fc_col else None
        out.append({
            "id_prospecto": pid,
            "fecha_presupuesto": fp,
            "fecha_contrato": fc,
            "tiene_contrato": False,
        })
    return pd.DataFrame(out) if out else None


def _normalizar_linea_cliente(val) -> Optional[str]:
    if not val or not isinstance(val, str):
        return str(val).strip() if val else None
    s = str(val).strip().upper()
    if s in ("ODONTOL", "ODONTOLOGIA") or s.startswith("ODONTOLOGI"):
        return "Odontologia"
    if s == "EPEM":
        return "Epem"
    return str(val).strip()


def _control_calidad_confirmado(val) -> bool:
    if val is None or str(val).strip() == "":
        return True
    s = str(val).strip().lower()
    import unicodedata
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s == "confirmado"


def _tiene_contrato_val(val) -> bool:
    v = str(val or "").strip()
    return bool(v and re.match(r"^s[ií]$|^yes$|^1$|^true$", v, re.I))


def _es_titular(val) -> bool:
    if val is None or str(val).strip() == "":
        return True
    s = str(val).strip().lower()
    import unicodedata
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s == "titular"


def load_clientes() -> Optional[pd.DataFrame]:
    path = DATA_DIR / "clientes.xlsx"
    if not path.exists():
        return None
    df = _read_sheet(path)
    if df.empty:
        return None

    cols = list(df.columns)
    id_col = find_column_key(cols, ["id", "id_cliente", "client_id", "client_i"]) or find_column_contains(cols, ["id", "client"])
    date_col = find_column_key(cols, ["contract_date", "fecha_contrato"]) or find_column_contains(cols, ["contract", "fecha_contrato"])
    tiene_col = find_column_key(cols, ["tiene_contrato", "si tiene contrato"]) or find_column_contains(cols, ["contrato", "tiene"])
    unidad_col = find_column_key(cols, ["unidad de negocio", "unidad_neg", "unidad"]) or find_column_contains(cols, ["unidad", "negocio"])
    control_col = find_column_key(cols, ["estado de control de calidad", "estado_control"]) or find_column_contains(cols, ["control", "estado_control"])
    tipo_col = find_column_key(cols, ["tipo de cliente", "tipo_cli"]) or find_column_contains(cols, ["tipo_cli", "tipo cliente"])

    out = []
    for _, row in df.iterrows():
        id_raw = row.get(id_col)
        if pd.isna(id_raw):
            continue
        cid = id_cliente_canonico(id_raw)
        contract_date = parse_date(row.get(date_col)) if date_col else None
        tiene_contrato = _tiene_contrato_val(row.get(tiene_col)) if tiene_col else False
        linea = _normalizar_linea_cliente(row.get(unidad_col)) if unidad_col else None
        control_ok = _control_calidad_confirmado(row.get(control_col)) if control_col else True
        titular = _es_titular(row.get(tipo_col)) if tipo_col else True
        out.append({
            "id": cid,
            "contract_date": contract_date,
            "tiene_contrato": tiene_contrato,
            "linea": linea,
            "control_calidad_confirmado": control_ok,
            "es_titular": titular,
        })
    return pd.DataFrame(out) if out else None


def load_clientes_y_telefonos() -> Optional[dict]:
    """Cliente_id -> set de teléfonos normalizados."""
    path = DATA_DIR / "Clientes y telefonos.xlsx"
    if not path.exists():
        return None
    try:
        df = pd.read_excel(path, sheet_name="Consulta1")
    except Exception:
        df = pd.read_excel(path, sheet_name=0)
    if df.empty:
        return None

    cols = list(df.columns)
    id_col = next((c for c in cols if re.search(r"cliente_id|^id$", str(c), re.I)), cols[0])
    tel_col = next((c for c in cols if re.search(r"telefono|tel[eé]fono|phone", str(c), re.I)), None)
    if not tel_col:
        return None

    out = {}
    for _, row in df.iterrows():
        cid = row.get(id_col)
        if pd.isna(cid):
            continue
        cid = id_cliente_canonico(cid)
        tel = row.get(tel_col)
        if pd.isna(tel) or not str(tel).strip():
            continue
        tel = normalizar_telefono(tel)
        if len(tel) >= 8:
            out.setdefault(cid, set()).add(tel)
    return out if out else None


_cache = {}
_use_mock = False


def get_datasets():
    global _cache, _use_mock
    if _cache:
        return _cache
    pautas = load_pautas()
    if pautas is None or pautas.empty:
        _use_mock = True
        _cache = {"pautas": pd.DataFrame(), "agendamientos": pd.DataFrame(), "presupuestosContratos": pd.DataFrame(), "clientes": pd.DataFrame(), "clientesYTelefonos": None}
        return _cache
    _use_mock = False
    _ag = load_agendamientos()
    agendamientos = _ag if _ag is not None else pd.DataFrame()
    _pr = load_presupuestos_contratos()
    presupuestos = _pr if _pr is not None else pd.DataFrame()
    _cl = load_clientes()
    clientes = _cl if _cl is not None else pd.DataFrame()
    cyt = load_clientes_y_telefonos()
    _cache = {
        "pautas": pautas,
        "agendamientos": agendamientos,
        "presupuestosContratos": presupuestos,
        "clientes": clientes,
        "clientesYTelefonos": cyt,
    }
    return _cache


def clear_cache():
    global _cache
    _cache = {}


def is_using_mock() -> bool:
    return _use_mock


def get_excel_headers() -> dict:
    out = {}
    for name, fname in [
        ("pautas", "Pautas-ThinkChat-2025-2026.xlsx"),
        ("agendamientos", "agendamientos-prospectos.xlsx"),
        ("presupuestosContratos", "Presupuestos y contratos.xlsx"),
    ]:
        path = DATA_DIR / fname
        try:
            df = pd.read_excel(path, nrows=0)
            out[name] = list(df.columns)
        except Exception as e:
            out[name] = {"error": str(e)}
    return out
