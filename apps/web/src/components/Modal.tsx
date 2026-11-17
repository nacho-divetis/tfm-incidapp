import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Botones del pie (normalmente Cancelar + acción principal). */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Impide cerrar (Esc, clic fuera) mientras hay una petición en curso. */
  busy?: boolean;
}

/**
 * Diálogo modal accesible basado en <dialog> nativo: atrapa el foco, se cierra con Esc,
 * devuelve el foco al elemento que lo abrió y se anuncia con aria-labelledby.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  busy,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Si el componente se desmonta abierto, se cierra para liberar el foco.
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        // Clic en el fondo (fuera del contenido) cierra el diálogo.
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-xl bg-white p-0 text-slate-900 shadow-2xl',
        widths[size],
      )}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-4rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-1 text-sm text-slate-600">
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="-m-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cerrar diálogo"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
