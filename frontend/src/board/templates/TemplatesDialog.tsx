import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { Modal } from '../../components/ui';
import { insertTemplate } from './insert';
import { TEMPLATES } from './templates';

export function TemplatesDialog({ api, onClose }: { api: ExcalidrawImperativeAPI; onClose: () => void }) {
  return (
    <Modal title="Insert a template" onClose={onClose} wide>
      <p className="muted small">Templates are added where you're looking. Use Ctrl/⌘ + Z to undo.</p>
      <div className="template-grid large">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="template-card"
            onClick={() => {
              insertTemplate(api, t.id);
              onClose();
            }}
          >
            <span className="template-emoji">{t.emoji}</span>
            <strong>{t.name}</strong>
            <span className="muted tiny">{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
