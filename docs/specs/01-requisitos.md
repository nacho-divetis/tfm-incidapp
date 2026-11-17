# Spec 01 — Requisitos de IncidApp

> Especificación funcional (Spec-Driven Development). Es la **fuente de verdad**: el código y los tests se derivan de aquí.
> Estado: **Aprobada** · Versión 1.0 · 17/11/2026

## 1. Visión

IncidApp es una aplicación web interna para **registrar y hacer seguimiento de las incidencias** de una empresa (transporte, proveedores, clientes, calidad, técnicas, administrativas e internas). Cada persona accede **solo a la información de su departamento**, las incidencias avanzan por un **flujo de estados** con historial completo y se pueden adjuntar **fotos y documentos**.

## 2. Actores y roles

| Rol           | Ámbito de visibilidad | Descripción                                                                             |
| ------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `ADMIN`       | Toda la empresa       | Administra usuarios y consulta la auditoría. Puede operar sobre cualquier incidencia.   |
| `DIRECCION`   | Toda la empresa       | Solo lectura: consulta incidencias y el cuadro de mando.                                |
| `RESPONSABLE` | Sus departamentos     | Gestiona las incidencias de sus departamentos: asigna, edita, rechaza, cierra y reabre. |
| `USUARIO`     | Sus departamentos     | Crea incidencias, comenta, adjunta y hace avanzar las que creó o tiene asignadas.       |

Un usuario tiene **un rol** y pertenece a **uno o varios departamentos** (salvo `ADMIN` y `DIRECCION`, cuyo ámbito es global).

## 3. Catálogos (empresa tipo)

**Departamentos:** Dirección (DIR), Administración y Finanzas (ADM), Comercial (COM), Atención al Cliente / Postventa (ATC), Compras (COMP), Logística y Almacén (LOG), Producción / Operaciones (PROD), Departamento Técnico (TEC), Calidad (CAL).

**Tipos de incidencia** (con departamento por defecto): Transporte (LOG), Proveedor (COMP), Cliente / Reclamación (ATC), Calidad (CAL), Técnica / Instalación (TEC), Administrativa (ADM), Interna / Operativa (PROD).

**Prioridades:** `BAJA`, `MEDIA`, `ALTA`, `CRITICA`.

## 4. Historias de usuario y criterios de aceptación

### HU-01 Iniciar sesión (Must)

Como empleado quiero iniciar sesión con email y contraseña para acceder a mis incidencias.

- CA1: Con credenciales correctas se crea una sesión (cookie `httpOnly`) y se redirige al panel.
- CA2: Con credenciales incorrectas se muestra un error genérico (no se revela si el email existe).
- CA3: Un usuario desactivado no puede iniciar sesión.
- CA4: Tras 10 intentos por minuto desde la misma IP, el login se bloquea temporalmente (429).
- CA5: Puedo cerrar sesión y cambiar mi contraseña (mínimo 8 caracteres).

### HU-02 Gestionar usuarios (Must) — `ADMIN`

- CA1: Puedo listar, crear y editar usuarios (nombre, email, rol, departamentos, activo).
- CA2: Puedo restablecer la contraseña de un usuario.
- CA3: Un `RESPONSABLE` o `USUARIO` debe tener al menos un departamento.
- CA4: No puedo desactivarme ni quitarme el rol `ADMIN` a mí mismo (el sistema nunca se queda sin administrador).
- CA5: Ningún otro rol puede acceder a la gestión de usuarios (403).

### HU-03 Crear incidencia (Must) — `ADMIN`, `RESPONSABLE`, `USUARIO`

- CA1: Indico título, descripción, tipo, prioridad y, opcionalmente, departamento, tercero implicado (proveedor/cliente/transportista) y fecha objetivo.
- CA2: Si no indico departamento se usa el del tipo; debe ser uno de **mis** departamentos (salvo `ADMIN`).
- CA3: Se genera un código legible único y correlativo por año: `INC-2026-0001`.
- CA4: La incidencia nace en estado `ABIERTA` y queda registrado el evento de creación.

### HU-04 Consultar incidencias (Must)

