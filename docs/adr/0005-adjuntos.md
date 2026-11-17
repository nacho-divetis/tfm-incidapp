# ADR-0005 — Adjuntos tras un puerto `FileStorage`, guardados en la base de datos

- **Estado:** Aceptada · 17/11/2026

## Contexto

Se necesitan fotos y documentos por incidencia. La idea inicial era Google Drive, que se descarta para el TFM (ver ADR-0003). Los PaaS gratuitos o baratos no siempre ofrecen disco persistente.

## Decisión

- La capa de aplicación depende de un puerto `FileStorage { put, get, delete }`.
- Adaptador por defecto: `DatabaseFileStorage` (columna `bytea` en `file_blobs`). Funciona en cualquier proveedor que dé PostgreSQL, sin volúmenes.
- Límite de **5 MB** por archivo y tipos permitidos **JPG, PNG, WEBP y PDF**, validados por **firma de contenido** (_magic bytes_), no por extensión ni `Content-Type`.
- Los archivos **nunca se sirven públicamente**: `/api/attachments/:id` comprueba que el usuario puede ver la incidencia (404 si no) y fija `Content-Type`, `Content-Disposition` y `nosniff`.

## Consecuencias

- ✅ Despliegue trivial y copias de seguridad unificadas con la BD.
- ⚠️ Guardar binarios en la BD no escala a grandes volúmenes. Para producción real bastaría un adaptador S3 o Google Drive que implemente el mismo puerto, sin tocar los casos de uso.
