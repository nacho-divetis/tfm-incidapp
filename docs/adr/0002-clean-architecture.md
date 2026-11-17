# ADR-0002 — Clean Architecture con puertos y adaptadores

- **Estado:** Aceptada · 17/11/2026

## Contexto

Las reglas de negocio más delicadas (quién puede ver o hacer qué y el flujo de estados) deben ser fáciles de probar y no depender del framework HTTP ni de la base de datos.

## Decisión

Organizar `apps/api/src` en cuatro capas con la regla de dependencias apuntando hacia dentro:

| Capa              | Contenido                                                                                                            | Depende de              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `domain/`         | Modelo, máquina de estados, políticas de permisos, validación de archivos, errores                                   | Nada                    |
| `application/`    | Casos de uso, esquemas de entrada (Zod) y **puertos** (interfaces de repositorios, almacenamiento, hash, auditoría…) | `domain`                |
| `infrastructure/` | Adaptadores: Drizzle/PostgreSQL, almacenamiento de archivos, scrypt, Fastify (HTTP)                                  | `application`, `domain` |
| `composition/`    | _Composition root_: instancia los adaptadores e inyecta dependencias                                                 | Todas                   |

## Consecuencias

- ✅ El dominio se prueba con tests unitarios puros (máquina de estados, matriz de permisos).
- ✅ Cambiar el almacenamiento de adjuntos (BD → disco → nube) o la base de datos solo afecta a `infrastructure/` y `composition/`.
- ✅ La autorización vive en los casos de uso: ningún adaptador (HTTP, scripts, _seed_) puede saltársela. El propio _seed_ de datos demo usa los casos de uso.
- ⚠️ Algo más de código "de fontanería" (interfaces, mapeos) que un enfoque CRUD directo.
