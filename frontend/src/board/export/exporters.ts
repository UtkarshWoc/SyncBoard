import { exportToBlob, exportToCanvas } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { LIMITS } from '@syncboard/shared';
import { blobToDataURL } from '../../lib/util';

function liveScene(api: ExcalidrawImperativeAPI) {
  return {
    elements: api.getSceneElements(),
    files: api.getFiles(),
    appState: api.getAppState(),
  };
}

/** Export the whole board as a single-page PDF sized to the content — handy as a lesson handout. */
export async function exportPdf(api: ExcalidrawImperativeAPI, fileName: string): Promise<void> {
  const { elements, files, appState } = liveScene(api);
  if (elements.length === 0) throw new Error('The board is empty');
  const [{ jsPDF }, canvas] = await Promise.all([
    import('jspdf'),
    exportToCanvas({
      elements,
      files,
      appState: { ...appState, exportBackground: true, exportWithDarkMode: false, viewBackgroundColor: '#ffffff' },
      exportPadding: 24,
      maxWidthOrHeight: 4000,
    }),
  ]);
  const landscape = canvas.width >= canvas.height;
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
  pdf.save(`${fileName.replace(/[^\w\- ]+/g, '').trim() || 'board'}.pdf`);
}

/** Small preview for the dashboard and version history. Returns null for empty boards or oversized output. */
export async function renderThumbnail(api: ExcalidrawImperativeAPI): Promise<string | null> {
  const { elements, files, appState } = liveScene(api);
  if (elements.length === 0) return null;
  for (const [mimeType, quality] of [
    ['image/webp', 0.75],
    ['image/jpeg', 0.7],
  ] as const) {
    const blob = await exportToBlob({
      elements,
      files,
      appState: { ...appState, exportBackground: true, exportWithDarkMode: appState.theme === 'dark' },
      mimeType,
      quality,
      maxWidthOrHeight: 480,
      exportPadding: 16,
    });
    // Some browsers silently fall back to PNG for unsupported types.
    if (blob.size <= LIMITS.THUMBNAIL_BYTES_MAX && blob.type !== 'image/png') return blobToDataURL(blob);
  }
  return null;
}
