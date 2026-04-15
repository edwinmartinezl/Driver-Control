# REPORTE ETAPA 3 — PWA + Sync Indicator + Deploy

**Fecha:** 2026-04-15
**URL en producción:** https://drivercontrol-4c88b.web.app
**Proyecto Firebase:** `drivercontrol-4c88b`

---

## Archivos creados / modificados

### Nuevos
- `manifest.json` — Web App Manifest (PWA installable)
- `sw.js` — Service Worker con estrategia cache-first + passthrough Firebase
- `icon-192.svg` — ícono 192×192 con fondo verde + carrito (any + maskable)
- `icon-512.svg` — ícono 512×512 (mismo diseño, escalado)
- `.firebaseignore` — excluye reportes y git del deploy

### Modificados
- `index.html`
  - Meta tags PWA (`manifest`, `apple-touch-icon`, `apple-mobile-web-app-*`)
  - `viewport-fit=cover` para notches
  - Registro del Service Worker al final del HTML
  - `DataProvider` extendido con `syncStatus` + listeners online/offline + wrapper `withSyncStatus`
  - Nuevo componente `SyncDot` consumido dentro del `Header`
  - `Header` ahora se renderiza en **todas las pantallas** (Home, Historial, Perfil), no solo en Home — para que el indicador sea visible siempre
- `firebase.json` — headers específicos para `sw.js` (no-cache + Service-Worker-Allowed), `*.html` y `manifest.json`

---

## Cómo funciona el Service Worker

Archivo: [`sw.js`](../sw.js). Nombre de cache: `driver-control-v1` (bumpear versión cuando quieras invalidar cache de todos los clientes).

### `install`
Pre-cachea el shell de la app:
- `/`, `/index.html`, `/manifest.json`, `/icon-192.svg`, `/icon-512.svg`
- Google Fonts (Nunito)
- CDNs de React 18, ReactDOM, Babel Standalone, Tailwind v4
- CDNs de Firebase app/auth/database v10.12.2

Cada URL se cachea individualmente con `catch` → si una sola falla no tumba la instalación.

### `activate`
Borra cualquier cache cuyo nombre sea distinto a `driver-control-v1`. `clients.claim()` toma control inmediato de las pestañas abiertas.

### `fetch` (estrategias)
1. **Passthrough** para Firebase / Google Auth: hostnames `firebaseio.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firebaseinstallations.googleapis.com`, `accounts.google.com`, `apis.google.com` — el SW **no intercepta**, deja pasar la red. Esto evita cachear tokens, respuestas de sesión y datos en vivo.
2. **Navegación (HTML)** → *Network First* con fallback a cache: intenta traer `/index.html` de la red; si falla (offline), sirve el cacheado. Así tu app carga aunque no tengas señal.
3. **Resto de recursos** → *Cache First*: sirve desde cache si existe, si no va a la red y cachea la respuesta para la próxima vez.

Solo cachea respuestas `status: 200` con tipo `basic` o `cors` para evitar problemas con respuestas opacas.

---

## Indicador de sincronización

El `DataProvider` mantiene el estado `syncStatus` con 4 valores:

| Estado | Cuándo | Visual |
|---|---|---|
| `synced` | Al inicio si hay red, o al terminar una operación OK | Punto verde 8px |
| `saving` | Entre `upsert`/`remove` llamado y resuelto | Spinner verde 10px |
| `offline` | `navigator.onLine === false` o evento `offline` | Punto gris |
| `error` | Falla `upsert`/`remove` | Punto rojo (vuelve a synced tras 3s) |

- Transiciones de color suaves (`transition-colors duration-300`).
- Tooltip nativo con el estado textual (`title` HTML).
- Renderizado dentro del `Header`, a la izquierda del logo, ocupando ~10×10px.
- Escucha `window.online`/`offline` en un `useEffect`. Cuando vuelve la red, pasa automáticamente a `synced` (a menos que esté guardando).

Wrapper `withSyncStatus(op)` centraliza el flujo saving → synced/error, se usa desde `upsert` y `remove`.

---

## Deploy a Firebase Hosting

Firebase Hosting ya está configurado y desplegado. Para releases futuros basta con:

```bash
firebase deploy --only hosting
```

