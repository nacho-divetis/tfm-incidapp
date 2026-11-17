import { sql } from 'drizzle-orm';
import type { Deps } from '../../application/deps.js';
import type { Clock } from '../../application/ports.js';
import {
  addComment,
  assignIncident,
  changeIncidentStatus,
  createIncident,
} from '../../application/use-cases/incidents.js';
import type { Actor, IncidentStatus, Priority, Role } from '../../domain/model.js';
import type { Db } from './client.js';
import { departments, incidentTypes, users } from './schema.js';

/** Estructura de una empresa tipo (docs/specs/01-requisitos.md §3). */
export const DEPARTMENTS = [
  { code: 'DIR', name: 'Dirección' },
  { code: 'ADM', name: 'Administración y Finanzas' },
  { code: 'COM', name: 'Comercial' },
  { code: 'ATC', name: 'Atención al Cliente / Postventa' },
  { code: 'COMP', name: 'Compras' },
  { code: 'LOG', name: 'Logística y Almacén' },
  { code: 'PROD', name: 'Producción / Operaciones' },
  { code: 'TEC', name: 'Departamento Técnico' },
  { code: 'CAL', name: 'Calidad' },
] as const;

export const INCIDENT_TYPES = [
  { code: 'TRANSPORTE', name: 'Transporte', dept: 'LOG' },
  { code: 'PROVEEDOR', name: 'Proveedor', dept: 'COMP' },
  { code: 'CLIENTE', name: 'Cliente / Reclamación', dept: 'ATC' },
  { code: 'CALIDAD', name: 'Calidad', dept: 'CAL' },
  { code: 'TECNICA', name: 'Técnica / Instalación', dept: 'TEC' },
  { code: 'ADMINISTRATIVA', name: 'Administrativa', dept: 'ADM' },
  { code: 'INTERNA', name: 'Interna / Operativa', dept: 'PROD' },
] as const;

/** Inserta departamentos y tipos si no existen (idempotente). */
export async function seedCatalog(db: Db) {
  await db
    .insert(departments)
    .values([...DEPARTMENTS])
    .onConflictDoNothing({ target: departments.code });
  const depts = await db.select().from(departments);
  const byCode = new Map(depts.map((d) => [d.code, d.id]));
  await db
    .insert(incidentTypes)
    .values(
      INCIDENT_TYPES.map((t) => ({
        code: t.code,
        name: t.name,
        defaultDepartmentId: byCode.get(t.dept)!,
      })),
    )
    .onConflictDoNothing({ target: incidentTypes.code });
}

export async function countUsers(db: Db): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return Number(row?.n ?? 0);
}

export const DEMO_PASSWORD = 'Demo1234!';

export const DEMO_USERS: { email: string; name: string; role: Role; depts: string[] }[] = [
  { email: 'admin@incidapp.demo', name: 'Ana Administradora', role: 'ADMIN', depts: [] },
  { email: 'direccion@incidapp.demo', name: 'Diego Director', role: 'DIRECCION', depts: ['DIR'] },
  {
    email: 'resp.logistica@incidapp.demo',
    name: 'Laura Logística',
    role: 'RESPONSABLE',
    depts: ['LOG'],
  },
  {
    email: 'usuario.logistica@incidapp.demo',
    name: 'Luis Almacén',
    role: 'USUARIO',
    depts: ['LOG'],
  },
  {
    email: 'resp.calidad@incidapp.demo',
    name: 'Carmen Calidad',
    role: 'RESPONSABLE',
    depts: ['CAL', 'COMP'],
  },
  {
    email: 'usuario.compras@incidapp.demo',
    name: 'Pablo Compras',
    role: 'USUARIO',
    depts: ['COMP'],
  },
  { email: 'resp.atc@incidapp.demo', name: 'Marta Postventa', role: 'RESPONSABLE', depts: ['ATC'] },
  { email: 'usuario.atc@incidapp.demo', name: 'Alba Atención', role: 'USUARIO', depts: ['ATC'] },
  {
    email: 'resp.tecnico@incidapp.demo',
    name: 'Tomás Técnico',
    role: 'RESPONSABLE',
    depts: ['TEC'],
  },
  { email: 'usuario.tecnico@incidapp.demo', name: 'Teresa SAT', role: 'USUARIO', depts: ['TEC'] },
  {
    email: 'usuario.admin@incidapp.demo',
    name: 'Raúl Facturación',
    role: 'USUARIO',
    depts: ['ADM'],
  },
  {
    email: 'resp.produccion@incidapp.demo',
    name: 'Pedro Producción',
    role: 'RESPONSABLE',
    depts: ['PROD'],
  },
];

