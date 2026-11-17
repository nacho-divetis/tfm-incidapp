import type { IncidentStatus, Priority, Role } from '../api/types';

/** Etiquetas legibles y colores consistentes, centralizados para toda la interfaz. */

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  ABIERTA: 'Abierta',
  EN_CURSO: 'En curso',
  PENDIENTE_TERCERO: 'Pendiente de tercero',
  RESUELTA: 'Resuelta',
  CERRADA: 'Cerrada',
  RECHAZADA: 'Rechazada',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  DIRECCION: 'Dirección',
  RESPONSABLE: 'Responsable',
  USUARIO: 'Usuario',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  ADMIN: 'Toda la empresa. Gestiona usuarios y auditoría.',
  DIRECCION: 'Toda la empresa, solo lectura.',
  RESPONSABLE: 'Gestiona las incidencias de sus departamentos.',
  USUARIO: 'Crea y trabaja incidencias de sus departamentos.',
};

/** Clases del badge (fondo, texto, borde) por estado. */
export const STATUS_BADGE: Record<IncidentStatus, string> = {
  ABIERTA: 'bg-blue-50 text-blue-800 ring-blue-200',
  EN_CURSO: 'bg-violet-50 text-violet-800 ring-violet-200',
  PENDIENTE_TERCERO: 'bg-amber-50 text-amber-900 ring-amber-200',
  RESUELTA: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  CERRADA: 'bg-slate-100 text-slate-700 ring-slate-300',
  RECHAZADA: 'bg-rose-50 text-rose-800 ring-rose-200',
};

/** Color sólido (barras, puntos) por estado. */
export const STATUS_COLOR: Record<IncidentStatus, string> = {
  ABIERTA: 'bg-blue-500',
  EN_CURSO: 'bg-violet-500',
  PENDIENTE_TERCERO: 'bg-amber-500',
  RESUELTA: 'bg-emerald-500',
  CERRADA: 'bg-slate-400',
  RECHAZADA: 'bg-rose-500',
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  BAJA: 'bg-slate-100 text-slate-700 ring-slate-300',
  MEDIA: 'bg-sky-50 text-sky-800 ring-sky-200',
  ALTA: 'bg-orange-50 text-orange-800 ring-orange-200',
  CRITICA: 'bg-red-600 text-white ring-red-700',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  BAJA: 'bg-slate-400',
  MEDIA: 'bg-sky-500',
  ALTA: 'bg-orange-500',
  CRITICA: 'bg-red-600',
};

export const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  DIRECCION: 'bg-teal-50 text-teal-800 ring-teal-200',
  RESPONSABLE: 'bg-blue-50 text-blue-800 ring-blue-200',
  USUARIO: 'bg-slate-100 text-slate-700 ring-slate-300',
};

/** Acción de auditoría → texto legible. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGIN_FAILED: 'Inicio de sesión fallido',
  PASSWORD_CHANGED: 'Cambio de contraseña',
  PASSWORD_RESET: 'Restablecimiento de contraseña',
  USER_CREATED: 'Usuario creado',
  USER_UPDATED: 'Usuario modificado',
  INCIDENT_CREATED: 'Incidencia creada',
  INCIDENT_UPDATED: 'Incidencia editada',
  INCIDENT_STATUS_CHANGED: 'Cambio de estado',
  INCIDENT_ASSIGNED: 'Asignación',
  ATTACHMENT_UPLOADED: 'Adjunto subido',
  ATTACHMENT_DELETED: 'Adjunto borrado',
};

export const AUDIT_ENTITY_LABEL: Record<string, string> = {
  incident: 'Incidencia',
  user: 'Usuario',
  attachment: 'Adjunto',
};

/** Nombre legible de cada campo editable de una incidencia (eventos UPDATED). */
export const INCIDENT_FIELD_LABEL: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  typeId: 'Tipo',
  priority: 'Prioridad',
  departmentId: 'Departamento',
  thirdParty: 'Tercero implicado',
  dueDate: 'Fecha objetivo',
  assigneeId: 'Asignación',
};

export const SORT_LABEL = {
  recent: 'Más recientes',
  oldest: 'Más antiguas',
  priority: 'Prioridad',
  due: 'Vencimiento',
} as const;

/**
 * Reglas de la máquina de estados que afectan a la interfaz (reflejo de
 * apps/api/src/domain/incident-status.ts). Quién puede hacer cada transición lo decide la API
 * y llega en `permissions.allowedTransitions`.
 */
export const isReopen = (from: IncidentStatus, to: IncidentStatus) =>
  to === 'EN_CURSO' && (from === 'RESUELTA' || from === 'CERRADA' || from === 'RECHAZADA');

export const transitionRequiresComment = (from: IncidentStatus, to: IncidentStatus) =>
  to === 'RESUELTA' || to === 'RECHAZADA' || isReopen(from, to);

/** Texto del botón para cada transición. */
export function transitionLabel(from: IncidentStatus, to: IncidentStatus): string {
  if (isReopen(from, to)) return 'Reabrir';
  switch (to) {
    case 'EN_CURSO':
      return from === 'PENDIENTE_TERCERO' ? 'Retomar' : 'Iniciar trabajo';
    case 'PENDIENTE_TERCERO':
      return 'Pendiente de tercero';
    case 'RESUELTA':
      return 'Resolver';
    case 'CERRADA':
      return 'Cerrar';
    case 'RECHAZADA':
      return 'Rechazar';
    default:
      return STATUS_LABEL[to];
  }
}
