# README Stats Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nightly-generate the GitHub profile README's stats cards as self-contained, theme-adaptive SVGs that reproduce the metrics.tamino.dev design, driven by a single `config.ts`.

**Architecture:** A small TypeScript/Node project. `fetch.ts` pulls the two upstream `stats.json` files; `aggregate.ts` reduces them to typed summaries (pure functions); `svg/*.ts` render each card as an SVG string using `opentype.js` for text (rendered as vector paths from Nutanix Soft `.otf`, so the font is identical on GitHub) and `d3-shape` for the Daytime chart paths; `readme.ts` writes the `<picture>`/`<a>` markup between markers; `index.ts` orchestrates. A nightly GitHub Action runs it and commits changes.

**Tech Stack:** TypeScript (ESM), `tsx` (run), `vitest` (test), `d3-shape`, `opentype.js`, `@biomejs/biome` (lint/format). Node 22.

**Note on a refinement from the spec:** The spec listed font *embedding* as primary with text→paths as fallback. This plan uses **text→paths as primary** (via `opentype.js`) because it removes GitHub's font-stripping risk entirely and produces smaller SVGs (only used glyphs become paths). Same approach (hand-written SVG), strictly safer.

**Key conventions (used across tasks — keep names consistent):**
- Hour keys: `` `${Weekday}, ${HH}` `` e.g. `"Thu, 13"`. Weekdays: `Sun Mon Tue Wed Thu Fri Sat`. Hours: `"01".."24"`.
- Raw GitHub repo `commitsPerHour`/`commitsPerDate` values are `{ commitCount, additions, deletions, changedFiles }`.
- Public repos carry `public: { name, url, languages: string[], description, stargazerCount, forkCount }`.
- npm: `user.versionsPerHour` is `Record<HourKey, number>`; each package has `details`, `downloadsPerDate: Record<string,number>`.
- Card width constants: `CARD_W = 420`, `FULL_W = 860`, tile `TILE_W = 420`, `TILE_H = 64`.
- `AggregatedStats` interface (defined in Task 4, extended in 5–6) is the single data object passed to every renderer.

---

## Task 0: Scaffold the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `src/.gitkeep`, `src/svg/.gitkeep`, `test/.gitkeep`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "readme-stats-generator",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "format": "biome format --write ."
  },
  "dependencies": {
    "d3-shape": "^3.2.0",
    "opentype.js": "^1.3.4"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/d3-shape": "^3.1.6",
    "@types/node": "^22.10.0",
    "@types/opentype.js": "^1.3.8",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src", "test", "config.ts"]
}
```

- [ ] **Step 3: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 120 },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "files": { "ignore": ["dist", "assets", "fonts", "node_modules"] }
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 5: Create placeholder dirs**

```bash
mkdir -p src/svg test assets fonts
touch src/.gitkeep src/svg/.gitkeep test/.gitkeep
```

- [ ] **Step 6: Install and verify**

Run: `npm install && npm run lint`
Expected: install succeeds; `biome check` reports no files-to-fix errors (it may report 0 files checked or pass).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json biome.json vitest.config.ts src/.gitkeep src/svg/.gitkeep test/.gitkeep
git commit -m "chore: scaffold readme stats generator project"
```

---

## Task 1: Config file

**Files:**
- Create: `config.ts`
- Test: `test/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/config.test.ts
import { describe, expect, it } from 'vitest';
import { config } from '../config';

describe('config', () => {
  it('declares github accounts and an npm account', () => {
    expect(config.github.accounts.length).toBeGreaterThan(0);
    expect(typeof config.npm.account).toBe('string');
  });

  it('declares all seven cards with enabled flags', () => {
    const keys = Object.keys(config.cards);
    expect(keys).toEqual([
      'user', 'githubTotals', 'githubDaytime', 'popularRepos',
      'npmTotals', 'npmDaytime', 'popularPackages',
    ]);
  });

  it('popular cards default to 6 items', () => {
    expect(config.cards.popularRepos.count).toBe(6);
    expect(config.cards.popularPackages.count).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/config.test.ts`
Expected: FAIL — cannot find module `../config`.

- [ ] **Step 3: Create `config.ts`**

```ts
export interface PopularCardConfig {
  enabled: boolean;
  count: number;
  sortBy: 'stars' | 'downloads';
  exclude: string[];
}

export const config = {
  github: { accounts: ['tamino-martinius', 'tamino-cookieai'] },
  npm: { account: 'tamino-martinius' },
  cards: {
    user: { enabled: true, topLanguages: 4 },
    githubTotals: { enabled: true },
    githubDaytime: { enabled: true },
    popularRepos: { enabled: true, count: 6, sortBy: 'stars', exclude: [] } as PopularCardConfig,
    npmTotals: { enabled: true },
    npmDaytime: { enabled: true },
    popularPackages: { enabled: true, count: 6, sortBy: 'downloads', exclude: [] } as PopularCardConfig,
  },
  output: { assetsDir: 'assets', readme: 'README.md' },
} as const;

export type Config = typeof config;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add config.ts test/config.test.ts
git commit -m "feat: add config.ts driving card generation"
```

---

## Task 2: Raw stats types + fetch with multi-account merge

**Files:**
- Create: `src/types.ts`, `src/fetch.ts`
- Test: `test/fetch.test.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
// Shapes of the upstream stats.json files (only the fields we consume).
export interface CommitStat {
  commitCount: number;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface RepoPublicDetails {
  name: string;
  url: string;
  languages: string[];
  description: string;
  stargazerCount: number;
  forkCount: number;
}

export interface Repository {
  public?: RepoPublicDetails;
  commitsPerDate: Record<string, CommitStat>;
  commitsPerHour: Record<string, CommitStat>;
}

export interface GithubUser {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  url: string;
  followerCount: number;
  followingCount: number;
}

export interface GithubStats {
  user: GithubUser;
  languageColors: Record<string, string>;
  repositories: Repository[];
}

export interface NpmPackage {
  details: {
    name: string;
    description: string;
    latestVersion: string;
    license?: string;
    links?: { npm?: string; repository?: string; homepage?: string };
  };
  downloadsPerDate: Record<string, number>;
  versionsPerHour: Record<string, number>;
}

export interface NpmStats {
  user: { username: string; versionsPerHour: Record<string, number> };
  packages: NpmPackage[];
}
```

- [ ] **Step 2: Write the failing test**

