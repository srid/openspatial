/**
 * E2E Test DSL - Screen Share Mock
 */
import { Page } from '@playwright/test';

/**
 * Mocks getDisplayMedia to return a canvas-based stream.
 * This allows screen share testing without actual screen capture permission.
 * The canvas is animated to ensure continuous frame generation for WebRTC.
 */
export async function mockScreenShare(page: Page, color: string = 'blue'): Promise<void> {
  await page.evaluate((fillColor) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    
    // Animate the canvas to ensure continuous frame generation
    // A static canvas may not produce frames for captureStream
    let frameCount = 0;
    function drawFrame() {
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, 640, 480);
      // Add slight variation so each frame is unique and detectable
      ctx.fillStyle = 'white';
      ctx.font = '20px sans-serif';
      ctx.fillText(`Frame: ${frameCount++}`, 20, 40);
      requestAnimationFrame(drawFrame);
    }
    drawFrame();
    
    const stream = canvas.captureStream(30);
    (navigator.mediaDevices as any).getDisplayMedia = async () => stream;
  }, color);
}