- CA1: Veo un listado paginado solo con las incidencias de mi ámbito.
- CA2: Puedo filtrar por estado, tipo, departamento, prioridad, "asignadas a mí" y texto (código, título, tercero).
- CA3: Si accedo por URL a una incidencia fuera de mi ámbito obtengo "no encontrada" (404), sin revelar que existe.
- CA4: El detalle muestra los datos, los adjuntos y la **línea de tiempo** (creación, cambios, comentarios, asignaciones, adjuntos) en orden cronológico.

### HU-05 Flujo de estados (Must)

Estados: `ABIERTA`, `EN_CURSO`, `PENDIENTE_TERCERO`, `RESUELTA`, `CERRADA`, `RECHAZADA`.

- CA1: Solo se permiten las transiciones definidas en `02-diseno.md` §3.
- CA2: Pasar a `RECHAZADA` o `RESUELTA`, o reabrir (volver a `EN_CURSO` desde `RESUELTA`, `CERRADA` o `RECHAZADA`) exige un comentario.
- CA3: Solo `RESPONSABLE`/`ADMIN` pueden rechazar, cerrar y reabrir.
- CA4: Un `USUARIO` solo puede cambiar el estado de incidencias que creó o tiene asignadas.
- CA5: Se registran las fechas de resolución y cierre.

### HU-06 Asignar (Must) — `RESPONSABLE`, `ADMIN`

- CA1: Puedo asignar la incidencia a un usuario activo del departamento de la incidencia, o desasignarla.
- CA2: La asignación queda en la línea de tiempo.

### HU-07 Editar (Should)

- CA1: `RESPONSABLE`/`ADMIN` pueden editar título, descripción, tipo, prioridad, tercero, fecha objetivo y departamento (traslado).
- CA2: El creador (`USUARIO`) puede editar mientras la incidencia esté `ABIERTA`, sin trasladarla.
- CA3: No se edita una incidencia `CERRADA` o `RECHAZADA` (hay que reabrirla).

### HU-08 Comentar (Must)

- CA1: Cualquier rol con ámbito, salvo `DIRECCION`, puede comentar (1–5000 caracteres).

### HU-09 Adjuntos (Must)

- CA1: Puedo adjuntar imágenes (JPG, PNG, WEBP) y PDF de hasta 5 MB.
- CA2: El tipo se valida por el **contenido** (firma del archivo), no solo por la extensión.
- CA3: Solo quien puede ver la incidencia puede descargar o previsualizar sus adjuntos.
- CA4: Pueden borrar un adjunto quien lo subió o `RESPONSABLE`/`ADMIN`, salvo en incidencias cerradas.

### HU-10 Cuadro de mando (Should)

- CA1: Muestra, dentro de mi ámbito: total abiertas, vencidas, críticas abiertas, distribución por estado, tipo, departamento y prioridad, tiempo medio de resolución y últimas incidencias.

### HU-11 Auditoría (Should) — `ADMIN`

- CA1: Se registran inicios de sesión (correctos y fallidos), cambios de contraseña, gestión de usuarios y acciones sobre incidencias y adjuntos, con actor, fecha e IP.
- CA2: El `ADMIN` puede consultarla paginada.

## 5. Requisitos no funcionales

| ID     | Requisito                                                                                                                                                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-01 | **Seguridad:** autorización en el servidor en cada operación; contraseñas con hash `scrypt` + sal; cookies `httpOnly`, `sameSite=strict`, `secure` en producción; cabeceras de seguridad (Helmet); validación de entradas con esquemas; límite de intentos de login. |
| RNF-02 | **Arquitectura:** Clean Architecture; el dominio no depende de frameworks ni de la base de datos.                                                                                                                                                                    |
| RNF-03 | **Calidad:** tests automáticos del dominio, casos de uso y API (incluida la matriz de permisos); CI en cada push.                                                                                                                                                    |
| RNF-04 | **Portabilidad:** se ejecuta en local sin instalar nada más que Node (PostgreSQL embebido) y en producción con PostgreSQL real.                                                                                                                                      |
| RNF-05 | **Usabilidad:** interfaz en español, adaptable a móvil.                                                                                                                                                                                                              |
| RNF-06 | **Demo:** datos de ejemplo y un usuario por rol para la evaluación.                                                                                                                                                                                                  |

## 6. Fuera de alcance (v1)

Login con proveedores externos (Google), notificaciones por email, integración con Google Drive, IA, exportaciones, aplicación móvil nativa.
