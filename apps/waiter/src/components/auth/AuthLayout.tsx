import { Link } from 'react-router-dom';
import { CULLINOS_BRAND } from '@/lib/api';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      <div className="flex w-full flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary font-mono text-lg font-bold text-bg-primary">
              W
            </div>
            <div>
              <p className="text-lg font-semibold">{CULLINOS_BRAND.name} Waiter</p>
              <p className="text-sm text-text-secondary">Mobile service app</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-2 text-text-secondary">{subtitle}</p>
          </div>

          {children}

          <p className="mt-8 text-center text-xs text-text-muted">
            {CULLINOS_BRAND.poweredBy}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AuthFooterLink({
  text,
  linkText,
  to,
}: {
  text: string;
  linkText: string;
  to: string;
}) {
  return (
    <p className="mt-6 text-center text-sm text-text-secondary">
      {text}{' '}
      <Link to={to} className="font-medium text-brand-primary hover:text-brand-primary-dark">
        {linkText}
      </Link>
    </p>
  );
}
