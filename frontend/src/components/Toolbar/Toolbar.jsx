import { TOOLS, DEFAULT_COLORS, DEFAULT_LINE_WIDTH } from '../../utils/canvasUtils';
import { useSocket } from '../../context/SocketContext';
import {
  HiOutlinePencil,
  HiOutlineMinus,
  HiOutlineTrash,
  HiOutlineArrowUturnLeft,
} from 'react-icons/hi2';
import { BiRectangle, BiEraser } from 'react-icons/bi';

export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  lineWidth,
  setLineWidth,
  onClear,
  onUndo,
}) {
  const tools = [
    { id: TOOLS.PENCIL, icon: <HiOutlinePencil />, label: 'Pencil' },
    { id: TOOLS.LINE, icon: <HiOutlineMinus />, label: 'Line' },
    { id: TOOLS.RECTANGLE, icon: <BiRectangle />, label: 'Rectangle' },
    { id: TOOLS.ERASER, icon: <BiEraser />, label: 'Eraser' },
  ];

  return (
    <div className="toolbar" id="drawing-toolbar">
      {/* Tool buttons */}
      <div className="toolbar-section">
        <span className="toolbar-label">Tools</span>
        <div className="toolbar-buttons">
          {tools.map((t) => (
            <button
              key={t.id}
              id={`tool-${t.id}`}
              className={`toolbar-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="toolbar-section">
        <span className="toolbar-label">Color</span>
        <div className="color-swatches">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Line width */}
      <div className="toolbar-section">
        <span className="toolbar-label">Size: {lineWidth}px</span>
        <input
          id="line-width-slider"
          type="range"
          min="1"
          max="20"
          value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          className="line-width-slider"
        />
      </div>

      {/* Actions */}
      <div className="toolbar-section toolbar-actions">
        <button
          id="undo-btn"
          className="toolbar-btn action-btn"
          onClick={onUndo}
          title="Undo"
        >
          <HiOutlineArrowUturnLeft />
        </button>
        <button
          id="clear-btn"
          className="toolbar-btn action-btn danger"
          onClick={onClear}
          title="Clear Canvas"
        >
          <HiOutlineTrash />
        </button>
      </div>
    </div>
  );
}
