/**
 * Deterministic avatar color generation from username.
 * Each user gets a unique two-tone gradient for their webcam-off avatar.
 *
 * Approach based on the color-hash npm package:
 * - BKDRHash for better string distribution than djb2
 * - Prime modulus (359) for hue
 * - Stepped saturation/lightness arrays to multiply distinct combos
 * - Two independently seeded hashes for gradient start/end colors
 */

const S_ARRAY = [45, 60, 75];   // saturation steps (%)
const L_ARRAY = [45, 55, 65];   // lightness steps (%)

/** BKDRHash with configurable seed (better distribution for short strings) */
function bkdr(str: string, seed: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = hash * seed + str.charCodeAt(i);
    hash = hash & 0x7FFFFFFF; // keep positive 32-bit
  }
  return hash;
}

/** Derive an HSL color string from a hash value */
function hslFromHash(hash: number): string {
  const h = hash % 359;                                    // prime modulus
  const s = S_ARRAY[Math.floor(hash / 359) % S_ARRAY.length];
  const l = L_ARRAY[Math.floor(hash / 359 / S_ARRAY.length) % L_ARRAY.length];
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Hash a username to a palette index (exported for E2E data attribute) */
export function avatarHue(username: string): number {
  return bkdr(username, 131) % 359;
}

/** Generate a CSS gradient string for a username */
export function avatarGradient(username: string): string {
  const h1 = bkdr(username, 131);   // seed 131 (classic BKDRHash)
  const h2 = bkdr(username, 31415); // different seed → independent color
  return `linear-gradient(135deg, ${hslFromHash(h1)} 0%, ${hslFromHash(h2)} 100%)`;
}


