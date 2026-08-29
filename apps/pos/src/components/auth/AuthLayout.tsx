import { CULLINOS_BRAND } from '@/lib/api';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6">
      <div className="mb-10 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary font-mono text-3xl font-bold text-bg-primary">
          C
        </div>
        <div>
          <h1 className="text-3xl font-bold">{CULLINOS_BRAND.name}</h1>
          <p className="text-lg text-text-secondary">Point of Sale</p>
        </div>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg-secondary p-8 shadow-xl">
        {children}
      </div>
    </div>
  );
}
