import { DomainError } from './errors.js';

/** Tamaño máximo de un adjunto: 5 MB. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) =>
  bytes.every((b, i) => buf[offset + i] === b);

/**
 * Detecta el tipo real del archivo por su firma ("magic bytes"), sin fiarse
 * de la extensión ni del Content-Type que envía el cliente (OWASP A08).
 */
export function sniffMimeType(buf: Uint8Array): AllowedMimeType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  return null;
}

export function validateAttachment(buf: Uint8Array): AllowedMimeType {
  if (buf.byteLength === 0) throw new DomainError('VALIDATION', 'El archivo está vacío');
  if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new DomainError('FILE_TOO_LARGE', 'El archivo supera el tamaño máximo de 5 MB');
  }
  const mime = sniffMimeType(buf);
  if (!mime) {
    throw new DomainError(
      'UNSUPPORTED_FILE',
      'Tipo de archivo no permitido (solo JPG, PNG, WEBP o PDF)',
    );
  }
  return mime;
}

/** Limpia el nombre de archivo para almacenarlo y devolverlo en cabeceras de forma segura. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'archivo';
  const cleaned = base
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex -- se eliminan a propósito los caracteres de control
    .replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '')
    .trim()
    .slice(0, 150);
  return cleaned || 'archivo';
}
