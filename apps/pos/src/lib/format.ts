const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatMoney(paise: number): string {
  return inrFormatter.format(paise / 100);
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
