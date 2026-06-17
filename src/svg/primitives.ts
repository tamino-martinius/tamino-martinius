import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import type { Theme } from "../theme";

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

export function cardBackground(width: number, height: number, theme: Theme): string {
  return `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${theme.background}" stroke="${theme.cardBorder}" />`;
}

export function hr(x: number, y: number, theme: Theme): string {
  return `<line x1="${x}" y1="${y}" x2="${x + 30}" y2="${y}" stroke="${theme.foregroundLight}" stroke-opacity="0.4" />`;
}

export interface BarSection {
  value: number;
  color: string;
}

export function bar(opts: {
  x: number;
  y: number;
  width: number;
  height: number;
  sections: BarSection[];
  theme: Theme;
}): string {
  const { x, y, width, height, sections, theme } = opts;
  const total = sections.reduce((sum, s) => sum + s.value, 0) || 1;
  let offset = x;
  const rects: string[] = [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${theme.empty}" />`,
  ];
  for (const s of sections) {
    const w = (s.value / total) * width;
    rects.push(
      `<rect x="${offset.toFixed(2)}" y="${y}" width="${w.toFixed(2)}" height="${height}" rx="${height / 2}" fill="${s.color}" />`,
    );
    offset += w;
  }
  return rects.join("");
}

export interface LegendItem {
  label: string;
  value: string;
  color: string;
}

export function legendRows(opts: {
  x: number;
  y: number;
  items: LegendItem[];
  theme: Theme;
  rowHeight?: number;
}): string {
  const { x, y, items, theme, rowHeight = 22 } = opts;
  return items
    .map((item, i) => {
      const cy = y + i * rowHeight;
      const dot = `<circle cx="${x + 4}" cy="${cy - 4}" r="4" fill="${item.color}" />`;
      const label = textPath({
        text: item.label,
        x: x + 16,
        y: cy,
        size: 13,
        weight: "regular",
        color: theme.foreground,
      });
      const value = textPath({
        text: item.value,
        x: x + 200,
        y: cy,
        size: 13,
        weight: "bold",
        color: theme.foregroundLight,
        anchor: "end",
      });
      return `<g aria-label="${escapeXml(`${item.label}: ${item.value}`)}">${dot}${label}${value}</g>`;
    })
    .join("");
}
