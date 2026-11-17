# AGENTS.md — Guía para agentes de IA en IncidApp

Contexto para cualquier agente de código (Claude Code, Copilot, Codex…) que trabaje en este repositorio.

## Qué es

IncidApp: webapp interna de gestión de incidencias con roles por departamento, flujo de estados, adjuntos y auditoría. TFM del Máster de Desarrollo con IA.

## Fuente de verdad (Spec-Driven Development)

1. `docs/specs/01-requisitos.md`: historias de usuario (HU-xx) y criterios de aceptación (CA). **Todo cambio funcional empieza actualizando la spec.**
2. `docs/specs/02-diseno.md`: arquitectura, modelo de datos, máquina de estados, matriz de permisos y API.
3. `docs/specs/03-tareas.md`: plan de tareas y su estado.
4. `docs/adr/`: decisiones de arquitectura. No contradigas un ADR sin proponer uno nuevo.

## Estructura

- `apps/api`: Node 22+, TypeScript estricto, Fastify 5, Drizzle ORM, Zod, Vitest.
  - `src/domain`: puro, **sin imports externos**. Permisos en `policies.ts`, estados en `incident-status.ts`.
  - `src/application`: casos de uso (`use-cases/`), puertos (`ports.ts`) y validación (`schemas.ts`).
  - `src/infrastructure`: BD (`db/`), repositorios, seguridad, HTTP (`http/`).
  - `src/composition`: inyección de dependencias y arranque.
- `apps/web`: React 19, Vite, React Router, TanStack Query, Tailwind 4.

## Reglas

- **Autorización siempre en los casos de uso**, usando `domain/policies.ts`. El frontend solo oculta botones con los `permissions` que devuelve la API.
- Incidencia fuera de ámbito → `notFound` (404), nunca 403, para no revelar que existe.
- Toda entrada externa se valida con Zod en `application/schemas.ts`.
- Cambios de esquema: editar `infrastructure/db/schema.ts` y ejecutar `npm run db:generate -w apps/api` (nunca editar a mano migraciones ya publicadas).
- Cada caso de uso que modifica datos registra auditoría (`deps.audit.log`) y, si afecta a una incidencia, un evento de historial.
- Imports con extensión `.js` (ESM NodeNext).
- Textos de la interfaz y mensajes de error en **español**.
- No guardes secretos en el repo; usa `.env` (ver `.env.example`).

## Comandos

| Acción                 | Comando                           |
| ---------------------- | --------------------------------- |
| Instalar               | `npm install`                     |
| Desarrollo (API + web) | `npm run dev`                     |
| Tests                  | `npm test`                        |
| Tipos                  | `npm run typecheck`               |
| Lint / formato         | `npm run lint` · `npm run format` |
| Build producción       | `npm run build && npm start`      |

## Definición de hecho

- Criterios de aceptación de la HU cubiertos y con test (dominio y/o API).
- `npm run typecheck`, `npm run lint` y `npm test` en verde.
- Spec y README actualizados si cambia el comportamiento.
