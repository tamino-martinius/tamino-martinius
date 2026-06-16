import type { GithubStats } from "./types";

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
