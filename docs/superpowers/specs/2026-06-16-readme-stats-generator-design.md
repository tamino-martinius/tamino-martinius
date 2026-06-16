# README Stats Generator — Design

**Repo:** `tamino-martinius/tamino-martinius` (the GitHub profile README repo)
**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan

## Goal

Auto-generate, nightly, the contents and illustrations of the personal profile
README from existing nightly stats data — reproducing the visual design of
[metrics.tamino.dev](https://github.com/tamino-martinius/metrics.tamino.dev) as
self-contained SVG cards embedded in the README. A single config file drives
which cards appear and how they're built, mirroring the role of metrics'
`src/models/Data.ts`.

## Data sources (already exist)

Two companion repos publish JSON nightly to raw GitHub URLs:

- **GitHub:** `https://raw.githubusercontent.com/<account>/github-stats/<account>/data/stats.json`
  (runs ~midnight UTC). Shape: `user` (name, username, bio, avatarUrl, url,
  follower/following counts, `commentsPerDate`, `commentsPerHour`),
  `organizations`, `languageColors` (lang → hex), `repositories[]` where each
  item has `commitsPerDate`, `commitsPerHour`, and **public** repos additionally
  carry `public: { name, url, languages[], description, stargazerCount, forkCount }`.
- **npm:** `https://raw.githubusercontent.com/<account>/npm-stats/<account>/data/stats.json`
  (runs every 6h). Shape: `user` (username, `versionsPerDate`, `versionsPerHour`),
  `packages[]` where each has `details { name, description, latestVersion,
  license, keywords[], links { homepage, repository, bugs, npm } }`,
  `downloadsPerDate` (yyyy-MM-dd → count), `versionsPerDate`, `versionsPerHour`.

Hour keys are `"Wkd, HH"` (e.g. `"Thu, 13"`); weekdays are `Sun…Sat`; hours `01…24`.

The metrics dashboard's `Data.ts` config establishes the pattern this repo
follows: `GITHUB_ACCOUNTS = ['tamino-martinius', 'tamino-cookieai']`,
`NPM_ACCOUNT = 'tamino-martinius'`.

## Design system (reproduced from metrics.tamino.dev)

Color tokens (light) from `src/style/index.css`:

```
--color-background:#f8f9fa  --color-foreground:#22272e  --color-foreground-light:#627386
--color-primary:#c9cbce     --color-empty:#f4faff
--color-green:#00d559 (public/additions/followers)  --color-blue:#00a5fe (private/deletions/following)
--color-red:#f05033 (git)
--color-0..13: #d4dae1 #673bd6 #535ae0 #3f77e9 #2c96f2 #34adf0 #56bce1 #7accd4 #9ddbc6 #d5efe4 #dddae4 #e5aed4 #e986b4 #ff8585
--size-container:880px
```

Font: **Nutanix Soft** (custom .otf/woff2). Type scale: h1/h2 14px/600,
h3 18px/500 (14px top pad), h4 14px/500 light color; `hr` = 30px wide, 1px
`#d5dae0`. Cards are white with rounded corners and a soft border/shadow.

A **dark palette** is derived from these tokens: keep the accent colors
(`color-0..13`, green/blue/red); swap `background`/`foreground`/`border` for dark
equivalents (e.g. background `#22272e`/`#0d1117`, foreground `#f8f9fa`).

## Scope — cards on the README

Reuse three card designs from metrics, build two genuinely new ones in the same
style:

| Card | Source | Notes |
|---|---|---|
| **User card** | metrics `GithubUserCard` | avatar + name + bio + top-4 languages legend. One link to profile. |
| **GitHub Total Counts** | metrics `GithubTotalCountsCard` | headline commit count + additions/deletions/changed-files legend + bar. |
| **GitHub Daytime** | metrics `GithubDaytimeChartCard` | 7 weekday line/area graphs over 24h. |
| **npm Total Counts** | metrics `NpmTotalCountsCard` (adapted) | total downloads / versions / package count. |
| **npm Daytime** | metrics `NpmPublishDaytimeCard` (adapted) | publishes per hour/weekday. |
| **Popular Repos** | **NEW**, metrics style | top 6 repos by stars; per-row linked tiles. |
| **Popular Packages** | **NEW**, metrics style | top 6 packages by downloads; per-row linked tiles. |

7 cards: one User card, then paired GitHub + npm sections.

## Key constraint — links inside SVG do not work on GitHub

GitHub proxies README images through camo, which strips interactivity. A single
SVG cannot have multiple clickable regions. Therefore:

- **Single cards** (User, both Totals, both Daytime) are single SVG `<img>`s.
  The User card is wrapped in one `<a>` to the GitHub profile.
- **Popular cards** are rendered as **per-row linked SVG tiles**: each of the 6
  rows is its own small SVG, individually wrapped in a markdown link. This keeps
  the Nutanix Soft style (text stays inside SVG) *and* gives clickable rows. A
  native markdown table was rejected because it would render in GitHub's font,
  not Nutanix Soft.

## Generation approach (chosen)

**Hand-written TypeScript SVG generators** (the github-readme-stats pattern):
each card is a pure function `(data, theme) → svg string`. `d3-shape` (pure JS,
no DOM) computes the Daytime chart line/area `d` paths. No headless browser in
CI → fast, crisp scalable SVG, trivial light+dark variants, natural per-tile
linking, matches the TS/biome stack.

*Rejected:* Playwright screenshots (heavy CI, raster PNGs, brittle); Satori
(flexbox-only, can't render the D3 chart). May revisit if fidelity falls short.

### Font fidelity

Primary: base64-embed Nutanix Soft (woff2, subset to used glyphs) via
`@font-face` inside each SVG. GitHub sometimes strips embedded fonts from
proxied SVGs — **verify early**. Fallback if stripped: convert text → vector
paths with `opentype.js` so the font renders identically regardless of viewer
support. Avatar is embedded as base64 (external `<image href>` is unreliable
through camo).

## Repository layout

```
README.md                 # hand-written intro + generated block between markers
config.ts                 # the centerpiece config (see below)
package.json              # tsx, d3-shape, opentype.js, vitest, @biomejs/biome
biome.json · tsconfig.json
fonts/                    # NutanixSoft woff2
assets/                   # generated SVGs (committed nightly)
  github-user.{light,dark}.svg
  github-total.{light,dark}.svg · github-daytime.{light,dark}.svg
  npm-total.{light,dark}.svg · npm-daytime.{light,dark}.svg
  repos/<slug>.{light,dark}.svg        # 6 linked tiles
  packages/<slug>.{light,dark}.svg     # 6 linked tiles
src/
  index.ts                # orchestrator: fetch → aggregate → render → write README
  fetch.ts                # pull the two stats.json sources, merge GitHub accounts
  types.ts                # raw stats JSON shapes
  aggregate.ts            # derive totals, per-hour/weekday, top languages/repos/packages
  theme.ts                # light + dark palettes from tokens
  svg/
    primitives.ts         # card chrome, text, bar, legend, hr helpers
    userCard.ts
    totalCounts.ts        # GitHub + npm variants
    daytimeChart.ts       # uses d3-shape; GitHub + npm variants
    popularTile.ts        # one tile (repo or package)
  readme.ts               # inject <picture>/<a> markup between markers
.github/workflows/nightly.yml
```

## Config file (`config.ts`)

```ts
export const config = {
  github: { accounts: ['tamino-martinius', 'tamino-cookieai'] },
  npm:    { account: 'tamino-martinius' },
  cards: {
    user:            { enabled: true, topLanguages: 4 },
    githubTotals:    { enabled: true },
    githubDaytime:   { enabled: true },
    popularRepos:    { enabled: true, count: 6, sortBy: 'stars',     exclude: [] as string[] },
    npmTotals:       { enabled: true },
    npmDaytime:      { enabled: true },
    popularPackages: { enabled: true, count: 6, sortBy: 'downloads', exclude: [] as string[] }, // total downloads
  },
  theme:  { /* light + dark; defaulted from tokens, overridable here */ },
  output: { assetsDir: 'assets', readme: 'README.md' },
} as const;
```

Toggling a card to `enabled: false` omits it from generation and the README.

## Aggregation (mirrors `Data.ts`)

- **GitHub commit totals:** sum `commitCount`, `additions`, `deletions`,
  `changedFiles` across all repos and all configured accounts.
- **GitHub commits per hour / weekday:** sum `commitsPerHour` across repos into
  `"Wkd, HH"` buckets and weekday buckets.
- **Top languages:** weight by commits per language → top N for the User legend.
- **Top repos:** public repos sorted by `stargazerCount` desc, minus `exclude`,
  take `count`.
- **npm totals:** total downloads (sum `downloadsPerDate` across packages),
  total versions/publishes, package count.
- **npm publishes per hour/weekday:** from `user.versionsPerHour`.
- **Top packages:** sort by total `downloadsPerDate` sum (or last-week, per
  `sortBy`), minus `exclude`, take `count`.

All pure functions over typed inputs.

## README assembly

- Generated content lives between `<!-- METRICS:START -->` and
  `<!-- METRICS:END -->`. The intro above the markers is hand-editable and never
  overwritten.
- Dark/light via `<picture>`:
  ```html
  <a href="…repo…"><picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/repos/x.dark.svg">
    <img src="assets/repos/x.light.svg" alt="x" width="420">
  </picture></a>
  ```
- **Popular cards** = a non-linked header tile + 6 linked row tiles, equal width,
  stacked tight so they read as one card.
- **Layout:** User + GitHub Totals side by side; GitHub Daytime full width; a
  2-column block (GitHub Popular Repos | npm Popular Packages); npm Totals +
  Daytime mirrored. GitHub-native HTML (table where alignment needs it).

## Nightly workflow

`.github/workflows/nightly.yml`:

- Triggers: `schedule` cron `30 5 * * *` (~05:30 UTC, after github-stats midnight
  run and npm 6h syncs land) + `workflow_dispatch`.
- Steps: checkout → setup-node → `npm ci` → `npm run build` (`tsx src/index.ts`)
  → commit changed `assets/` + `README.md` **only if a diff exists** (no-op on no
  change, matching the other stats jobs).
- Permissions: `contents: write`.

## Testing (TDD)

`vitest`:

- **aggregate.ts:** unit tests for totals, top-N sorting, multi-account merge,
  exclude handling, empty/edge data — with small JSON fixtures.
- **svg/*.ts:** structural/snapshot tests asserting key values render, correct
  `viewBox`, and both light + dark variants produced.

## Out of scope

- Other metrics cards (followers, heatmaps, year charts, org breakdowns,
  timelines) — config can grow to add them later.
- Live/interactive content. The README is static SVG only.
- Changing the upstream github-stats / npm-stats jobs.
