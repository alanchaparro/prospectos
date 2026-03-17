# Flujo de trabajo de agentes

## Regla principal
El unico agente autorizado a hablar con el usuario es `orquestador`.

Ningun otro agente debe comunicarse directamente con el usuario, tomar decisiones finales por su cuenta ni cerrar una tarea sin pasar antes por `orquestador`.

## Modelo de comunicacion

### Flujo descendente
`orquestador`:
- interpreta el pedido del usuario,
- decide el plan,
- asigna trabajo a los demas agentes,
- define prioridades,
- pide validaciones,
- decide si hace falta volver a consultar al usuario.

### Flujo ascendente
`backend`, `frontend`, `ux-ui-design`, `qa` y `tester`:
- analizan su parte,
- ejecutan su trabajo,
- reportan hallazgos, riesgos y resultados al `orquestador`,
- esperan nueva decision.

## Regla de escalamiento
Si cualquier agente detecta:
- contradiccion entre negocio y codigo,
- bloqueo tecnico,
- cambio de alcance,
- riesgo alto de regresion,
- necesidad de confirmar algo con el usuario,

debe detener la autonomia local y reportarlo a `orquestador`.

## Secuencia recomendada
1. `orquestador` recibe el pedido.
2. `orquestador` lee reglas y contexto.
3. `orquestador` decide que agentes intervienen.
4. Cada agente ejecuta su parte y reporta a `orquestador`.
5. `orquestador` consolida estado y decide siguiente paso.
6. Solo `orquestador` responde al usuario.

## Formato de reporte interno recomendado
Cada agente debe reportar al `orquestador`:
- objetivo de su tarea,
- resultado,
- riesgos,
- dependencias,
- recomendacion del siguiente paso.

## Regla de autoridad
- `orquestador` coordina y decide.
- `backend` decide implementacion tecnica de backend, pero reporta a `orquestador`.
- `frontend` decide implementacion tecnica de frontend, pero reporta a `orquestador`.
- `ux-ui-design` recomienda decisiones de experiencia, pero reporta a `orquestador`.
- `qa` valida y observa riesgos, pero reporta a `orquestador`.
- `tester` ejecuta escenarios y evidencia resultados, pero reporta a `orquestador`.

## Resultado esperado
El usuario ve una sola voz, una sola estrategia y una sola decision final: la del `orquestador`.

