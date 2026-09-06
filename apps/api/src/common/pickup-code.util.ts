/** Alphabet omits 0/O and 1/I/L to avoid receipt ambiguity. */
const PICKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PICKUP_CODE_LENGTH = 6;

export function generatePickupCode(length = PICKUP_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * PICKUP_CODE_ALPHABET.length);
    code += PICKUP_CODE_ALPHABET[idx];
  }
  return code;
}
