import { useEffect } from 'react';

/** Une clases condicionalmente (alternativa mínima a `clsx`). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Fija el título de la pestaña del navegador. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · IncidApp` : 'IncidApp';
  }, [title]);
}