type Step =
  | { kind: 'assign'; by: string; to: string; h: number }
  | { kind: 'status'; by: string; to: IncidentStatus; h: number; comment?: string }
  | { kind: 'comment'; by: string; h: number; text: string };

interface DemoIncident {
  by: string;
  type: string;
  title: string;
  description: string;
  priority: Priority;
  thirdParty?: string;
  daysAgo: number;
  dueInDays?: number;
  steps: Step[];
}

const u = (alias: string) => `${alias}@incidapp.demo`;

const DEMO_INCIDENTS: DemoIncident[] = [
  {
    by: u('usuario.logistica'),
    type: 'TRANSPORTE',
    priority: 'ALTA',
    thirdParty: 'Transportes Rápidos del Norte',
    title: 'Palé recibido con embalaje dañado',
    daysAgo: 2,
    dueInDays: 5,
    description:
      'El palé del pedido de compra PC-2026-311 llegó con el film roto y dos cajas aplastadas. Se adjuntan fotos de la recepción.',
    steps: [
      { kind: 'assign', by: u('resp.logistica'), to: u('usuario.logistica'), h: 1 },
      { kind: 'status', by: u('usuario.logistica'), to: 'EN_CURSO', h: 2 },
      {
        kind: 'comment',
        by: u('usuario.logistica'),
        h: 3,
        text: 'Abierta reclamación con el transportista, pendiente de su perito.',
      },
      { kind: 'status', by: u('usuario.logistica'), to: 'PENDIENTE_TERCERO', h: 4 },
    ],
  },
  {
    by: u('resp.logistica'),
    type: 'TRANSPORTE',
    priority: 'MEDIA',
    thirdParty: 'Logística Express SL',
    title: 'Retraso de 3 días en entrega a cliente',
    daysAgo: 12,
    dueInDays: 3,
    description:
      'La agencia no entregó el envío EXP-88213 en la fecha comprometida. El cliente ha llamado dos veces.',
    steps: [
      { kind: 'status', by: u('resp.logistica'), to: 'EN_CURSO', h: 1 },
      {
        kind: 'comment',
        by: u('resp.logistica'),
        h: 20,
        text: 'La agencia confirma incidencia en su hub. Entrega reprogramada.',
      },
      {
        kind: 'status',
        by: u('resp.logistica'),
        to: 'RESUELTA',
        h: 70,
        comment: 'Entregado. Se solicita abono parcial del porte.',
      },
      { kind: 'status', by: u('resp.logistica'), to: 'CERRADA', h: 80 },
    ],
  },
  {
    by: u('usuario.logistica'),
    type: 'TRANSPORTE',
    priority: 'BAJA',
    title: 'Error en etiquetas de envío',
    daysAgo: 20,
    description:
      'Varias etiquetas impresas con el código postal incorrecto en la expedición de la mañana.',
    steps: [
      { kind: 'status', by: u('usuario.logistica'), to: 'EN_CURSO', h: 1 },
      {
        kind: 'status',
        by: u('usuario.logistica'),
        to: 'RESUELTA',
        h: 5,
        comment: 'Plantilla de etiquetas corregida y reimpresas.',
      },
      { kind: 'status', by: u('resp.logistica'), to: 'CERRADA', h: 24 },
    ],
  },
  {
    by: u('usuario.compras'),
    type: 'PROVEEDOR',
    priority: 'CRITICA',
    thirdParty: 'Metales Ibéricos SA',
    title: 'Lote de material con defecto de fabricación',
    daysAgo: 4,
    dueInDays: 3,
    description:
      'El lote L-4471 presenta grietas en el 15 % de las piezas. Producción parada en la línea 2 a la espera de material conforme.',
    steps: [
      { kind: 'assign', by: u('resp.calidad'), to: u('usuario.compras'), h: 1 },
      { kind: 'status', by: u('usuario.compras'), to: 'EN_CURSO', h: 1 },
      {
        kind: 'comment',
        by: u('resp.calidad'),
        h: 6,
        text: 'Solicitado informe 8D al proveedor y reposición urgente.',
      },
    ],
  },
  {
    by: u('usuario.compras'),
    type: 'PROVEEDOR',
    priority: 'MEDIA',
    thirdParty: 'Suministros Industriales Levante',
    title: 'Pedido incompleto: faltan 40 unidades',
    daysAgo: 9,
    dueInDays: 10,
    description: 'Del pedido PC-2026-298 se recibieron 160 de 200 unidades. El albarán indica 200.',
    steps: [
      { kind: 'status', by: u('usuario.compras'), to: 'EN_CURSO', h: 2 },
      { kind: 'status', by: u('usuario.compras'), to: 'PENDIENTE_TERCERO', h: 3 },
    ],
  },
  {
    by: u('resp.calidad'),
    type: 'PROVEEDOR',
    priority: 'ALTA',
    thirdParty: 'Plásticos del Sur',
    title: 'Certificado de calidad no recibido',
    daysAgo: 30,
    description: 'El proveedor no ha enviado el certificado de conformidad del último suministro.',
    steps: [
      { kind: 'status', by: u('resp.calidad'), to: 'EN_CURSO', h: 4 },
      {
        kind: 'status',
        by: u('resp.calidad'),
        to: 'RESUELTA',
        h: 96,
        comment: 'Certificado recibido y archivado.',
      },
    ],
  },
  {
    by: u('usuario.atc'),
    type: 'CLIENTE',
    priority: 'ALTA',
    thirdParty: 'Distribuciones García',
    title: 'Cliente reclama producto no conforme',
    daysAgo: 3,
    dueInDays: 4,
    description:
      'El cliente indica que 5 unidades no funcionan correctamente desde la instalación. Solicita sustitución.',
    steps: [
      { kind: 'assign', by: u('resp.atc'), to: u('usuario.atc'), h: 2 },
      { kind: 'status', by: u('usuario.atc'), to: 'EN_CURSO', h: 3 },
      {
        kind: 'comment',
        by: u('usuario.atc'),
        h: 5,
        text: 'Solicitadas fotos y números de serie al cliente.',
      },
    ],
  },
  {
    by: u('usuario.atc'),
    type: 'CLIENTE',
    priority: 'MEDIA',
    thirdParty: 'Hoteles Mediterráneo',
    title: 'Devolución por pedido duplicado',
    daysAgo: 15,
    description:
      'El cliente recibió dos veces el mismo pedido por un error en la tramitación. Solicita recogida.',
    steps: [
      { kind: 'status', by: u('usuario.atc'), to: 'EN_CURSO', h: 1 },
      {
        kind: 'status',
        by: u('usuario.atc'),
        to: 'RESUELTA',
        h: 50,
        comment: 'Recogida realizada y abono emitido.',
      },
      { kind: 'status', by: u('resp.atc'), to: 'CERRADA', h: 60 },
    ],
  },
  {
    by: u('usuario.atc'),
    type: 'CLIENTE',
    priority: 'BAJA',
    thirdParty: 'Particular',
    title: 'Queja por tiempo de respuesta telefónica',
    daysAgo: 6,
    description:
      'Un cliente se queja de esperas largas en la línea de atención en horario de mañana.',
    steps: [
      {
        kind: 'status',
        by: u('resp.atc'),
        to: 'RECHAZADA',
        h: 30,
        comment: 'Se gestiona como mejora interna, no como incidencia de cliente.',
      },
    ],
  },
  {
    by: u('resp.calidad'),
    type: 'CALIDAD',
    priority: 'ALTA',
    title: 'No conformidad en inspección final',
    daysAgo: 1,
    dueInDays: 7,
    description:
      'En la inspección final de la OF-1203 se detectan desviaciones dimensionales fuera de tolerancia.',
    steps: [],
  },
  {
    by: u('resp.calidad'),
    type: 'CALIDAD',
    priority: 'MEDIA',
    title: 'Calibración vencida de equipo de medida',
    daysAgo: 25,
    description: 'El calibre digital CD-07 tiene la calibración vencida desde hace dos semanas.',
    steps: [
      { kind: 'status', by: u('resp.calidad'), to: 'EN_CURSO', h: 2 },
      {
        kind: 'status',
        by: u('resp.calidad'),
        to: 'RESUELTA',
        h: 30,
        comment: 'Equipo calibrado por laboratorio externo.',
      },
      { kind: 'status', by: u('resp.calidad'), to: 'CERRADA', h: 40 },
    ],
  },
  {
    by: u('usuario.tecnico'),
    type: 'TECNICA',
    priority: 'CRITICA',
    thirdParty: 'Cliente: Almacenes Centro',
    title: 'Avería en instalación de cliente',
    daysAgo: 1,
    dueInDays: 1,
    description:
      'El sistema instalado la semana pasada no arranca tras un corte de suministro eléctrico. Cliente sin servicio.',
    steps: [
      { kind: 'assign', by: u('resp.tecnico'), to: u('usuario.tecnico'), h: 1 },
      { kind: 'status', by: u('usuario.tecnico'), to: 'EN_CURSO', h: 1 },
    ],
  },
  {
    by: u('resp.tecnico'),
    type: 'TECNICA',
    priority: 'MEDIA',
    thirdParty: 'Cliente: Industrias Ruiz',
    title: 'Revisión en garantía solicitada',
    daysAgo: 18,
    dueInDays: 7,
    description: 'Intervención en garantía para ajuste de sensores. Programar visita.',
    steps: [
      { kind: 'assign', by: u('resp.tecnico'), to: u('usuario.tecnico'), h: 2 },
      { kind: 'status', by: u('usuario.tecnico'), to: 'EN_CURSO', h: 24 },
      {
        kind: 'status',
        by: u('usuario.tecnico'),
        to: 'RESUELTA',
        h: 120,
        comment: 'Visita realizada, sensores ajustados.',
      },
    ],
  },
  {
    by: u('usuario.admin'),
    type: 'ADMINISTRATIVA',
    priority: 'MEDIA',
    thirdParty: 'Distribuciones García',
    title: 'Factura emitida con IVA incorrecto',
    daysAgo: 7,
    dueInDays: 2,
    description:
      'La factura F-2026-1123 se emitió con un tipo de IVA erróneo. Hay que rectificarla.',
    steps: [{ kind: 'status', by: u('usuario.admin'), to: 'EN_CURSO', h: 3 }],
  },
  {
    by: u('resp.produccion'),
    type: 'INTERNA',
    priority: 'ALTA',
    title: 'Parada no planificada en línea 2',
    daysAgo: 4,
    description:
      'La línea 2 está parada por falta de material conforme (ver incidencia de proveedor del lote L-4471).',
    steps: [
      { kind: 'status', by: u('resp.produccion'), to: 'EN_CURSO', h: 1 },
      { kind: 'status', by: u('resp.produccion'), to: 'PENDIENTE_TERCERO', h: 2 },
    ],
  },
  {
    by: u('resp.produccion'),
    type: 'INTERNA',
    priority: 'BAJA',
    title: 'Fuga de aire comprimido en zona de montaje',
    daysAgo: 0,
    description: 'Se escucha una fuga de aire en la toma 4 de la zona de montaje.',
    steps: [],
  },
];

