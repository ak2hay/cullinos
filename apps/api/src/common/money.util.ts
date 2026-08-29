/** DB stores rupees; client apps use paise (integer). */
export function toPaise(rupees: number | string | { toString(): string }): number {
  return Math.round(Number(rupees) * 100);
}

export function toRupees(paise: number): number {
  return paise / 100;
}
