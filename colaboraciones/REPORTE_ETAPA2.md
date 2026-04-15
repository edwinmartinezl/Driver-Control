# REPORTE ETAPA 2 — Firebase Auth + Realtime Database

**Fecha:** 2026-04-15
**Entregable:** `index.html` (mismo archivo único, Etapa 1 + Firebase)
**Proyecto Firebase ya configurado:** `drivercontrol-4c88b`

---

## Cambios vs Etapa 1

### Nuevos providers de contexto
- **`AuthProvider`**: escucha `onAuthStateChanged`, expone `user`, `ready`, `signInGoogle()` y `signOut()`. Procesa `getRedirectResult` en el mount para recuperar sesión post-redirect móvil.
- **`DataProvider` reescrito**: ya no usa `useState + localStorage`. Ahora suscribe un listener `onValue` en `users/{uid}/registros` y mantiene el array en sincronía en tiempo real. Al desmontar o cambiar de usuario, desuscribe con `ref.off`.
- **Jerarquía de providers**: `ThemeProvider → AuthProvider → DataProvider → App`.

### Navegación gobernada por auth
- Se quitó el bypass (`screen === "app"` fijo).
- `App` ahora decide qué renderizar según el estado:
  - `!ready` → **Splash** (logo + spinner verde) mientras Firebase resuelve la sesión inicial.
  - `!user` → **Login**.
  - `user` → Home / Historial / Perfil como Etapa 1.
- Al cerrar sesión, `onAuthStateChanged` dispara y React vuelve a Login automáticamente.

### Login real con fallback móvil
- Botón "Continuar con Google" llama a `auth.signInWithPopup(GoogleAuthProvider)`.
- Si el browser bloquea el popup (Samsung Internet, WebViews, iOS Safari con restricciones), atrapa los códigos `auth/popup-blocked`, `auth/popup-closed-by-user`, `auth/cancelled-popup-request`, `auth/operation-not-supported-in-this-environment` y hace fallback automático a `signInWithRedirect`.
- Spinner en el botón mientras procesa; mensaje rojo "No pudimos conectarte. Intenta de nuevo." si falla por otra causa.

### Estructura en RTDB
```
users/
  {uid}/
    meta/
      migrated: true
    registros/
      2026-04-15: {
        ingreso, gasolina, mantenimiento, nota, neto, updatedAt
      }
```
La clave del registro es la `fechaISO` → upsert natural, sin duplicados por diseño. `updatedAt` usa `firebase.database.ServerValue.TIMESTAMP` para no depender del reloj del cliente.