/** Carga usuarios demo y un histórico de incidencias usando los propios casos de uso. */
export async function seedDemoData(db: Db, deps: Deps, clock: { set(d: Date): void } & Clock) {
  const depts = await deps.catalog.listDepartments();
  const types = await deps.catalog.listIncidentTypes();
  const deptId = (code: string) => depts.find((d) => d.code === code)!.id;
  const typeId = (code: string) => types.find((t) => t.code === code)!.id;

  const passwordHash = await deps.hasher.hash(DEMO_PASSWORD);
  const actors = new Map<string, Actor>();
  for (const du of DEMO_USERS) {
    const user = await deps.users.create({
      email: du.email,
      name: du.name,
      role: du.role,
      passwordHash,
      departmentIds: du.depts.map(deptId),
    });
    actors.set(du.email, { id: user.id, role: user.role, departmentIds: user.departmentIds });
  }
  const actor = (email: string) => actors.get(email)!;
  const realNow = Date.now();

  // En orden cronológico para que los códigos INC-AAAA-NNNN sean correlativos en el tiempo.
  for (const di of [...DEMO_INCIDENTS].sort((a, b) => b.daysAgo - a.daysAgo)) {
    const base = new Date(realNow - di.daysAgo * 86_400_000 - 3 * 3_600_000);
    clock.set(base);
    const dueDate =
      di.dueInDays !== undefined
        ? new Date(base.getTime() + di.dueInDays * 86_400_000).toISOString().slice(0, 10)
        : null;
    const incident = await createIncident(deps, actor(di.by), {
      title: di.title,
      description: di.description,
      typeId: typeId(di.type),
      priority: di.priority,
      thirdParty: di.thirdParty ?? null,
      dueDate,
    });
    for (const step of di.steps) {
      clock.set(new Date(Math.min(base.getTime() + step.h * 3_600_000, realNow - 60_000)));
      if (step.kind === 'assign') {
        await assignIncident(deps, actor(step.by), incident.id, { assigneeId: actor(step.to).id });
      } else if (step.kind === 'status') {
        await changeIncidentStatus(deps, actor(step.by), incident.id, {
          status: step.to,
          comment: step.comment,
        });
      } else {
        await addComment(deps, actor(step.by), incident.id, { text: step.text });
      }
    }
  }
  return { users: DEMO_USERS.length, incidents: DEMO_INCIDENTS.length };
}

/** Reloj controlable para generar un histórico con fechas realistas. */
export function settableClock(): Clock & { set(d: Date): void } {
  let current: Date | null = null;
  return {
    now: () => current ?? new Date(),
    set: (d: Date) => {
      current = d;
    },
  };
}
