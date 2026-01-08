/**
 * E2E Test DSL - Screen Share Mock
 */
import { Page } from '@playwright/test';

/**
 * Mocks getDisplayMedia to return a canvas-based stream.
 * This allows screen share testing without actual screen capture permission.
 */
export async function mockScreenShare(page: Page, color: string = 'blue'): Promise<void> {
  await page.evaluate((fillColor) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, 640, 480);
    const stream = canvas.captureStream(30);
    (navigator.mediaDevices as any).getDisplayMedia = async () => stream;
  }, color);
}
