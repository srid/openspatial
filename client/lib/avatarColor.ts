/**
 * Deterministic avatar color generation from username.
 * Each user gets a unique gradient for their webcam-off avatar.
 */

/** Hash a username to a hue angle (0–360) */
export function avatarHue(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ((hash % 360) + 360) % 360;
}

/** Generate a CSS gradient string for a username */
export function avatarGradient(username: string): string {
  const hue = avatarHue(username);
  return `linear-gradient(135deg, hsl(${hue}, 70%, 55%) 0%, hsl(${hue + 30}, 70%, 45%) 100%)`;
}
