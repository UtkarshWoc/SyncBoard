import { exportToSvg, restoreElements } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { LIMITS, type BoardVersionSummary, type Role } from '@syncboard/shared';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api, errorMessage } from '../../lib/api';
import type { AppSocket } from '../../lib/socket';
import { timeAgo } from '../../lib/util';
import { renderThumbnail } from '../export/exporters';

const KIND_LABEL = { auto: 'Autosave', manual: 'Saved', 'pre-restore': 'Before restore' } as const;

interface Props {
  boardId: string;
  role: Role;
  socket: AppSocket;
  excalidraw: ExcalidrawImperativeAPI;
  onClose: () => void;
}

export function VersionsDialog({ boardId, role, socket, excalidraw, onClose }: Props) {
  const toast = useToast();
  const [versions, setVersions] = useState<BoardVersionSummary[] | null>(null);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ version: BoardVersionSummary; svg: string } | null>(null);
  const canEdit = role !== 'viewer';

  const load = useCallback(async () => {
    try {
      setVersions(await api.listVersions(boardId));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [boardId, toast]);

  useEffect(() => {
    void load();
    const onUpdated = () => void load();
    socket.on('versions:updated', onUpdated);
    return () => {
      socket.off('versions:updated', onUpdated);
    };
  }, [load, socket]);

  const save = async () => {
    setSaving(true);
    try {
      const thumbnail = (await renderThumbnail(excalidraw)) ?? undefined;
      await api.createVersion(boardId, label.trim(), thumbnail);
      setLabel('');
      toast('Version saved', 'success');
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openPreview = async (version: BoardVersionSummary) => {
    try {
      const detail = await api.getVersion(boardId, version.id);
      const elements = restoreElements(detail.elements as never, null);
      const svg = await exportToSvg({
        elements,
        files: excalidraw.getFiles(),
        appState: { ...excalidraw.getAppState(), exportBackground: true, exportWithDarkMode: false },
        exportPadding: 16,
      });
      // Shown via <img>, never injected as markup: scene data comes from other users, and SVG
      // loaded as an image can't run scripts or load external resources.
      const markup = new XMLSerializer().serializeToString(svg);
      setPreview({ version, svg: URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' })) });
    } catch (err) {
      toast(errorMessage(err, 'Could not open this version'), 'error');
    }
  };

  const restore = async (version: BoardVersionSummary) => {
    if (!window.confirm('Restore this version for everyone? The current board is saved first, so you can undo this.'))
      return;
    try {
      await api.restoreVersion(boardId, version.id);
      toast('Version restored', 'success');
      setPreview(null);
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.svg);
  }, [preview]);

  if (preview) {
    return (
      <Modal
        title={
          preview.version.label ??
          `${KIND_LABEL[preview.version.kind]} · ${new Date(preview.version.createdAt).toLocaleString()}`
        }
        onClose={() => setPreview(null)}
        wide
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>
              Back
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={() => void restore(preview.version)}>
                Restore this version
              </button>
            )}
          </>
        }
      >
        <div className="version-preview">
          <img src={preview.svg} alt="Preview of this version" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Version history" onClose={onClose} wide>
      {canEdit && (
        <div className="row gap version-save">
          <input
            className="input"
            placeholder="Name this version, e.g. “End of lesson 3”"
            value={label}
            maxLength={LIMITS.VERSION_LABEL_MAX}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
          />
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save version'}
          </button>
        </div>
      )}
      <p className="muted small">The board is also saved automatically every few minutes while people are editing.</p>
      {!versions ? (
        <Spinner />
      ) : versions.length === 0 ? (
        <p className="muted">No versions yet.</p>
      ) : (
        <ul className="version-list">
          {versions.map((v) => (
            <li key={v.id}>
              <button className="version-item" onClick={() => void openPreview(v)}>
                <span className="version-thumb">
                  {v.thumbnail ? <img src={v.thumbnail} alt="" /> : <span>{v.elementCount}</span>}
                </span>
                <span className="version-meta">
                  <strong>{v.label ?? KIND_LABEL[v.kind]}</strong>
                  <span className="muted small">
                    {timeAgo(v.createdAt)} · {v.elementCount} item{v.elementCount === 1 ? '' : 's'}
                    {v.createdBy ? ` · ${v.createdBy.displayName}` : ''}
                  </span>
                </span>
                <span className={`kind-chip kind-${v.kind}`}>{KIND_LABEL[v.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
