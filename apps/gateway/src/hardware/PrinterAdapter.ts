export interface PrintJob {
  orderNumber: string;
  lines: string[];
  footer?: string;
}

export class PrinterAdapter {
  async print(job: PrintJob): Promise<{ success: boolean; message: string }> {
    console.log('[PrinterAdapter] stub print:', job.orderNumber, job.lines.length, 'lines');
    return {
      success: true,
      message: `Stub: printed receipt for order ${job.orderNumber}`,
    };
  }

  async getStatus(): Promise<{ connected: boolean; model: string }> {
    return { connected: false, model: 'stub-thermal-printer' };
  }
}

export const printerAdapter = new PrinterAdapter();
