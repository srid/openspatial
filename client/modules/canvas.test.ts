import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Pure coordinate transformation functions extracted from CanvasManager.
 * These are the core mathematical operations that can be tested in isolation.
 */

// Pure function: screen coordinates -> space coordinates
export function screenToSpace(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number,
  scale: number
): { x: number; y: number } {
  return {
    x: (screenX - offsetX) / scale,
    y: (screenY - offsetY) / scale,
  };
}

// Pure function: space coordinates -> screen coordinates
export function spaceToScreen(
  spaceX: number,
  spaceY: number,
  offsetX: number,
  offsetY: number,
  scale: number
): { x: number; y: number } {
  return {
    x: spaceX * scale + offsetX,
    y: spaceY * scale + offsetY,
  };
}

describe('Coordinate Transformations', () => {
  describe('screenToSpace', () => {
    it('converts screen to space at scale 1 with no offset', () => {
      const result = screenToSpace(100, 200, 0, 0, 1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('converts screen to space with positive offset', () => {
      // If canvas is offset by 50,50, screen point 150,200 is at space 100,150
      const result = screenToSpace(150, 200, 50, 50, 1);
      expect(result).toEqual({ x: 100, y: 150 });
    });

    it('converts screen to space with scale 2', () => {
      // At scale 2, screen point 200,200 with no offset is space 100,100
      const result = screenToSpace(200, 200, 0, 0, 2);
      expect(result).toEqual({ x: 100, y: 100 });
    });

    it('converts screen to space with offset and scale', () => {
      // Offset 100,100, scale 2: screen 300,400 -> space (300-100)/2, (400-100)/2 = 100,150
      const result = screenToSpace(300, 400, 100, 100, 2);
      expect(result).toEqual({ x: 100, y: 150 });
    });

    it('handles zoom out (scale < 1)', () => {
      // At scale 0.5, screen point 50,50 with no offset is space 100,100
      const result = screenToSpace(50, 50, 0, 0, 0.5);
      expect(result).toEqual({ x: 100, y: 100 });
    });
  });

  describe('spaceToScreen', () => {
    it('converts space to screen at scale 1 with no offset', () => {
      const result = spaceToScreen(100, 200, 0, 0, 1);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('converts space to screen with positive offset', () => {
      // Space 100,150 with offset 50,50 at scale 1 is screen 150,200
      const result = spaceToScreen(100, 150, 50, 50, 1);
      expect(result).toEqual({ x: 150, y: 200 });
    });

    it('converts space to screen with scale 2', () => {
      // Space 100,100 at scale 2 with no offset is screen 200,200
      const result = spaceToScreen(100, 100, 0, 0, 2);
      expect(result).toEqual({ x: 200, y: 200 });
    });

    it('converts space to screen with offset and scale', () => {
      // Space 100,150 with offset 100,100, scale 2: screen 100*2+100, 150*2+100 = 300,400
      const result = spaceToScreen(100, 150, 100, 100, 2);
      expect(result).toEqual({ x: 300, y: 400 });
    });
  });

  describe('round-trip conversion', () => {
    it('preserves coordinates through round-trip at scale 1', () => {
      const offsetX = 50;
      const offsetY = 100;
      const scale = 1;
      const original = { x: 500, y: 600 };

      const screen = spaceToScreen(original.x, original.y, offsetX, offsetY, scale);
      const space = screenToSpace(screen.x, screen.y, offsetX, offsetY, scale);

      expect(space).toEqual(original);
    });

    it('preserves coordinates through round-trip at scale 2', () => {
      const offsetX = -200;
      const offsetY = -100;
      const scale = 2;
      const original = { x: 1000, y: 800 };

      const screen = spaceToScreen(original.x, original.y, offsetX, offsetY, scale);
      const space = screenToSpace(screen.x, screen.y, offsetX, offsetY, scale);

      expect(space.x).toBeCloseTo(original.x);
      expect(space.y).toBeCloseTo(original.y);
    });

    it('preserves coordinates through round-trip at scale 0.5', () => {
      const offsetX = 100;
      const offsetY = 200;
      const scale = 0.5;
      const original = { x: 300, y: 400 };

      const screen = spaceToScreen(original.x, original.y, offsetX, offsetY, scale);
      const space = screenToSpace(screen.x, screen.y, offsetX, offsetY, scale);

      expect(space.x).toBeCloseTo(original.x);
      expect(space.y).toBeCloseTo(original.y);
    });
  });
});
