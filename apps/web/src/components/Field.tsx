import {
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '../lib/utils';

const control =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:ring-red-500';

export const controlClass = (className?: string) => cn(control, className);

interface ControlA11yProps {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  required?: boolean;
}

interface FieldProps {
  label: ReactNode;
  /** Un único control (Input, Select, Textarea): recibe id y atributos ARIA automáticamente. */
  children: ReactElement<ControlA11yProps>;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}

/** Etiqueta + control + ayuda + error, enlazados con id/aria-describedby. */
export function Field({ label, children, error, hint, required, className }: FieldProps) {
  const autoId = useId();
  const id = (isValidElement(children) && children.props.id) || autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        required: required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={controlClass(className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={controlClass(cn('min-h-24', className))} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select className={controlClass(cn('pr-8', className))} {...rest}>
      {children}
    </select>
  );
}

/** Casilla con etiqueta clicable. */
export function Checkbox({
  label,
  className,
  ...rest
}: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800',
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-4 rounded border-slate-300 text-blue-700 accent-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
        {...rest}
      />
      {label}
    </label>
  );
}

/** Mensaje de error general de un formulario (p. ej. el que devuelve la API). */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </div>
  );
}
