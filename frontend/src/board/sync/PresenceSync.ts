import { zoomToFitBounds } from '@excalidraw/excalidraw';
import type { AppState, Collaborator, ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types';
import type { Participant, PresencePayload, PresenceUpdate, Viewport } from '@syncboard/shared';
import type { AppSocket } from '../../lib/socket';
import { throttle } from '../../lib/util';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Live cursors, selections, laser pointer and "follow" mode, driven through
 * Excalidraw's collaborator map. Viewports ride along with presence so a
 * follower can mirror the person they follow (e.g. students following the tutor).
 */
export class PresenceSync {
  private collaborators = new Map<SocketId, Mutable<Collaborator>>();
  private viewports = new Map<string, Viewport>();
  private following: string | null = null;
  private lastSelection = '';
  private excalidraw: ExcalidrawImperativeAPI | null = null;

  private readonly sendPointer = throttle((p: PresencePayload) => this.socket.volatile.emit('presence:update', p), 40);
  private readonly sendViewport = throttle(
    (v: Viewport) => this.socket.volatile.emit('presence:update', { viewport: v }),
    120,
  );
  private readonly render = throttle(() => {
    this.excalidraw?.updateScene({ collaborators: new Map(this.collaborators) as Map<SocketId, Collaborator> });
  }, 16);

  constructor(private readonly socket: AppSocket) {
    socket.on('presence:update', this.onPresence);
  }

  attach(excalidraw: ExcalidrawImperativeAPI) {
    this.excalidraw = excalidraw;
    this.render();
  }

  dispose() {
    this.socket.off('presence:update', this.onPresence);
    this.sendPointer.cancel();
    this.sendViewport.cancel();
    this.render.cancel();
  }

  /** Rebuild the collaborator list from the server's participant list, keeping live pointer state. */
  setParticipants(participants: Participant[], mySocketId: string | null) {
    const next = new Map<SocketId, Mutable<Collaborator>>();
    for (const p of participants) {
      const id = p.socketId as SocketId;
      const prev = this.collaborators.get(id);
      next.set(id, {
        ...prev,
        id: p.user.id,
        socketId: id,
        username: p.user.displayName,
        avatarUrl: p.user.avatarUrl ?? undefined,
        color: { background: p.color, stroke: p.color },
        isCurrentUser: p.socketId === mySocketId,
        isInCall: p.inCall,
      });
    }
    for (const id of this.viewports.keys()) if (!next.has(id as SocketId)) this.viewports.delete(id);
    if (this.following && !next.has(this.following as SocketId)) this.following = null;
    this.collaborators = next;
    this.render();
  }

  // ─── Outgoing ──────────────────────────────────────────────

  onPointerUpdate(payload: { pointer: { x: number; y: number; tool: 'pointer' | 'laser' }; button: 'up' | 'down' }) {
    this.sendPointer({ pointer: payload.pointer, button: payload.button });
  }

  onAppStateChange(appState: AppState) {
    const key = Object.keys(appState.selectedElementIds).sort().join(',');
    if (key !== this.lastSelection) {
      this.lastSelection = key;
      this.socket.volatile.emit('presence:update', {
        selectedElementIds: { ...appState.selectedElementIds } as Record<string, true>,
      });
    }
  }

  onScrollChange() {
    const s = this.excalidraw?.getAppState();
    if (!s) return;
    this.sendViewport({ scrollX: s.scrollX, scrollY: s.scrollY, zoom: s.zoom.value, width: s.width, height: s.height });
  }

  // ─── Following ─────────────────────────────────────────────

  follow(socketId: string | null) {
    this.following = socketId;
    if (socketId) {
      const vp = this.viewports.get(socketId);
      if (vp) this.applyViewport(vp);
      // Ask everyone to re-announce viewports so we catch up immediately.
      this.onScrollChange();
    }
  }

  private applyViewport(vp: Viewport) {
    const ex = this.excalidraw;
    if (!ex) return;
    // Fit the followed person's visible area into our viewport, whatever our screen size.
    const minX = -vp.scrollX;
    const minY = -vp.scrollY;
    const bounds = [minX, minY, minX + vp.width / vp.zoom, minY + vp.height / vp.zoom] as const;
    const { appState } = zoomToFitBounds({
      bounds: [...bounds],
      appState: ex.getAppState(),
      fitToViewport: true,
      viewportZoomFactor: 1,
    });
    ex.updateScene({ appState: { scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom } });
  }

  // ─── Incoming ──────────────────────────────────────────────

  private onPresence = (update: PresenceUpdate) => {
    const id = update.socketId as SocketId;
    const collaborator = this.collaborators.get(id);
    if (update.viewport) {
      this.viewports.set(update.socketId, update.viewport);
      if (this.following === update.socketId) this.applyViewport(update.viewport);
    }
    if (!collaborator) return;
    if (update.pointer !== undefined) collaborator.pointer = update.pointer ?? undefined;
    if (update.button) collaborator.button = update.button;
    if (update.selectedElementIds) collaborator.selectedElementIds = update.selectedElementIds;
    if (update.pointer !== undefined || update.button || update.selectedElementIds) this.render();
  };
}
