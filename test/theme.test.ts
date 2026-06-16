import { describe, expect, it } from "vitest";
import { themes } from "../src/theme";

describe("theme", () => {
  it("exposes light and dark themes with 13 series colors", () => {
    expect(themes.light.series).toHaveLength(13);
    expect(themes.dark.series).toHaveLength(13);
  });

  it("keeps accent colors identical across themes but swaps background", () => {
    expect(themes.light.green).toBe(themes.dark.green);
    expect(themes.light.background).not.toBe(themes.dark.background);
    expect(themes.light.foreground).not.toBe(themes.dark.foreground);
  });
});
