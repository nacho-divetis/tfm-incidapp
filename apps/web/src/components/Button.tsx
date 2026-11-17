import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '../lib/utils';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<Variant, string> = {
  primary: 'bg-blue-700 text-white shadow-sm hover:bg-blue-800 focus-visible:outline-blue-700',
  secondary:
    'bg-white text-slate-800 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50 focus-visible:outline-blue-700',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-red-600',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-blue-700',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cn(base, variants[variant], sizes[size], className);

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClass(variant, size, typeof className === 'string' ? className : undefined)}
      {...rest}
    >
      {icon}
      {children}
    </Link>
  );
}