```ts
// test/fetch.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGithubStats, fetchNpmStats } from '../src/fetch';
import type { GithubStats, NpmStats } from '../src/types';

const ghA: GithubStats = {
  user: { name: 'A', username: 'a', bio: '', avatarUrl: '', url: '', followerCount: 1, followingCount: 0 },
  languageColors: { Ruby: '#701516' },
  repositories: [{ commitsPerDate: {}, commitsPerHour: {} }],
};
const ghB: GithubStats = {
  user: { name: 'B', username: 'b', bio: '', avatarUrl: '', url: '', followerCount: 2, followingCount: 0 },
  languageColors: { TypeScript: '#3178c6' },
  repositories: [{ commitsPerDate: {}, commitsPerHour: {} }, { commitsPerDate: {}, commitsPerHour: {} }],
};
const npm: NpmStats = { user: { username: 'a', versionsPerHour: {} }, packages: [] };

function mockFetch(map: Record<string, unknown>) {
  return vi.fn(async (url: string) => ({
    ok: true,
    json: async () => map[url],
  })) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe('fetch', () => {
  it('merges repositories from all github accounts and keeps the first account user', async () => {
    const urlA = 'https://raw.githubusercontent.com/a/github-stats/a/data/stats.json';
    const urlB = 'https://raw.githubusercontent.com/b/github-stats/b/data/stats.json';
    vi.stubGlobal('fetch', mockFetch({ [urlA]: ghA, [urlB]: ghB }));

    const merged = await fetchGithubStats(['a', 'b']);
    expect(merged.repositories).toHaveLength(3);
    expect(merged.user.username).toBe('a');
    expect(merged.languageColors).toMatchObject({ Ruby: '#701516', TypeScript: '#3178c6' });
  });

  it('fetches npm stats for the account', async () => {
    const url = 'https://raw.githubusercontent.com/a/npm-stats/a/data/stats.json';
    vi.stubGlobal('fetch', mockFetch({ [url]: npm }));
    const result = await fetchNpmStats('a');
    expect(result.user.username).toBe('a');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })) as unknown as typeof fetch);
    await expect(fetchNpmStats('a')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/fetch.test.ts`
Expected: FAIL — cannot find module `../src/fetch`.

- [ ] **Step 4: Create `src/fetch.ts`**

```ts
import type { GithubStats, NpmStats } from './types';

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
  if (!first) throw new Error('No github accounts configured');
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/fetch.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/fetch.ts test/fetch.test.ts
git commit -m "feat: fetch + merge upstream github/npm stats"
```

---

## Task 3: Theme palettes (light + dark)

**Files:**
- Create: `src/theme.ts`
- Test: `test/theme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/theme.test.ts
import { describe, expect, it } from 'vitest';
import { themes } from '../src/theme';

describe('theme', () => {
  it('exposes light and dark themes with 13 series colors', () => {
    expect(themes.light.series).toHaveLength(13);
    expect(themes.dark.series).toHaveLength(13);
  });

  it('keeps accent colors identical across themes but swaps background', () => {
    expect(themes.light.green).toBe(themes.dark.green);
    expect(themes.light.background).not.toBe(themes.dark.background);
    expect(themes.light.foreground).not.toBe(themes.dark.foreground);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/theme.test.ts`
Expected: FAIL — cannot find module `../src/theme`.

- [ ] **Step 3: Create `src/theme.ts`**

```ts
export interface Theme {
  name: 'light' | 'dark';
  background: string;
  cardBorder: string;
  foreground: string;
  foregroundLight: string;
  empty: string;
  green: string;
  blue: string;
  red: string;
  series: string[]; // color-1 .. color-13
}

// color-1 .. color-13 from metrics src/style/index.css (color-0 #d4dae1 is the empty/track color).
const SERIES = [
  '#673bd6', '#535ae0', '#3f77e9', '#2c96f2', '#34adf0', '#56bce1', '#7accd4',
  '#9ddbc6', '#d5efe4', '#dddae4', '#e5aed4', '#e986b4', '#ff8585',
];

export const themes: Record<'light' | 'dark', Theme> = {
  light: {
    name: 'light',
    background: '#ffffff',
    cardBorder: '#f2f4f6',
    foreground: '#22272e',
    foregroundLight: '#627386',
    empty: '#f4faff',
    green: '#00d559',
    blue: '#00a5fe',
    red: '#f05033',
    series: SERIES,
  },
  dark: {
    name: 'dark',
    background: '#161b22',
    cardBorder: '#30363d',
    foreground: '#e6edf3',
    foregroundLight: '#9aa7b4',
    empty: '#21262d',
    green: '#00d559',
    blue: '#00a5fe',
    red: '#f05033',
    series: SERIES,
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/theme.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts test/theme.test.ts
git commit -m "feat: add light/dark theme palettes from metrics tokens"
```

---

## Task 4: Aggregate — GitHub commit totals, per-hour/weekday, languages

**Files:**
- Create: `src/aggregate.ts`
- Test: `test/aggregate.github.test.ts`

This task defines the `AggregatedStats` interface (extended in Tasks 5–6) and the GitHub commit aggregation.

- [ ] **Step 1: Write the failing test**

```ts
// test/aggregate.github.test.ts
import { describe, expect, it } from 'vitest';
import { aggregateGithub } from '../src/aggregate';
import type { GithubStats } from '../src/types';

const stats: GithubStats = {
  user: { name: 'T', username: 't', bio: 'hi', avatarUrl: 'a', url: 'u', followerCount: 5, followingCount: 1 },
  languageColors: { Ruby: '#701516', TypeScript: '#3178c6' },
  repositories: [
    {
      public: { name: 'r1', url: 'https://x/r1', languages: ['Ruby'], description: 'd', stargazerCount: 10, forkCount: 0 },
      commitsPerDate: { '2024-01-01': { commitCount: 2, additions: 100, deletions: 5, changedFiles: 4 } },
      commitsPerHour: { 'Mon, 13': { commitCount: 2, additions: 100, deletions: 5, changedFiles: 4 } },
    },
    {
      // private repo: no public details, no language credit
      commitsPerDate: { '2024-01-02': { commitCount: 3, additions: 30, deletions: 10, changedFiles: 6 } },
      commitsPerHour: { 'Mon, 13': { commitCount: 3, additions: 30, deletions: 10, changedFiles: 6 } },
    },
  ],
};

describe('aggregateGithub', () => {
  it('sums commit totals across all repos', () => {
    const g = aggregateGithub(stats);
    expect(g.totals).toEqual({ commitCount: 5, additions: 130, deletions: 15, changedFiles: 10, publicCommitCount: 2 });
  });

  it('buckets commits per hour key', () => {
    const g = aggregateGithub(stats);
    expect(g.commitsPerHour['Mon, 13']).toBe(5);
  });

  it('buckets commits per weekday', () => {
    const g = aggregateGithub(stats);
    expect(g.commitsPerWeekday.Mon).toBe(5);
  });

  it('credits languages only for public repos, sorted desc', () => {
    const g = aggregateGithub(stats);
    expect(g.topLanguages[0]).toEqual({ language: 'Ruby', commitCount: 2, color: '#701516' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/aggregate.github.test.ts`
