export class CashDrawerAdapter {
  async open(): Promise<{ success: boolean; message: string }> {
    console.log('[CashDrawerAdapter] stub open drawer');
    return { success: true, message: 'Stub: cash drawer pulse sent' };
  }

  async getStatus(): Promise<{ connected: boolean }> {
    return { connected: false };
  }
}

export const cashDrawerAdapter = new CashDrawerAdapter();
