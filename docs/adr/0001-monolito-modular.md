# ADR-0001 — Monolito modular en lugar de microservicios

- **Estado:** Aceptada · 17/11/2026

## Contexto

IncidApp es una aplicación interna con un único equipo, un dominio acotado (incidencias, usuarios, adjuntos) y un plazo corto. Los microservicios aportan despliegue y escalado independientes, pero a cambio de complejidad operativa: red, consistencia eventual, observabilidad distribuida y varios pipelines.

## Decisión

Un **monolito modular**: un único proceso Node que expone la API REST y sirve el frontend compilado, con los módulos separados por capas (Clean Architecture, ADR-0002) y por áreas (auth, usuarios, incidencias, adjuntos, auditoría).

## Consecuencias

- ✅ Un único despliegue, una base de datos y transacciones locales (p. ej. incidencia + evento de historial en la misma transacción).
- ✅ Frontend y API en el mismo origen: cookies `sameSite=strict` sin CORS.
- ⚠️ El escalado es vertical o por réplicas del monolito completo. Para el volumen esperado es suficiente.
- 🔁 Si algún módulo lo necesitara (p. ej. almacenamiento de adjuntos), los puertos de la capa de aplicación permiten extraerlo sin tocar el dominio.