Expected: FAIL — cannot find module `../src/aggregate`.

- [ ] **Step 3: Create `src/aggregate.ts`**

```ts
import type { GithubStats } from './types';

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
    .map(([language, commitCount]) => ({ language, commitCount, color: stats.languageColors[language] ?? '#888' }))
    .sort((a, b) => b.commitCount - a.commitCount);

  return { totals, commitsPerHour, commitsPerWeekday, topLanguages };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/aggregate.github.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/aggregate.ts test/aggregate.github.test.ts
git commit -m "feat: aggregate github commit totals, hours, weekdays, languages"
```

---

## Task 5: Aggregate — top repositories by stars

**Files:**
- Modify: `src/aggregate.ts`
- Test: `test/aggregate.repos.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/aggregate.repos.test.ts
import { describe, expect, it } from 'vitest';
import { topRepositories } from '../src/aggregate';
import type { GithubStats } from '../src/types';

function repo(name: string, stars: number) {
  return {
    public: { name, url: `https://x/${name}`, languages: ['TS'], description: `${name} desc`, stargazerCount: stars, forkCount: 0 },
    commitsPerDate: {},
    commitsPerHour: {},
  };
}

const stats: GithubStats = {
  user: { name: 'T', username: 't', bio: '', avatarUrl: '', url: '', followerCount: 0, followingCount: 0 },
  languageColors: {},
  repositories: [repo('a', 5), repo('b', 50), repo('c', 20), { commitsPerDate: {}, commitsPerHour: {} }],
};

