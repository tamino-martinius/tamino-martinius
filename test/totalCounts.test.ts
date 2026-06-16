import { describe, expect, it } from "vitest";
import { renderGithubTotalCounts, renderNpmTotalCounts } from "../src/svg/totalCounts";
import { themes } from "../src/theme";

describe("total counts cards", () => {
  it("renders github total counts svg with bar sections", () => {
    const svg = renderGithubTotalCounts(
      { commitCount: 1234, additions: 5000, deletions: 2000, changedFiles: 800, publicCommitCount: 1000 },
      themes.light,
    );
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("renders npm total counts svg", () => {
    const svg = renderNpmTotalCounts({ downloads: 999999, versions: 200, packageCount: 103 }, themes.light);
    expect(svg.startsWith("<svg")).toBe(true);
  });
});
