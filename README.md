# IncidApp — Gestión interna de incidencias

> Trabajo Fin de Máster · **Máster de Desarrollo con IA** (BIG school) · 2026

IncidApp es una aplicación web para **registrar y hacer seguimiento de las incidencias** de una empresa: transporte, proveedores, clientes, calidad, técnicas, administrativas e internas. Cada persona accede **solo a la información de su departamento**, las incidencias avanzan por un **flujo de estados** con historial completo, se pueden adjuntar **fotos y documentos**, y un **administrador** gestiona usuarios y consulta la auditoría.

|               |             |
| ------------- | ----------- |
| 🌐 **Demo**   | _pendiente_ |
| 🖥️ **Slides** | _pendiente_ |
| 🎬 **Vídeo**  | _pendiente_ |

---

## Índice

1. [Usuarios de prueba](#usuarios-de-prueba)
2. [Funcionalidades principales](#funcionalidades-principales)
3. [Stack tecnológico](#stack-tecnológico)
4. [Instalación y ejecución](#instalación-y-ejecución)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Arquitectura y decisiones](#arquitectura-y-decisiones)
7. [Seguridad](#seguridad)
8. [Calidad y tests](#calidad-y-tests)
9. [Despliegue](#despliegue)
10. [Cómo se aplica el máster](#cómo-se-aplica-el-máster)

---

## Usuarios de prueba

Contraseña de todos: **`Demo1234!`**

| Rol                             | Email                             | Qué puede hacer                                                            |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Administrador                   | `admin@incidapp.demo`             | Todo + gestión de usuarios y auditoría                                     |
| Dirección                       | `direccion@incidapp.demo`         | Ver todas las incidencias y el panel (solo lectura)                        |
| Responsable (Logística)         | `resp.logistica@incidapp.demo`    | Gestionar las incidencias de Logística: asignar, cerrar, rechazar, reabrir |
| Usuario (Logística)             | `usuario.logistica@incidapp.demo` | Crear incidencias de Logística y trabajar las suyas                        |
| Responsable (Calidad y Compras) | `resp.calidad@incidapp.demo`      | Gestionar Calidad y Compras                                                |
| Usuario (Atención al Cliente)   | `usuario.atc@incidapp.demo`       | Crear y trabajar reclamaciones de clientes                                 |

Hay más usuarios demo (`resp.atc`, `resp.tecnico`, `usuario.tecnico`, `usuario.compras`, `usuario.admin`, `resp.produccion`, todos `@incidapp.demo`). La pantalla de login incluye un acceso rápido a todos ellos.

> 💡 **Prueba recomendada:** entra como `usuario.logistica`, copia la URL de una incidencia de Atención al Cliente que veas como `direccion`, y comprueba que responde "no encontrada".

## Funcionalidades principales

- 🔐 **Login** con email y contraseña, sesión segura y cambio de contraseña.
- 👥 **Roles y departamentos:** `ADMIN`, `DIRECCION`, `RESPONSABLE` y `USUARIO`. Cada usuario ve solo las incidencias de sus departamentos.
- 📝 **Incidencias** con código correlativo (`INC-2026-0001`), tipo, prioridad, departamento, tercero implicado (proveedor/cliente/transportista) y fecha objetivo.
- 🔄 **Flujo de estados:** Abierta → En curso ⇄ Pendiente de tercero → Resuelta → Cerrada, más Rechazada y reapertura. Las transiciones se validan y algunas exigen comentario.
- 👤 **Asignación** a personas del departamento.
- 🕒 **Línea de tiempo** con todos los cambios, comentarios, asignaciones y adjuntos.
- 📎 **Adjuntos** (JPG, PNG, WEBP y PDF de hasta 5 MB) con previsualización y descarga protegida.
- 🔎 **Búsqueda y filtros** por estado, tipo, departamento, prioridad, "asignadas a mí" y texto.
- 📊 **Panel** con incidencias abiertas, vencidas y críticas, distribución por estado, tipo, departamento y prioridad, y tiempo medio de resolución.
- 🛡️ **Administración:** usuarios (alta, roles, departamentos, desactivación, restablecer contraseña) y **auditoría** de accesos y acciones.

Estructura de empresa tipo incluida: 9 departamentos (Dirección, Administración, Comercial, Atención al Cliente, Compras, Logística, Producción, Técnico y Calidad) y 7 tipos de incidencia.

## Stack tecnológico

| Capa            | Tecnología                                                                             |
| --------------- | -------------------------------------------------------------------------------------- |
| Frontend        | React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS 4               |
| Backend         | Node.js 22, TypeScript, Fastify 5, Zod                                                 |
| Base de datos   | PostgreSQL con Drizzle ORM. **PGlite** (PostgreSQL embebido) en desarrollo y tests     |
| Seguridad       | scrypt, JWT en cookie httpOnly, Helmet, rate limiting                                  |
| Tests           | Vitest (dominio + API sobre BD real en memoria) y Playwright (E2E, escritorio y móvil) |
| Calidad         | ESLint, Prettier, GitHub Actions, Dependabot                                           |
| Infraestructura | Docker (multi-stage), despliegue en PaaS con PostgreSQL gestionado                     |

## Instalación y ejecución

**Requisitos:** Node.js ≥ 22. **No hace falta instalar PostgreSQL ni Docker**: en local se usa una base de datos PostgreSQL embebida.

```bash
git clone <url-del-repo> incidapp && cd incidapp
npm install
npm run dev        # API en http://localhost:3000 y web en http://localhost:5173
```

La primera vez se crea la base de datos en `apps/api/data/pgdata` y se cargan los datos demo automáticamente.

Otros comandos:

| Comando                                                                                                | Descripción                                                                         |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `npm test`                                                                                             | Tests del backend (dominio + API)                                                   |
| `npm run test:e2e`                                                                                     | Tests E2E con Playwright (compila y arranca la app con una BD en memoria)           |
| `npm run typecheck`                                                                                    | Comprobación de tipos de API y web                                                  |
| `npm run lint`                                                                                         | ESLint                                                                              |
| `npm run build && npm start`                                                                           | Build de producción y arranque (la API sirve también el frontend en el puerto 3000) |
| `docker build -t incidapp . && docker run -p 3000:3000 -e JWT_SECRET=... -e DATABASE_URL=... incidapp` | Ejecución con Docker                                                                |

Variables de entorno (ver [`.env.example`](.env.example)):

| Variable                         | Descripción                                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`                   | `postgres://…` en producción; vacío = PGlite local                         |
| `JWT_SECRET`                     | Secreto de firma de la sesión (obligatorio en producción, ≥ 32 caracteres) |
| `SEED_DEMO`                      | `true` para cargar los datos demo si la BD está vacía                      |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador inicial si no se cargan datos demo                           |
| `PORT`                           | Puerto HTTP (3000 por defecto)                                             |

## Estructura del proyecto

```
.
├── apps/
│   ├── api/                      # Backend
│   │   ├── src/
│   │   │   ├── domain/           # Reglas de negocio puras: estados, permisos, archivos
│   │   │   ├── application/      # Casos de uso, puertos y validación
│   │   │   ├── infrastructure/   # BD (Drizzle), repositorios, seguridad, HTTP (Fastify)
│   │   │   ├── composition/      # Inyección de dependencias y arranque
│   │   │   └── main.ts
│   │   ├── drizzle/              # Migraciones SQL
│   │   └── test/                 # Tests de dominio y de API
│   └── web/                      # Frontend React
│       └── src/ (api, auth, components, pages, lib)
├── docs/
│   ├── specs/                    # Spec-Driven Development: requisitos, diseño, tareas
│   └── adr/                      # Decisiones de arquitectura
├── .github/workflows/ci.yml      # Integración continua
├── AGENTS.md                     # Contexto para agentes de IA
└── Dockerfile
```

## Arquitectura y decisiones

Monolito modular con **Clean Architecture** (puertos y adaptadores). El dominio no depende de ningún framework: los permisos (`domain/policies.ts`) y la máquina de estados (`domain/incident-status.ts`) son funciones puras con tests unitarios. Los detalles están en [`docs/specs/02-diseno.md`](docs/specs/02-diseno.md).

| ADR                                         | Decisión                                                   |
| ------------------------------------------- | ---------------------------------------------------------- |
| [0001](docs/adr/0001-monolito-modular.md)   | Monolito modular en lugar de microservicios                |
| [0002](docs/adr/0002-clean-architecture.md) | Clean Architecture con puertos y adaptadores               |
| [0003](docs/adr/0003-sesion-jwt-cookie.md)  | Autenticación propia con JWT en cookie httpOnly            |
| [0004](docs/adr/0004-base-de-datos.md)      | PostgreSQL en producción, PGlite en desarrollo y tests     |
| [0005](docs/adr/0005-adjuntos.md)           | Adjuntos tras un puerto `FileStorage`, validados por firma |

## Seguridad

Medidas alineadas con **OWASP Top 10**. Detalle en [`02-diseno.md §6`](docs/specs/02-diseno.md):

- **Control de acceso** en el servidor, en cada caso de uso. Una incidencia de otro departamento responde **404** (no revela que existe), y la matriz de permisos está cubierta por tests.
- **Contraseñas** con scrypt y sal; **sesión** JWT en cookie `httpOnly`, `sameSite=strict` y `secure`; usuario recargado en cada petición.
- **Límite de intentos** de login (10/min por IP) y mensajes genéricos.
- **Validación** de todas las entradas con Zod y consultas parametrizadas (Drizzle).
- **Adjuntos** validados por su contenido real (firma), con tamaño máximo y descarga autorizada.
- **Cabeceras** de seguridad (Helmet/CSP) y errores sin detalles internos.
- **Auditoría** de inicios de sesión, cambios de usuarios, incidencias y adjuntos.
- **Dependencias:** Dependabot y `npm audit` en la CI.

## Calidad y tests

```bash
npm test
```

- **Dominio:** máquina de estados, matriz de permisos y validación de archivos.
- **API (integración):** autenticación, _rate limiting_, gestión de usuarios, visibilidad por departamento, flujo completo de estados, asignación, edición y traslado, adjuntos (incluido un HTML disfrazado de PNG) y panel. Los tests de API se ejecutan contra una base de datos **PostgreSQL real en memoria** (PGlite), sin _mocks_.
- **E2E (Playwright):** flujo completo de una incidencia entre dos roles (crear → comentar → iniciar → resolver con comentario obligatorio → cerrar), permisos (404 fuera del departamento, Dirección solo lectura, administración solo para ADMIN) y uso en móvil.
- **Git hooks (Husky):** `pre-commit` con ESLint + Prettier sobre los archivos modificados y `pre-push` con tipos + tests.
- **CI:** cada _push_ ejecuta lint, tipos, tests, build, auditoría de dependencias, E2E y build de la imagen Docker.

## Despliegue

_pendiente: URL y proveedor._

La aplicación es un único contenedor (API + frontend) que necesita una base de datos PostgreSQL:

1. Crear la base de datos PostgreSQL y obtener `DATABASE_URL`.
2. Desplegar el repositorio (Dockerfile) con `NODE_ENV=production`, `JWT_SECRET`, `DATABASE_URL` y `SEED_DEMO=true`.
3. Las migraciones y los datos demo se aplican solos al arrancar.

## Cómo se aplica el máster

| Módulo                          | Dónde se ve en el proyecto                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Ingeniería de software       | Requisitos con historias de usuario y criterios de aceptación, MoSCoW y diagramas UML (estados, ER) en [`docs/specs`](docs/specs); principios SOLID en los casos de uso y puertos |
| 2. Arquitectura                 | Clean Architecture, puertos y adaptadores, _composition root_, monolito modular y ADRs                                                                                            |
| 4. Herramientas                 | Desarrollo asistido con agentes de código; Dependabot                                                                                                                             |
| 5. Flujo de desarrollo con IA   | [`AGENTS.md`](AGENTS.md) como contexto del agente; especificaciones como base de conocimiento                                                                                     |
| 6. Calidad                      | Tests de dominio e integración, lint y _quality gates_ en CI, AuthN/AuthZ con tokens "a mano", OWASP aplicado, variables de entorno y secretos                                    |
| 7. Infraestructura y cloud      | Docker multi-stage, GitHub Actions, despliegue en la nube con PostgreSQL gestionado                                                                                               |
| 8. Seguridad                    | Security by design (permisos en el dominio), OWASP Top 10, validación de entradas, auditoría y DevSecOps en la CI                                                                 |
| 9. Desarrollo potenciado por IA | **Spec-Driven Development**: spec → diseño → tareas → implementación → verificación, con trazabilidad HU → test                                                                   |

---

Autor: Nacho Izquierdo · 2026
