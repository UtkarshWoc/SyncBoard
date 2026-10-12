import { CaptureUpdateAction, reconcileElements, restoreElements } from '@excalidraw/excalidraw';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type { BinaryFileData, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { LIMITS, changedSince, chunkBySize, type SceneElement } from '@syncboard/shared';
import { api } from '../../lib/api';
import { emitWithAck, type AppSocket } from '../../lib/socket';
import { throttle } from '../../lib/util';

const SEND_INTERVAL_MS = 50;
const CHUNK_BYTES = 2 * 1024 * 1024;
const FILE_FETCH_CONCURRENCY = 4;

export interface SceneSyncOptions {
  canEdit: () => boolean;
  onError: (message: string) => void;
}

/**
 * Keeps an Excalidraw scene in sync with the server.
 *
 * - Local edits: on every change, send elements whose version moved past what
 *   the server is known to have (`synced`), chunked to fit the socket limit.
 * - Remote edits: reconciled into the local scene without touching the local
 *   undo stack, so undo only ever reverts your own work.
 * - Reconnects: the join snapshot is reconciled with whatever is on screen and
 *   anything newer locally (offline edits) is pushed back up.
 * - Files (images): uploaded once when first referenced; fetched lazily when a
 *   remote image element appears.
 */
export class SceneSync {
  private readonly synced = new Map<string, number>();
  private readonly uploadedFiles = new Set<string>();
  private readonly knownServerFiles = new Set<string>();
  private readonly requestedFiles = new Set<string>();
  private readonly fileQueue: string[] = [];
  private activeFetches = 0;
  private buffer: SceneElement[][] = [];
  private ready = false;
  private disposed = false;
  private readonly sendThrottled = throttle(() => this.flush(), SEND_INTERVAL_MS);

  constructor(
    private readonly socket: AppSocket,
    private readonly boardId: string,
    private readonly opts: SceneSyncOptions,
    private excalidraw: ExcalidrawImperativeAPI | null = null,
  ) {
    socket.on('scene:update', this.onRemoteUpdate);
    socket.on('files:added', this.onFilesAdded);
  }

  private pendingInit: { elements: SceneElement[]; fileIds: string[]; isRejoin: boolean } | null = null;

  /** Excalidraw mounts after the first join; any snapshot that arrived first is applied now. */
  attach(excalidraw: ExcalidrawImperativeAPI) {
    this.excalidraw = excalidraw;
    if (this.pendingInit) {
      const { elements, fileIds, isRejoin } = this.pendingInit;
      this.pendingInit = null;
      this.init(elements, fileIds, isRejoin);
    }
  }

  dispose() {
    this.disposed = true;
    this.sendThrottled.flush();
    this.socket.off('scene:update', this.onRemoteUpdate);
    this.socket.off('files:added', this.onFilesAdded);
  }

  /**
   * Apply the snapshot from a (re)join. On first join the elements were already
   * passed to Excalidraw as initialData; on rejoin they are reconciled with the
   * local scene and any local-only progress is pushed.
   */
  init(serverElements: SceneElement[], fileIds: string[], isRejoin: boolean) {
    if (!this.excalidraw) {
      this.pendingInit = { elements: serverElements, fileIds, isRejoin };
      return;
    }
    this.synced.clear();
    for (const el of serverElements) this.synced.set(el.id, el.version);
    for (const id of fileIds) {
      this.knownServerFiles.add(id);
      this.uploadedFiles.add(id);
    }

    if (isRejoin) this.applyRemote(serverElements);
    this.ready = true;

    // Updates that raced the join ack.
    const pending = this.buffer;
    this.buffer = [];
    for (const batch of pending) this.applyRemote(batch);

    this.loadMissingFiles();
    // Push anything the server doesn't have (offline edits after a reconnect).
    if (isRejoin) this.flush();
  }

  /** Called from Excalidraw's onChange. */
  onLocalChange() {
    if (!this.ready || !this.opts.canEdit()) return;
    this.sendThrottled();
  }

  private flush() {
    const ex = this.excalidraw;
    if (!ex || !this.ready || !this.opts.canEdit() || !this.socket.connected) return;

    const elements = ex.getSceneElementsIncludingDeleted() as unknown as SceneElement[];
    const changed = changedSince(elements, this.synced);
    if (changed.length > 0) {
      for (const el of changed) this.synced.set(el.id, el.version);
      for (const chunk of chunkBySize(changed, LIMITS.ELEMENTS_PER_UPDATE, CHUNK_BYTES)) {
        void emitWithAck<{ accepted: number; rejected: number }>(this.socket, 'scene:update', { elements: chunk }).then(
          (res) => {
            if (!res.ok) {
              // Allow a retry on the next change rather than silently dropping edits.
              for (const el of chunk) this.synced.delete(el.id);
              if (res.error.code !== 'RATE_LIMITED') this.opts.onError(res.error.message);
            }
          },
        );
      }
    }
    this.uploadNewFiles(elements);
  }

  private onRemoteUpdate = ({ elements }: { elements: SceneElement[] }) => {
    if (!this.ready || !this.excalidraw) {
      this.buffer.push(elements);
      return;
    }
    this.applyRemote(elements);
  };

  private applyRemote(remote: SceneElement[]) {
    const ex = this.excalidraw;
    if (!ex || this.disposed || remote.length === 0) return;
    const restored = restoreElements(remote as never, null) as unknown as RemoteExcalidrawElement[];
    const reconciled = reconcileElements(
      ex.getSceneElementsIncludingDeleted() as OrderedExcalidrawElement[],
      restored,
      ex.getAppState(),
    );
    // Record what the server has so these don't bounce back as "local" changes.
    for (const el of remote) {
      if ((this.synced.get(el.id) ?? -1) < el.version) this.synced.set(el.id, el.version);
    }
    ex.updateScene({ elements: reconciled, captureUpdate: CaptureUpdateAction.NEVER });
    this.loadMissingFiles();
  }

  // ─── Files ─────────────────────────────────────────────────

  private onFilesAdded = ({ fileIds }: { fileIds: string[] }) => {
    for (const id of fileIds) {
      this.knownServerFiles.add(id);
      this.uploadedFiles.add(id);
      // An image element may have arrived before its file finished uploading.
      this.requestedFiles.delete(id);
    }
    this.loadMissingFiles();
  };

  private referencedFileIds(): Set<string> {
    const ids = new Set<string>();
    for (const el of this.excalidraw?.getSceneElements() ?? []) {
      if (el.type === 'image' && el.fileId) ids.add(el.fileId);
    }
    return ids;
  }

  private loadMissingFiles() {
    const ex = this.excalidraw;
    if (!ex) return;
    const have = ex.getFiles();
    for (const id of this.referencedFileIds()) {
      if (have[id] || this.requestedFiles.has(id) || !this.knownServerFiles.has(id)) continue;
      this.requestedFiles.add(id);
      this.fileQueue.push(id);
    }
    this.pumpFileQueue();
  }

  private pumpFileQueue() {
    while (this.activeFetches < FILE_FETCH_CONCURRENCY && this.fileQueue.length > 0) {
      const id = this.fileQueue.shift()!;
      this.activeFetches++;
      api
        .getFile(this.boardId, id)
        .then((file) => {
          if (this.disposed) return;
          this.excalidraw?.addFiles([file as unknown as BinaryFileData]);
        })
        .catch(() => this.requestedFiles.delete(id))
        .finally(() => {
          this.activeFetches--;
          this.pumpFileQueue();
        });
    }
  }

  private uploadNewFiles(elements: SceneElement[]) {
    const ex = this.excalidraw;
    if (!ex) return;
    const files = ex.getFiles();
    for (const el of elements) {
      if (el.type !== 'image' || el.isDeleted) continue;
      const fileId = el.fileId as string | null | undefined;
      if (!fileId || this.uploadedFiles.has(fileId)) continue;
      const file = files[fileId];
      if (!file) continue;
      this.uploadedFiles.add(fileId);
      api
        .uploadFile(this.boardId, { id: fileId, mimeType: file.mimeType, dataURL: file.dataURL })
        .then(() => this.knownServerFiles.add(fileId))
        .catch((err: unknown) => {
          this.uploadedFiles.delete(fileId);
          this.opts.onError(err instanceof Error ? `Image upload failed: ${err.message}` : 'Image upload failed');
        });
    }
  }
}
