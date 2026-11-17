import { z } from 'zod';
import { PRIORITIES, ROLES, STATUSES } from '../domain/model.js';
import { DomainError } from '../domain/errors.js';

/**
 * Esquemas de validación de entrada de los casos de uso (OWASP A03).
 * Se validan en la capa de aplicación para que ningún adaptador pueda saltárselos.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({
      error: (issue) =>
        issue.input === undefined ? `${label} es obligatorio` : `${label} no es válido`,
    })
    .trim()
    .min(min, `${label} debe tener al menos ${min} caracteres`)
    .max(max, `${label} no puede superar ${max} caracteres`);

const uuid = (label: string) => z.string().uuid(`${label} no es válido`);
const email = z.string().trim().toLowerCase().email('Email no válido').max(200);
export const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida (AAAA-MM-DD)')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Fecha no válida');

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Indica tu contraseña actual').max(128),
  newPassword: password,
});

export const createUserSchema = z.object({
  email,
  name: trimmed(2, 120, 'El nombre'),
  role: z.enum(ROLES),
  password,
  departmentIds: z.array(uuid('Departamento')).max(20).default([]),
});

export const updateUserSchema = z
  .object({
    name: trimmed(2, 120, 'El nombre'),
    role: z.enum(ROLES),
    active: z.boolean(),
    departmentIds: z.array(uuid('Departamento')).max(20),
  })
  .partial();

export const resetPasswordSchema = z.object({ password });

export const createIncidentSchema = z.object({
  title: trimmed(5, 150, 'El título'),
  description: trimmed(10, 5000, 'La descripción'),
  typeId: uuid('Tipo'),
  priority: z.enum(PRIORITIES).default('MEDIA'),
  departmentId: uuid('Departamento').optional(),
  thirdParty: z.string().trim().max(150).optional().nullable(),
  dueDate: isoDate.optional().nullable(),
});

export const updateIncidentSchema = z
  .object({
    title: trimmed(5, 150, 'El título'),
    description: trimmed(10, 5000, 'La descripción'),
    typeId: uuid('Tipo'),
    priority: z.enum(PRIORITIES),
    departmentId: uuid('Departamento'),
    thirdParty: z.string().trim().max(150).nullable(),
    dueDate: isoDate.nullable(),
  })
  .partial();

export const changeStatusSchema = z.object({
  status: z.enum(STATUSES),
  comment: z.string().trim().max(5000).optional().nullable(),
});

export const assignSchema = z.object({ assigneeId: uuid('Usuario').nullable() });

export const commentSchema = z.object({ text: trimmed(1, 5000, 'El comentario') });

/** Booleano en query string ("true"/"false"); z.coerce.boolean() convertiría "false" en true. */
const boolQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const statusList = z
  .union([z.enum(STATUSES), z.array(z.enum(STATUSES))])
  .transform((v) => (Array.isArray(v) ? v : [v]));

export const listIncidentsSchema = z.object({
  status: z.union([statusList, z.literal('OPEN')]).optional(),
  typeId: uuid('Tipo').optional(),
  departmentId: uuid('Departamento').optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedToMe: boolQuery.optional(),
  mine: boolQuery.optional(),
  overdue: boolQuery.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['recent', 'oldest', 'priority', 'due']).default('recent'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/** Valida y convierte errores de Zod en un DomainError legible. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.length ? `${first.path.join('.')}: ` : '';
    throw new DomainError('VALIDATION', `${path}${first?.message ?? 'Datos no válidos'}`);
  }
  return result.data;
}
