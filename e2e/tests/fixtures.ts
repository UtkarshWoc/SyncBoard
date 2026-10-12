import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

let counter = 0;

export interface Person {
  context: BrowserContext;
  page: Page;
  name: string;
  email: string;
}

/** A signed-in user in their own browser context (separate cookies = separate person). */
export async function signUp(browser: Browser, name: string): Promise<Person> {
  counter += 1;
  const email = `${name.toLowerCase()}-${Date.now()}-${counter}@e2e.test`;
  const context = await browser.newContext();
  const page = await context.newPage();
  // Registering through the API sets the refresh cookie in this context.
  const res = await page.request.post('/api/auth/register', {
    data: { email, password: 'e2e password 123', displayName: name },
    headers: { 'X-Requested-With': 'syncboard' },
  });
  expect(res.status(), await res.text()).toBe(201);
  return { context, page, name, email };
}

/** Count of live scene elements of a type, read from the canvas API exposed in E2E builds. */
export function sceneCount(page: Page, type?: string): Promise<number> {
  return page.evaluate((t) => {
    const api = (window as unknown as { __excalidraw?: { getSceneElements(): { type: string }[] } }).__excalidraw;
    if (!api) return -1;
    return api.getSceneElements().filter((e) => !t || e.type === t).length;
  }, type);
}

export async function waitForCanvas(page: Page) {
  await expect(page.getByTestId('board-page')).toBeVisible();
  await expect.poll(() => sceneCount(page)).toBeGreaterThanOrEqual(0);
}

/** Draw a rectangle by dragging on the canvas with the rectangle tool. */
export async function drawRectangle(page: Page, from: [number, number], to: [number, number]) {
  // The test id sits on a visually hidden radio input; click its label.
  await page.locator('label', { has: page.getByTestId('toolbar-rectangle') }).click();
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
}
