import { describe, expect, it } from "vitest";
import { aggregateGithub } from "../src/aggregate";
import type { GithubStats } from "../src/types";

const stats: GithubStats = {
  user: { name: "T", username: "t", bio: "hi", avatarUrl: "a", url: "u", followerCount: 5, followingCount: 1 },
  languageColors: { Ruby: "#701516", TypeScript: "#3178c6" },
  repositories: [
    {
      public: {
        name: "r1",
        url: "https://x/r1",
        languages: ["Ruby"],
        description: "d",
        stargazerCount: 10,
        forkCount: 0,
      },
      commitsPerDate: { "2024-01-01": { commitCount: 2, additions: 100, deletions: 5, changedFiles: 4 } },
      commitsPerHour: { "Mon, 13": { commitCount: 2, additions: 100, deletions: 5, changedFiles: 4 } },
    },
    {
      commitsPerDate: { "2024-01-02": { commitCount: 3, additions: 30, deletions: 10, changedFiles: 6 } },
      commitsPerHour: { "Mon, 13": { commitCount: 3, additions: 30, deletions: 10, changedFiles: 6 } },
    },
  ],
};

describe("aggregateGithub", () => {
  it("sums commit totals across all repos", () => {
    const g = aggregateGithub(stats);
    expect(g.totals).toEqual({ commitCount: 5, additions: 130, deletions: 15, changedFiles: 10, publicCommitCount: 2 });
  });

  it("buckets commits per hour key", () => {
    const g = aggregateGithub(stats);
    expect(g.commitsPerHour["Mon, 13"]).toBe(5);
  });

  it("buckets commits per weekday", () => {
    const g = aggregateGithub(stats);
    expect(g.commitsPerWeekday.Mon).toBe(5);
  });

  it("credits languages only for public repos, sorted desc", () => {
    const g = aggregateGithub(stats);
    expect(g.topLanguages[0]).toEqual({ language: "Ruby", commitCount: 2, color: "#701516" });
  });
});
