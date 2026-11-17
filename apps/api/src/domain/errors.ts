/**
 * Errores de dominio. La capa HTTP los traduce a códigos de estado,
 * pero el dominio no sabe nada de HTTP.
 */
export type DomainErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_TRANSITION'
  | 'UNSUPPORTED_FILE'
  | 'FILE_TOO_LARGE';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const validationError = (message: string) => new DomainError('VALIDATION', message);
export const unauthorized = (message = 'No autenticado') =>
  new DomainError('UNAUTHORIZED', message);
export const forbidden = (message = 'No tienes permiso para realizar esta acción') =>
  new DomainError('FORBIDDEN', message);
/** Recursos con su mensaje en español (concordancia de género). */
const NOT_FOUND_MESSAGES = {
  Recurso: 'Recurso no encontrado',
  Incidencia: 'Incidencia no encontrada',
  Adjunto: 'Adjunto no encontrado',
  Usuario: 'Usuario no encontrado',
} as const;
export type NotFoundResource = keyof typeof NOT_FOUND_MESSAGES;
export const notFound = (what: NotFoundResource = 'Recurso') =>
  new DomainError('NOT_FOUND', NOT_FOUND_MESSAGES[what]);
export const conflict = (message: string) => new DomainError('CONFLICT', message);
