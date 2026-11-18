import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFileData, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { getTemplate } from './templates';

/** Centre of what the user is currently looking at, in scene coordinates. */
export function viewportCenter(api: ExcalidrawImperativeAPI) {
  const s = api.getAppState();
  return { x: -s.scrollX + s.width / 2 / s.zoom.value, y: -s.scrollY + s.height / 2 / s.zoom.value };
}

function bounds(elements: readonly ExcalidrawElement[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Add elements centred on the viewport as one undoable step; the normal
 * onChange → SceneSync path broadcasts them.
 */
export function insertSkeletons(
  api: ExcalidrawImperativeAPI,
  skeletons: ExcalidrawElementSkeleton[],
  opts: { files?: BinaryFileData[]; select?: boolean; fit?: boolean } = {},
) {
  if (opts.files?.length) api.addFiles(opts.files);
  const created = convertToExcalidrawElements(skeletons, { regenerateIds: true });
  const b = bounds(created);
  const center = viewportCenter(api);
  const dx = center.x - (b.minX + b.maxX) / 2;
  const dy = center.y - (b.minY + b.maxY) / 2;
  const moved = created.map((el) => ({ ...el, x: el.x + dx, y: el.y + dy }));

  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...moved],
    appState: opts.select
      ? { selectedElementIds: Object.fromEntries(moved.map((e) => [e.id, true as const])) }
      : undefined,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  if (opts.fit) api.scrollToContent(moved, { fitToContent: true });
  return moved;
}

export function insertTemplate(api: ExcalidrawImperativeAPI, id: string): boolean {
  const template = getTemplate(id);
  if (!template) return false;
  insertSkeletons(api, template.build(), { fit: true });
  return true;
}
