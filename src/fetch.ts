import type { GithubStats, NpmStats } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return (await res.json()) as T;
}

function githubUrl(account: string): string {
  return `https://raw.githubusercontent.com/${account}/github-stats/${account}/data/stats.json`;
}

function npmUrl(account: string): string {
  return `https://raw.githubusercontent.com/${account}/npm-stats/${account}/data/stats.json`;
}

export async function fetchGithubStats(accounts: readonly string[]): Promise<GithubStats> {
  const all = await Promise.all(accounts.map((a) => getJson<GithubStats>(githubUrl(a))));
  const first = all[0];
  if (!first) throw new Error("No github accounts configured");
  const merged: GithubStats = {
    user: first.user,
    languageColors: {},
    repositories: [],
  };
  for (const stats of all) {
    Object.assign(merged.languageColors, stats.languageColors);
    merged.repositories.push(...stats.repositories);
  }
  return merged;
}

export async function fetchNpmStats(account: string): Promise<NpmStats> {
  return getJson<NpmStats>(npmUrl(account));
}

/**
 * Names of repositories owned by the given accounts that are archived on GitHub.
 * The github-stats data has no archived flag, so we read it live from the GitHub REST
 * API to auto-exclude archived repos from the "popular" list. Best-effort: on any error
 * (rate limit, network) it returns whatever it gathered so the build still succeeds.
 * Uses GITHUB_TOKEN if present (higher rate limit; auto-provided in GitHub Actions).
 */
export async function fetchArchivedRepoNames(accounts: readonly string[]): Promise<Set<string>> {
  const archived = new Set<string>();
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  for (const account of accounts) {
    try {
      for (let page = 1; page <= 10; page++) {
        const res = await fetch(
          `https://api.github.com/users/${account}/repos?per_page=100&type=owner&page=${page}`,
          { headers },
        );
        if (!res.ok) break;
        const repos = (await res.json()) as { name: string; archived: boolean }[];
        for (const repo of repos) if (repo.archived) archived.add(repo.name);
        if (repos.length < 100) break;
      }
    } catch {
      // Best-effort: skip this account on failure.
    }
  }
  return archived;
}
