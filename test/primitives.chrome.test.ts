import { describe, expect, it } from "vitest";
import { bar, cardBackground, hr, legendRows } from "../src/svg/primitives";
import { themes } from "../src/theme";

const t = themes.light;

describe("card chrome", () => {
  it("renders a rounded card background rect with theme colors", () => {
    const out = cardBackground(420, 160, t);
    expect(out).toContain("rx=");
    expect(out).toContain(t.background);
    expect(out).toContain(t.cardBorder);
  });

  it("renders a stacked bar with one rect per section", () => {
    const out = bar({
      x: 12,
      y: 100,
      width: 396,
      height: 8,
      sections: [
        { value: 75, color: t.green },
        { value: 25, color: t.blue },
      ],
      theme: t,
    });
    expect((out.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("renders legend rows with color dots and labels", () => {
    const out = legendRows({ x: 12, y: 60, items: [{ label: "Additions", value: "130", color: t.green }], theme: t });
    expect(out).toContain("Additions");
    expect(out).toContain(t.green);
  });

  it("renders an hr line", () => {
    expect(hr(12, 80, t)).toContain("<line");
  });
});
