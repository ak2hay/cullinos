import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = 'cf-turnstile-script';

export type TurnstileProps = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  /** Cloudflare Turnstile site key (e.g. import.meta.env.VITE_TURNSTILE_SITE_KEY). */
  siteKey?: string;
  className?: string;
};

export function isTurnstileEnabled(siteKey?: string | null): boolean {
  return Boolean(siteKey?.trim());
}

export function Turnstile({ onToken, onExpire, siteKey, className }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const key = siteKey?.trim();

  useEffect(() => {
    if (!key || !containerRef.current) return;

    const render = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: key,
        callback: onToken,
        'expired-callback': () => onExpire?.(),
        'error-callback': () => onExpire?.(),
        theme: 'auto',
      });
    };

    if (window.turnstile) {
      render();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [key, onToken, onExpire]);

  if (!key) return null;

  return <div ref={containerRef} className={className ?? 'cf-turnstile'} />;
}