describe('topRepositories', () => {
  it('returns public repos sorted by stars desc, limited to count', () => {
    const top = topRepositories(stats, { count: 2, exclude: [] });
    expect(top.map((r) => r.name)).toEqual(['b', 'c']);
  });

  it('excludes named repos', () => {
    const top = topRepositories(stats, { count: 3, exclude: ['b'] });
    expect(top.map((r) => r.name)).toEqual(['c', 'a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/aggregate.repos.test.ts`
Expected: FAIL — `topRepositories` is not exported.

- [ ] **Step 3: Append to `src/aggregate.ts`**

```ts
import type { RepoPublicDetails } from './types';

export interface TopRepo extends RepoPublicDetails {
  primaryLanguage: string | null;
}

export function topRepositories(
  stats: GithubStats,
  opts: { count: number; exclude: string[] },
): TopRepo[] {
  return stats.repositories
    .map((r) => r.public)
    .filter((p): p is RepoPublicDetails => Boolean(p) && !opts.exclude.includes(p!.name))
    .sort((a, b) => b.stargazerCount - a.stargazerCount)
    .slice(0, opts.count)
    .map((p) => ({ ...p, primaryLanguage: p.languages[0] ?? null }));
}
```

(Move the `import type { RepoPublicDetails }` to merge with the existing import line at the top of the file; do not leave a second import statement mid-file.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/aggregate.repos.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/aggregate.ts test/aggregate.repos.test.ts
git commit -m "feat: aggregate top repositories by stars"
```

---

## Task 6: Aggregate — npm totals, publishes, top packages

**Files:**
- Modify: `src/aggregate.ts`
- Test: `test/aggregate.npm.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/aggregate.npm.test.ts
import { describe, expect, it } from 'vitest';
import { aggregateNpm, topPackages } from '../src/aggregate';
import type { NpmStats } from '../src/types';

function pkg(name: string, downloads: number) {
  return {
    details: { name, description: `${name} desc`, latestVersion: '1.0.0', links: { npm: `https://npm/${name}` } },
    downloadsPerDate: { '2024-01-01': downloads },
    versionsPerHour: {},
  };
}

const stats: NpmStats = {
  user: { username: 't', versionsPerHour: { 'Mon, 13': 4, 'Tue, 09': 2 } },
  packages: [pkg('a', 100), pkg('b', 9000), pkg('c', 500)],
};

describe('aggregateNpm', () => {
  it('sums total downloads and package count', () => {
    const n = aggregateNpm(stats);
    expect(n.totals.downloads).toBe(9600);
    expect(n.totals.packageCount).toBe(3);
  });

  it('buckets publishes per hour and weekday', () => {
    const n = aggregateNpm(stats);
    expect(n.publishesPerHour['Mon, 13']).toBe(4);
    expect(n.publishesPerWeekday.Mon).toBe(4);
    expect(n.publishesPerWeekday.Tue).toBe(2);
  });
});

describe('topPackages', () => {
  it('sorts by total downloads desc, limited to count', () => {
    const top = topPackages(stats, { count: 2, exclude: [] });
    expect(top.map((p) => p.name)).toEqual(['b', 'c']);
    expect(top[0]?.downloads).toBe(9000);
  });

  it('excludes named packages', () => {
    const top = topPackages(stats, { count: 3, exclude: ['b'] });
    expect(top.map((p) => p.name)).toEqual(['c', 'a']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/aggregate.npm.test.ts`
Expected: FAIL — `aggregateNpm` / `topPackages` not exported.

- [ ] **Step 3: Append to `src/aggregate.ts`** (add `NpmStats` to the `./types` import)

```ts
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
      description: p.details.description ?? '',
      latestVersion: p.details.latestVersion,
      url: p.details.links?.npm ?? `https://www.npmjs.com/package/${p.details.name}`,
      downloads: sumValues(p.downloadsPerDate),
    }))
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, opts.count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/aggregate.npm.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/aggregate.ts test/aggregate.npm.test.ts
git commit -m "feat: aggregate npm totals, publishes, top packages"
```

---

## Task 7: Download fonts + SVG text primitives

**Files:**
- Create: `fonts/NutanixSoft-Medium.otf`, `fonts/NutanixSoft-Bold.otf` (downloaded)
- Create: `src/svg/primitives.ts`
- Test: `test/primitives.test.ts`

- [ ] **Step 1: Download the fonts**

```bash
curl -sL -o fonts/NutanixSoft-Medium.otf https://raw.githubusercontent.com/tamino-martinius/metrics.tamino.dev/main/public/NutanixSoft-Medium.otf
curl -sL -o fonts/NutanixSoft-Bold.otf https://raw.githubusercontent.com/tamino-martinius/metrics.tamino.dev/main/public/NutanixSoft-Bold.otf
ls -l fonts
```
Expected: two `.otf` files ~57–58 KB each.

- [ ] **Step 2: Write the failing test**

```ts
// test/primitives.test.ts
import { describe, expect, it } from 'vitest';
import { escapeXml, measureText, svgDocument, textPath, truncateToWidth } from '../src/svg/primitives';

describe('primitives', () => {
  it('escapes xml special chars', () => {
    expect(escapeXml('a & <b> "c"')).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });

  it('renders text as an svg path element', () => {
    const out = textPath({ text: 'Hi', x: 0, y: 20, size: 14, weight: 'regular', color: '#000' });
    expect(out).toContain('<path');
    expect(out).toContain('fill="#000"');
  });

  it('measures advance width as a positive number', () => {
    expect(measureText('Hello', 14, 'regular')).toBeGreaterThan(0);
  });

  it('truncates long text with an ellipsis to fit width', () => {
    const full = 'a-very-long-package-name-that-will-not-fit';
    const out = truncateToWidth(full, 14, 'regular', 60);
    expect(out.endsWith('…')).toBe(true);
    expect(measureText(out, 14, 'regular')).toBeLessThanOrEqual(60);
  });

  it('wraps content in an svg document with viewBox', () => {
    const doc = svgDocument(100, 50, '<rect />');
    expect(doc).toContain('viewBox="0 0 100 50"');
    expect(doc).toContain('<rect />');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/primitives.test.ts`
Expected: FAIL — cannot find module `../src/svg/primitives`.

- [ ] **Step 4: Create `src/svg/primitives.ts`**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

export type Weight = 'regular' | 'bold';

const FONT_PATHS: Record<Weight, string> = {
  regular: fileURLToPath(new URL('../../fonts/NutanixSoft-Medium.otf', import.meta.url)),
  bold: fileURLToPath(new URL('../../fonts/NutanixSoft-Bold.otf', import.meta.url)),
};

const fontCache = new Map<Weight, opentype.Font>();

function font(weight: Weight): opentype.Font {
  const cached = fontCache.get(weight);
  if (cached) return cached;
  const buffer = readFileSync(FONT_PATHS[weight]);
  const parsed = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  fontCache.set(weight, parsed);
  return parsed;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function measureText(text: string, size: number, weight: Weight): number {
  return font(weight).getAdvanceWidth(text, size);
}

export function truncateToWidth(text: string, size: number, weight: Weight, maxWidth: number): string {
  if (measureText(text, size, weight) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && measureText(`${result}…`, size, weight) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

export interface TextOptions {
  text: string;
  x: number;
  y: number; // baseline
  size: number;
  weight: Weight;
  color: string;
  anchor?: 'start' | 'middle' | 'end';
}

export function textPath(opts: TextOptions): string {
  const { text, x, y, size, weight, color, anchor = 'start' } = opts;
  let drawX = x;
  if (anchor !== 'start') {
    const width = measureText(text, size, weight);
    drawX = anchor === 'middle' ? x - width / 2 : x - width;
  }
  const path = font(weight).getPath(text, drawX, y, size);
  return `<path d="${path.toPathData(2)}" fill="${color}" />`;
}

export function svgDocument(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${body}</svg>`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/primitives.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add fonts/NutanixSoft-Medium.otf fonts/NutanixSoft-Bold.otf src/svg/primitives.ts test/primitives.test.ts
git commit -m "feat: add Nutanix Soft fonts and SVG text primitives"
```

---

## Task 8: Card chrome + bar + legend primitives

**Files:**
- Modify: `src/svg/primitives.ts`
- Test: `test/primitives.chrome.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/primitives.chrome.test.ts
import { describe, expect, it } from 'vitest';
import { bar, cardBackground, hr, legendRows } from '../src/svg/primitives';
import { themes } from '../src/theme';

const t = themes.light;

describe('card chrome', () => {
  it('renders a rounded card background rect with theme colors', () => {
    const out = cardBackground(420, 160, t);
    expect(out).toContain('rx=');
    expect(out).toContain(t.background);
    expect(out).toContain(t.cardBorder);
  });

  it('renders a stacked bar with one rect per section', () => {
    const out = bar({ x: 12, y: 100, width: 396, height: 8, sections: [
      { value: 75, color: t.green }, { value: 25, color: t.blue },
    ], theme: t });
    expect((out.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('renders legend rows with color dots and labels', () => {
    const out = legendRows({ x: 12, y: 60, items: [
      { label: 'Additions', value: '130', color: t.green },
    ], theme: t });
    expect(out).toContain('Additions');
    expect(out).toContain(t.green);
  });

  it('renders an hr line', () => {
    expect(hr(12, 80, t)).toContain('<line');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/primitives.chrome.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Append to `src/svg/primitives.ts`**

```ts
import type { Theme } from '../theme';

export function cardBackground(width: number, height: number, theme: Theme): string {
  return `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${theme.background}" stroke="${theme.cardBorder}" />`;
}

export function hr(x: number, y: number, theme: Theme): string {
  return `<line x1="${x}" y1="${y}" x2="${x + 30}" y2="${y}" stroke="${theme.foregroundLight}" stroke-opacity="0.4" />`;
}

export interface BarSection {
  value: number;
  color: string;
}

export function bar(opts: { x: number; y: number; width: number; height: number; sections: BarSection[]; theme: Theme }): string {
  const { x, y, width, height, sections, theme } = opts;
  const total = sections.reduce((sum, s) => sum + s.value, 0) || 1;
  let offset = x;
  const rects: string[] = [`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${theme.empty}" />`];
  for (const s of sections) {
    const w = (s.value / total) * width;
    rects.push(`<rect x="${offset.toFixed(2)}" y="${y}" width="${w.toFixed(2)}" height="${height}" rx="${height / 2}" fill="${s.color}" />`);
    offset += w;
  }
  return rects.join('');
}

export interface LegendItem {
  label: string;
  value: string;
  color: string;
}

export function legendRows(opts: { x: number; y: number; items: LegendItem[]; theme: Theme; rowHeight?: number }): string {
  const { x, y, items, theme, rowHeight = 22 } = opts;
  return items
    .map((item, i) => {
      const cy = y + i * rowHeight;
      const dot = `<circle cx="${x + 4}" cy="${cy - 4}" r="4" fill="${item.color}" />`;
      const label = textPath({ text: item.label, x: x + 16, y: cy, size: 13, weight: 'regular', color: theme.foreground });
      const value = textPath({ text: item.value, x: x + 200, y: cy, size: 13, weight: 'bold', color: theme.foregroundLight, anchor: 'end' });
      return dot + label + value;
    })
    .join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/primitives.chrome.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/svg/primitives.ts test/primitives.chrome.test.ts
git commit -m "feat: add card chrome, bar, legend, hr primitives"
```

---

## Task 9: User card renderer

**Files:**
- Create: `src/svg/userCard.ts`
- Test: `test/userCard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/userCard.test.ts
import { describe, expect, it } from 'vitest';
import { aggregateGithub } from '../src/aggregate';
import { renderUserCard } from '../src/svg/userCard';
import { themes } from '../src/theme';
import type { GithubStats } from '../src/types';

const stats: GithubStats = {
  user: { name: 'Tamino Martinius', username: 't', bio: 'Staff Engineer', avatarUrl: 'data:image/png;base64,AA==', url: 'https://github.com/t', followerCount: 158, followingCount: 13 },
  languageColors: { Ruby: '#701516' },
  repositories: [{
    public: { name: 'r', url: 'u', languages: ['Ruby'], description: '', stargazerCount: 1, forkCount: 0 },
    commitsPerDate: { '2024-01-01': { commitCount: 4, additions: 1, deletions: 1, changedFiles: 1 } },
    commitsPerHour: {},
  }],
};

describe('renderUserCard', () => {
  it('produces an svg with the user name and top language', () => {
    const g = aggregateGithub(stats);
    const svg = renderUserCard(stats.user, g, themes.light, { topLanguages: 4 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox');
    // name rendered as path data is not literal text; assert language legend + avatar wired instead:
    expect(svg).toContain('data:image/png;base64,AA==');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/userCard.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `src/svg/userCard.ts`**

```ts
import type { GithubAggregate } from '../aggregate';
import type { Theme } from '../theme';
import type { GithubUser } from '../types';
import { cardBackground, escapeXml, hr, legendRows, svgDocument, textPath, truncateToWidth } from './primitives';

const W = 420;
const H = 150;

export function renderUserCard(
  user: GithubUser,
  github: GithubAggregate,
  theme: Theme,
  opts: { topLanguages: number },
): string {
  const denom = github.totals.publicCommitCount || 1;
  const langs = github.topLanguages.slice(0, opts.topLanguages).map((l) => ({
    label: l.language,
    value: `${((l.commitCount / denom) * 100).toFixed(1)}%`,
    color: l.color,
  }));

  const avatar = `<clipPath id="avatar-clip"><circle cx="36" cy="36" r="18" /></clipPath>` +
    `<image href="${escapeXml(user.avatarUrl)}" x="18" y="18" width="36" height="36" clip-path="url(#avatar-clip)" />`;
  const name = textPath({ text: user.name, x: 64, y: 34, size: 16, weight: 'bold', color: theme.foreground });
  const bio = textPath({ text: truncateToWidth(user.bio, 13, 'regular', W - 84), x: 64, y: 50, size: 13, weight: 'regular', color: theme.foregroundLight });
  const divider = hr(18, 74, theme);
  const legend = legendRows({ x: 18, y: 96, items: langs, theme });

  return svgDocument(W, H, cardBackground(W, H, theme) + avatar + name + bio + divider + legend);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/userCard.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/svg/userCard.ts test/userCard.test.ts
git commit -m "feat: render github user card svg"
```

---

## Task 10: Total Counts renderer (GitHub + npm)

**Files:**
- Create: `src/svg/totalCounts.ts`
- Test: `test/totalCounts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/totalCounts.test.ts
import { describe, expect, it } from 'vitest';
import { renderNpmTotalCounts, renderGithubTotalCounts } from '../src/svg/totalCounts';
import { themes } from '../src/theme';

describe('total counts cards', () => {
  it('renders github total counts svg with bar sections', () => {
    const svg = renderGithubTotalCounts(
      { commitCount: 1234, additions: 5000, deletions: 2000, changedFiles: 800, publicCommitCount: 1000 },
      themes.light,
    );
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('renders npm total counts svg', () => {
    const svg = renderNpmTotalCounts({ downloads: 999999, versions: 200, packageCount: 103 }, themes.light);
    expect(svg.startsWith('<svg')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/totalCounts.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `src/svg/totalCounts.ts`**

```ts
import type { GithubTotals, NpmTotals } from '../aggregate';
import type { Theme } from '../theme';
import { bar, cardBackground, hr, legendRows, svgDocument, textPath } from './primitives';

const W = 420;
const H = 170;

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function headline(heading: string, sub: string, theme: Theme): string {
  return (
    textPath({ text: heading, x: 18, y: 38, size: 22, weight: 'bold', color: theme.foreground }) +
    textPath({ text: sub, x: 18, y: 58, size: 13, weight: 'regular', color: theme.foregroundLight })
  );
}

export function renderGithubTotalCounts(totals: GithubTotals, theme: Theme): string {
  const items = [
    { label: 'Additions', value: formatNumber(totals.additions), color: theme.green },
    { label: 'Deletions', value: formatNumber(totals.deletions), color: theme.blue },
    { label: 'Changed Files', value: formatNumber(totals.changedFiles), color: theme.series[0]! },
  ];
  const body =
    cardBackground(W, H, theme) +
    headline(`${formatNumber(totals.commitCount)} Commits`, 'In Total', theme) +
    hr(18, 76, theme) +
    legendRows({ x: 18, y: 100, items, theme }) +
    bar({ x: 18, y: 150, width: W - 36, height: 8, sections: [
      { value: totals.additions, color: theme.green },
      { value: totals.deletions, color: theme.blue },
    ], theme });
  return svgDocument(W, H, body);
}

export function renderNpmTotalCounts(totals: NpmTotals, theme: Theme): string {
  const items = [
    { label: 'Packages', value: formatNumber(totals.packageCount), color: theme.series[0]! },
    { label: 'Versions Published', value: formatNumber(totals.versions), color: theme.blue },
  ];
  const body =
    cardBackground(W, H, theme) +
    headline(`${formatNumber(totals.downloads)} Downloads`, 'In Total', theme) +
    hr(18, 76, theme) +
    legendRows({ x: 18, y: 100, items, theme });
  return svgDocument(W, H, body);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/totalCounts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/svg/totalCounts.ts test/totalCounts.test.ts
git commit -m "feat: render github + npm total counts cards"
```

---

## Task 11: Daytime chart renderer (d3-shape)

**Files:**
- Create: `src/svg/daytimeChart.ts`
- Test: `test/daytimeChart.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/daytimeChart.test.ts
import { describe, expect, it } from 'vitest';
import { renderDaytimeChart } from '../src/svg/daytimeChart';
import { themes } from '../src/theme';

describe('renderDaytimeChart', () => {
  it('renders one line path per weekday with data', () => {
    const perHour: Record<string, number> = {};
    for (const wd of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      for (let h = 1; h <= 24; h++) perHour[`${wd}, ${String(h).padStart(2, '0')}`] = (h * 3) % 7;
    }
    const svg = renderDaytimeChart('Daytime Chart', perHour, themes.light);
    expect(svg.startsWith('<svg')).toBe(true);
    // 7 weekday area/line paths (+ possibly axis lines)
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it('handles empty data without throwing', () => {
    expect(() => renderDaytimeChart('Daytime Chart', {}, themes.light)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/daytimeChart.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `src/svg/daytimeChart.ts`**

```ts
import { area, curveCatmullRom } from 'd3-shape';
import type { Theme } from '../theme';
import { cardBackground, svgDocument, textPath } from './primitives';

const W = 860;
const H = 240;
const PAD_LEFT = 24;
const PAD_RIGHT = 24;
const PAD_TOP = 50;
const PAD_BOTTOM = 30;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function renderDaytimeChart(title: string, perHour: Record<string, number>, theme: Theme): string {
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;

  // Build a [weekday][hour] matrix and find the global max for scaling.
  let max = 0;
  const matrix = WEEKDAYS.map((wd) =>
    Array.from({ length: 24 }, (_, i) => {
      const v = perHour[`${wd}, ${String(i + 1).padStart(2, '0')}`] ?? 0;
      if (v > max) max = v;
      return v;
    }),
  );
  const yScale = (v: number) => baseY - (max === 0 ? 0 : (v / max) * plotH);
  const xScale = (hour: number) => PAD_LEFT + (hour / 23) * plotW;

  const makeArea = area<number>()
    .x((_d, i) => xScale(i))
    .y0(baseY)
    .y1((d) => yScale(d))
    .curve(curveCatmullRom.alpha(0.5));

  const paths = matrix
    .map((row, i) => {
      const color = theme.series[i] ?? theme.foregroundLight;
      const d = makeArea(row) ?? '';
      return `<path d="${d}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1.5" />`;
    })
    .join('');

  // x-axis labels every 2 hours
  const labels = Array.from({ length: 12 }, (_, i) => i * 2)
    .map((h) => textPath({ text: `${String(h + 1).padStart(2, '0')}:00`, x: xScale(h), y: H - 10, size: 10, weight: 'regular', color: theme.foregroundLight, anchor: 'middle' }))
    .join('');

  const heading = textPath({ text: title, x: 18, y: 32, size: 16, weight: 'bold', color: theme.foreground });

  return svgDocument(W, H, cardBackground(W, H, theme) + heading + paths + labels);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/daytimeChart.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/svg/daytimeChart.ts test/daytimeChart.test.ts
git commit -m "feat: render daytime chart via d3-shape area paths"
```

---

## Task 12: Popular tile renderer (repos + packages)

**Files:**
- Create: `src/svg/popularTile.ts`
- Test: `test/popularTile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/popularTile.test.ts
import { describe, expect, it } from 'vitest';
import { renderPopularHeader, renderPopularTile } from '../src/svg/popularTile';
import { themes } from '../src/theme';

describe('popular tiles', () => {
  it('renders a header tile svg', () => {
    const svg = renderPopularHeader('Popular Repositories', themes.light);
    expect(svg.startsWith('<svg')).toBe(true);
  });

  it('renders a tile with a value bar scaled to leaderValue', () => {
    const svg = renderPopularTile({
      name: 'ts-dedent',
      description: 'smartly trims indentation',
      value: 500,
      valueLabel: '500',
      leaderValue: 1000,
      accent: themes.light.series[0]!,
      theme: themes.light,
    });
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThanOrEqual(2); // card bg + bar track + fill
  });

  it('does not divide by zero when leaderValue is 0', () => {
    expect(() =>
      renderPopularTile({ name: 'x', description: '', value: 0, valueLabel: '0', leaderValue: 0, accent: '#000', theme: themes.light }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/popularTile.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `src/svg/popularTile.ts`**

```ts
import type { Theme } from '../theme';
import { bar, cardBackground, svgDocument, textPath, truncateToWidth } from './primitives';

const W = 420;
const TILE_H = 64;
const HEADER_H = 40;

export function renderPopularHeader(title: string, theme: Theme): string {
  const body = cardBackground(W, HEADER_H, theme) + textPath({ text: title, x: 18, y: 26, size: 15, weight: 'bold', color: theme.foreground });
  return svgDocument(W, HEADER_H, body);
}

export interface PopularTileOptions {
  name: string;
  description: string;
  value: number;
  valueLabel: string;
  leaderValue: number;
  accent: string;
  theme: Theme;
}

export function renderPopularTile(opts: PopularTileOptions): string {
  const { name, description, value, valueLabel, leaderValue, accent, theme } = opts;
  const ratio = leaderValue > 0 ? value / leaderValue : 0;
  const barWidth = W - 36;
  const name1 = textPath({ text: truncateToWidth(name, 14, 'bold', 240), x: 18, y: 24, size: 14, weight: 'bold', color: theme.foreground });
  const valueText = textPath({ text: valueLabel, x: W - 18, y: 24, size: 13, weight: 'bold', color: theme.foregroundLight, anchor: 'end' });
  const desc = textPath({ text: truncateToWidth(description, 12, 'regular', W - 36), x: 18, y: 40, size: 12, weight: 'regular', color: theme.foregroundLight });
  const valueBar = bar({ x: 18, y: 50, width: barWidth, height: 6, sections: [{ value: ratio, color: accent }], theme });
  // bar() scales sections to their own total; pass a single section sized to ratio of full width:
  const scaledBar = bar({ x: 18, y: 50, width: barWidth * ratio, height: 6, sections: [{ value: 1, color: accent }], theme });
  return svgDocument(W, TILE_H, cardBackground(W, TILE_H, theme) + name1 + valueText + desc + scaledBar + valueBar.slice(0, 0));
}
```

Note: the `valueBar`/`scaledBar` lines above are intentionally simplified — the implementer should keep only the `scaledBar` (a track + a fill scaled to `ratio`). Replace the last three lines of the function body with:

```ts
  const track = `<rect x="18" y="50" width="${barWidth}" height="6" rx="3" fill="${theme.empty}" />`;
  const fill = `<rect x="18" y="50" width="${(barWidth * ratio).toFixed(2)}" height="6" rx="3" fill="${accent}" />`;
  return svgDocument(W, TILE_H, cardBackground(W, TILE_H, theme) + name1 + valueText + desc + track + fill);
```

(Use the corrected version; remove the `bar(...)` calls and the `valueBar.slice` artifact. The corrected body imports `bar` no longer — drop `bar` from the import if unused, or keep it; biome will flag unused imports, so remove it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/popularTile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/svg/popularTile.ts test/popularTile.test.ts
git commit -m "feat: render popular repo/package tiles"
```

---

## Task 13: README assembly between markers

**Files:**
- Create: `src/readme.ts`
- Test: `test/readme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/readme.test.ts
import { describe, expect, it } from 'vitest';
import { linkedPicture, picture, replaceBlock } from '../src/readme';

describe('readme assembly', () => {
  it('replaces content between markers, preserving intro and outro', () => {
    const md = 'Intro\n<!-- METRICS:START -->\nold\n<!-- METRICS:END -->\nOutro';
    const out = replaceBlock(md, 'NEW');
    expect(out).toContain('Intro');
    expect(out).toContain('Outro');
    expect(out).toContain('NEW');
    expect(out).not.toContain('old');
  });

  it('appends a block if markers are absent', () => {
    const out = replaceBlock('Just intro', 'NEW');
    expect(out).toContain('<!-- METRICS:START -->');
    expect(out).toContain('NEW');
    expect(out).toContain('<!-- METRICS:END -->');
  });

  it('builds a theme-adaptive picture element', () => {
    const out = picture('assets/x.light.svg', 'assets/x.dark.svg', 'alt', 420);
    expect(out).toContain('prefers-color-scheme: dark');
    expect(out).toContain('assets/x.dark.svg');
    expect(out).toContain('width="420"');
  });

  it('wraps a picture in a link', () => {
    const out = linkedPicture('https://x', 'assets/x.light.svg', 'assets/x.dark.svg', 'alt', 420);
    expect(out).toContain('<a href="https://x"');
    expect(out).toContain('</a>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/readme.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `src/readme.ts`**

```ts
const START = '<!-- METRICS:START -->';
const END = '<!-- METRICS:END -->';

export function replaceBlock(markdown: string, block: string): string {
  const wrapped = `${START}\n${block}\n${END}`;
  const startIdx = markdown.indexOf(START);
  const endIdx = markdown.indexOf(END);
  if (startIdx === -1 || endIdx === -1) {
    const sep = markdown.endsWith('\n') ? '\n' : '\n\n';
    return `${markdown}${sep}${wrapped}\n`;
  }
  return markdown.slice(0, startIdx) + wrapped + markdown.slice(endIdx + END.length);
}

export function picture(lightSrc: string, darkSrc: string, alt: string, width: number): string {
  return (
    '<picture>' +
    `<source media="(prefers-color-scheme: dark)" srcset="${darkSrc}">` +
    `<img src="${lightSrc}" alt="${alt}" width="${width}">` +
    '</picture>'
  );
}

export function linkedPicture(href: string, lightSrc: string, darkSrc: string, alt: string, width: number): string {
  return `<a href="${href}">${picture(lightSrc, darkSrc, alt, width)}</a>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/readme.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/readme.ts test/readme.test.ts
git commit -m "feat: README block replacement + picture/link helpers"
```

---

## Task 14: Orchestrator

**Files:**
- Create: `src/index.ts`
- Create/Modify: `README.md` (add intro + markers)
- Test: manual run (this task wires everything; logic is already unit-tested)

- [ ] **Step 1: Write `src/index.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { aggregateGithub, aggregateNpm, topPackages, topRepositories } from './aggregate';
import { fetchGithubStats, fetchNpmStats } from './fetch';
import { linkedPicture, picture, replaceBlock } from './readme';
import { renderDaytimeChart } from './svg/daytimeChart';
import { renderPopularHeader, renderPopularTile } from './svg/popularTile';
import { renderGithubTotalCounts, renderNpmTotalCounts } from './svg/totalCounts';
import { renderUserCard } from './svg/userCard';
import { themes } from './theme';

const assetsDir = config.output.assetsDir;

function slugify(name: string): string {
  return name.replace(/[@/]/g, '-').replace(/[^a-zA-Z0-9._-]/g, '').replace(/^-+/, '');
}

async function fetchAvatarDataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') ?? 'image/png';
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return url;
  }
}

/** Write light + dark variants; return relative paths. */
function writePair(name: string, render: (theme: (typeof themes)['light']) => string): { light: string; dark: string } {
  const light = join(assetsDir, `${name}.light.svg`);
  const dark = join(assetsDir, `${name}.dark.svg`);
  mkdirSync(join(assetsDir, name, '..'), { recursive: true });
  writeFileSync(light, render(themes.light));
  writeFileSync(dark, render(themes.dark));
  return { light, dark };
}

async function main(): Promise<void> {
  mkdirSync(assetsDir, { recursive: true });
  mkdirSync(join(assetsDir, 'repos'), { recursive: true });
  mkdirSync(join(assetsDir, 'packages'), { recursive: true });

  const ghStats = await fetchGithubStats(config.github.accounts);
  const npmStats = await fetchNpmStats(config.npm.account);
  const gh = aggregateGithub(ghStats);
  const npm = aggregateNpm(npmStats);
  const avatar = await fetchAvatarDataUri(ghStats.user.avatarUrl);
  const userWithAvatar = { ...ghStats.user, avatarUrl: avatar };

  const sections: string[] = [];

  if (config.cards.user.enabled) {
    const p = writePair('github-user', (t) => renderUserCard(userWithAvatar, gh, t, { topLanguages: config.cards.user.topLanguages }));
    sections.push(linkedPicture(ghStats.user.url, p.light, p.dark, ghStats.user.name, 420));
  }

  const row: string[] = [];
  if (config.cards.githubTotals.enabled) {
    const p = writePair('github-total', (t) => renderGithubTotalCounts(gh.totals, t));
    row.push(picture(p.light, p.dark, 'GitHub totals', 420));
  }
  if (config.cards.npmTotals.enabled) {
    const p = writePair('npm-total', (t) => renderNpmTotalCounts(npm.totals, t));
    row.push(picture(p.light, p.dark, 'npm totals', 420));
  }
  if (row.length) sections.push(row.join(' '));

  if (config.cards.githubDaytime.enabled) {
    const p = writePair('github-daytime', (t) => renderDaytimeChart('Daytime Chart — Commits', gh.commitsPerHour, t));
    sections.push(picture(p.light, p.dark, 'GitHub daytime', 860));
  }
  if (config.cards.npmDaytime.enabled) {
    const p = writePair('npm-daytime', (t) => renderDaytimeChart('Daytime Chart — Publishes', npm.publishesPerHour, t));
    sections.push(picture(p.light, p.dark, 'npm daytime', 860));
  }

  // Popular cards: header tile + 6 linked row tiles each.
  if (config.cards.popularRepos.enabled) {
    const repos = topRepositories(ghStats, { count: config.cards.popularRepos.count, exclude: config.cards.popularRepos.exclude });
    const leader = repos[0]?.stargazerCount ?? 0;
    const header = writePair('repos/_header', (t) => renderPopularHeader('Popular Repositories', t));
    const tiles = [picture(header.light, header.dark, 'Popular Repositories', 420)];
    for (const repo of repos) {
      const slug = slugify(repo.name);
      const accent = ghStats.languageColors[repo.primaryLanguage ?? ''] ?? themes.light.series[0]!;
      const pair = writePair(`repos/${slug}`, (t) => renderPopularTile({
        name: repo.name, description: repo.description, value: repo.stargazerCount,
        valueLabel: `★ ${repo.stargazerCount.toLocaleString('en-US')}`, leaderValue: leader, accent, theme: t,
      }));
      tiles.push(linkedPicture(repo.url, pair.light, pair.dark, repo.name, 420));
    }
    sections.push(tiles.join('<br>'));
  }

  if (config.cards.popularPackages.enabled) {
    const pkgs = topPackages(npmStats, { count: config.cards.popularPackages.count, exclude: config.cards.popularPackages.exclude });
    const leader = pkgs[0]?.downloads ?? 0;
    const header = writePair('packages/_header', (t) => renderPopularHeader('Popular Packages', t));
    const tiles = [picture(header.light, header.dark, 'Popular Packages', 420)];
    for (const pkg of pkgs) {
      const slug = slugify(pkg.name);
      const pair = writePair(`packages/${slug}`, (t) => renderPopularTile({
        name: pkg.name, description: pkg.description, value: pkg.downloads,
        valueLabel: `↓ ${pkg.downloads.toLocaleString('en-US')}`, leaderValue: leader, accent: themes.light.blue, theme: t,
      }));
      tiles.push(linkedPicture(pkg.url, pair.light, pair.dark, pkg.name, 420));
    }
    sections.push(tiles.join('<br>'));
  }

  const block = sections.join('\n\n');
  const readmePath = config.output.readme;
  const current = readFileSync(readmePath, 'utf8');
  writeFileSync(readmePath, replaceBlock(current, block));
  console.log('README updated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Seed `README.md` with an intro + markers**

Replace `README.md` content with:

```markdown
## Hi there 👋

I speak code as a Staff Engineer. Stats below are generated nightly from my GitHub and npm activity.

<!-- METRICS:START -->
<!-- METRICS:END -->
```

- [ ] **Step 3: Run the generator end-to-end (live data)**

Run: `npm run build`
Expected: completes without error, prints "README updated.", creates SVGs under `assets/`, and fills the marker block in `README.md`.

- [ ] **Step 4: Sanity-check output**

Run: `ls assets assets/repos assets/packages && head -40 README.md`
Expected: `*.light.svg` / `*.dark.svg` pairs present; README has `<picture>`/`<a>` markup between markers.

- [ ] **Step 5: Run the full test suite + lint**

Run: `npm test && npm run lint`
Expected: all tests pass; biome reports no errors (fix any unused-import warnings flagged, e.g. in `popularTile.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/index.ts README.md assets
git commit -m "feat: orchestrate generation and assemble README"
```

---

## Task 15: Verify rendering on GitHub + nightly workflow

**Files:**
- Create: `.github/workflows/nightly.yml`
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules
dist
```

(Note: `assets/` and `fonts/` ARE committed — do not ignore them. The README references committed SVGs; the workflow commits regenerated ones.)

- [ ] **Step 2: Visually verify one card opens correctly**

Run: `open assets/github-user.light.svg` (macOS) or inspect in a browser.
Expected: card renders with Nutanix Soft text as crisp paths, avatar visible, legend present. If text is missing/garbled, the `opentype.js` path generation needs fixing before proceeding.

- [ ] **Step 3: Push the branch and confirm GitHub renders the SVGs**

```bash
git push -u origin tm/readme-stats-generator
```
Then open the branch's `README.md` on github.com and confirm: cards display, dark/light switches with your GitHub theme, and Popular tile links navigate to the repo/package. (This is the real fidelity gate. If GitHub fails to render path-based SVG text, revisit — but vector paths are well-supported.)

- [ ] **Step 4: Create `.github/workflows/nightly.yml`**

```yaml
name: Generate README

on:
  schedule:
    - cron: '30 5 * * *' # ~05:30 UTC, after upstream stats jobs land
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Commit changes if any
        run: |
          if [[ -n "$(git status --porcelain README.md assets)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add README.md assets
            git commit -m "chore: nightly stats refresh"
            git push
          else
            echo "No changes."
          fi
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore .github/workflows/nightly.yml
git commit -m "ci: nightly README regeneration workflow"
```

- [ ] **Step 6: Validate the workflow file**

Run: `npx --yes @action-validator/cli .github/workflows/nightly.yml 2>/dev/null || echo "validator unavailable; verify YAML manually"`
Expected: no schema errors (or manual confirmation the YAML is well-formed).

---

## Self-Review Notes

- **Spec coverage:** config (T1), fetch+merge (T2), theme (T3), GitHub aggregation incl. languages (T4), top repos (T5), npm aggregation + top packages (T6), primitives/fonts (T7–T8), User card (T9), Total Counts ×2 (T10), Daytime ×2 (T11), Popular tiles + per-row links (T12), README markers + `<picture>` dark/light (T13), orchestrator + avatar embedding (T14), nightly workflow + GitHub fidelity gate (T15). All spec sections mapped.
- **Type consistency:** `AggregatedStats` is realized as separate `GithubAggregate` + `NpmAggregate` objects (cleaner than one mega-type); renderers consume the specific aggregate they need. `GithubTotals`/`NpmTotals`/`TopRepo`/`TopPackage` names are used identically across producer (aggregate.ts) and consumers (svg/*.ts, index.ts).
- **Known cleanup:** Task 12's `renderPopularTile` includes a deliberately-marked simplification — the implementer must keep only the corrected `track`+`fill` version and drop the unused `bar` import (biome will flag it in Task 14 Step 5).
- **Fidelity gate:** Task 15 Step 3 is the real test that GitHub renders the SVGs; geometry refinement (exact paddings, font sizes) is expected polish after first render and won't break the structural tests.
