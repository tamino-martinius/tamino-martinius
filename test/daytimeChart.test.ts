import { describe, expect, it } from "vitest";
import { renderDaytimeChart } from "../src/svg/daytimeChart";
import { themes } from "../src/theme";

describe("renderDaytimeChart", () => {
  it("renders one line path per weekday with data", () => {
    const perHour: Record<string, number> = {};
    for (const wd of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      for (let h = 1; h <= 24; h++) perHour[`${wd}, ${String(h).padStart(2, "0")}`] = (h * 3) % 7;
    }
    const svg = renderDaytimeChart("Daytime Chart", perHour, themes.light);
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it("handles empty data without throwing", () => {
    expect(() => renderDaytimeChart("Daytime Chart", {}, themes.light)).not.toThrow();
  });
});
