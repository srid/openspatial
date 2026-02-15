/**
 * Demo Recording Scenario
 *
 * Produces a ~20s screen recording of two users in a space.
 * Used by `just gif` to generate docs/demo.gif.
 *
 * Records only Alice's viewport, which shows both avatars and synced content.
 */
import { test, expect } from '@playwright/test';

const SPACE_ID = `demo-gif-${Date.now()}`;
const RECORDING_DIR = 'test-results/demo-recording';

/**
 * Mock webcam with a patterned canvas (gradient + shape) instead of a plain fill.
 */
async function mockPatternedWebcam(page: import('@playwright/test').Page, hue: number, shape: 'circle' | 'diamond') {
  await page.evaluate(({ hue, shape }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d')!;

    let frameCount = 0;
    function drawFrame() {
      // Animated gradient background
      const shift = (frameCount * 2) % 360;
      const gradient = ctx.createLinearGradient(0, 0, 320, 240);
      gradient.addColorStop(0, `hsl(${(hue + shift) % 360}, 70%, 50%)`);
      gradient.addColorStop(1, `hsl(${(hue + shift + 60) % 360}, 70%, 40%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 320, 240);

      // Rotating shape in center
      const cx = 160, cy = 120;
      const angle = (frameCount * 0.05);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = `hsla(${hue}, 90%, 85%, 0.8)`;
      ctx.beginPath();
      if (shape === 'circle') {
        // Pulsing circle
        const r = 30 + Math.sin(frameCount * 0.1) * 10;
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      } else {
        // Rotating diamond
        const s = 35;
        ctx.moveTo(0, -s);
        ctx.lineTo(s, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s, 0);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();

      frameCount++;
      requestAnimationFrame(drawFrame);
    }
    drawFrame();

    const stream = canvas.captureStream(30);
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (navigator.mediaDevices as any).getUserMedia = async (constraints: MediaStreamConstraints) => {
      if (constraints.video) {
        const mockStream = stream.clone();
        if (constraints.audio) {
          try {
            const audioStream = await originalGetUserMedia({ audio: true });
            audioStream.getAudioTracks().forEach(track => mockStream.addTrack(track));
          } catch { /* no audio */ }
        }
        return mockStream;
      }
      return originalGetUserMedia(constraints);
    };
  }, { hue, shape });
}

/**
 * Mock screen share with an animated display.
 */
async function mockAnimatedScreenShare(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;

    let frameCount = 0;
    function drawFrame() {
      // Dark editor-like background
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(0, 0, 640, 480);

      // Simulated code lines
      const colors = ['#89b4fa', '#a6e3a1', '#f9e2af', '#cba6f7', '#f38ba8'];
      ctx.font = '14px monospace';
      for (let i = 0; i < 12; i++) {
        const lineNum = i + 1;
        ctx.fillStyle = '#6c7086';
        ctx.fillText(`${lineNum}`, 15, 40 + i * 22);

        ctx.fillStyle = colors[i % colors.length];
        const indent = i > 2 && i < 9 ? '    ' : '';
        // Typing animation: reveal characters over time
        const maxChars = Math.min(40, Math.max(0, frameCount - i * 8));
        const line = `${indent}${'█'.repeat(Math.min(maxChars, 20 + (i * 3) % 15))}`;
        ctx.fillText(line, 45, 40 + i * 22);
      }

      // Blinking cursor
      if (Math.floor(frameCount / 15) % 2 === 0) {
        ctx.fillStyle = '#cdd6f4';
        ctx.fillRect(45, 40 + 11 * 22 + 4, 8, 2);
      }

      frameCount++;
      requestAnimationFrame(drawFrame);
    }
    drawFrame();

    const stream = canvas.captureStream(30);
    (navigator.mediaDevices as any).getDisplayMedia = async () => stream;
  });
}

test('demo recording', async ({ browser }) => {
  test.setTimeout(90000); // Extended timeout for the full demo flow

  // Alice's context WITH video recording
  const aliceContext = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
    recordVideo: {
      dir: RECORDING_DIR,
      size: { width: 1280, height: 720 },
    },
  });

  // Bob's context (no recording needed)
  const bobContext = await browser.newContext({
    permissions: ['camera', 'microphone'],
    ignoreHTTPSErrors: true,
  });

  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  // --- Alice joins with green/circle webcam ---
  await alicePage.goto(`/s/${SPACE_ID}`);
  await mockPatternedWebcam(alicePage, 140, 'circle'); // green hue, pulsing circle
  await alicePage.fill('#username', 'Alice');
  await alicePage.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(alicePage.locator('#control-bar')).toBeVisible({ timeout: 10000 });

  await alicePage.waitForTimeout(1000);

  // --- Bob joins with orange/diamond webcam ---
  await bobPage.goto(`/s/${SPACE_ID}`);
  await mockPatternedWebcam(bobPage, 25, 'diamond'); // orange hue, rotating diamond
  await bobPage.fill('#username', 'Bob');
  await bobPage.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(bobPage.locator('#control-bar')).toBeVisible({ timeout: 10000 });

  // Wait for Bob's avatar on Alice's view
  await expect(alicePage.locator('.avatar:has-text("Bob")')).toBeVisible({ timeout: 5000 });
  await alicePage.waitForTimeout(1000);

  // --- Alice drags to the LEFT side of the viewport ---
  const aliceAvatar = alicePage.locator('.avatar.self');
  await expect(aliceAvatar).toBeVisible({ timeout: 5000 });
  const aliceBox = await aliceAvatar.boundingBox();
  if (aliceBox) {
    const cx = aliceBox.x + aliceBox.width / 2;
    const cy = aliceBox.y + aliceBox.height / 2;
    await alicePage.mouse.move(cx, cy);
    await alicePage.mouse.down();
    // Sweep to upper-left (~200, 300) — close to where Bob will be
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      await alicePage.mouse.move(
        cx + (200 - cx) * t,
        cy + (300 - cy) * t,
        { steps: 2 },
      );
      await alicePage.waitForTimeout(40);
    }
    await alicePage.mouse.up();
  }
  await alicePage.waitForTimeout(800);

  // --- Bob drags NEAR Alice (spatial audio proximity) ---
  const bobAvatar = bobPage.locator('.avatar.self');
  const bobBox = await bobAvatar.boundingBox();
  if (bobBox) {
    const cx = bobBox.x + bobBox.width / 2;
    const cy = bobBox.y + bobBox.height / 2;
    await bobPage.mouse.move(cx, cy);
    await bobPage.mouse.down();
    // Sweep to just below Alice (~200, 430)
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      await bobPage.mouse.move(
        cx + (200 - cx) * t,
        cy + (430 - cy) * t,
        { steps: 2 },
      );
      await bobPage.waitForTimeout(40);
    }
    await bobPage.mouse.up();
  }
  await alicePage.waitForTimeout(1000);

  // --- Bob starts screen share ---
  await mockAnimatedScreenShare(bobPage);
  await bobPage.click('#btn-screen');
  await expect(alicePage.locator('.screen-share:has-text("Bob")')).toBeVisible({ timeout: 5000 });
  await alicePage.waitForTimeout(500);

  // Drag Bob's screen share to upper-right (fully visible)
  const ssEl = alicePage.locator('.screen-share:has-text("Bob")');
  const ssHeader = ssEl.locator('.screen-share-header');
  const ssBox = await ssHeader.boundingBox();
  if (ssBox) {
    await alicePage.mouse.move(ssBox.x + 5, ssBox.y + 5);
    await alicePage.mouse.down();
    // Target: upper-right area, ~(500, 50)
    await alicePage.mouse.move(500, 50, { steps: 8 });
    await alicePage.mouse.up();
  }
  await alicePage.waitForTimeout(800);

  // --- Alice starts screen share too (multi-screen-share demo) ---
  await mockAnimatedScreenShare(alicePage);
  await alicePage.click('#btn-screen');
  await expect(alicePage.locator('.screen-share:has-text("Your Screen")')).toBeVisible({ timeout: 5000 });

  // Drag Alice's screen share below Bob's, on the right
  const ssAlice = alicePage.locator('.screen-share:has-text("Your Screen")');
  const ssAliceHeader = ssAlice.locator('.screen-share-header');
  const ssAliceBox = await ssAliceHeader.boundingBox();
  if (ssAliceBox) {
    await alicePage.mouse.move(ssAliceBox.x + 5, ssAliceBox.y + 5);
    await alicePage.mouse.down();
    // Target: right side, below Bob's share, ~(500, 300)
    await alicePage.mouse.move(500, 300, { steps: 8 });
    await alicePage.mouse.up();
  }
  await alicePage.waitForTimeout(1000);

  // --- Alice creates a text note ---
  await alicePage.click('#btn-note');
  const note = alicePage.locator('.text-note').first();
  await expect(note).toBeVisible({ timeout: 5000 });

  // Drag note to right-center, above control bar (~600, 420)
  const noteHeader = note.locator('.text-note-header');
  const noteBox = await noteHeader.boundingBox();
  if (noteBox) {
    await alicePage.mouse.move(noteBox.x + 5, noteBox.y + 5);
    await alicePage.mouse.down();
    await alicePage.mouse.move(600, 420, { steps: 8 });
    await alicePage.mouse.up();
  }
  await alicePage.waitForTimeout(500);

  // Alice types markdown into the note
  const aliceEditor = alicePage.locator('.text-note .cm-content').first();
  await aliceEditor.click({ force: true });
  await aliceEditor.focus();
  await alicePage.keyboard.press('ControlOrMeta+A');
  await alicePage.keyboard.press('Backspace');
  await alicePage.keyboard.type('# Meeting Notes\n\n', { delay: 40 });
  await alicePage.keyboard.type('Discussing **spatial audio** design', { delay: 40 });
  await alicePage.waitForTimeout(800);

  // --- Bob types a 2nd paragraph on the same note ---
  await bobPage.waitForSelector('.text-note', { timeout: 10000 });
  const bobEditor = bobPage.locator('.text-note .cm-content').first();
  await bobEditor.click({ force: true });
  await bobEditor.focus();
  await bobPage.keyboard.press('ControlOrMeta+End');
  await bobPage.keyboard.press('Enter');
  await bobPage.keyboard.press('Enter');
  await bobPage.keyboard.type('> Looks great! — *Bob*', { delay: 50 });

  // Hold for 2 seconds so viewer can absorb everything
  await alicePage.waitForTimeout(2000);

  // --- Close contexts to finalize video files ---
  await aliceContext.close();
  await bobContext.close();
});
