import { describe, expect, it } from "vitest";
import { aggregateNpm, topPackages } from "../src/aggregate";
import type { NpmStats } from "../src/types";

function pkg(name: string, downloads: number) {
  return {
    details: { name, description: `${name} desc`, latestVersion: "1.0.0", links: { npm: `https://npm/${name}` } },
    downloadsPerDate: { "2024-01-01": downloads },
    versionsPerHour: {},
  };
}

const stats: NpmStats = {
  user: { username: "t", versionsPerHour: { "Mon, 13": 4, "Tue, 09": 2 } },
  packages: [pkg("a", 100), pkg("b", 9000), pkg("c", 500)],
};

describe("aggregateNpm", () => {
  it("sums total downloads and package count", () => {
    const n = aggregateNpm(stats);
    expect(n.totals.downloads).toBe(9600);
    expect(n.totals.packageCount).toBe(3);
  });

  it("buckets publishes per hour and weekday", () => {
    const n = aggregateNpm(stats);
    expect(n.publishesPerHour["Mon, 13"]).toBe(4);
    expect(n.publishesPerWeekday.Mon).toBe(4);
    expect(n.publishesPerWeekday.Tue).toBe(2);
  });
});

describe("topPackages", () => {
  it("sorts by total downloads desc, limited to count", () => {
    const top = topPackages(stats, { count: 2, exclude: [] });
    expect(top.map((p) => p.name)).toEqual(["b", "c"]);
    expect(top[0]?.downloads).toBe(9000);
  });

  it("excludes named packages", () => {
    const top = topPackages(stats, { count: 3, exclude: ["b"] });
    expect(top.map((p) => p.name)).toEqual(["c", "a"]);
  });
});
