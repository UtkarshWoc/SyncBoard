import { expect, test, type Page } from '@playwright/test';
import { drawRectangle, sceneCount, signUp, waitForCanvas } from './fixtures';

test.describe('live tutoring session', () => {
  test('tutor creates a board, student joins by link, drawings and chat sync both ways', async ({ browser }) => {
    const tutor = await signUp(browser, 'Tutor');
    const student = await signUp(browser, 'Student');

    // Tutor creates an open-edit board from the dashboard.
    await tutor.page.goto('/');
    await tutor.page.getByRole('button', { name: 'New board' }).click();
    await tutor.page.getByLabel('Board name').fill('Algebra lesson');
    await tutor.page.getByRole('button', { name: 'Anyone can edit' }).click();
    await tutor.page.getByRole('button', { name: 'Create board' }).click();
    await expect(tutor.page).toHaveURL(/\/board\/[A-Z0-9]{8}$/);
    await waitForCanvas(tutor.page);
    const boardUrl = new URL(tutor.page.url()).pathname;

    // Student opens the shared link directly (deep links work after refresh too).
    await student.page.goto(boardUrl);
    await waitForCanvas(student.page);

    // Tutor draws; student sees it.
    await drawRectangle(tutor.page, [400, 300], [560, 420]);
    await expect.poll(() => sceneCount(tutor.page, 'rectangle')).toBe(1);
    await expect.poll(() => sceneCount(student.page, 'rectangle')).toBe(1);

    // Student draws; tutor sees it.
    await drawRectangle(student.page, [650, 300], [760, 380]);
    await expect.poll(() => sceneCount(tutor.page, 'rectangle')).toBe(2);

    // Undo is per user: the student's undo removes only the student's rectangle.
    await student.page.keyboard.press('Control+z');
    await expect.poll(() => sceneCount(student.page, 'rectangle')).toBe(1);
    await expect.poll(() => sceneCount(tutor.page, 'rectangle')).toBe(1);

    // Chat.
    await student.page.getByTitle('Chat').click();
    await student.page.getByLabel('Message').fill('Is x = 4?');
    await student.page.getByLabel('Send').click();
    await tutor.page.getByTitle('Chat').click();
    await expect(tutor.page.getByText('Is x = 4?')).toBeVisible();

    // The board survives a full reload (persisted server-side).
    await student.page.reload();
    await waitForCanvas(student.page);
    await expect.poll(() => sceneCount(student.page, 'rectangle')).toBe(1);

    await tutor.context.close();
    await student.context.close();
  });

  test('view-only links cannot edit and restricted boards are refused', async ({ browser }) => {
    const tutor = await signUp(browser, 'Owner');
    const student = await signUp(browser, 'Viewer');

    const create = async (generalAccess: string) => {
      const res = await tutor.page.request.post('/api/boards', {
        data: { name: `Board ${generalAccess}`, generalAccess },
        headers: { 'X-Requested-With': 'syncboard', Authorization: `Bearer ${await accessToken(tutor.page)}` },
      });
      expect(res.status()).toBe(201);
      return ((await res.json()) as { id: string }).id;
    };

    const viewOnly = await create('viewer');
    await student.page.goto(`/board/${viewOnly}`);
    await waitForCanvas(student.page);
    await expect(student.page.getByText('View only')).toBeVisible();

    const restricted = await create('restricted');
    await student.page.goto(`/board/${restricted}`);
    await expect(student.page.getByText("You don't have access")).toBeVisible();

    await tutor.context.close();
    await student.context.close();
  });

  test('unknown board codes show a friendly message', async ({ browser }) => {
    const user = await signUp(browser, 'Lost');
    await user.page.goto('/board/ZZZZZZZZ');
    await expect(user.page.getByText('Board not found')).toBeVisible();
    await user.context.close();
  });
});

async function accessToken(page: Page): Promise<string> {
  const res = await page.request.post('/api/auth/refresh', { headers: { 'X-Requested-With': 'syncboard' } });
  return ((await res.json()) as { accessToken: string }).accessToken;
}
