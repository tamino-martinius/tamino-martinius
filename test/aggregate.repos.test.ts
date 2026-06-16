import { describe, expect, it } from "vitest";
import { topRepositories } from "../src/aggregate";
import type { GithubStats } from "../src/types";

function repo(name: string, stars: number) {
  return {
    public: {
      name,
      url: `https://x/${name}`,
      languages: ["TS"],
      description: `${name} desc`,
      stargazerCount: stars,
      forkCount: 0,
    },
    commitsPerDate: {},
    commitsPerHour: {},
  };
}

const stats: GithubStats = {
  user: { name: "T", username: "t", bio: "", avatarUrl: "", url: "", followerCount: 0, followingCount: 0 },
  languageColors: {},
  repositories: [repo("a", 5), repo("b", 50), repo("c", 20), { commitsPerDate: {}, commitsPerHour: {} }],
};

describe("topRepositories", () => {
  it("returns public repos sorted by stars desc, limited to count", () => {
    const top = topRepositories(stats, { count: 2, exclude: [] });
    expect(top.map((r) => r.name)).toEqual(["b", "c"]);
  });

  it("excludes named repos", () => {
    const top = topRepositories(stats, { count: 3, exclude: ["b"] });
    expect(top.map((r) => r.name)).toEqual(["c", "a"]);
  });
});
