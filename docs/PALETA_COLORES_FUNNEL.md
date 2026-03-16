# Paleta de colores para el funnel – Basada en redes comerciales

Referencia según buenas prácticas de embudos de ventas y documentación de funnel en redes comerciales (SlideGenius, CleanChart, Domo, Infogram).

---

## Principios de documentación

1. **Gradiente frío → cálido**: Colores **fríos** (azul, verde) en etapas **iniciales** (confianza, calma, entrada) y colores **cálidos** (naranja, rojo) hacia el **cierre** (urgencia, acción).
2. **Un color por etapa**: Cada fase debe distinguirse claramente de la anterior.
3. **Azul** = confianza y profesionalidad, ideal para inicio del recorrido.
4. **Rojo / naranja** = urgencia y decisión, ideal para etapas de cierre.
5. **Verde** = éxito y conversión, ideal para la etapa final (socio/cliente).
6. **Alto contraste** con el fondo para legibilidad (importante con tema oscuro `--surface`).

---

## Mapeo con tu embudo

Según tus reglas de negocio:

| Orden | Etapa en la app | Momento en el funnel | Color sugerido | Hex (ejemplo) |
|-------|-----------------|----------------------|----------------|----------------|
| 0 | Universo total | Conjunto (segmentado) | — | META / viejos / otras (ver abajo) |
| 1 | Prospectos | Contacto por pautas (entrada) | **Azul** – confianza, inicio | `#3b82f6` → `#2563eb` |
| 2 | Agendamientos | Turno agendado (interés) | **Cyan / azul claro** – siguiente paso | `#0ea5e9` → `#0284c7` |
| 3 | Presupuestos | En clínica (consideración) | **Ámbar / naranja** – evaluación | `#f59e0b` → `#d97706` |
| 4 | Contratos | Firma (decisión) | **Naranja-rojo** – compromiso | `#ea580c` → `#c2410c` |
| 5 | Clientes únicos | Socio (conversión) | **Verde** – éxito, cierre | `#22c55e` → `#16a34a` |

---

## Segmentos dentro de cada barra (META, Prospectos viejos, Otras fuentes)

- **META (de prospectos)**: Mantener un color fijo en todas las barras para que la leyenda sea coherente.  
  - Opción A (actual): **Ámbar/dorado** `#fbbf24` → `#d97706`.  
  - Opción B (identidad red): **Azul Meta** `#1877F2` (si quieres asociar explícitamente a la red).
- **Prospectos viejos**: **Cyan/teal** `#22d3ee` → `#0891b2` (secundario, ya diferenciado).
- **Otras fuentes**: Un color que contraste con META y con el fondo; por ejemplo **violeta** `#a78bfa` → `#7c3aed` o **azul** `#60a5fa` → `#2563eb` (actual).

---

## Resumen de paleta sugerida (etapas)

| Etapa | Color | Uso en UI |
|-------|--------|-----------|
| Prospectos | Azul | Barra “solo” o segmento principal de la etapa |
| Agendamientos | Cyan | Igual |
| Presupuestos | Ámbar/Naranja | Igual |
| Contratos | Naranja-rojo | Igual |
| Clientes únicos | Verde | Igual |

Así el funnel sigue el flujo **frío → cálido → verde (éxito)** que recomienda la documentación de redes comerciales y se entiende de un vistazo dónde está cada etapa y cuál es la de cierre.

Si quieres, en el siguiente paso puedo proponerte los cambios concretos en `Funnel1View.module.css` para aplicar esta paleta por etapa manteniendo tus segmentos (META, prospectos viejos, otras fuentes).
