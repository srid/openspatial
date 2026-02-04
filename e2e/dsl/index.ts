/**
 * E2E Test DSL - Main Entry Point
 * 
 * Provides the scenario() function that wraps Playwright tests.
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { ScenarioFn, UserBuilder, User } from './types';
import { UserImpl } from './user';
import { mockWebcam } from './mocks';

export * from './types';
export { mockScreenShare, mockWebcam } from './mocks';

const CONTROL_BAR_TIMEOUT = 10000;

/**
 * Join a space with a given username.
 * Navigates directly to /s/:spaceId and fills in the username.
 */
async function joinSpace(page: Page, username: string, spaceId: string): Promise<void> {
  await page.goto(`/s/${spaceId}`);
  await page.fill('#username', username);
  await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('#control-bar')).toBeVisible({ timeout: CONTROL_BAR_TIMEOUT });
}

class UserBuilderImpl implements UserBuilder {
  private webcamColor: string | null = null;
  
  constructor(
    private name: string,
    private contextFactory: () => Promise<BrowserContext>,
    private spaceId: string,
    private contexts: BrowserContext[]
  ) {}

  withMockedWebcam(color: string = 'green'): UserBuilder {
    this.webcamColor = color;
    return this;
  }

  async join(): Promise<User> {
    const context = await this.contextFactory();
    this.contexts.push(context);
    const page = await context.newPage();
    
    // Navigate to space first to load the SPA (so navigator.mediaDevices exists)
    await page.goto(`/s/${this.spaceId}`);
    
    // Apply webcam mock AFTER navigation but BEFORE join form submission
    // This is when getUserMedia will be called
    if (this.webcamColor) {
      await mockWebcam(page, this.webcamColor);
    }
    
    // Now fill and submit the join form
    await page.fill('#username', this.name);
    await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('#control-bar')).toBeVisible({ timeout: CONTROL_BAR_TIMEOUT });
    
    return new UserImpl(this.name, page);
  }
}

interface ScenarioOptions {
  browser: any; // Playwright browser fixture
}

/**
 * Define an E2E scenario with the given name and space.
 * 
 * @example
 * scenario('both users see each other', 'test-room', async ({ createUser }) => {
 *   const alice = await createUser('Alice').join();
 *   const bob = await createUser('Bob').join();
 *   expect(await alice.visibleUsers()).toEqual(['Bob']);
 * });
 */
export function scenario(name: string, spaceId: string, fn: ScenarioFn): void {
  test(name, async ({ browser }) => {
    const contexts: BrowserContext[] = [];

    const contextFactory = async () => {
      return await browser.newContext({
        permissions: ['camera', 'microphone'],
        ignoreHTTPSErrors: true,
      });
    };

    const createUser = (userName: string): UserBuilder => {
      return new UserBuilderImpl(userName, contextFactory, spaceId, contexts);
    };

    try {
      await fn({ createUser });
    } finally {
      // Clean up all created contexts (ignore errors for already-closed contexts)
      for (const ctx of contexts) {
        try {
          await ctx.close();
        } catch {
          // Context may already be closed
        }
      }
    }
  });
}