### Primera vez (setup completo desde cero)

```bash
# 1. Instalar firebase-tools
npm install -g firebase-tools

# 2. Loguearse con la cuenta dueña del proyecto
firebase login

# 3. (Ya hecho) Inicializar hosting — solo si el proyecto no tenía firebase.json
# firebase init hosting
#   - Use existing project → drivercontrol-4c88b
#   - Public directory → .
#   - Single-page app → Yes
#   - Set up automatic builds with GitHub → No (por ahora)
#   - Overwrite index.html → No

# 4. Deploy
firebase deploy --only hosting
```

**URL final:** https://drivercontrol-4c88b.web.app (también alias `drivercontrol-4c88b.firebaseapp.com`).

### Qué se sube y qué no
- **Sube:** `index.html`, `manifest.json`, `sw.js`, `icon-192.svg`, `icon-512.svg`, `firebase.json`
- **No sube** (via `.firebaseignore` + `ignore` del `firebase.json`): `colaboraciones/`, `REPORTE_*.md`, `.git/`, `node_modules/`, archivos ocultos.

---

## Íconos: SVG ahora, PNG recomendados a futuro

Actualmente los íconos son SVG. Android Chrome los acepta para instalación PWA; iOS puede tener soporte parcial para `apple-touch-icon` SVG dependiendo de la versión (iOS 16+ OK).

Para máxima compatibilidad y mejor Lighthouse score, genera los PNG:

1. Ve a https://realfavicongenerator.net (o https://www.pwabuilder.com/imageGenerator).
2. Sube `icon-512.svg`.
3. Descarga el paquete y coloca en la raíz: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180).
4. Actualiza `manifest.json` → cambia `icon-192.svg`/`icon-512.svg` por `.png` y `type: "image/png"`.
5. Redeploy.

---

## Instalar la PWA

### Android (Chrome / Edge / Brave)
1. Abre https://drivercontrol-4c88b.web.app
2. Verás un banner "Instalar Driver Control" o el ícono de ⊕ en la barra.
3. Si no aparece: menú (⋮) → **Instalar aplicación** / **Agregar a pantalla de inicio**.
4. La app se abre en modo standalone (sin barra del navegador).

### iPhone / iPad (Safari)
1. Abre https://drivercontrol-4c88b.web.app en Safari (no Chrome iOS).
2. Toca el botón **Compartir** (▢↑).
3. **Agregar a pantalla de inicio**.
4. Confirma el nombre "Driver Control" y **Agregar**.

Después de instalar, el ícono aparece en tu launcher como una app nativa. Al abrir se comporta en standalone (sin barra de URL) y con acceso offline al shell ya cacheado.

---

## Checklist Lighthouse PWA

- ✅ `manifest.json` con name, short_name, start_url, display standalone, theme/bg color, íconos 192 + 512 (any + maskable)
- ✅ Service Worker registrado y activo
- ✅ HTTPS (Firebase Hosting lo da por default)
- ✅ Viewport meta correcto
- ✅ `theme-color` meta tag
- ✅ `apple-touch-icon` y `apple-mobile-web-app-*` meta tags
- ⚠ Íconos en SVG — para 100% perfecto usar PNG (instrucciones arriba)

---

## Pendientes futuros

- **Notificaciones push**: recordatorio diario "¿Ya registraste hoy?" con FCM.
- **Export CSV / PDF** del historial (mensual y completo).
- **Gráficos**: barras por mes, pastel ingreso vs gastos, línea de tendencia semanal.
- **Categorías de mantenimiento**: dropdown (aceite, gomas, frenos, otros) con stats por categoría.
- **Filtros** en historial: por rango de fechas, por nota, por monto mínimo.
- **Multi-moneda** si trabajas en más de un país.
- **Comparativa** entre meses ("este mes vs el mismo mes del año pasado").
- **Metas** semanales/mensuales con barra de progreso.
- **Dark mode adaptativo** según hora del día o preferencia del sistema.
- **Autenticación alternativa**: email/password o número de teléfono como fallback a Google.
- **Background Sync API** para reintentar escrituras fallidas automáticamente cuando vuelve la red.
- **Update prompt** cuando el SW detecte nueva versión disponible ("Actualización lista, toca para recargar").
