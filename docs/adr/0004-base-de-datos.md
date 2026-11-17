# ADR-0004 — PostgreSQL (real en producción, PGlite embebido en desarrollo y tests)

- **Estado:** Aceptada · 17/11/2026

## Contexto

Hace falta una base de datos relacional con transacciones, JSONB e integridad referencial. El entorno de desarrollo no tiene Docker ni PostgreSQL instalados, y los tests deben ser rápidos y aislados.

## Decisión

- **PostgreSQL** como motor y **Drizzle ORM** (consultas tipadas y parametrizadas, migraciones SQL generadas con `drizzle-kit`).
- `DATABASE_URL=postgres://…` → PostgreSQL real (producción).
- Sin `DATABASE_URL` → **PGlite** (PostgreSQL compilado a WebAssembly) persistido en `data/pgdata`: se trabaja en local sin instalar nada.
- Tests de API → PGlite **en memoria** (`memory://`), una BD limpia por fichero de tests.
- Las migraciones se aplican automáticamente al arrancar.

## Consecuencias

- ✅ Mismo dialecto SQL en todos los entornos; los tests ejercitan SQL real (no _mocks_).
- ✅ Cualquier persona clona el repo, ejecuta `npm install && npm run dev` y funciona.
- ⚠️ PGlite es monoproceso: no es apto para producción, solo para desarrollo y tests.
