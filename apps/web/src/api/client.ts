import type { ApiErrorBody } from './types';

/** Error devuelto por la API (`{ error: { code, message } }`) o por la red. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Mensaje legible para el usuario a partir de cualquier error. */
export function errorMessage(e: unknown, fallback = 'Se ha producido un error inesperado'): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Registra qué hacer cuando la API responde 401 (sesión caducada o inexistente). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Cuerpo JSON (se serializa) o FormData (multipart). */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Si es true, un 401 no dispara el cierre de sesión global (p. ej. login, /auth/me). */
  ignoreUnauthorized?: boolean;
}

const BASE = '/api';

function buildUrl(path: string, query?: RequestOptions['query']) {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '' || value === false) continue;
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ''}`;
}

async function readError(res: Response): Promise<ApiError> {
  let code = 'HTTP_' + res.status;
  let message = defaultMessage(res.status);
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body?.error?.message) {
      message = body.error.message;
      code = body.error.code ?? code;
    }
  } catch {
    // Respuesta sin JSON (proxy caído, HTML…): se usa el mensaje genérico.
  }
  return new ApiError(res.status, code, message);
}

function defaultMessage(status: number) {
  if (status === 401) return 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
  if (status === 403) return 'No tienes permiso para realizar esta acción';
  if (status === 404) return 'No encontrado';
  if (status === 413) return 'El archivo supera el tamaño máximo de 5 MB';
  if (status === 429) return 'Demasiadas peticiones. Espera un momento.';
  if (status >= 500) return 'El servidor no está disponible en este momento. Inténtalo más tarde.';
  return 'La petición no es válida';
}

/**
 * Cliente HTTP de la API. La sesión viaja en una cookie httpOnly del mismo origen,
 * por lo que nunca se manejan tokens en JavaScript.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, ignoreUnauthorized } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // el navegador pone el boundary del multipart
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: payload,
      signal,
      credentials: 'same-origin',
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(
      0,
      'NETWORK',
      'No se puede conectar con el servidor. Comprueba tu conexión.',
    );
  }

  if (!res.ok) {
    const error = await readError(res);
    if (res.status === 401 && !ignoreUnauthorized) onUnauthorized?.();
    throw error;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
