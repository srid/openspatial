/**
 * E2E Test DSL - Main Entry Point
 * 
 * Provides the scenario() function that wraps Playwright tests.
 */
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { ScenarioFn, UserBuilder, User } from './types';
import { UserImpl } from './user';

export * from './types';
export { mockScreenShare } from './mocks';

const CONTROL_BAR_TIMEOUT = 10000;

/**
 * Join a space with a given username.
 */
async function joinSpace(page: Page, username: string, spaceId: string): Promise<void> {
  await page.goto('/');
  await page.fill('#username', username);
  await page.fill('#space-id', spaceId);
  await page.locator('#join-form').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('#control-bar')).toBeVisible({ timeout: CONTROL_BAR_TIMEOUT });
}

class UserBuilderImpl implements UserBuilder {
  constructor(
    private name: string,
    private contextFactory: () => Promise<BrowserContext>,
    private spaceId: string,
    private contexts: BrowserContext[]
  ) {}

  async join(): Promise<User> {
    const context = await this.contextFactory();
    this.contexts.push(context);
    const page = await context.newPage();
    await joinSpace(page, this.name, this.spaceId);
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
