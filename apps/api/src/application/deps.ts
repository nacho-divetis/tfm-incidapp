import type {
  AttachmentRepository,
  AuditLogger,
  CatalogRepository,
  Clock,
  DashboardQuery,
  FileStorage,
  IdGenerator,
  IncidentRepository,
  PasswordHasher,
  UserRepository,
} from './ports.js';

/** Dependencias que reciben los casos de uso (inyectadas desde composition/). */
export interface Deps {
  users: UserRepository;
  catalog: CatalogRepository;
  incidents: IncidentRepository;
  attachments: AttachmentRepository;
  storage: FileStorage;
  hasher: PasswordHasher;
  audit: AuditLogger;
  dashboard: DashboardQuery;
  clock: Clock;
  ids: IdGenerator;
}
