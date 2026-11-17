import {
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  TriangleAlert,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useCatalog } from '../api/queries';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { can } from '../auth/guards';
import { ROLE_LABEL } from '../lib/labels';
import { cn } from '../lib/utils';
import { useToast } from './Toast';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  /** Criterio de "activo" personalizado (p. ej. el detalle cuenta como Incidencias). */
  match?: (pathname: string) => boolean;
}

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { pathname } = useLocation();
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive: routeActive }) => {
        const isActive = item.match ? item.match(pathname) : routeActive;
        return cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-blue-50 text-blue-800'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        );
      }}
      aria-current={item.match ? (item.match(pathname) ? 'page' : undefined) : undefined}
    >
      {item.icon}
      {item.label}
    </NavLink>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn('flex items-center gap-2 font-bold tracking-tight text-slate-900', className)}
    >
      <span
        className="grid size-8 place-items-center rounded-lg bg-blue-700 text-white"
        aria-hidden="true"
      >
        <TriangleAlert className="size-4.5" />
      </span>
      IncidApp
    </span>
  );
}

/** Estructura de las páginas autenticadas: barra lateral + cabecera + contenido. */
export function AppLayout() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { data: catalog } = useCatalog();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Cierra el menú móvil al navegar o al pulsar Esc.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const iconCls = 'size-4.5 shrink-0';
  const mainNav: NavItem[] = [
    {
      to: '/',
      label: 'Panel',
      icon: <LayoutDashboard className={iconCls} aria-hidden="true" />,
      end: true,
    },
    {
      to: '/incidencias',
      label: 'Incidencias',
      icon: <ClipboardList className={iconCls} aria-hidden="true" />,
      end: true,
      match: (p) => p.startsWith('/incidencias') && p !== '/incidencias/nueva',
    },
  ];
  if (can.createIncident(user)) {
    mainNav.push({
      to: '/incidencias/nueva',
      label: 'Nueva incidencia',
      icon: <FilePlus2 className={iconCls} aria-hidden="true" />,
    });
  }
  const adminNav: NavItem[] = can.administer(user)
    ? [
        {
          to: '/admin/usuarios',
          label: 'Usuarios',
          icon: <Users className={iconCls} aria-hidden="true" />,
        },
        {
          to: '/admin/auditoria',
          label: 'Auditoría',
          icon: <ScrollText className={iconCls} aria-hidden="true" />,
        },
      ]
    : [];

  const departmentNames =
    user.role === 'ADMIN' || user.role === 'DIRECCION'
      ? 'Toda la empresa'
      : catalog
        ? catalog.departments
            .filter((d) => user.departmentIds.includes(d.id))
            .map((d) => d.name)
            .join(', ')
        : '';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
      toast.info('Has cerrado la sesión');
    } catch {
      navigate('/login', { replace: true });
    }
  };

  const close = () => setMenuOpen(false);

  const sidebar = (
    <nav
      aria-label="Navegación principal"
      className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-4"
    >
      <ul className="space-y-1">
        {mainNav.map((item) => (
          <li key={item.to}>
            <SidebarLink item={item} onNavigate={close} />
          </li>
        ))}
      </ul>
      {adminNav.length > 0 && (
        <div>
          <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Administración
          </p>
          <ul className="space-y-1">
            {adminNav.map((item) => (
              <li key={item.to}>
                <SidebarLink item={item} onNavigate={close} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600 lg:hidden">
        <p className="font-semibold text-slate-800">{user.name}</p>
        <p>{ROLE_LABEL[user.role]}</p>
        {departmentNames && <p className="mt-1">{departmentNames}</p>}
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium text-blue-800 shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>

      {/* Cabecera */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          className="-ml-1 rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-controls="menu-movil"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Link to="/" className="rounded-md" aria-label="IncidApp, ir al panel">
          <Logo />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="max-w-xs truncate text-xs text-slate-600" title={departmentNames}>
              {ROLE_LABEL[user.role]}
              {departmentNames && ` · ${departmentNames}`}
            </p>
          </div>
          <NavLink
            to="/perfil"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-slate-100',
                isActive ? 'text-blue-800' : 'text-slate-700',
              )
            }
          >
            <UserRound className="size-5" aria-hidden="true" />
            <span className="hidden md:inline">Mi perfil</span>
            <span className="sr-only md:hidden">Mi perfil</span>
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="size-5" aria-hidden="true" />
            <span className="hidden md:inline">Cerrar sesión</span>
            <span className="sr-only md:hidden">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Barra lateral fija en escritorio */}
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
          {sidebar}
        </aside>

        {/* Menú lateral deslizante en móvil */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            id="menu-movil"
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
          >
            <div className="absolute inset-0 bg-slate-900/50" onClick={close} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
                <Logo />
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                  aria-label="Cerrar menú"
                  autoFocus
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              {sidebar}
            </div>
          </div>
        )}

        <main
          id="contenido"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
