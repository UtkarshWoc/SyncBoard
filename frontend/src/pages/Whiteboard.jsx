import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import Canvas from '../components/Canvas/Canvas';
import Toolbar from '../components/Toolbar/Toolbar';
import Chat from '../components/Chat/Chat';
import Participants from '../components/Participants/Participants';
import { TOOLS, DEFAULT_LINE_WIDTH } from '../utils/canvasUtils';
import { HiOutlineArrowLeftOnRectangle, HiOutlineClipboardDocument } from 'react-icons/hi2';

export default function Whiteboard() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();

  const username = user?.displayName || 'Anonymous';

  const [tool, setTool] = useState(TOOLS.PENCIL);
  const [color, setColor] = useState('#FFFFFF');
  const [lineWidth, setLineWidth] = useState(DEFAULT_LINE_WIDTH);
  const [elements, setElements] = useState([]);
  const [copied, setCopied] = useState(false);

  // If user navigated directly (no state), redirect to home
  useEffect(() => {
    if (!location.state) {
      navigate('/', { replace: true });
    }
  }, [location.state, navigate]);

  const handleClear = () => {
    setElements([]);
    socket?.emit('canvas:clear');
  };

  const handleUndo = () => {
    socket?.emit('canvas:undo');
  };

  const handleLeave = () => {
    socket?.emit('room:leave', () => {
      navigate('/');
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roomName = location.state?.roomName || `Room ${roomId}`;

  return (
    <div className="whiteboard-page" id="whiteboard-page">
      {/* Top bar */}
      <header className="whiteboard-header" id="whiteboard-header">
        <div className="header-left">
          <button
            id="leave-room-btn"
            className="header-btn leave-btn"
            onClick={handleLeave}
            title="Leave Room"
          >
            <HiOutlineArrowLeftOnRectangle />
            <span>Leave</span>
          </button>
          <div className="room-info">
            <span className="room-info-name" title={`ID: ${roomId}`}>{roomName}</span>
            <button
              className="copy-code-btn"
              onClick={handleCopyCode}
              title="Copy room code"
              id="copy-code-btn"
            >
              <HiOutlineClipboardDocument />
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>

        <div className="header-center">
          <Toolbar
            tool={tool}
            setTool={setTool}
            color={color}
            setColor={setColor}
            lineWidth={lineWidth}
            setLineWidth={setLineWidth}
            onClear={handleClear}
            onUndo={handleUndo}
          />
        </div>

        <div className="header-right">
          <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            {isConnected ? 'Live' : 'Reconnecting...'}
          </div>
        </div>
      </header>

      {/* Canvas area */}
      <main className="canvas-container" id="canvas-container">
        <Canvas
          tool={tool}
          color={color}
          lineWidth={lineWidth}
          elements={elements}
          setElements={setElements}
        />
      </main>

      {/* Side panels */}
      <Participants />
      <Chat username={username} />
    </div>
  );
}
