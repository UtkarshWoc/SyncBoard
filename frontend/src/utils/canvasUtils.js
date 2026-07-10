/**
 * Canvas drawing utilities
 */

export const TOOLS = {
  PENCIL: 'pencil',
  RECTANGLE: 'rectangle',
  LINE: 'line',
  ERASER: 'eraser',
};

export const DEFAULT_COLORS = [
  '#FFFFFF', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C42',
  '#6C5CE7', '#00CEC9', '#FD79A8', '#A29BFE',
];

export const DEFAULT_LINE_WIDTH = 3;
export const ERASER_LINE_WIDTH = 20;

/**
 * Draw a single element on canvas context
 */
export function drawElement(ctx, element) {
  if (!element) return;

  ctx.strokeStyle = element.color || '#FFFFFF';
  ctx.lineWidth = element.lineWidth || DEFAULT_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (element.tool) {
    case TOOLS.PENCIL:
      drawPencil(ctx, element.points);
      break;
    case TOOLS.RECTANGLE:
      drawRectangle(ctx, element);
      break;
    case TOOLS.LINE:
      drawLine(ctx, element);
      break;
    case TOOLS.ERASER:
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = element.lineWidth || ERASER_LINE_WIDTH;
      drawPencil(ctx, element.points);
      break;
  }
}

function drawPencil(ctx, points) {
  if (!points || points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function drawRectangle(ctx, element) {
  ctx.beginPath();
  ctx.strokeRect(
    element.startX,
    element.startY,
    element.endX - element.startX,
    element.endY - element.startY
  );
}

function drawLine(ctx, element) {
  ctx.beginPath();
  ctx.moveTo(element.startX, element.startY);
  ctx.lineTo(element.endX, element.endY);
  ctx.stroke();
}

/**
 * Redraw entire canvas from elements array
 */
export function redrawCanvas(ctx, canvas, elements) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  elements.forEach((el) => drawElement(ctx, el));
}
