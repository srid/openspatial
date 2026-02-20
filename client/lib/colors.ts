/**
 * Color utility functions for generating unique user colors
 */

// Predefined vibrant color pairs for gradients (hue-based)
const COLOR_PAIRS: Array<[string, string]> = [
  ['#6366f1', '#8b5cf6'], // Indigo to Violet
  ['#ec4899', '#f43f5e'], // Pink to Rose
  ['#10b981', '#14b8a6'], // Emerald to Teal
  ['#f59e0b', '#f97316'], // Amber to Orange
  ['#3b82f6', '#06b6d4'], // Blue to Cyan
  ['#8b5cf6', '#d946ef'], // Violet to Fuchsia
  ['#ef4444', '#f97316'], // Red to Orange
  ['#14b8a6', '#22c55e'], // Teal to Green
  ['#a855f7', '#ec4899'], // Purple to Pink
  ['#0ea5e9', '#6366f1'], // Sky to Indigo
  ['#84cc16', '#10b981'], // Lime to Emerald
  ['#f43f5e', '#ec4899'], // Rose to Pink
];

/**
 * Generate a consistent color pair from a username string.
 * Uses a simple hash to deterministically pick from predefined color pairs.
 */
export function getUserColors(username: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    const char = username.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % COLOR_PAIRS.length;
  const [from, to] = COLOR_PAIRS[index];

  return { from, to };
}

/**
 * Generate a CSS gradient string for a username
 */
export function getUserGradient(username: string): string {
  const { from, to } = getUserColors(username);
  return `linear-gradient(135deg, ${from} 0%, ${to} 50%, ${to} 100%)`;
}
