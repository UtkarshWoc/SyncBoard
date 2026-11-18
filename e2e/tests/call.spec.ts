import { expect, test } from '@playwright/test';
import { signUp, waitForCanvas } from './fixtures';

test('tutor and student connect a voice/video call over WebRTC', async ({ browser }) => {
  const tutor = await signUp(browser, 'Caller');
  const student = await signUp(browser, 'Callee');

  await tutor.page.goto('/');
  await tutor.page.locator('#new-board-btn').click();
  await tutor.page.getByLabel('Board name').fill('Office hours');
  await tutor.page.getByRole('button', { name: 'Anyone can edit' }).click();
  await tutor.page.getByRole('button', { name: 'Create board' }).click();
  await waitForCanvas(tutor.page);
  await student.page.goto(new URL(tutor.page.url()).pathname);
  await waitForCanvas(student.page);

  await tutor.page.getByTitle('Start a voice/video call').click();
  await expect(tutor.page.getByRole('region', { name: 'Voice and video call' })).toBeVisible();

  await student.page.getByTitle(/Join the call/).click();
  const studentDock = student.page.getByRole('region', { name: 'Voice and video call' });
  await expect(studentDock).toBeVisible();

  // Each side ends up with a remote tile whose <video> carries live tracks from the other peer.
  const remoteTracks = (page: typeof tutor.page) =>
    page.evaluate(() => {
      const videos = [...document.querySelectorAll<HTMLVideoElement>('.video-tile video')].slice(1);
      return videos.reduce((n, v) => n + ((v.srcObject as MediaStream | null)?.getTracks().length ?? 0), 0);
    });
  await expect.poll(() => remoteTracks(tutor.page), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => remoteTracks(student.page), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(tutor.page.locator('.video-label', { hasText: 'Callee' })).toBeVisible();

  // Leaving removes the tile on the other side.
  await student.page.getByRole('button', { name: 'Leave call' }).click();
  await expect(tutor.page.locator('.video-label', { hasText: 'Callee' })).toHaveCount(0);

  await tutor.context.close();
  await student.context.close();
});
