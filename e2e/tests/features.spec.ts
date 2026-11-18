import { expect, test } from '@playwright/test';
import { accessToken, sceneCount, signUp, waitForCanvas } from './fixtures';

test.describe('tutoring features', () => {
  test('creates a board with Coordinate plane template and verifies elements on canvas', async ({ browser }) => {
    const tutor = await signUp(browser, 'MathTutor');

    await tutor.page.goto('/');
    await tutor.page.locator('#new-board-btn').click();
    await tutor.page.getByLabel('Board name').fill('Graphing Lesson');

    // Select the Coordinate plane template
    await tutor.page.locator('.template-card', { hasText: 'Coordinate plane' }).click();
    await tutor.page.getByRole('button', { name: 'Create board' }).click();

    await expect(tutor.page).toHaveURL(/\/board\/[A-Z0-9]{8}$/);
    await waitForCanvas(tutor.page);

    // The coordinate plane template has axes, grid lines, arrows, labels (> 10 elements)
    await expect.poll(() => sceneCount(tutor.page)).toBeGreaterThan(10);

    await tutor.context.close();
  });

  test('inserts a LaTeX equation and verifies it is added to the scene', async ({ browser }) => {
    const tutor = await signUp(browser, 'PhysicsTutor');

    await tutor.page.goto('/');
    await tutor.page.locator('#new-board-btn').click();
    await tutor.page.getByLabel('Board name').fill('Physics Notes');
    await tutor.page.getByRole('button', { name: 'Create board' }).click();

    await expect(tutor.page).toHaveURL(/\/board\/[A-Z0-9]{8}$/);
    await waitForCanvas(tutor.page);

    // Open equation modal via the welcome screen button
    await tutor.page.getByText('Insert an equation').click();
    await expect(tutor.page.getByRole('heading', { name: 'Insert equation' })).toBeVisible();

    // Select Pythagoras preset
    await tutor.page.getByRole('button', { name: 'Pythagoras' }).click();
    await expect(tutor.page.locator('#latex-input')).toHaveValue('a^2 + b^2 = c^2');

    // Wait for the MathJax preview to render
    await expect(tutor.page.locator('.equation-preview img')).toBeVisible({ timeout: 10_000 });

    // Click Insert
    await tutor.page.getByRole('button', { name: 'Insert', exact: true }).click();

    // Expect an image element to appear in the Excalidraw scene
    await expect.poll(() => sceneCount(tutor.page, 'image')).toBe(1);

    await tutor.context.close();
  });

  test('places and replies to a comment pin', async ({ browser }) => {
    const tutor = await signUp(browser, 'CommentTutor');

    await tutor.page.goto('/');
    await tutor.page.locator('#new-board-btn').click();
    await tutor.page.getByLabel('Board name').fill('Review Board');
    await tutor.page.getByRole('button', { name: 'Create board' }).click();

    await waitForCanvas(tutor.page);

    // Click the comment button in toolbar
    await tutor.page.getByTitle(/Add a comment/).click();
    await expect(tutor.page.locator('.comment-mode-banner')).toBeVisible();

    // Click on canvas to pin a draft comment
    await tutor.page.mouse.click(500, 300);

    // Fill in the comment text and post
    const draftInput = tutor.page.locator('.comment-popover textarea');
    await expect(draftInput).toBeVisible();
    await draftInput.fill('Please check this solution step');
    await tutor.page.getByRole('button', { name: 'Comment', exact: true }).click();

    // Verify comment pin is rendered
    await expect(tutor.page.locator('.comment-pin')).toHaveCount(1);

    // Creating the comment automatically activates and opens the thread popover
    const threadPopover = tutor.page.locator('.comment-popover.thread');
    await expect(threadPopover).toBeVisible();
    await expect(threadPopover.getByText('Please check this solution step')).toBeVisible();

    // Reply to the thread
    const replyInput = threadPopover.locator('input[placeholder="Reply…"]');
    await replyInput.fill('Step looks correct!');
    await threadPopover.getByRole('button', { name: 'Reply' }).click();
    await expect(threadPopover.getByText('Step looks correct!')).toBeVisible();

    // Resolve the thread — the pin turns into a checkmark with .resolved class
    await threadPopover.getByLabel('Resolve thread').click();
    await expect(tutor.page.locator('.comment-pin.resolved')).toHaveCount(1);

    // Closing the active popover hides the resolved pin in default view
    await threadPopover.getByLabel('Close').click();
    await expect(tutor.page.locator('.comment-pin')).toHaveCount(0);

    await tutor.context.close();
  });

  test('tutor invites student with invite link to a restricted board', async ({ browser }) => {
    const tutor = await signUp(browser, 'InvitingTutor');
    const student = await signUp(browser, 'InvitedStudent');

    // Create restricted board
    await tutor.page.goto('/');
    await tutor.page.locator('#new-board-btn').click();
    await tutor.page.getByLabel('Board name').fill('Private Tutoring');
    await tutor.page.getByRole('button', { name: 'Only invited people' }).click();
    await tutor.page.getByRole('button', { name: 'Create board' }).click();

    await waitForCanvas(tutor.page);
    const boardUrl = new URL(tutor.page.url()).pathname;

    // Student tries opening board directly without invite -> forbidden
    await student.page.goto(boardUrl);
    await expect(student.page.getByText("You don't have access")).toBeVisible();

    // Tutor creates invite link via API using their access token
    const boardId = boardUrl.split('/board/')[1]!;
    const res = await tutor.page.request.post(`/api/boards/${boardId}/invites`, {
      data: { role: 'editor', expiresInDays: 7 },
      headers: {
        'X-Requested-With': 'syncboard',
        Authorization: `Bearer ${await accessToken(tutor.page)}`,
      },
    });
    expect(res.status()).toBe(201);
    const { token } = (await res.json()) as { token: string };

    // Student visits invite link
    await student.page.goto(`/invite/${token}`);
    await expect(student.page.getByText('Private Tutoring')).toBeVisible();
    await expect(student.page.getByText(/invited you as an editor/)).toBeVisible();

    // Student accepts invite
    await student.page.getByRole('button', { name: 'Accept and open board' }).click();
    await expect(student.page).toHaveURL(`/board/${boardId}`);
    await waitForCanvas(student.page);

    // Student can now access the board as editor (no "View only" badge)
    await expect(student.page.getByText('View only')).toHaveCount(0);

    await tutor.context.close();
    await student.context.close();
  });

  test('student can exit room, and tutor can end meeting for everyone', async ({ browser }) => {
    const tutor = await signUp(browser, 'HostTutor');
    const student = await signUp(browser, 'LiveStudent');

    // Tutor creates an editable board
    await tutor.page.goto('/');
    await tutor.page.locator('#new-board-btn').click();
    await tutor.page.getByLabel('Board name').fill('Exit Test Board');
    await tutor.page.getByRole('button', { name: 'Anyone can edit' }).click();
    await tutor.page.getByRole('button', { name: 'Create board' }).click();

    await expect(tutor.page).toHaveURL(/\/board\/[A-Z0-9]{8}$/);
    const boardUrl = tutor.page.url();
    await waitForCanvas(tutor.page);

    // Student joins
    await student.page.goto(boardUrl);
    await waitForCanvas(student.page);

    // 1. Student tests the exit flow
    await student.page.locator('#exit-room-btn').click();
    await expect(student.page.getByRole('heading', { name: 'Exit room' })).toBeVisible();
    await student.page.locator('#confirm-exit-btn').click();
    await expect(student.page).toHaveURL('/');

    // Student re-opens the board
    await student.page.goto(boardUrl);
    await waitForCanvas(student.page);

    // 2. Tutor ends the meeting for everyone
    await tutor.page.locator('#exit-room-btn').click();
    await expect(tutor.page.getByRole('heading', { name: 'End meeting or exit' })).toBeVisible();
    await tutor.page.locator('#confirm-end-meeting-btn').click();

    // Tutor returns to dashboard
    await expect(tutor.page).toHaveURL('/');

    // Student sees "Meeting ended" screen
    await expect(student.page.getByText('Meeting ended')).toBeVisible({ timeout: 10_000 });
    await expect(student.page.getByText('The host has ended this meeting for everyone.')).toBeVisible();

    await tutor.context.close();
    await student.context.close();
  });
});
