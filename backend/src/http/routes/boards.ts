import { Router, type Request } from 'express';
import {
  createBoardSchema,
  createInviteSchema,
  createVersionSchema,
  thumbnailSchema,
  updateBoardSchema,
  updateMemberSchema,
  uploadFileSchema,
} from '@syncboard/shared';
import { z } from 'zod';
import { HttpError, badRequest } from '../../lib/errors.js';
import type { Realtime } from '../../lib/realtime.js';
import * as boards from '../../services/boardService.js';
import * as scene from '../../services/sceneService.js';
import * as versions from '../../services/versionService.js';
import { requireAuth, uid } from '../middleware/auth.js';
import { authLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';

const param = (req: Request, name: string) => {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) throw badRequest(`Missing ${name}`);
  return value;
};

export function boardsRouter(realtime: Realtime) {
  const router = Router();
  router.use(requireAuth);

  const broadcastUpdate = (boardId: string) =>
    realtime.boardUpdated(boardId, async (userId) => {
      const board = await boards.getBoard(boardId).catch(() => null);
      return board ? boards.summaryFor(board, userId) : null;
    });

  router.get('/', async (req, res) => {
    res.json(await boards.listBoards(uid(req), (ids) => realtime.liveCounts(ids)));
  });

  router.post('/', validateBody(createBoardSchema), async (req, res) => {
    const board = await boards.createBoard(uid(req), req.body);
    res.status(201).json(await boards.summaryFor(board, uid(req)));
  });

  router.get('/:id', async (req, res) => {
    const board = await boards.getBoard(param(req, 'id'));
    const access = boards.resolveAccess(board, uid(req));
    if (!access.role) {
      if (access.needsPassword) {
        throw new HttpError(403, 'PASSWORD_REQUIRED', 'This board is password protected', { name: board.name });
      }
      throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this board');
    }
    res.json(await boards.details(board, uid(req)));
  });

  router.post(
    '/:id/unlock',
    authLimiter,
    validateBody(z.object({ password: z.string().min(1).max(64) })),
    async (req, res) => {
      const board = await boards.getBoard(param(req, 'id'));
      const existing = boards.resolveAccess(board, uid(req)).role;
      const role = existing ?? (await boards.unlockWithPassword(board, uid(req), req.body.password));
      res.json({ role });
    },
  );

  router.patch('/:id', validateBody(updateBoardSchema), async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'owner');
    await boards.updateBoard(board, req.body);
    await broadcastUpdate(board._id);
    res.json(await boards.details(board, uid(req)));
  });

  router.delete('/:id', async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'owner');
    await realtime.removed(board._id, 'deleted');
    await boards.deleteBoard(board._id);
    res.status(204).end();
  });

  router.put('/:id/thumbnail', uploadLimiter, validateBody(thumbnailSchema), async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'editor');
    await boards.setThumbnail(board._id, req.body.dataURL);
    res.status(204).end();
  });

  // ─── Members & invites ───────────────────────────────────────
  router.patch('/:id/members/:userId', validateBody(updateMemberSchema), async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'owner');
    const memberId = param(req, 'userId');
    await boards.setMemberRole(board, memberId, req.body.role);
    realtime.roleChanged(board._id, memberId, req.body.role);
    res.json(await boards.details(await boards.getBoard(board._id), uid(req)));
  });

  router.delete('/:id/members/:userId', async (req, res) => {
    const memberId = param(req, 'userId');
    const self = memberId === uid(req);
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), self ? 'viewer' : 'owner');
    await boards.removeMember(board, memberId);
    // Leaving or being removed may still leave link access; recompute rather than assume.
    const after = await boards.getBoard(board._id);
    if (!boards.resolveAccess(after, memberId).role) await realtime.removed(board._id, 'access-revoked', [memberId]);
    res.status(204).end();
  });

  router.post('/:id/invites', validateBody(createInviteSchema), async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'owner');
    const token = await boards.createInvite(board, uid(req), req.body.role, req.body.expiresInDays);
    res.status(201).json({ token });
  });

  router.delete('/:id/invites/:token', async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'owner');
    await boards.revokeInvite(board, param(req, 'token'));
    res.status(204).end();
  });

  // ─── Files ───────────────────────────────────────────────────
  router.post('/:id/files', uploadLimiter, validateBody(uploadFileSchema), async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'editor');
    const created = await scene.saveFile(board._id, uid(req), req.body);
    if (created) realtime.filesAdded(board._id, [req.body.id]);
    res.status(created ? 201 : 200).json({ id: req.body.id });
  });

  router.get('/:id/files/:fileId', async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'viewer');
    const file = await scene.getFile(board._id, param(req, 'fileId'));
    // File ids are content hashes, so a given URL never changes.
    res.set('Cache-Control', 'private, max-age=31536000, immutable').json(file);
  });

  // ─── Versions ────────────────────────────────────────────────
  router.get('/:id/versions', async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'viewer');
    res.json(await versions.listVersions(board._id));
  });

  router.post('/:id/versions', validateBody(createVersionSchema), async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'editor');
    const version = await versions.createVersion(board._id, 'manual', {
      userId: uid(req),
      label: req.body.label,
      thumbnail: req.body.thumbnail,
    });
    realtime.versionsUpdated(board._id);
    res.status(201).json(version);
  });

  router.get('/:id/versions/:versionId', async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'viewer');
    res.json(await versions.getVersion(board._id, param(req, 'versionId')));
  });

  router.post('/:id/versions/:versionId/restore', async (req, res) => {
    const { board } = await boards.getBoardWithRole(param(req, 'id'), uid(req), 'editor');
    const changed = await versions.restoreVersion(board._id, param(req, 'versionId'), uid(req));
    realtime.sceneChanged(board._id, changed);
    realtime.versionsUpdated(board._id);
    res.json({ changed: changed.length });
  });

  return router;
}

export function invitesRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/:token', async (req, res) => {
    res.json(await boards.previewInvite(param(req, 'token')));
  });

  router.post('/:token/accept', async (req, res) => {
    res.json(await boards.acceptInvite(param(req, 'token'), uid(req)));
  });

  return router;
}
