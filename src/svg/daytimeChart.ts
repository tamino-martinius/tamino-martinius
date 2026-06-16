import { area, curveCatmullRom } from "d3-shape";
import type { Theme } from "../theme";
import { cardBackground, svgDocument, textPath } from "./primitives";

const W = 860;
const H = 240;
const PAD_LEFT = 24;
const PAD_RIGHT = 24;
const PAD_TOP = 50;
const PAD_BOTTOM = 30;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function renderDaytimeChart(title: string, perHour: Record<string, number>, theme: Theme): string {
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;

  // Build a [weekday][hour] matrix and find the global max for scaling.
  let max = 0;
  const matrix = WEEKDAYS.map((wd) =>
    Array.from({ length: 24 }, (_, i) => {
      const v = perHour[`${wd}, ${String(i + 1).padStart(2, "0")}`] ?? 0;
      if (v > max) max = v;
      return v;
    }),
  );
  const yScale = (v: number) => baseY - (max === 0 ? 0 : (v / max) * plotH);
  const xScale = (hour: number) => PAD_LEFT + (hour / 23) * plotW;

  const makeArea = area<number>()
    .x((_d, i) => xScale(i))
    .y0(baseY)
    .y1((d) => yScale(d))
    .curve(curveCatmullRom.alpha(0.5));

  const paths = matrix
    .map((row, i) => {
      const color = theme.series[i] ?? theme.foregroundLight;
      const d = makeArea(row) ?? "";
      return `<path d="${d}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1.5" />`;
    })
    .join("");

  // x-axis labels every 2 hours
  const labels = Array.from({ length: 12 }, (_, i) => i * 2)
    .map((h) =>
      textPath({
        text: `${String(h + 1).padStart(2, "0")}:00`,
        x: xScale(h),
        y: H - 10,
        size: 10,
        weight: "regular",
        color: theme.foregroundLight,
        anchor: "middle",
      }),
    )
    .join("");

  const heading = textPath({ text: title, x: 18, y: 32, size: 16, weight: "bold", color: theme.foreground });

  return svgDocument(W, H, cardBackground(W, H, theme) + heading + paths + labels);
}