### Reglas de seguridad (incluidas como comentario al inicio del HTML)
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```
Cada usuario solo puede leer/escribir en su propio árbol `users/{uid}/…`.

### Feedback en el sheet
- Estado `saving` + `saveError` en `RegisterSheet`.
- Botón "Guardar" muestra spinner blanco mientras la promesa resuelve.
- Si falla (red caída, permisos), aparece mensaje rojo "No se pudo guardar. Revisa tu conexión." y el sheet **no se cierra** — el usuario puede reintentar sin perder sus datos.

### Avatar y datos reales
- **Header**: `user.photoURL` como `<img>` circular con `referrerPolicy="no-referrer"` (evita bloqueos de Google al servir la foto). Si no hay foto, muestra la inicial.
- **Perfil**: foto + `displayName` + `email` reales. El botón "Cerrar sesión" llama a `auth.signOut()`.

---

## Migración localStorage → Firebase

Función `migrateLocalStorageIfNeeded(uid)` ejecutada una sola vez por usuario:

1. Lee `users/{uid}/meta/migrated` en Firebase.
2. Si ya es `true` → skip.
3. Si no, lee la clave `driver-control-records-v1` del localStorage.
4. Si hay datos: construye un `update()` masivo con todos los registros mapeados al nuevo esquema (calculando `neto` y añadiendo `updatedAt`).
5. Marca `meta/migrated = true`.
6. Borra la clave del localStorage.

**Resultado**: si Edwin abrió la app en Etapa 1 y registró días, la primera vez que entre con Google esos datos se suben automáticamente a su cuenta y nunca más se vuelven a migrar (aunque quede algo en otro navegador). Si abre la app en un segundo dispositivo, esos datos locales también se migran a su cuenta y se fusionan (upsert por fecha).

La función está envuelta en try/catch para que un fallo nunca tumbe la app.

---

## Manejo de popup / redirect en móvil

### Flujo popup (desktop + la mayoría de browsers móviles modernos)
```
click → signInWithPopup → popup de Google → cierra → onAuthStateChanged → Home
```

### Flujo redirect (fallback móvil)
```
click → signInWithPopup falla → catch → signInWithRedirect
→ página entera va a accounts.google.com
→ vuelve con token en la URL
→ al montar: getRedirectResult() procesa el token
→ onAuthStateChanged → Home
```

`getRedirectResult()` se llama en el `useEffect` del `AuthProvider` sin `await`, con `.catch(() => {})` para no ensuciar la consola cuando no hay redirect pendiente. Si hubo éxito, Firebase ya dejó la sesión internamente y el listener `onAuthStateChanged` dispara solo.

---

## Instrucciones para activar el proyecto real

La config ya está pegada en el archivo con las credenciales de `drivercontrol-4c88b`. Para que funcione de extremo a extremo:

### 1. Activar Google como proveedor de Auth
1. Firebase Console → **Authentication** → pestaña **Sign-in method**.
2. Click en **Google** → **Habilitar**.
3. Selecciona un email de soporte (el tuyo).
4. **Guardar**.

### 2. Configurar dominios autorizados
Mismo menú → **Settings** → **Authorized domains**. Deben estar:
- `localhost` (para pruebas locales)
- El dominio de Firebase Hosting cuando despliegues (ej: `drivercontrol-4c88b.web.app`)
- Cualquier dominio custom que añadas.

### 3. Crear la Realtime Database
1. Firebase Console → **Realtime Database** → **Create Database**.
2. Región (recomendado: el más cercano a ti).
3. **Start in locked mode**.
4. En la pestaña **Rules**, pega las reglas que están como comentario al inicio del `index.html` y publica.

### 4. Probar
1. Abre `index.html` en el navegador (preferiblemente sirviéndolo con un mini server, no `file://`, porque Firebase Auth requiere http/https).
   - Un comando rápido: `python3 -m http.server 8000` y abre `http://localhost:8000`.
2. Click "Continuar con Google" → popup → elige cuenta.
3. Si tenías datos en localStorage de la Etapa 1 → aparecen migrados automáticamente.
4. Agrega/edita/borra registros → revisa en Firebase Console → Realtime Database que aparecen bajo `users/{tu_uid}/registros/…`.

### 5. Desplegar en Firebase Hosting (opcional)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: .   (el root donde está index.html)
# Single-page app: Yes
firebase deploy
```

---

## Consideraciones offline / resiliencia

- `onValue` mantiene el último snapshot en cache mientras no haya red; si escribes offline, Firebase encola y sincroniza al volver la conexión.
- Todas las escrituras (`upsert`, `remove`) retornan promesas que solo resuelven cuando el servidor confirma. Por eso el spinner y el mensaje de error: si el usuario está realmente sin red, verá el error y podrá reintentar.
- Si el listener de lectura falla, se loggea con `console.warn` y se deja el array vacío — la app no crashea.

---

## Pendientes para Etapa 3

- **PWA**: `manifest.json` + service worker para instalación y offline completo (Firebase SDK ya es offline-first, pero el shell HTML también debería cachearse).
- **Indicador de sincronización** (ícono en el header): "sincronizado", "guardando", "sin conexión".
- **Gráficos** mensuales/semanales en Historial.
- **Export CSV / PDF** de los registros.
- **Categorías de gastos** (mantenimiento → aceite / gomas / frenos / otros).
- **Filtros** en el historial (buscar por nota, rango de fechas).
- **Recordatorios**: notificación diaria "¿Ya registraste hoy?".
- **Compartir** vista resumen del mes como imagen.
- **Soporte multi-moneda** (por si el driver trabaja en otro país).
