import { Link } from 'react-router-dom';
import { CULLINOS_BRAND } from '@/lib/api';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-bg-secondary p-12 lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary font-mono text-lg font-bold text-bg-primary">
              C
            </div>
            <div>
              <p className="text-xl font-semibold">{CULLINOS_BRAND.name}</p>
              <p className="text-sm text-text-secondary">{CULLINOS_BRAND.tagline}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">
            Run your restaurant
            <br />
            <span className="text-brand-primary">from one place.</span>
          </h2>
          <p className="max-w-md text-text-secondary">
            Menu, orders, inventory, staff, and analytics — unified for modern
            restaurant operations.
          </p>
        </div>

        <p className="text-sm text-text-muted">© {new Date().getFullYear()} {CULLINOS_BRAND.name}</p>
      </div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary font-mono font-bold text-bg-primary">
                C
              </div>
              <span className="text-lg font-semibold">{CULLINOS_BRAND.name}</span>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-2 text-text-secondary">{subtitle}</p>
          </div>

          {children}
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
