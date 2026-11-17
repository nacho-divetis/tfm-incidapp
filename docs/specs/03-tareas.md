# Spec 03 — Plan de tareas

| #   | Tarea                                                                                                | HU            | Estado |
| --- | ---------------------------------------------------------------------------------------------------- | ------------- | ------ |
| T1  | Spec de requisitos, diseño, ADRs y `AGENTS.md`                                                       | —             | ✅     |
| T2  | Monorepo, TypeScript, configuración y BD (Drizzle + PGlite/PostgreSQL + migraciones)                 | RNF-04        | ✅     |
| T3  | Dominio: modelo, máquina de estados, políticas de permisos, validación de archivos + tests unitarios | HU-05, RNF-01 | ✅     |
| T4  | Autenticación (scrypt, JWT en cookie, rate limit), sesión y cambio de contraseña                     | HU-01         | ✅     |
| T5  | Gestión de usuarios (ADMIN) con salvaguarda del último administrador                                 | HU-02         | ✅     |
| T6  | Incidencias: crear, listar con filtros y ámbito, detalle, editar, trasladar                          | HU-03, 04, 07 | ✅     |
| T7  | Estados, asignación y comentarios con línea de tiempo                                                | HU-05, 06, 08 | ✅     |
| T8  | Adjuntos con validación por firma y descarga protegida                                               | HU-09         | ✅     |
| T9  | Cuadro de mando y auditoría                                                                          | HU-10, 11     | ✅     |
| T10 | Datos demo generados con los casos de uso                                                            | RNF-06        | ✅     |
| T11 | Tests de API: autenticación, matriz de permisos, flujo completo, adjuntos                            | RNF-03        | ✅     |
| T12 | Frontend React: login, panel, listado, detalle, alta, administración, perfil                         | Todas         | ✅     |
| T13 | CI (GitHub Actions), Dockerfile, lint y _hooks_ de Git                                               | RNF-03        | ✅     |
| T14 | Tests E2E (Playwright) de los flujos principales                                                     | RNF-03        | ✅     |
| T15 | Despliegue de la demo y README final                                                                 | RNF-06        | ⏳     |
| T16 | Slides y vídeo                                                                                       | —             | ⏳     |
