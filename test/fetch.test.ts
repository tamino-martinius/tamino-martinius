import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGithubStats, fetchNpmStats } from "../src/fetch";
import type { GithubStats, NpmStats } from "../src/types";

const ghA: GithubStats = {
  user: { name: "A", username: "a", bio: "", avatarUrl: "", url: "", followerCount: 1, followingCount: 0 },
  languageColors: { Ruby: "#701516" },
  repositories: [{ commitsPerDate: {}, commitsPerHour: {} }],
};
const ghB: GithubStats = {
  user: { name: "B", username: "b", bio: "", avatarUrl: "", url: "", followerCount: 2, followingCount: 0 },
  languageColors: { TypeScript: "#3178c6" },
  repositories: [
    { commitsPerDate: {}, commitsPerHour: {} },
    { commitsPerDate: {}, commitsPerHour: {} },
  ],
};
const npm: NpmStats = { user: { username: "a", versionsPerHour: {} }, packages: [] };

function mockFetch(map: Record<string, unknown>) {
  return vi.fn(async (url: string) => ({
    ok: true,
    json: async () => map[url],
  })) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe("fetch", () => {
  it("merges repositories from all github accounts and keeps the first account user", async () => {
    const urlA = "https://raw.githubusercontent.com/a/github-stats/a/data/stats.json";
    const urlB = "https://raw.githubusercontent.com/b/github-stats/b/data/stats.json";
    vi.stubGlobal("fetch", mockFetch({ [urlA]: ghA, [urlB]: ghB }));

    const merged = await fetchGithubStats(["a", "b"]);
    expect(merged.repositories).toHaveLength(3);
    expect(merged.user.username).toBe("a");
    expect(merged.languageColors).toMatchObject({ Ruby: "#701516", TypeScript: "#3178c6" });
  });

  it("fetches npm stats for the account", async () => {
    const url = "https://raw.githubusercontent.com/a/npm-stats/a/data/stats.json";
    vi.stubGlobal("fetch", mockFetch({ [url]: npm }));
    const result = await fetchNpmStats("a");
    expect(result.user.username).toBe("a");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch);
    await expect(fetchNpmStats("a")).rejects.toThrow();
  });
});
