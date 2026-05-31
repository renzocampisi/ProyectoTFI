# Auditoría del flujo del encargado mobile

**Fecha:** 31/05/2026 · **Auditor:** Claude (Opus) · **Scope:** `RemitoQRPage` (4 escaneos QR)

---

## TL;DR — ¿4 escaneos es demasiado?

**No, son útiles, pero el escaneo #4 hoy es desperdicio.**

Cada escaneo tiene un propósito de **trazabilidad física** distinto (no son autenticación: eso lo hace el login). Sirven para registrar "alguien estuvo físicamente acá en este momento" y para identificar el remito rápido sin buscar en una lista. La fricción no está en *cuántos* escaneos, está en *qué pide cada uno*.

**Mejor camino:** mantener los 4 escaneos, mejorar los flujos UX puntuales.

---

## Mapa de los 4 escaneos

| # | Acción          | Estado actual         | Lo que ve el encargado                                   |
|---|-----------------|-----------------------|----------------------------------------------------------|
| 1 | SALIDA          | CONFIRMADO            | Datos + input conductor + 1 botón                        |
| 2 | LLEGADA         | EN_TRANSITO           | Datos + listas para verificar + 2 botones (OK / Problema) |
| 3 | SALIDA_OBRA     | EN_RETORNO            | Datos + pills retorno por ítem + 1 botón ⭐ PR #33      |
| 4 | LLEGADA_GALPON  | EN_TRANSITO_RETORNO   | Datos + 1 botón                                          |

---

## Hallazgos por escaneo

### 🔴 Escaneo #4 — LLEGADA_GALPON (CRÍTICO, ítem del Word)

**Bug funcional**: hoy es un solo botón "Confirmar llegada al galpón" sin verificación.

El Word pide explícitamente:
> "Cuando llega al galpón, se escanea el QR, y se constata de que llegó y que no, y se reporta el problema si fuera necesario."

**Falta:**
- Lista de items con check "llegó OK / no llegó" para constatar visualmente.
- Botón "reportar problema en el retorno" (ej: herramienta volvió rota aunque salió OK de obra).

**Prioridad: ALTA.** Este es el item del Word pendiente.

---

### 🟡 Escaneo #3 — SALIDA_OBRA (mejorable)

PR #33 lo resolvió OK pero hay margen:

| Problema | Sugerencia |
|---|---|
| Si hay 20 herramientas y todas vuelven OK, hay que tocar 20 pills | **Atajo "Todo vuelve"** al inicio (default ya es VUELVE, pero un botón explícito ayuda y confirma) |
| Input numérico requiere precision en mobile (teclado abierto = pantalla chica) | **Stepper +/- al lado del input** para ajustes rápidos |
| Si te equivocaste de QR escaneado, no hay "volver" sin perder lo tipeado | **Confirmación previa**: "¿Confirmás que este es el remito FS-00027?" (1 tap extra pero evita errores caros) |

**Prioridad: MEDIA** (mejoras de UX, no bug funcional).

---

### 🟡 Escaneo #2 — LLEGADA (mejorable)

Si hay un problema con varios items, el flujo es tedioso:

| Problema | Sugerencia |
|---|---|
| 3 taps por item afectado: checkbox + textarea + sub-toggle "se extravió" | **Sub-toggle "Extraviado" antes del textarea** — orden actual no es el natural |
| Pantalla larga con scroll si hay muchos items | **Sección colapsable**: por defecto solo se ven los items marcados; los demás colapsados |
| Botón "✓ Todo llegó correctamente" es el caso 95% pero no hay confirmación silenciosa | OK como está |

**Prioridad: BAJA** (funcional, solo molesto en casos extremos).

---

### 🟢 Escaneo #1 — SALIDA (OK)

Funciona bien. Único detalle menor:

| Problema | Sugerencia |
|---|---|
| Escribir el nombre del conductor a mano es tedioso en mobile | **Autocomplete** con los últimos 5 conductores usados (guardar en localStorage por usuario) |

**Prioridad: BAJA.**

---

## Bugs/gaps transversales

### 1. Pantalla de éxito sin "escanear otro"
Tras confirmar cualquier escaneo, hay un botón "Ver remito" pero no "Escanear siguiente". Si el encargado tiene que procesar 5 remitos seguidos, vuelve manualmente cada vez al scanner.

**Fix sugerido:** segundo botón "📷 Escanear otro QR" que navega a `/qr`.

### 2. Conductor sin validación de formato
Cualquier string vale (incluyendo "a" o "."). Mínimo 3 caracteres + trim sería razonable.

### 3. Estado de la app post-escaneo
Si el responsable cierra la pestaña justo después de confirmar pero antes de ver la pantalla de éxito, no tiene feedback de qué pasó.

**Fix sugerido:** persistir el último escaneo en localStorage para mostrar "Último escaneo: FS-00027 confirmado a las 14:32" al reabrir.

### 4. Sin manejo de "ya escaneaste hace 5 segundos"
Si el encargado escanea, se procesa, vuelve atrás y escanea el mismo QR de nuevo (porque pensó que no había confirmado), el backend lo rechaza con "no se puede confirmar este estado" — pero el mensaje podría ser más amigable: "Este remito ya fue confirmado hace 5 segundos".

---

## Recomendación final priorizada

1. **🔴 Implementar escaneo #4 completo** (verificación + reportar problema) — *item del Word, prioridad ALTA*.
2. **🟡 Atajo "Todo vuelve" en SALIDA_OBRA** — *MEDIA, 30 min de trabajo*.
3. **🟡 Botón "Escanear otro QR" en pantalla de éxito** — *BAJA, 10 min*.
4. **🟡 Autocomplete del conductor con localStorage** — *BAJA, 20 min*.
5. Resto de mejoras menores quedan como ideas a discutir.

**No reducir a menos de 4 escaneos** — cada uno cumple un rol único de trazabilidad física.
