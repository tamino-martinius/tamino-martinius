import type { Theme } from "../theme";
import { cardBackground, measureText, svgDocument, textPath, truncateToWidth } from "./primitives";

const W = 420;
const TILE_H = 64;
const HEADER_H = 40;

export function renderPopularHeader(title: string, theme: Theme): string {
  const body =
    cardBackground(W, HEADER_H, theme) +
    textPath({ text: title, x: 18, y: 26, size: 15, weight: "bold", color: theme.foreground });
  return svgDocument(W, HEADER_H, body);
}

export interface PopularTileOptions {
  name: string;
  description: string;
  value: number;
  valueLabel: string;
  leaderValue: number;
  accent: string;
  theme: Theme;
  valueIcon?: "star" | "download";
}

/** A small 12x12 vector icon drawn at (x, 12), so the font's missing ★/↓ glyphs aren't needed. */
function valueIconShape(kind: "star" | "download", x: number, color: string): string {
  const at = `transform="translate(${x.toFixed(2)}, 12)"`;
  if (kind === "star") {
    return `<path ${at} d="M6 0.5 L7.5 4.2 L11.5 4.5 L8.4 7 L9.4 11 L6 8.8 L2.6 11 L3.6 7 L0.5 4.5 L4.5 4.2 Z" fill="${color}" />`;
  }
  return `<path ${at} d="M6 1 L6 7.5 M3 5 L6 8 L9 5 M2 10.5 L10 10.5" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />`;
}

export function renderPopularTile(opts: PopularTileOptions): string {
  const { name, description, valueLabel, value, leaderValue, accent, theme, valueIcon } = opts;
  const ratio = leaderValue > 0 ? value / leaderValue : 0;
  const barWidth = W - 36;
  const nameText = textPath({
    text: truncateToWidth(name, 14, "bold", 240),
    x: 18,
    y: 24,
    size: 14,
    weight: "bold",
    color: theme.foreground,
  });
  const valueWidth = measureText(valueLabel, 13, "bold");
  const valueText = textPath({
    text: valueLabel,
    x: W - 18,
    y: 24,
    size: 13,
    weight: "bold",
    color: theme.foregroundLight,
    anchor: "end",
  });
  const icon = valueIcon ? valueIconShape(valueIcon, W - 18 - valueWidth - 17, theme.foregroundLight) : "";
  const desc = textPath({
    text: truncateToWidth(description, 12, "regular", barWidth),
    x: 18,
    y: 40,
    size: 12,
    weight: "regular",
    color: theme.foregroundLight,
  });
  const track = `<rect x="18" y="50" width="${barWidth}" height="6" rx="3" fill="${theme.empty}" />`;
  const fill = `<rect x="18" y="50" width="${(barWidth * ratio).toFixed(2)}" height="6" rx="3" fill="${accent}" />`;
  return svgDocument(W, TILE_H, cardBackground(W, TILE_H, theme) + nameText + valueText + icon + desc + track + fill);
}
