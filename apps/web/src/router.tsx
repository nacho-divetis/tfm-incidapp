import { createBrowserRouter, Outlet } from 'react-router';
import { RequireAuth, RequireRole } from './auth/guards';
import { AppLayout } from './components/AppLayout';
import { RouteError } from './pages/RouteError';
import { AuditPage } from './pages/admin/AuditPage';
import { UsersPage } from './pages/admin/UsersPage';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentDetailPage } from './pages/incident/IncidentDetailPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { LoginPage } from './pages/LoginPage';
import { NewIncidentPage } from './pages/NewIncidentPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    element: <Outlet />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'incidencias', element: <IncidentsPage /> },
          { path: 'incidencias/nueva', element: <NewIncidentPage /> },
          { path: 'incidencias/:id', element: <IncidentDetailPage /> },
          { path: 'perfil', element: <ProfilePage /> },
          {
            path: 'admin',
            element: (
              <RequireRole roles={['ADMIN']}>
                <Outlet />
              </RequireRole>
            ),
            children: [
              { path: 'usuarios', element: <UsersPage /> },
              { path: 'auditoria', element: <AuditPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
