import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

export type Weight = "regular" | "bold";

const FONT_PATHS: Record<Weight, string> = {
  regular: fileURLToPath(new URL("../../fonts/NutanixSoft-Medium.otf", import.meta.url)),
  bold: fileURLToPath(new URL("../../fonts/NutanixSoft-Bold.otf", import.meta.url)),
};

const fontCache = new Map<Weight, opentype.Font>();

function font(weight: Weight): opentype.Font {
  const cached = fontCache.get(weight);
  if (cached) return cached;
  const buffer = readFileSync(FONT_PATHS[weight]);
  const parsed = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  fontCache.set(weight, parsed);
  return parsed;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function measureText(text: string, size: number, weight: Weight): number {
  return font(weight).getAdvanceWidth(text, size);
}

export function truncateToWidth(text: string, size: number, weight: Weight, maxWidth: number): string {
  if (measureText(text, size, weight) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && measureText(`${result}…`, size, weight) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

export interface TextOptions {
  text: string;
  x: number;
  y: number; // baseline
  size: number;
  weight: Weight;
  color: string;
  anchor?: "start" | "middle" | "end";
}

export function textPath(opts: TextOptions): string {
  const { text, x, y, size, weight, color, anchor = "start" } = opts;
  let drawX = x;
  if (anchor !== "start") {
    const width = measureText(text, size, weight);
    drawX = anchor === "middle" ? x - width / 2 : x - width;
  }
  const path = font(weight).getPath(text, drawX, y, size);
  return `<path d="${path.toPathData(2)}" fill="${color}" />`;
}

export function svgDocument(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${body}</svg>`;
}
