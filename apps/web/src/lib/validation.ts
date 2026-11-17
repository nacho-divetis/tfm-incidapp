/**
 * Validación en cliente coherente con los esquemas de la API (apps/api/src/application/schemas.ts).
 * La API vuelve a validar todo: esto solo mejora la experiencia de uso.
 */

export const LIMITS = {
  titleMin: 5,
  titleMax: 150,
  descriptionMin: 10,
  descriptionMax: 5000,
  thirdPartyMax: 150,
  commentMax: 5000,
  passwordMin: 8,
  passwordMax: 128,
  nameMin: 2,
  nameMax: 120,
} as const;

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',');
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export interface IncidentFormValues {
  title: string;
  description: string;
  typeId: string;
  priority: string;
  departmentId: string;
  thirdParty: string;
  dueDate: string;
}

export type FormErrors<T> = Partial<Record<keyof T, string>>;

export function validateIncident(v: IncidentFormValues): FormErrors<IncidentFormValues> {
  const errors: FormErrors<IncidentFormValues> = {};
  const title = v.title.trim();
  const description = v.description.trim();
  if (title.length < LIMITS.titleMin) {
    errors.title = `El título debe tener al menos ${LIMITS.titleMin} caracteres`;
  } else if (title.length > LIMITS.titleMax) {
    errors.title = `El título no puede superar ${LIMITS.titleMax} caracteres`;
  }
  if (description.length < LIMITS.descriptionMin) {
    errors.description = `La descripción debe tener al menos ${LIMITS.descriptionMin} caracteres`;
  } else if (description.length > LIMITS.descriptionMax) {
    errors.description = `La descripción no puede superar ${LIMITS.descriptionMax} caracteres`;
  }
  if (!v.typeId) errors.typeId = 'Selecciona un tipo de incidencia';
  if (!v.priority) errors.priority = 'Selecciona una prioridad';
  if (!v.departmentId) errors.departmentId = 'Selecciona un departamento';
  if (v.thirdParty.trim().length > LIMITS.thirdPartyMax) {
    errors.thirdParty = `Máximo ${LIMITS.thirdPartyMax} caracteres`;
  }
  if (v.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.dueDate)) {
    errors.dueDate = 'Fecha no válida';
  }
  return errors;
}

/** Comprueba un archivo antes de subirlo. Devuelve el error o `null` si es válido. */
export function validateAttachmentFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const extOk = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mimeOk = !file.type || ACCEPTED_MIME.includes(file.type);
  if (!extOk || !mimeOk) return `«${file.name}»: solo se admiten imágenes JPG, PNG, WEBP o PDF`;
  if (file.size === 0) return `«${file.name}» está vacío`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `«${file.name}» supera el tamaño máximo de 5 MB`;
  return null;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;

export function validatePassword(pw: string): string | null {
  if (pw.length < LIMITS.passwordMin) {
    return `La contraseña debe tener al menos ${LIMITS.passwordMin} caracteres`;
  }
  if (pw.length > LIMITS.passwordMax) return 'La contraseña es demasiado larga';
  return null;
}

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
