import type { GithubStats, NpmPackage, NpmStats, RepoPublicDetails } from "./types";

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
  // Normalized to numbers (default 0) so downstream rendering never sees undefined.
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: string | null;
}

export function topRepositories(stats: GithubStats, opts: { count: number; exclude: string[] }): TopRepo[] {
  return (
    stats.repositories
      .map((r) => r.public)
      .filter((p): p is RepoPublicDetails => p !== undefined && !opts.exclude.includes(p.name))
      // Treat a missing stargazerCount as 0 so the comparator stays a real number (an
      // undefined would make `b - a` NaN, leaving the sort order — and the top slice — unstable).
      .sort((a, b) => (b.stargazerCount ?? 0) - (a.stargazerCount ?? 0))
      .slice(0, opts.count)
      .map((p) => ({
        ...p,
        stargazerCount: p.stargazerCount ?? 0,
        forkCount: p.forkCount ?? 0,
        primaryLanguage: p.languages[0] ?? null,
      }))
  );
}

export interface NpmTotals {
  downloads: number;
  downloadsThisWeek: number;
  versions: number;
  packageCount: number;
  organizations: number;
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
  let latestDate = "";
  const scopes = new Set<string>();
  for (const p of stats.packages) {
    downloads += sumValues(p.downloadsPerDate);
    const scope = scopeOf(p.details.name);
    if (scope) scopes.add(scope);
    for (const date of Object.keys(p.downloadsPerDate)) {
      if (date > latestDate) latestDate = date;
    }
  }

  // "This week" = the 7 calendar days ending at the latest date present in the data.
  const weekDates = new Set<string>();
  if (latestDate) {
    const end = new Date(`${latestDate}T00:00:00Z`);
    for (let i = 0; i < 7; i++) {
      const day = new Date(end);
      day.setUTCDate(end.getUTCDate() - i);
      weekDates.add(day.toISOString().slice(0, 10));
    }
  }
  let downloadsThisWeek = 0;
  for (const p of stats.packages) {
    for (const [date, count] of Object.entries(p.downloadsPerDate)) {
      if (weekDates.has(date)) downloadsThisWeek += count;
    }
  }

  return {
    totals: {
      downloads,
      downloadsThisWeek,
      versions,
      packageCount: stats.packages.length,
      organizations: scopes.size,
    },
    publishesPerHour,
    publishesPerWeekday,
  };
}

/** The npm scope of a package name, e.g. "@central-icons-react/foo" -> "@central-icons-react"; null if unscoped. */
function scopeOf(name: string): string | null {
  const match = name.match(/^(@[^/]+)\//);
  return match?.[1] ?? null;
}

function npmUrl(pkg: NpmPackage): string {
  return pkg.details.links?.npm ?? `https://www.npmjs.com/package/${pkg.details.name}`;
}

/**
 * Top packages by downloads. Packages published under an npm scope (e.g. `@central-icons-react`)
 * are collapsed into a single entry: downloads are summed across the scope, the entry links to the
 * scope's most-downloaded package, and the description reports how many packages the scope has in
 * the data. Unscoped packages remain individual entries.
 */
export function topPackages(stats: NpmStats, opts: { count: number; exclude: string[] }): TopPackage[] {
  const filtered = stats.packages.filter((p) => !opts.exclude.includes(p.details.name));

  const scopes = new Map<string, NpmPackage[]>();
  const entries: TopPackage[] = [];

  for (const pkg of filtered) {
    const scope = scopeOf(pkg.details.name);
    if (scope) {
      const group = scopes.get(scope) ?? [];
      group.push(pkg);
      scopes.set(scope, group);
    } else {
      entries.push({
        name: pkg.details.name,
        description: pkg.details.description ?? "",
        latestVersion: pkg.details.latestVersion,
        url: npmUrl(pkg),
        downloads: sumValues(pkg.downloadsPerDate),
      });
    }
  }

  for (const [scope, group] of scopes) {
    let downloads = 0;
    let topUrl = "";
    let topVersion = "";
    let topDownloads = -1;
    for (const pkg of group) {
      const pkgDownloads = sumValues(pkg.downloadsPerDate);
      downloads += pkgDownloads;
      if (pkgDownloads > topDownloads) {
        topDownloads = pkgDownloads;
        topUrl = npmUrl(pkg);
        topVersion = pkg.details.latestVersion;
      }
    }
    entries.push({
      name: scope,
      description: `${group.length} package${group.length === 1 ? "" : "s"} in this scope`,
      latestVersion: topVersion,
      url: topUrl,
      downloads,
    });
  }

  return entries.sort((a, b) => b.downloads - a.downloads).slice(0, opts.count);
}

/**
 * Combine multiple per-key numeric series giving each source EQUAL weight: each is
 * normalized to its own max (→ 0..1) before summing, so a high-volume source (e.g.
 * commits) doesn't drown out a low-volume one (e.g. npm publishes).
 */
export function combineEqualWeight(...sources: Record<string, number>[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const source of sources) {
    let max = 0;
    for (const value of Object.values(source)) if (value > max) max = value;
    if (max === 0) continue;
    for (const [key, value] of Object.entries(source)) {
      result[key] = (result[key] ?? 0) + value / max;
    }
  }
  return result;
}
