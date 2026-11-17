import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from './endpoints';
import type { IncidentListParams } from './types';

/** Claves de React Query centralizadas para poder invalidarlas con precisión. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  catalog: ['catalog'] as const,
  dashboard: ['dashboard'] as const,
  incidents: ['incidents'] as const,
  incidentList: (params: IncidentListParams) => ['incidents', 'list', params] as const,
  incidentDetail: (id: string) => ['incidents', 'detail', id] as const,
  assignable: (departmentId: string) => ['assignable', departmentId] as const,
  adminUsers: ['admin', 'users'] as const,
  audit: (page: number, pageSize: number) => ['admin', 'audit', page, pageSize] as const,
};

/** Catálogo (departamentos, tipos…): cambia muy poco, se cachea toda la sesión. */
export function useCatalog() {
  return useQuery({
    queryKey: queryKeys.catalog,
    queryFn: api.catalog,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useIncidentList(params: IncidentListParams) {
  return useQuery({
    queryKey: queryKeys.incidentList(params),
    queryFn: ({ signal }) => api.listIncidents(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useIncidentDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.incidentDetail(id),
    queryFn: () => api.getIncident(id),
  });
}

/** Tras cualquier cambio en una incidencia: refresca listados, detalle y cuadro de mando. */
export async function invalidateIncidents(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.incidents }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard }),
  ]);
}
