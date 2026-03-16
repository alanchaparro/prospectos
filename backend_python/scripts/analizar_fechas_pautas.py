#!/usr/bin/env python3
"""
Analiza las columnas de fecha en Pautas-ThinkChat para confirmar
que 'Fecha de ingreso' (o la que usamos) representa el primer contacto.
"""
import sys
from pathlib import Path

# Permitir importar app desde el padre
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
PAUTAS_PATH = DATA_DIR / "Pautas-ThinkChat-2025-2026.xlsx"


def main():
    if not PAUTAS_PATH.exists():
        print(f"No encontrado: {PAUTAS_PATH}")
        return

    print("=" * 60)
    print("ANÁLISIS DE FECHAS EN PAUTAS (primer contacto)")
    print("=" * 60)

    # Leer primera hoja, primeras filas
    df = pd.read_excel(PAUTAS_PATH, sheet_name=0, header=0, nrows=5000)
    print(f"\nColumnas en el archivo ({len(df.columns)}):")
    for i, col in enumerate(df.columns):
        print(f"  {i+1}. {repr(col)}")

    # Columnas cuyo nombre sugiere fecha
    date_keywords = ["fecha", "ingreso", "date", "creacion", "alta", "ultimo", "último", "contacto"]
    date_cols = []
    for col in df.columns:
        c = str(col).lower().strip()
        if any(kw in c for kw in date_keywords):
            date_cols.append(col)

    print(f"\nColumnas que parecen FECHA (por nombre):")
    for col in date_cols:
        sample = df[col].dropna().head(5).tolist()
        sample_str = [str(s)[:50] for s in sample]
        print(f"  - {repr(col)}")
        print(f"    Muestra: {sample_str}")

    # ¿Existe algo como "fecha de ingreso"?
    ingreso_like = [c for c in df.columns if "ingreso" in str(c).lower()]
    print(f"\nColumnas con 'ingreso' en el nombre: {[repr(c) for c in ingreso_like]}")

    if ingreso_like:
        col = ingreso_like[0]
        non_null = df[col].dropna()
        print(f"  Valores no nulos: {len(non_null)} de {len(df)}")
        print(f"  Ejemplos: {non_null.head(10).tolist()}")

    # Conclusión
    print("\n" + "=" * 60)
    print("CONCLUSIÓN")
    print("=" * 60)
    print("El backend usa la PRIMERA columna cuyo nombre contiene (fecha|ingreso|date|...)")
    print("y que tenga un valor parseable como fecha en cada fila.")
    if ingreso_like:
        print(f"En tu archivo, la columna tipo 'ingreso' es: {repr(ingreso_like[0])}")
        print("Si esa columna es la de 'primer contacto / fecha de ingreso', está correcto.")
    else:
        print("No se encontró columna con 'ingreso'; se usará la primera columna de fecha detectada.")
    print("Para que el 'primer contacto' sea canónico, conviene que esa columna sea 'Fecha de ingreso'.")


if __name__ == "__main__":
    main()
