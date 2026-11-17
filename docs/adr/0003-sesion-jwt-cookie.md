# ADR-0003 — Autenticación propia con JWT en cookie httpOnly

- **Estado:** Aceptada · 17/11/2026 (sustituye la idea inicial de login con Google Workspace)

## Contexto

El TFM exige poder entregar **usuario y contraseña de prueba** y un despliegue accesible para el corrector. Un login federado con la cuenta de Google de la empresa no lo permitiría.

## Decisión

- Login con email y contraseña. Las contraseñas se guardan con **scrypt** y sal aleatoria (librería estándar de Node) y se comparan en tiempo constante.
- La sesión es un **JWT firmado (HS256)** con 8 h de validez, enviado en una cookie `httpOnly`, `sameSite=strict` y `secure` en producción. Nunca se expone a JavaScript (protege frente a XSS).
- En **cada petición** se recarga el usuario desde la BD: un cambio de rol o una desactivación tienen efecto inmediato aunque el token siga vigente.
- Límite de 10 intentos de login por minuto e IP, mensaje de error genérico (no permite enumerar usuarios) y auditoría de intentos fallidos.

## Consecuencias

- ✅ Sin dependencias externas de identidad; la demo funciona con usuarios ficticios.
- ✅ `sameSite=strict` + mismo origen mitigan CSRF sin tokens adicionales.
- ⚠️ El cierre de sesión borra la cookie, pero un token robado sería válido hasta caducar (8 h). Mitigación: la recarga del usuario permite invalidar desactivándolo.
- 🔁 En una versión productiva se podría añadir OIDC (Google Workspace) como un adaptador más.
