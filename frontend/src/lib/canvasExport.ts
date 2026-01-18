import { Stroke, TextItem, Point } from "@/lib/types";
import { DEFAULT_TEXT_FONT_FAMILY } from "@/lib/typography";

type ExportInput = {
  strokes: Record<string, Stroke>;
  texts: Record<string, TextItem>;
  padding?: number;
  background?: string;
  scale?: number;
};

type ExportResult = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

const DEFAULT_PADDING = 32;
const DEFAULT_SCALE = 2;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotatePoint = (point: Point, radians: number): Point => ({
  x: point.x * Math.cos(radians) - point.y * Math.sin(radians),
  y: point.x * Math.sin(radians) + point.y * Math.cos(radians),
});

const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  if (stroke.points.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }

  ctx.stroke();
};

const drawText = (ctx: CanvasRenderingContext2D, text: TextItem) => {
  const resolvedFontFamily = text.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
  ctx.font = `${text.fontSize}px ${resolvedFontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = text.color;
  const metrics = ctx.measureText(text.content);
  const ascent = metrics.actualBoundingBoxAscent || text.fontSize;
  const descent = metrics.actualBoundingBoxDescent || Math.max(2, text.fontSize * 0.2);
  const center = {
    x: text.position.x + metrics.width / 2,
    y: text.position.y + (-ascent + descent) / 2,
  };
  const rotationRadians = toRadians(text.rotation ?? 0);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotationRadians);
  ctx.translate(-center.x, -center.y);
  ctx.fillText(text.content, text.position.x, text.position.y);
  ctx.restore();
};

const updateBounds = (bounds: number[], x: number, y: number) => {
  bounds[0] = Math.min(bounds[0], x);
  bounds[1] = Math.min(bounds[1], y);
  bounds[2] = Math.max(bounds[2], x);
  bounds[3] = Math.max(bounds[3], y);
};

export function renderBoardToCanvas({
  strokes,
  texts,
  padding = DEFAULT_PADDING,
  background = "#ffffff",
  scale = DEFAULT_SCALE,
}: ExportInput): ExportResult | null {
  const strokeList = Object.values(strokes);
  const textList = Object.values(texts);

  if (strokeList.length === 0 && textList.length === 0) {
    return null;
  }

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) return null;

  const bounds = [Infinity, Infinity, -Infinity, -Infinity];

  for (const stroke of strokeList) {
    if (stroke.points.length === 0) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    const pad = stroke.thickness / 2;
    updateBounds(bounds, minX - pad, minY - pad);
    updateBounds(bounds, maxX + pad, maxY + pad);
  }

  for (const text of textList) {
    const resolvedFontFamily = text.fontFamily || DEFAULT_TEXT_FONT_FAMILY;
    measureCtx.font = `${text.fontSize}px ${resolvedFontFamily}`;
    measureCtx.textBaseline = "alphabetic";
    const metrics = measureCtx.measureText(text.content);
    const ascent = metrics.actualBoundingBoxAscent || text.fontSize;
    const descent = metrics.actualBoundingBoxDescent || Math.max(2, text.fontSize * 0.2);
    const width = metrics.width;
    const height = ascent + descent;
    const center = {
      x: text.position.x + width / 2,
      y: text.position.y + (-ascent + descent) / 2,
    };
    const rotationRadians = toRadians(text.rotation ?? 0);
    const corners = [
      { x: -width / 2, y: -height / 2 },
      { x: width / 2, y: -height / 2 },
      { x: width / 2, y: height / 2 },
      { x: -width / 2, y: height / 2 },
    ];
    for (const corner of corners) {
      const rotated = rotatePoint(corner, rotationRadians);
      updateBounds(bounds, center.x + rotated.x, center.y + rotated.y);
    }
  }

  if (!Number.isFinite(bounds[0])) {
    return null;
  }

  const width = Math.max(1, Math.ceil(bounds[2] - bounds[0] + padding * 2));
  const height = Math.max(1, Math.ceil(bounds[3] - bounds[1] + padding * 2));

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    (padding - bounds[0]) * scale,
    (padding - bounds[1]) * scale
  );

  for (const stroke of strokeList) {
    drawStroke(ctx, stroke);
  }

  for (const text of textList) {
    drawText(ctx, text);
  }

  return { canvas, width, height };
}
