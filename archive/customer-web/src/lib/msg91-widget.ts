export type Msg91WidgetConfig = {
  widgetId: string;
  tokenAuth: string;
};

export type Msg91SuccessData =
  | string
  | {
      message?: string;
      accessToken?: string;
      token?: string;
      identifier?: string;
      mobile?: string;
      phone?: string;
      success?: boolean;
    };

export type Msg91WidgetResult = {
  accessToken: string;
  /** Verified mobile/email from MSG91 success callback when present. */
  identifier: string | null;
};

declare global {
  interface Window {
    initSendOTP?: (configuration: Record<string, unknown>) => void;
  }
}

const SCRIPT_URLS = [
  'https://verify.msg91.com/otp-provider.js',
  'https://verify.phone91.com/otp-provider.js',
];

let scriptPromise: Promise<void> | null = null;

function loadMsg91Script(): Promise<void> {
  if (typeof window.initSendOTP === 'function') {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    let i = 0;
    const attempt = () => {
      const s = document.createElement('script');
      s.src = SCRIPT_URLS[i]!;
      s.async = true;
      s.onload = () => {
        if (typeof window.initSendOTP === 'function') {
          resolve();
        } else {
          reject(new Error('MSG91 OTP script loaded but initSendOTP is missing'));
        }
      };
      s.onerror = () => {
        i += 1;
        if (i < SCRIPT_URLS.length) {
          attempt();
        } else {
          scriptPromise = null;
          reject(new Error('Failed to load MSG91 OTP script'));
        }
      };
      document.head.appendChild(s);
    };
    attempt();
  });

  return scriptPromise;
}

export function extractMsg91AccessToken(data: Msg91SuccessData): string | null {
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data && typeof data === 'object') {
    const token = data.message ?? data.accessToken ?? data.token;
    if (typeof token === 'string' && token.trim()) return token.trim();
  }
  return null;
}

export function extractMsg91Identifier(data: Msg91SuccessData): string | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data.identifier ?? data.mobile ?? data.phone;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

/** Open MSG91 default OTP UI; resolves with access-token + identifier on success. */
export async function openMsg91OtpWidget(options: {
  config: Msg91WidgetConfig;
  identifier?: string;
}): Promise<Msg91WidgetResult> {
  await loadMsg91Script();
  if (typeof window.initSendOTP !== 'function') {
    throw new Error('MSG91 OTP widget is unavailable');
  }

  return new Promise((resolve, reject) => {
    window.initSendOTP!({
      widgetId: options.config.widgetId,
      tokenAuth: options.config.tokenAuth,
      ...(options.identifier ? { identifier: options.identifier } : {}),
      exposeMethods: false,
      success: (data: Msg91SuccessData) => {
        const token = extractMsg91AccessToken(data);
        if (!token) {
          reject(new Error('MSG91 success response did not include an access token'));
          return;
        }
        resolve({
          accessToken: token,
          identifier: extractMsg91Identifier(data) ?? options.identifier ?? null,
        });
      },
      failure: (error: unknown) => {
        const message =
          typeof error === 'string'
            ? error
            : error && typeof error === 'object' && 'message' in error
              ? String((error as { message: unknown }).message)
              : 'OTP verification failed';
        reject(new Error(message));
      },
    });
  });
}
