import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ApiError, setUnauthorizedHandler } from './api/client';
import { queryKeys } from './api/queries';
import { AuthProvider, clearSession } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import './index.css';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No se reintentan errores del cliente (4xx): solo fallos de red o del servidor.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
    mutations: { retry: false },
  },
});

// Un 401 en cualquier llamada significa sesión caducada: se limpia la caché y RequireAuth lleva a /login.
setUnauthorizedHandler(() => {
  if (queryClient.getQueryData(queryKeys.me) === null) return;
  queryClient.setQueryData(queryKeys.me, null);
  // Se difiere para que las páginas abiertas se desmonten antes de borrar sus consultas.
  setTimeout(() => clearSession(queryClient), 0);
});

const root = document.getElementById('root');
if (!root) throw new Error('No se encuentra el elemento #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
