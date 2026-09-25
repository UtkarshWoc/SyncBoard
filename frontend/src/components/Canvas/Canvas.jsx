import { useRef, useEffect, useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import {
  TOOLS,
  DEFAULT_LINE_WIDTH,
  ERASER_LINE_WIDTH,
  drawElement,
  redrawCanvas,
} from '../../utils/canvasUtils';

export default function Canvas({ tool, color, lineWidth, elements, setElements }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const { socket } = useSocket();
  const { theme } = useTheme();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState(null);
  const remoteDrawing = useRef({});

  const getCanvasBgColor = () => theme === 'light' ? '#e9ecef' : '#0e0e0e';

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getCanvasBgColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctxRef.current = ctx;

    const handleResize = () => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      ctx.putImageData(imageData, 0, 0);
      redrawCanvas(ctx, canvas, elements, getCanvasBgColor());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [theme]);

  // Redraw when elements or theme change
  useEffect(() => {
    if (ctxRef.current && canvasRef.current) {
      redrawCanvas(ctxRef.current, canvasRef.current, elements, getCanvasBgColor());
    }
  }, [elements, theme]);

  // Socket listeners for remote drawing
  useEffect(() => {
    if (!socket) return;

    socket.on('draw:start', (data) => {
      remoteDrawing.current[data.userId] = {
        tool: data.tool,
        color: data.color,
        lineWidth: data.lineWidth,
        points: [{ x: data.x, y: data.y }],
        startX: data.x,
        startY: data.y,
      };
    });

    socket.on('draw:move', (data) => {
      const remote = remoteDrawing.current[data.userId];
      if (!remote) return;

      const ctx = ctxRef.current;
      const canvas = canvasRef.current;

      if (remote.tool === TOOLS.PENCIL || remote.tool === TOOLS.ERASER) {
        remote.points.push({ x: data.x, y: data.y });
        // Redraw everything + in-progress remote strokes
        redrawCanvas(ctx, canvas, elements, getCanvasBgColor());
        // Draw all in-progress remote strokes
        Object.values(remoteDrawing.current).forEach((r) => {
          drawElement(ctx, { ...r, endX: data.x, endY: data.y }, getCanvasBgColor());
        });
      } else {
        remote.endX = data.x;
        remote.endY = data.y;
        redrawCanvas(ctx, canvas, elements, getCanvasBgColor());
        Object.values(remoteDrawing.current).forEach((r) => {
          if (r.endX !== undefined) drawElement(ctx, r, getCanvasBgColor());
        });
      }
    });

    socket.on('draw:end', (data) => {
      if (data.element) {
        setElements((prev) => [...prev, data.element]);
      }
      delete remoteDrawing.current[data.userId];
    });

    socket.on('canvas:clear', () => {
      setElements([]);
    });

    socket.on('canvas:state', (state) => {
      setElements(state);
    });

    return () => {
      socket.off('draw:start');
      socket.off('draw:move');
      socket.off('draw:end');
      socket.off('canvas:clear');
      socket.off('canvas:state');
    };
  }, [socket, elements, setElements]);

  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const handleStart = useCallback(
    (e) => {
      e.preventDefault();
      const { x, y } = getCanvasCoords(e);
      setIsDrawing(true);

      const lw = tool === TOOLS.ERASER ? ERASER_LINE_WIDTH : lineWidth;
      const newElement = {
        tool,
        color,
        lineWidth: lw,
        points: [{ x, y }],
        startX: x,
        startY: y,
        endX: x,
        endY: y,
      };
      setCurrentElement(newElement);

      socket?.emit('draw:start', { tool, color, lineWidth: lw, x, y });
    },
    [tool, color, lineWidth, socket, getCanvasCoords]
  );

  const handleMove = useCallback(
    (e) => {
      if (!isDrawing || !currentElement) return;
      e.preventDefault();
      const { x, y } = getCanvasCoords(e);
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;

      const updated = { ...currentElement };

      if (tool === TOOLS.PENCIL || tool === TOOLS.ERASER) {
        updated.points = [...currentElement.points, { x, y }];
      }
      updated.endX = x;
      updated.endY = y;

      setCurrentElement(updated);

      // Redraw everything + current in-progress element
      redrawCanvas(ctx, canvas, elements, getCanvasBgColor());
      drawElement(ctx, updated, getCanvasBgColor());
      // Also draw remote in-progress strokes
      Object.values(remoteDrawing.current).forEach((r) => {
        if (r.endX !== undefined) drawElement(ctx, r, getCanvasBgColor());
      });

      socket?.emit('draw:move', { x, y });
    },
    [isDrawing, currentElement, tool, elements, socket, getCanvasCoords]
  );

  const handleEnd = useCallback(
    (e) => {
      if (!isDrawing || !currentElement) return;
      e.preventDefault();
      setIsDrawing(false);

      const finalElement = { ...currentElement };
      setElements((prev) => [...prev, finalElement]);
      setCurrentElement(null);

      socket?.emit('draw:end', { element: finalElement });
    },
    [isDrawing, currentElement, socket, setElements]
  );

  return (
    <canvas
      ref={canvasRef}
      id="whiteboard-canvas"
      className={`whiteboard-canvas ${tool === TOOLS.ERASER ? 'eraser' : ''}`}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    />
  );
}
