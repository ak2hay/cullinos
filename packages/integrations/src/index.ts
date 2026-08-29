export interface PaymentAdapter {
  createPayment(amount: number, currency: string, metadata: Record<string, unknown>): Promise<PaymentResult>;
  verifyPayment(reference: string): Promise<PaymentResult>;
  refundPayment(reference: string, amount: number): Promise<PaymentResult>;
}

export interface PaymentResult {
  success: boolean;
  reference?: string;
  gatewayRef?: string;
  error?: string;
}

export interface PrinterAdapter {
  print(data: PrintJob): Promise<void>;
  getStatus(): Promise<PrinterStatus>;
}

export interface PrintJob {
  type: 'RECEIPT' | 'KOT' | 'LABEL';
  content: string;
  copies?: number;
}

export interface PrinterStatus {
  online: boolean;
  paperLow?: boolean;
  error?: string;
}

export interface CashDrawerAdapter {
  open(): Promise<void>;
}

export interface ScannerAdapter {
  onScan(callback: (data: string) => void): void;
  stop(): void;
}

export interface CustomerDisplayAdapter {
  display(message: string): Promise<void>;
  clear(): Promise<void>;
}

export interface SmsAdapter {
  send(to: string, message: string): Promise<boolean>;
}

export interface EmailAdapter {
  send(to: string, subject: string, body: string, html?: string): Promise<boolean>;
}

export interface NotificationAdapter {
  send(channel: string, recipient: string, title: string, body: string): Promise<boolean>;
}
