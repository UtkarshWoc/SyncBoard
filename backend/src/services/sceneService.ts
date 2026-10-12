import { mongo } from 'mongoose';
import { LIMITS, type SceneElement, type StoredFile } from '@syncboard/shared';
import { limitExceeded, notFound } from '../lib/errors.js';
import { sceneElements } from '../lib/metrics.js';
import { BoardElement } from '../models/BoardElement.js';
import { BoardFile } from '../models/BoardFile.js';

export interface ApplyResult {
  accepted: SceneElement[];
  /** Server's current copy of elements the client sent stale versions of. */
  current: SceneElement[];
  dropped: number;
}

const COUNT_TTL_MS = 60_000;
const countCache = new Map<string, { count: number; at: number }>();

async function elementCount(boardId: string): Promise<number> {
  const cached = countCache.get(boardId);
  if (cached && Date.now() - cached.at < COUNT_TTL_MS) return cached.count;
  const count = await BoardElement.countDocuments({ boardId });
  countCache.set(boardId, { count, at: Date.now() });
  if (countCache.size > 5_000) countCache.clear();
  return count;
}

export async function loadElements(boardId: string): Promise<SceneElement[]> {
  const docs = await BoardElement.find({ boardId }, { data: 1, _id: 0 }).lean();
  return docs.map((d) => d.data as SceneElement);
}

/**
 * Apply client edits with last-writer-wins semantics, enforced by the database:
 * an upsert only matches when the stored element is older; otherwise the
 * unique (boardId, elementId) index rejects the insert and the edit is stale.
 */
export async function applyElements(boardId: string, elements: SceneElement[]): Promise<ApplyResult> {
  const valid = elements.filter((el) => JSON.stringify(el).length <= LIMITS.ELEMENT_BYTES_MAX);
  let dropped = elements.length - valid.length;
  if (valid.length === 0) return { accepted: [], current: [], dropped };

  if ((await elementCount(boardId)) >= LIMITS.BOARD_ELEMENTS_MAX) {
    // At the cap, only allow edits to elements that already exist.
    const existing = new Set(
      (await BoardElement.find({ boardId, elementId: { $in: valid.map((e) => e.id) } }, { elementId: 1 }).lean()).map(
        (d) => d.elementId,
      ),
    );
    const before = valid.length;
    valid.splice(0, valid.length, ...valid.filter((e) => existing.has(e.id)));
    dropped += before - valid.length;
    if (valid.length === 0) throw limitExceeded('This board has reached its element limit');
  }

  const ops = valid.map((el) => ({
    updateOne: {
      filter: {
        boardId,
        elementId: el.id,
        $or: [{ version: { $lt: el.version } }, { version: el.version, versionNonce: { $gt: el.versionNonce } }],
      },
      update: {
        $set: { version: el.version, versionNonce: el.versionNonce, isDeleted: Boolean(el.isDeleted), data: el },
      },
      upsert: true,
    },
  }));

  // A duplicate-key error means either "stored copy is newer" or "another writer inserted the
  // element between our filter and our insert". Retrying once settles the race: the document
  // now exists, so the version filter alone decides.
  let pending = ops.map((_, i) => i);
  let rejectedIdx = new Set<number>();
  for (let attempt = 0; attempt < 2 && pending.length > 0; attempt++) {
    rejectedIdx = new Set<number>();
    try {
      await BoardElement.bulkWrite(
        pending.map((i) => ops[i]!),
        { ordered: false },
      );
    } catch (err) {
      if (!(err instanceof mongo.MongoBulkWriteError)) throw err;
      const writeErrors = Array.isArray(err.writeErrors) ? err.writeErrors : [err.writeErrors];
      for (const we of writeErrors) {
        if (we.code !== 11000) throw err;
        rejectedIdx.add(pending[we.index]!);
      }
    }
    pending = [...rejectedIdx];
  }

  const accepted = valid.filter((_, i) => !rejectedIdx.has(i));
  const rejectedIds = valid.filter((_, i) => rejectedIdx.has(i)).map((e) => e.id);
  const current = rejectedIds.length
    ? (await BoardElement.find({ boardId, elementId: { $in: rejectedIds } }, { data: 1 }).lean()).map(
        (d) => d.data as SceneElement,
      )
    : [];

  sceneElements.inc({ outcome: 'accepted' }, accepted.length);
  sceneElements.inc({ outcome: 'stale' }, rejectedIds.length);
  sceneElements.inc({ outcome: 'dropped' }, dropped);
  return { accepted, current, dropped };
}

/** Overwrite elements unconditionally (used by version restore). */
export async function writeElements(boardId: string, elements: SceneElement[]): Promise<void> {
  if (elements.length === 0) return;
  await BoardElement.bulkWrite(
    elements.map((el) => ({
      updateOne: {
        filter: { boardId, elementId: el.id },
        update: {
          $set: { version: el.version, versionNonce: el.versionNonce, isDeleted: Boolean(el.isDeleted), data: el },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  countCache.delete(boardId);
}

/** Drop tombstones nobody needs anymore so deleted strokes don't count against the board forever. */
export async function pruneDeleted(boardId: string, olderThan: Date): Promise<number> {
  const res = await BoardElement.deleteMany({ boardId, isDeleted: true, updatedAt: { $lt: olderThan } });
  countCache.delete(boardId);
  return res.deletedCount;
}

// ─── Files ────────────────────────────────────────────────────

const DATA_URL = /^data:([\w/+.-]+);base64,(.*)$/s;

export async function saveFile(
  boardId: string,
  userId: string,
  file: { id: string; mimeType: string; dataURL: string },
): Promise<boolean> {
  const match = DATA_URL.exec(file.dataURL);
  if (!match) throw limitExceeded('Malformed file');
  const data = Buffer.from(match[2]!, 'base64');
  if (data.length > LIMITS.FILE_BYTES_MAX) {
    throw limitExceeded(`Files must be smaller than ${Math.round(LIMITS.FILE_BYTES_MAX / 1024 / 1024)} MB`);
  }
  const res = await BoardFile.updateOne(
    { boardId, fileId: file.id },
    { $setOnInsert: { mimeType: file.mimeType, data, size: data.length, createdBy: userId } },
    { upsert: true },
  );
  return res.upsertedCount > 0;
}

export async function getFile(boardId: string, fileId: string): Promise<StoredFile> {
  const doc = await BoardFile.findOne({ boardId, fileId });
  if (!doc) throw notFound('File not found');
  return {
    id: doc.fileId,
    mimeType: doc.mimeType,
    dataURL: `data:${doc.mimeType};base64,${doc.data.toString('base64')}`,
    created: (doc.get('createdAt') as Date).getTime(),
  };
}

export async function listFileIds(boardId: string): Promise<string[]> {
  const docs = await BoardFile.find({ boardId }, { fileId: 1, _id: 0 }).lean();
  return docs.map((d) => d.fileId);
}
