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

  it("accumulates language commits across multiple dates of a public repo", () => {
    const multi: GithubStats = {
      user: { name: "T", username: "t", bio: "", avatarUrl: "", url: "", followerCount: 0, followingCount: 0 },
      languageColors: { Go: "#00ADD8" },
      repositories: [
        {
          public: { name: "g", url: "u", languages: ["Go"], description: "", stargazerCount: 1, forkCount: 0 },
          commitsPerDate: {
            "2024-01-01": { commitCount: 2, additions: 0, deletions: 0, changedFiles: 0 },
            "2024-01-02": { commitCount: 3, additions: 0, deletions: 0, changedFiles: 0 },
          },
          commitsPerHour: {},
        },
      ],
    };
    const g = aggregateGithub(multi);
    expect(g.topLanguages[0]).toEqual({ language: "Go", commitCount: 5, color: "#00ADD8" });
  });

  it("falls back to a default color for unknown languages", () => {
    const unknown: GithubStats = {
      user: { name: "T", username: "t", bio: "", avatarUrl: "", url: "", followerCount: 0, followingCount: 0 },
      languageColors: {},
      repositories: [
        {
          public: { name: "x", url: "u", languages: ["Brainfuck"], description: "", stargazerCount: 0, forkCount: 0 },
          commitsPerDate: { "2024-01-01": { commitCount: 1, additions: 0, deletions: 0, changedFiles: 0 } },
          commitsPerHour: {},
        },
      ],
    };
    expect(aggregateGithub(unknown).topLanguages[0]?.color).toBe("#888");
  });
});
