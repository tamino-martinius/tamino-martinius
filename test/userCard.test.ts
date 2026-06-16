import { describe, expect, it } from "vitest";
import { aggregateGithub } from "../src/aggregate";
import { renderUserCard } from "../src/svg/userCard";
import { themes } from "../src/theme";
import type { GithubStats } from "../src/types";

const stats: GithubStats = {
  user: {
    name: "Tamino Martinius",
    username: "t",
    bio: "Staff Engineer",
    avatarUrl: "data:image/png;base64,AA==",
    url: "https://github.com/t",
    followerCount: 158,
    followingCount: 13,
  },
  languageColors: { Ruby: "#701516" },
  repositories: [
    {
      public: { name: "r", url: "u", languages: ["Ruby"], description: "", stargazerCount: 1, forkCount: 0 },
      commitsPerDate: { "2024-01-01": { commitCount: 4, additions: 1, deletions: 1, changedFiles: 1 } },
      commitsPerHour: {},
    },
  ],
};

describe("renderUserCard", () => {
  it("produces an svg with the avatar embedded and a viewBox", () => {
    const g = aggregateGithub(stats);
    const svg = renderUserCard(stats.user, g, themes.light, { topLanguages: 4 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox");
    expect(svg).toContain("data:image/png;base64,AA==");
  });
});
