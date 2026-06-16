import type { Theme } from "../theme";
import { cardBackground, svgDocument, textPath, truncateToWidth } from "./primitives";

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
}

export function renderPopularTile(opts: PopularTileOptions): string {
  const { name, description, valueLabel, value, leaderValue, accent, theme } = opts;
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
  const valueText = textPath({
    text: valueLabel,
    x: W - 18,
    y: 24,
    size: 13,
    weight: "bold",
    color: theme.foregroundLight,
    anchor: "end",
  });
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
  return svgDocument(W, TILE_H, cardBackground(W, TILE_H, theme) + nameText + valueText + desc + track + fill);
}
