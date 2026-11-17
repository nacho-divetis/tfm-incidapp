import { OPEN_STATUSES, type IncidentStatus } from '../api/types';

/** Formatos de fecha y número en español (es-ES). */

const LOCALE = 'es-ES';

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const longDateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const relativeFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const numberFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

/** Convierte `YYYY-MM-DD` en una fecha local (sin desfase por zona horaria). */
export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Fecha y hora: 17/11/2026, 10:35 */
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

/** Fecha corta de una marca de tiempo: 17/11/2026 */
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

/** Fecha sin hora (`YYYY-MM-DD`): 17 nov 2026 */
export const formatDay = (isoDate: string) => longDateFmt.format(parseIsoDate(isoDate));

export const formatNumber = (n: number) => numberFmt.format(n);

/** "hace 5 minutos", "ayer", "hace 3 días"… */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'ahora mismo';
  if (abs < 3600) return relativeFmt.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return relativeFmt.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return relativeFmt.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 365) return relativeFmt.format(Math.round(diffSec / (86400 * 30)), 'month');
  return relativeFmt.format(Math.round(diffSec / (86400 * 365)), 'year');
}

/** Hoy en formato `YYYY-MM-DD` (hora local). */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Una incidencia está vencida si sigue abierta y su fecha objetivo ya pasó. */
export function isOverdue(dueDate: string | null, status: IncidentStatus): boolean {
  return !!dueDate && OPEN_STATUSES.includes(status) && dueDate < todayIso();
}

/** Duración en horas → "5,5 h" o "3,2 días". */
export function formatDuration(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 48) return `${formatNumber(hours)} h`;
  return `${formatNumber(hours / 24)} días`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} KB`;
  return `${formatNumber(bytes / (1024 * 1024))} MB`;
}
