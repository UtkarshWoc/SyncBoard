import type { BoardSummary, Role, SceneElement } from '@syncboard/shared';

/**
 * What the HTTP layer needs to push to connected clients. Implemented by the
 * socket layer; a no-op version keeps REST usable (and testable) without it.
 */
export interface Realtime {
  filesAdded(boardId: string, fileIds: string[]): void;
  /** Board settings changed; each client re-fetches its own role-specific view. */
  boardUpdated(boardId: string, summaryFor: (userId: string) => Promise<BoardSummary | null>): Promise<void>;
  roleChanged(boardId: string, userId: string, role: Role): void;
  removed(boardId: string, reason: 'deleted' | 'access-revoked', userIds?: string[]): Promise<void>;
  sceneChanged(boardId: string, elements: SceneElement[]): void;
  versionsUpdated(boardId: string): void;
  liveCounts(boardIds: string[]): Promise<Map<string, number>>;
}

export const noopRealtime: Realtime = {
  filesAdded: () => {},
  boardUpdated: async () => {},
  roleChanged: () => {},
  removed: async () => {},
  sceneChanged: () => {},
  versionsUpdated: () => {},
  liveCounts: async () => new Map(),
};
