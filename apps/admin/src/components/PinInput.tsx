import { useRef } from 'react';

const LENGTH = 4;

export function PinInput({
  value,
  onChange,
  label,
  disabled,
  autoFocus,
  onComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onComplete?: (pin: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  function setAt(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    const joined = next.join('').slice(0, LENGTH);
    onChange(joined);
    if (digit && index < LENGTH - 1) refs.current[index + 1]?.focus();
    if (digit && joined.length === LENGTH) onComplete?.(joined);
  }

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm font-medium text-text-secondary">{label}</legend>
      <div className="flex gap-2">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            aria-label={`${label} digit ${i + 1}`}
            autoFocus={autoFocus && i === 0}
            value={digit}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '').slice(-1);
              setAt(i, d);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digit && i > 0) {
                refs.current[i - 1]?.focus();
                setAt(i - 1, '');
              }
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
              if (!pasted) return;
              e.preventDefault();
              onChange(pasted);
              refs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
              if (pasted.length === LENGTH) onComplete?.(pasted);
            }}
            className="h-12 w-12 rounded-xl border border-line bg-bg-elevated text-center font-mono text-xl outline-none focus:border-brand-primary disabled:opacity-50"
          />
        ))}
      </div>
    </fieldset>
  );
}
