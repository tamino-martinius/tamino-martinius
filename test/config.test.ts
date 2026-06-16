import { describe, expect, it } from "vitest";
import { config } from "../config";

describe("config", () => {
  it("declares github accounts and an npm account", () => {
    expect(config.github.accounts.length).toBeGreaterThan(0);
    expect(typeof config.npm.account).toBe("string");
  });

  it("declares all seven cards with enabled flags", () => {
    const keys = Object.keys(config.cards);
    expect(keys).toEqual([
      "user",
      "githubTotals",
      "githubDaytime",
      "popularRepos",
      "npmTotals",
      "npmDaytime",
      "popularPackages",
    ]);
  });

  it("popular cards default to 6 items", () => {
    expect(config.cards.popularRepos.count).toBe(6);
    expect(config.cards.popularPackages.count).toBe(6);
  });
});
