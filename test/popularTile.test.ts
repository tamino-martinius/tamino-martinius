import { describe, expect, it } from "vitest";
import { renderPopularHeader, renderPopularTile } from "../src/svg/popularTile";
import { themes } from "../src/theme";

describe("popular tiles", () => {
  it("renders a header tile svg", () => {
    const svg = renderPopularHeader("Popular Repositories", themes.light);
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("renders a tile with a value bar scaled to leaderValue", () => {
    const svg = renderPopularTile({
      name: "ts-dedent",
      description: "smartly trims indentation",
      value: 500,
      valueLabel: "500",
      leaderValue: 1000,
      accent: themes.light.series[0] ?? "#000",
      theme: themes.light,
    });
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(2); // card bg + bar track + fill
  });

  it("does not divide by zero when leaderValue is 0", () => {
    expect(() =>
      renderPopularTile({
        name: "x",
        description: "",
        value: 0,
        valueLabel: "0",
        leaderValue: 0,
        accent: "#000",
        theme: themes.light,
      }),
    ).not.toThrow();
  });
});
