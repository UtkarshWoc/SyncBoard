import { randomInt } from 'node:crypto';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';
import { Types, isValidObjectId } from 'mongoose';
import type { BoardVersionDetail, BoardVersionSummary, SceneElement, VersionKind } from '@syncboard/shared';
import { env } from '../config/env.js';
import { notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { iso, toPublicUser } from '../lib/serialize.js';
import { Board } from '../models/Board.js';
import { BoardElement } from '../models/BoardElement.js';
import { BoardVersion } from '../models/BoardVersion.js';
import { User } from '../models/User.js';
import { loadElements, pruneDeleted, writeElements } from './sceneService.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

interface VersionLike {
  id: unknown;
  label?: string | null;
  kind: string;
  createdBy?: Types.ObjectId | null;
  elementCount: number;
  thumbnail?: string | null;
  get(path: 'createdAt'): Date;
}

async function summarize(versions: VersionLike[]): Promise<BoardVersionSummary[]> {
  const ids = [...new Set(versions.map((v) => v.createdBy?.toString()).filter(Boolean))] as string[];
  const users = new Map(
    (await User.find({ _id: { $in: ids } }, { displayName: 1, avatarUrl: 1 })).map((u) => [
      u.id as string,
      toPublicUser(u),
    ]),
  );
  return versions.map((v) => ({
    id: v.id as string,
    label: v.label ?? null,
    kind: v.kind as VersionKind,
    createdAt: iso(v.get('createdAt'))!,
    createdBy: v.createdBy ? (users.get(v.createdBy.toString()) ?? null) : null,
    elementCount: v.elementCount,
    thumbnail: v.thumbnail ?? null,
  }));
}

export async function createVersion(
  boardId: string,
  kind: VersionKind,
  opts: { userId?: string | null; label?: string | null; thumbnail?: string | null } = {},
): Promise<BoardVersionSummary> {
  const live = (await loadElements(boardId)).filter((el) => !el.isDeleted);
  const version = await BoardVersion.create({
    boardId,
    kind,
    label: opts.label || null,
    createdBy: opts.userId ? new Types.ObjectId(opts.userId) : null,
    elementCount: live.length,
    elementsGz: await gzipAsync(JSON.stringify(live)),
    thumbnail: opts.thumbnail ?? null,
  });
  return (await summarize([version]))[0]!;
}

export async function listVersions(boardId: string): Promise<BoardVersionSummary[]> {
  const versions = await BoardVersion.find({ boardId }, { elementsGz: 0 }).sort({ createdAt: -1 }).limit(100);
  return summarize(versions);
}

async function findVersion(boardId: string, versionId: string) {
  if (!isValidObjectId(versionId)) throw notFound('Version not found');
  const version = await BoardVersion.findOne({ _id: versionId, boardId });
  if (!version) throw notFound('Version not found');
  return version;
}

export async function getVersion(boardId: string, versionId: string): Promise<BoardVersionDetail> {
  const version = await findVersion(boardId, versionId);
  const elements = JSON.parse((await gunzipAsync(version.elementsGz)).toString('utf8')) as SceneElement[];
  return { ...(await summarize([version]))[0]!, elements };
}

/**
 * Make the board look like the snapshot. Every touched element gets a version
 * above anything clients have, so the restore wins reconciliation everywhere.
 * Returns the elements that changed, for broadcasting.
 */
export async function restoreVersion(boardId: string, versionId: string, userId: string): Promise<SceneElement[]> {
  const target = await getVersion(boardId, versionId);
  await createVersion(boardId, 'pre-restore', { userId, label: `Before restoring "${target.label ?? 'snapshot'}"` });

  const current = new Map(
    (await BoardElement.find({ boardId }, { elementId: 1, version: 1, isDeleted: 1, data: 1 }).lean()).map((d) => [
      d.elementId,
      d,
    ]),
  );
  const now = Date.now();
  const bump = (base: number) => ({ version: base + 1, versionNonce: randomInt(0, 2 ** 31 - 1), updated: now });

  const changed: SceneElement[] = [];
  const wanted = new Set<string>();
  for (const el of target.elements) {
    wanted.add(el.id);
    const cur = current.get(el.id);
    changed.push({ ...el, isDeleted: false, ...bump(Math.max(cur?.version ?? 0, el.version)) });
  }
  for (const [id, cur] of current) {
    if (wanted.has(id) || cur.isDeleted) continue;
    changed.push({ ...(cur.data as SceneElement), isDeleted: true, ...bump(cur.version) });
  }

  await writeElements(boardId, changed);
  await Board.updateOne({ _id: boardId }, { $set: { lastEditedAt: new Date(), lastActivityAt: new Date() } });
  return changed;
}

async function pruneAutoVersions(boardId: string): Promise<void> {
  const stale = await BoardVersion.find({ boardId, kind: { $in: ['auto', 'pre-restore'] } }, { _id: 1 })
    .sort({ createdAt: -1 })
    .skip(env.SNAPSHOT_KEEP_AUTO);
  if (stale.length) await BoardVersion.deleteMany({ _id: { $in: stale.map((v) => v._id) } });
}

/**
 * Snapshot boards edited since their last snapshot. Boards are claimed with an
 * atomic update so several server instances never snapshot the same board twice.
 */
export async function runAutoSnapshots(onSnapshot?: (boardId: string) => void): Promise<number> {
  const interval = env.SNAPSHOT_INTERVAL_MINUTES * 60_000;
  const now = new Date();
  let done = 0;
  for (let i = 0; i < 20; i++) {
    const board = await Board.findOneAndUpdate(
      {
        lastEditedAt: { $ne: null },
        $and: [
          { $or: [{ lastSnapshotAt: null }, { lastSnapshotAt: { $lt: new Date(now.getTime() - interval) } }] },
          { $expr: { $or: [{ $eq: ['$lastSnapshotAt', null] }, { $gt: ['$lastEditedAt', '$lastSnapshotAt'] }] } },
        ],
      },
      { $set: { lastSnapshotAt: now } },
    );
    if (!board) break;
    try {
      await createVersion(board._id, 'auto');
      await pruneAutoVersions(board._id);
      await pruneDeleted(board._id, new Date(now.getTime() - 7 * 86_400_000));
      onSnapshot?.(board._id);
      done++;
    } catch (err) {
      logger.error({ err, boardId: board._id }, 'Auto snapshot failed');
    }
  }
  return done;
}
