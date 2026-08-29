interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'warning';
  loading?: boolean;
}

const variants = {
  primary:
    'bg-brand-primary text-bg-primary hover:bg-brand-primary-dark disabled:opacity-60',
  secondary:
    'bg-bg-elevated text-text-primary border border-white/10 hover:bg-bg-card disabled:opacity-60',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-white/5 disabled:opacity-60',
  success: 'bg-status-ready text-bg-primary hover:opacity-90 disabled:opacity-60',
  warning: 'bg-status-preparing text-bg-primary hover:opacity-90 disabled:opacity-60',
};

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={inputId}
        className={`h-11 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${error ? 'border-status-error' : ''} ${className}`}
        {...props}
      />
      {error ? <p className="text-sm text-status-error">{error}</p> : null}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, options, id, className = '', ...props }: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block text-sm font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={selectId}
        className={`h-11 w-full rounded-lg border border-white/10 bg-bg-card px-3 text-sm text-text-primary outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
