const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});
export function formatMoney(paise) {
    return inrFormatter.format(paise / 100);
}
export function generateIdempotencyKey() {
    return crypto.randomUUID();
}
