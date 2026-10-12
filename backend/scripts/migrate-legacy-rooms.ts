/**
 * One-off migration from the v1 data model (a `rooms` collection with the
 * canvas embedded as an array of pencil/line/rectangle strokes) to v2 boards.
 *
 *   npm run migrate:rooms -w @syncboard/backend            # dry run
 *   npm run migrate:rooms -w @syncboard/backend -- --apply # write changes
 *   ... -- --apply --include-empty                         # also migrate rooms with blank canvases
 *
 * Notes:
 * - Rooms become boards with the same code; anyone with the code can still edit
 *   (generalAccess: editor), matching v1 behaviour. Owners can tighten this later.
 * - v1 stored the creator's display name, not their id. The owner is set only
 *   when exactly one user has that display name; otherwise the board is ownerless.
 * - Eraser strokes painted over pixels in v1 and have no vector equivalent, so
 *   they are skipped. Chat history is not migrated (authors were anonymous sockets).
 * - The `rooms` collection is left untouched.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/lib/logger.js';
import { Board } from '../src/models/Board.js';
import { User } from '../src/models/User.js';
import { writeElements } from '../src/services/sceneService.js';
import type { SceneElement } from '@syncboard/shared';

interface LegacyStroke {
  tool?: string;
  color?: string;
  lineWidth?: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

interface LegacyRoom {
  id: string;
  name?: string;
  isPublic?: boolean;
  createdBy?: string | null;
  canvasState?: LegacyStroke[];
  createdAt?: Date;
  updatedAt?: Date;
}

const apply = process.argv.includes('--apply');
const includeEmpty = process.argv.includes('--include-empty');

/** v1 drew white on a dark canvas. Excalidraw's dark mode inverts colours, so map white to its default ink. */
function mapColor(color: string | undefined): string {
  if (!color) return '#1e1e1e';
  const c = color.toLowerCase();
  if (['#ffffff', '#fff', '#cccccc', '#f0f0f0'].includes(c)) return '#1e1e1e';
  return color;
}

function base(stroke: LegacyStroke, now: number) {
  return {
    id: randomUUID(),
    angle: 0,
    strokeColor: mapColor(stroke.color),
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: Math.max(1, Math.min(4, Math.round((stroke.lineWidth ?? 3) / 2))),
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: randomInt(1, 2 ** 31 - 1),
    version: 1,
    versionNonce: randomInt(1, 2 ** 31 - 1),
    isDeleted: false,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
  };
}

export function convertStroke(stroke: LegacyStroke, now = Date.now()): SceneElement | null {
  switch (stroke.tool) {
    case 'pencil': {
      const pts = stroke.points ?? [];
      if (pts.length < 2) return null;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return {
        ...base(stroke, now),
        type: 'freedraw',
        x,
        y,
        width: Math.max(...xs) - x,
        height: Math.max(...ys) - y,
        points: pts.map((p) => [p.x - x, p.y - y]),
        pressures: [],
        simulatePressure: true,
        lastCommittedPoint: null,
      };
    }
    case 'line': {
      const { startX = 0, startY = 0, endX = 0, endY = 0 } = stroke;
      return {
        ...base(stroke, now),
        type: 'line',
        x: startX,
        y: startY,
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        points: [
          [0, 0],
          [endX - startX, endY - startY],
        ],
        lastCommittedPoint: null,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
      };
    }
    case 'rectangle': {
      const { startX = 0, startY = 0, endX = 0, endY = 0 } = stroke;
      return {
        ...base(stroke, now),
        type: 'rectangle',
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      };
    }
    default:
      return null;
  }
}

async function main() {
  await connectDB(env.MONGODB_URI);
  const db = mongoose.connection.db!;
  const exists = (await db.listCollections({ name: 'rooms' }).toArray()).length > 0;
  if (!exists) {
    logger.info('No legacy `rooms` collection found — nothing to migrate.');
    return;
  }

  const rooms = await db.collection<LegacyRoom>('rooms').find({}).toArray();
  let migrated = 0;
  let skipped = 0;

  for (const room of rooms) {
    if (!room.id || (await Board.exists({ _id: room.id }))) {
      skipped++;
      continue;
    }
    const strokes = room.canvasState ?? [];
    if (strokes.length === 0 && !includeEmpty) {
      skipped++;
      continue;
    }

    const elements = strokes.map((s) => convertStroke(s)).filter((e): e is SceneElement => e !== null);
    let ownerId: mongoose.Types.ObjectId | null = null;
    if (room.createdBy) {
      const matches = await User.find({ displayName: room.createdBy }, { _id: 1 }).limit(2);
      if (matches.length === 1) ownerId = matches[0]!._id as mongoose.Types.ObjectId;
    }

    logger.info(
      {
        room: room.id,
        name: room.name,
        strokes: strokes.length,
        elements: elements.length,
        owner: ownerId?.toString() ?? null,
      },
      apply ? 'Migrating room' : 'Would migrate room',
    );
    if (!apply) continue;

    await Board.create({
      _id: room.id,
      name: (room.name ?? `Board ${room.id}`).slice(0, 60),
      ownerId,
      listed: room.isPublic ?? false,
      generalAccess: 'editor',
      lastActivityAt: room.updatedAt ?? room.createdAt ?? new Date(),
      lastEditedAt: elements.length ? new Date() : null,
    });
    await writeElements(room.id, elements);
    migrated++;
  }

  logger.info({ total: rooms.length, migrated, skipped, dryRun: !apply }, 'Legacy room migration finished');
  if (!apply) logger.info('Dry run only. Re-run with --apply to write changes.');
}

const runDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runDirectly) {
  main()
    .catch((err: unknown) => {
      logger.fatal({ err }, 'Migration failed');
      process.exitCode = 1;
    })
    .finally(() => disconnectDB());
}
