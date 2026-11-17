import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  actions,
  as: Heading = 'h2',
}: {
  title: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
      <Heading className="text-sm font-semibold text-slate-900">{title}</Heading>
      {actions}
    </div>
  );
}

/** Cabecera de página: título, subtítulo y acciones. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
