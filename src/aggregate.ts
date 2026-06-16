import type { GithubStats, NpmStats, RepoPublicDetails } from "./types";

export interface GithubTotals {
  commitCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  publicCommitCount: number;
}

export interface LanguageStat {
  language: string;
  commitCount: number;
  color: string;
}

export interface GithubAggregate {
  totals: GithubTotals;
  commitsPerHour: Record<string, number>; // "Wkd, HH" -> commits
  commitsPerWeekday: Record<string, number>; // "Wkd" -> commits
  topLanguages: LanguageStat[]; // sorted desc, full list (caller slices)
}

const DEFAULT_LANGUAGE_COLOR = "#888";

/** Hour keys are formatted "Wkd, HH" (e.g. "Mon, 13"); the weekday is the first 3 chars. */
function weekdayOf(hourKey: string): string {
  return hourKey.slice(0, 3);
}

export function aggregateGithub(stats: GithubStats): GithubAggregate {
  const totals: GithubTotals = { commitCount: 0, additions: 0, deletions: 0, changedFiles: 0, publicCommitCount: 0 };
  const commitsPerHour: Record<string, number> = {};
  const commitsPerWeekday: Record<string, number> = {};
  const perLanguage: Record<string, number> = {};

  for (const repo of stats.repositories) {
    const isPublic = Boolean(repo.public);
    for (const stat of Object.values(repo.commitsPerDate)) {
      totals.commitCount += stat.commitCount;
      totals.additions += stat.additions;
      totals.deletions += stat.deletions;
      totals.changedFiles += stat.changedFiles;
      if (isPublic) {
        totals.publicCommitCount += stat.commitCount;
        // Credit each language the repo lists with this date's commits (matches metrics.tamino.dev):
        // a language's total = sum of commitCount across all dates of every public repo that uses it.
        for (const lang of repo.public?.languages ?? []) {
          perLanguage[lang] = (perLanguage[lang] ?? 0) + stat.commitCount;
        }
      }
    }
    for (const [hourKey, stat] of Object.entries(repo.commitsPerHour)) {
      commitsPerHour[hourKey] = (commitsPerHour[hourKey] ?? 0) + stat.commitCount;
      const wd = weekdayOf(hourKey);
      commitsPerWeekday[wd] = (commitsPerWeekday[wd] ?? 0) + stat.commitCount;
    }
  }

  const topLanguages: LanguageStat[] = Object.entries(perLanguage)
    .map(([language, commitCount]) => ({
      language,
      commitCount,
      color: stats.languageColors[language] ?? DEFAULT_LANGUAGE_COLOR,
    }))
    .sort((a, b) => b.commitCount - a.commitCount);

  return { totals, commitsPerHour, commitsPerWeekday, topLanguages };
}

export interface TopRepo extends RepoPublicDetails {
  primaryLanguage: string | null;
}

export function topRepositories(stats: GithubStats, opts: { count: number; exclude: string[] }): TopRepo[] {
  return stats.repositories
    .map((r) => r.public)
    .filter((p): p is RepoPublicDetails => p !== undefined && !opts.exclude.includes(p.name))
    .sort((a, b) => b.stargazerCount - a.stargazerCount)
    .slice(0, opts.count)
    .map((p) => ({ ...p, primaryLanguage: p.languages[0] ?? null }));
}

export interface NpmTotals {
  downloads: number;
  versions: number;
  packageCount: number;
}

export interface NpmAggregate {
  totals: NpmTotals;
  publishesPerHour: Record<string, number>;
  publishesPerWeekday: Record<string, number>;
}

export interface TopPackage {
  name: string;
  description: string;
  latestVersion: string;
  url: string;
  downloads: number;
}

function sumValues(record: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(record)) total += v;
  return total;
}

export function aggregateNpm(stats: NpmStats): NpmAggregate {
  const publishesPerHour: Record<string, number> = {};
  const publishesPerWeekday: Record<string, number> = {};
  let versions = 0;
  for (const [hourKey, count] of Object.entries(stats.user.versionsPerHour)) {
    publishesPerHour[hourKey] = (publishesPerHour[hourKey] ?? 0) + count;
    const wd = hourKey.slice(0, 3);
    publishesPerWeekday[wd] = (publishesPerWeekday[wd] ?? 0) + count;
    versions += count;
  }
  let downloads = 0;
  for (const p of stats.packages) downloads += sumValues(p.downloadsPerDate);
  return {
    totals: { downloads, versions, packageCount: stats.packages.length },
    publishesPerHour,
    publishesPerWeekday,
  };
}

export function topPackages(stats: NpmStats, opts: { count: number; exclude: string[] }): TopPackage[] {
  return stats.packages
    .filter((p) => !opts.exclude.includes(p.details.name))
    .map((p) => ({
      name: p.details.name,
      description: p.details.description ?? "",
      latestVersion: p.details.latestVersion,
      url: p.details.links?.npm ?? `https://www.npmjs.com/package/${p.details.name}`,
      downloads: sumValues(p.downloadsPerDate),
    }))
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, opts.count);
}
