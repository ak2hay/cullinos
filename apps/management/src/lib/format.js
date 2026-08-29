const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});
/** Amounts from the API are in paise (minor units). */
export function formatMoney(paise) {
    return inrFormatter.format(paise / 100);
}
export function formatDate(iso) {
    return new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}
export function formatPercent(value, total) {
    if (total === 0)
        return '0%';
    return `${Math.round((value / total) * 100)}%`;
}
