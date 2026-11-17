import { ApiError, apiFetch } from './client';
import type {
  AssignableUser,
  Attachment,
  AuditResponse,
  Catalog,
  CreateIncidentInput,
  CreateUserInput,
  DashboardStats,
  Incident,
  IncidentDetail,
  IncidentListParams,
  IncidentListResponse,
  IncidentStatus,
  UpdateIncidentInput,
  UpdateUserInput,
  User,
} from './types';

/** Funciones tipadas para cada endpoint de la API REST (docs/specs/02-diseno.md §5). */
export const api = {
  // --- Autenticación ---
  login: (email: string, password: string) =>
    apiFetch<{ user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      ignoreUnauthorized: true,
    }).then((r) => r.user),

  logout: () =>
    apiFetch<{ ok: true }>('/auth/logout', { method: 'POST', ignoreUnauthorized: true }),

  /** Usuario de la sesión, o `null` si no hay sesión válida. */
  me: async (): Promise<User | null> => {
    try {
      const r = await apiFetch<{ user: User }>('/auth/me', { ignoreUnauthorized: true });
      return r.user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ ok: true }>('/auth/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  catalog: () => apiFetch<Catalog>('/catalog'),

  dashboard: () => apiFetch<DashboardStats>('/dashboard'),

  // --- Incidencias ---
  listIncidents: (params: IncidentListParams, signal?: AbortSignal) =>
    apiFetch<IncidentListResponse>('/incidents', { query: { ...params }, signal }),

  getIncident: (id: string) => apiFetch<IncidentDetail>(`/incidents/${encodeURIComponent(id)}`),

  createIncident: (input: CreateIncidentInput) =>
    apiFetch<{ incident: Incident }>('/incidents', { method: 'POST', body: input }).then(
      (r) => r.incident,
    ),

  updateIncident: (id: string, input: UpdateIncidentInput) =>
    apiFetch<{ incident: Incident }>(`/incidents/${id}`, { method: 'PATCH', body: input }).then(
      (r) => r.incident,
    ),

  changeStatus: (id: string, status: IncidentStatus, comment?: string) =>
    apiFetch<{ incident: Incident }>(`/incidents/${id}/status`, {
      method: 'POST',
      body: { status, comment: comment?.trim() || null },
    }).then((r) => r.incident),

  assign: (id: string, assigneeId: string | null) =>
    apiFetch<{ incident: Incident }>(`/incidents/${id}/assign`, {
      method: 'POST',
      body: { assigneeId },
    }).then((r) => r.incident),

  comment: (id: string, text: string) =>
    apiFetch<{ ok: true }>(`/incidents/${id}/comments`, { method: 'POST', body: { text } }),

  uploadAttachment: (incidentId: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return apiFetch<{ attachment: Omit<Attachment, 'uploadedByName'> }>(
      `/incidents/${incidentId}/attachments`,
      { method: 'POST', body: form },
    ).then((r) => r.attachment);
  },

  deleteAttachment: (id: string) => apiFetch<void>(`/attachments/${id}`, { method: 'DELETE' }),

  assignableUsers: (departmentId: string) =>
    apiFetch<{ users: AssignableUser[] }>('/users/assignable', { query: { departmentId } }).then(
      (r) => r.users,
    ),

  // --- Administración ---
  listUsers: () => apiFetch<{ users: User[] }>('/admin/users').then((r) => r.users),

  createUser: (input: CreateUserInput) =>
    apiFetch<{ user: User }>('/admin/users', { method: 'POST', body: input }).then((r) => r.user),

  updateUser: (id: string, input: UpdateUserInput) =>
    apiFetch<{ user: User }>(`/admin/users/${id}`, { method: 'PATCH', body: input }).then(
      (r) => r.user,
    ),

  resetUserPassword: (id: string, password: string) =>
    apiFetch<{ ok: true }>(`/admin/users/${id}/password`, { method: 'POST', body: { password } }),

  audit: (page: number, pageSize: number) =>
    apiFetch<AuditResponse>('/admin/audit', { query: { page, pageSize } }),
};

/** URL para previsualizar (inline) o descargar un adjunto. */
export const attachmentUrl = (id: string, download = false) =>
  `/api/attachments/${id}${download ? '?download=1' : ''}`;
