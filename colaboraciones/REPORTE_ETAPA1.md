# REPORTE ETAPA 1 — Shell UI + Lógica Local Driver Control

**Fecha:** 2026-04-15
**Entregable:** `index.html` (un solo archivo, listo para Firebase Hosting)
**Alcance real:** la etapa creció más allá del shell de UI — incluye también toda la lógica de cálculos con persistencia local vía `localStorage`, modo oscuro y edición/eliminación de registros.

---

## Pantallas construidas

1. **Login** — logo de carrito (vehículo real con carrocería, techo, ventanas y ruedas en SVG inline), título "Driver Control", subtítulo, botón pill blanco "Continuar con Google" con ícono G oficial de 4 colores. Actualmente puenteado: la app arranca directo en el dashboard para agilizar el trabajo.
2. **Home** — header con logo + avatar, tarjeta del mes actual con gradiente verde mostrando totales reales (Ganado / Gasolina / Mantenimiento / Neto grande), sección "Esta semana" con todos los registros del domingo en curso, total de la semana en el encabezado, empty state amigable cuando no hay datos, FAB flotante centrado con "+".
3. **Registrar / Editar día** (bottom sheet) — overlay oscuro, sheet blanco animado, campos: fecha (default hoy), ingreso Uber, gasto gasolina, **mantenimiento** (nuevo) y **nota** en textarea (nuevo). Preview en tiempo real del neto calculado (verde si ≥ 0, rojo si negativo). Detecta colisiones de fecha y avisa. En modo edición aparece botón rojo "Eliminar registro".
4. **Historial** — lista de meses reales agrupados desde los registros. Cada mes muestra nombre, año, neto y barra de progreso proporcional al mejor mes. Al entrar en un mes: totales en grid 2×2 (Ganado, Gasolina, Mantenimiento, Neto) y todos sus días ordenados desc.
5. **Perfil** — avatar, nombre/email mock, stats del usuario (cantidad de registros, ganado total, neto total), toggle de **modo oscuro**, moneda, versión, botón pill rojo "Cerrar sesión".

---

## Lógica de cálculos implementada

- **Modelo de registro:** `{ fecha, ingreso, gasolina, mantenimiento, nota }`.
- **Neto por día:** `ingreso - gasolina - mantenimiento`.
- **Persistencia:** `localStorage` clave `driver-control-records-v1`. Guardado automático en cada cambio vía `useEffect`.
- **Upsert por fecha:** si ya existe registro para esa fecha, se sobrescribe (con aviso previo en el sheet).
- **Selectores puros:**
  - `sumRecords(recs)` → `{ ingreso, gasolina, mantenimiento, neto }`
  - `recordsOfMonth(recs, year, month)`
  - `recordsOfCurrentWeek(recs)` (desde el domingo a las 00:00)
- **Totales reactivos** en MonthCard, Home, Historial y Perfil vía `useMemo`.
- **Contexto de datos:** `DataProvider` expone `records`, `upsert`, `remove`.

---

## Fila de registro — layout tipo tabla

Cada fila es una mini-tabla legible:

- Encabezado: fecha (izquierda) y Neto (derecha).
- Cuerpo: grid de 3 columnas con fondo gris suave, separadas por líneas verticales — `Ingreso` (verde), `Gasolina` (rojo), `Mantenim.` (amarillo #D4A200).
- Pie opcional: nota del día con ícono 📝 truncada a una línea.
- Tap abre el sheet en modo edición.

---

## Modo oscuro

- Toggle iOS-style en Perfil (☀️ ↔ 🌙) con persistencia en localStorage (`driver-control-theme`).
- Implementado con CSS cascada + clase `.dark` en `.app-frame` — no requiere repintar componentes.
- Paleta oscura: fondo app `#141414`, tarjetas `#222`, inputs `#1B1B1B`, texto `#F0F0F0`, bordes `#333`. Acentos Duolingo verde/rojo/amarillo sin cambios.
- Inputs con placeholder adaptado, `calendar-picker-indicator` invertido en WebKit.
- También tiñe el fondo del body para el frame centrado en desktop.

---

## Decisiones de diseño

- **Frame móvil 430px** centrado con fondo gris en desktop, borde pleno en móvil — sensación de app nativa.
- **Efectos 3D Duolingo** (sombra inferior sólida) en los botones de acción (Guardar, Cerrar sesión). **Quitados** del FAB y de la tarjeta del mes por pedido del usuario — ahora usan sombra difusa normal, se ven más planos y modernos.
- **Tailwind v4 browser build** (`@tailwindcss/browser@4`) + Babel Standalone + React 18 UMD — cero build step.
- **Nunito** 400/600/700/800/900 desde Google Fonts.
- **Formato moneda** vía `Intl` con `es-DO`, firma separada para valores negativos.
- **FAB pequeño** (48px) visible solo en Home e Historial, oculto en Perfil.
- **Iconografía** 100% SVG inline (Home, Calendario, Perfil, Back, Plus, Close, G de Google, logo carrito).

---

## Problemas encontrados y soluciones

- **Filas de registro se solapaban** (fecha + 3 columnas + neto en una sola línea se rompía en 375px). Se resolvió partiendo la fila en dos: encabezado fecha/neto arriba y mini-tabla de 3 columnas abajo con `whitespace-nowrap`.
- **Dark mode con Tailwind arbitrario (`text-[#3C3C3C]`)**: los valores arbitrarios no heredan de variables CSS. Se resolvió con selectores escapados `.app-frame.dark .text-\[\#3C3C3C\]` en un bloque CSS estático — una sola vez, y todo cambia.
- **Zona horaria en `todayISO`**: `new Date().toISOString()` daba la fecha UTC, no la local. Se corrigió restando el offset antes de `slice(0,10)`.
- **Colisión de fechas en upsert**: al editar cambiando la fecha a una que ya existe, se detecta y se avisa con warning amarillo antes de sobrescribir.
- **Botón Guardar habilitado incluso sin datos**: se añadió validación — solo se habilita si hay fecha + al menos un valor/nota.

---

## Pendientes para Etapa 2

- **Firebase Auth** real con Google sign-in (reactivar la pantalla Login).
- **Firestore** para sincronizar registros entre dispositivos; migrar datos existentes de localStorage al primer login.
- **Queries por rango de fechas** en lugar de cargar todo y filtrar en memoria (cuando el historial crezca).
- **Export / Import** CSV para respaldos.
- **PWA**: manifest, service worker, ícono de instalación, soporte offline.
- **Gráficos** en Historial (evolución mensual, comparativa ingreso/gasto).
- **Categorías de mantenimiento** (cambio de aceite, gomas, frenos) con tags.
- **Filtros y búsqueda** en el historial (por nota, por rango).
- **Deploy** a Firebase Hosting.
