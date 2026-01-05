import { describe, it, expect } from 'vitest';
import type { Position } from '../../shared/types/events.js';

/**
 * Pure functions for spatial audio calculations, extracted for testability.
 * These mirror the calculations in SpatialAudio class.
 */

const DEFAULT_MAX_DISTANCE = 500;

/**
 * Calculate volume based on distance from local peer.
 * Volume is 1 at distance 0, linearly decreasing to 0 at maxDistance.
 */
export function calculateVolume(distance: number, maxDistance = DEFAULT_MAX_DISTANCE): number {
  return Math.max(0, 1 - distance / maxDistance);
}

/**
 * Calculate stereo pan value based on horizontal offset.
 * Pan is -1 (left) to 1 (right), clamped.
 */
export function calculatePan(dx: number, maxDistance = DEFAULT_MAX_DISTANCE): number {
  return Math.max(-1, Math.min(1, dx / (maxDistance / 2)));
}

/**
 * Calculate Euclidean distance between two positions.
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

describe('Spatial Audio Calculations', () => {
  describe('calculateDistance', () => {
    it('returns 0 for same position', () => {
      const pos = { x: 100, y: 100 };
      expect(calculateDistance(pos, pos)).toBe(0);
    });

    it('calculates horizontal distance', () => {
      expect(calculateDistance({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(100);
    });

    it('calculates vertical distance', () => {
      expect(calculateDistance({ x: 0, y: 0 }, { x: 0, y: 100 })).toBe(100);
    });

    it('calculates diagonal distance (3-4-5 triangle)', () => {
      expect(calculateDistance({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(500);
    });
  });

  describe('calculateVolume', () => {
    it('returns 1 at distance 0', () => {
      expect(calculateVolume(0)).toBe(1);
    });

    it('returns 0.5 at half max distance', () => {
      expect(calculateVolume(250)).toBe(0.5);
    });

    it('returns 0 at max distance', () => {
      expect(calculateVolume(500)).toBe(0);
    });

    it('returns 0 beyond max distance (clamped)', () => {
      expect(calculateVolume(1000)).toBe(0);
    });

    it('respects custom max distance', () => {
      expect(calculateVolume(500, 1000)).toBe(0.5);
    });
  });

  describe('calculatePan', () => {
    it('returns 0 when peer is directly ahead/behind (dx = 0)', () => {
      expect(calculatePan(0)).toBe(0);
    });

    it('returns positive when peer is to the right', () => {
      expect(calculatePan(100)).toBeGreaterThan(0);
    });

    it('returns negative when peer is to the left', () => {
      expect(calculatePan(-100)).toBeLessThan(0);
    });

    it('is clamped to 1 at far right', () => {
      expect(calculatePan(500)).toBe(1);
    });

    it('is clamped to -1 at far left', () => {
      expect(calculatePan(-500)).toBe(-1);
    });

    it('reaches full pan at half max distance', () => {
      // At maxDistance/2 = 250, pan should be 1
      expect(calculatePan(250)).toBe(1);
    });
  });

  describe('integration: volume and pan for positions', () => {
    const localPos: Position = { x: 1000, y: 1000 };

    it('peer nearby ahead has high volume and center pan', () => {
      const peerPos: Position = { x: 1000, y: 900 }; // 100 units above
      const distance = calculateDistance(localPos, peerPos);
      const dx = peerPos.x - localPos.x;

      expect(calculateVolume(distance)).toBe(0.8); // 100/500 = 0.2 reduction
      expect(calculatePan(dx)).toBe(0); // directly ahead
    });

    it('peer to the right has rightward pan', () => {
      const peerPos: Position = { x: 1200, y: 1000 }; // 200 units right
      const dx = peerPos.x - localPos.x;

      expect(calculatePan(dx)).toBe(0.8); // 200/250 = 0.8
    });

    it('distant peer has low volume', () => {
      const peerPos: Position = { x: 1000, y: 1450 }; // 450 units away
      const distance = calculateDistance(localPos, peerPos);

      expect(calculateVolume(distance)).toBeCloseTo(0.1); // 450/500 = 0.9 reduction
    });
  });
});
