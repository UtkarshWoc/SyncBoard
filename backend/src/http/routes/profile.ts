import { Router } from 'express';
import { updateProfileSchema } from '@syncboard/shared';
import type { Realtime } from '../../lib/realtime.js';
import * as users from '../../services/userService.js';
import { clearRefreshCookie } from '../cookies.js';
import { requireAuth, uid } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export function profileRouter(realtime: Realtime) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    res.json(await users.getProfile(uid(req)));
  });

  router.patch('/', validateBody(updateProfileSchema), async (req, res) => {
    res.json({ user: await users.updateDisplayName(uid(req), req.body.displayName) });
  });

  router.delete('/', async (req, res) => {
    const boardIds = await users.deleteAccount(uid(req));
    await Promise.all(boardIds.map((id) => realtime.removed(id, 'deleted')));
    clearRefreshCookie(res);
    res.status(204).end();
  });

  return router;
}
