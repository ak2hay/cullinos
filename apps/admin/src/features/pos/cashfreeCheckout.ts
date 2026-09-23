export type CashfreeCheckoutResult = {
  cashfreeOrderId: string;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: 'sandbox' | 'production' }) => {
      checkout: (opts: {
        paymentSessionId: string;
        redirectTarget?: string;
      }) => Promise<{ error?: { message?: string }; redirect?: boolean }>;
    };
  }
}

function loadCashfreeScript(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Cashfree Checkout'));
    document.body.appendChild(script);
  });
}

export async function openCashfreeCheckout(options: {
  paymentSessionId: string;
  cashfreeOrderId: string;
  mode?: 'sandbox' | 'production';
}): Promise<CashfreeCheckoutResult> {
  await loadCashfreeScript();
  const CashfreeCtor = window.Cashfree;
  if (!CashfreeCtor) {
    throw new Error('Cashfree Checkout is unavailable');
  }

  const cashfree = CashfreeCtor({ mode: options.mode ?? 'sandbox' });
  const result = await cashfree.checkout({
    paymentSessionId: options.paymentSessionId,
    redirectTarget: '_modal',
  });

  if (result?.error?.message) {
    throw new Error(result.error.message);
  }

  return { cashfreeOrderId: options.cashfreeOrderId };
}
