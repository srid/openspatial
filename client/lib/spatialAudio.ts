/**
 * Shared utility for calculating spatial audio volume based on Euclidean distance
 * between an audio source and a listener on the canvas.
 * 
 * Returns a volume factor between 0.0 and 1.0.
 */
export function calculateSpatialVolume(
  distance: number,
  maxVolumeDistance: number = 300,
  maxHearingDistance: number = 1500
): number {
  if (distance > maxHearingDistance) {
    return 0.0;
  } else if (distance > maxVolumeDistance) {
    const factor = 1.0 - ((distance - maxVolumeDistance) / (maxHearingDistance - maxVolumeDistance));
    // Square the factor for a slightly more natural inverse-square-like dropoff
    return factor * factor;
  }
  return 1.0;
}
