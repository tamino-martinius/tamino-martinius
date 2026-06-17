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
