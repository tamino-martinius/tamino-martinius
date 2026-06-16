import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../config";
import { aggregateGithub, aggregateNpm, topPackages, topRepositories } from "./aggregate";
import { fetchGithubStats, fetchNpmStats } from "./fetch";
import { linkedPicture, picture, replaceBlock } from "./readme";
import { renderDaytimeChart } from "./svg/daytimeChart";
import { renderPopularHeader, renderPopularTile } from "./svg/popularTile";
import { renderGithubTotalCounts, renderNpmTotalCounts } from "./svg/totalCounts";
import { renderUserCard } from "./svg/userCard";
import { type Theme, themes } from "./theme";

const assetsDir = config.output.assetsDir;

function slugify(name: string): string {
  return name
    .replace(/[@/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^-+/, "");
}

const usedSlugs = new Set<string>();

/** Slugify within a namespace (e.g. "repos"/"packages") and fail loudly on collision. */
function uniqueSlug(namespace: string, name: string): string {
  const slug = slugify(name);
  const key = `${namespace}/${slug}`;
  if (usedSlugs.has(key)) {
    throw new Error(`Slug collision for "${name}" -> "${key}". Add an exclude or adjust slugify.`);
  }
  usedSlugs.add(key);
  return slug;
}

async function fetchAvatarDataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return url;
  }
}

/** Write light + dark variants; return relative paths. */
function writePair(name: string, render: (theme: Theme) => string): { light: string; dark: string } {
  const light = join(assetsDir, `${name}.light.svg`);
  const dark = join(assetsDir, `${name}.dark.svg`);
  mkdirSync(dirname(light), { recursive: true });
  writeFileSync(light, render(themes.light));
  writeFileSync(dark, render(themes.dark));
  return { light, dark };
}

async function main(): Promise<void> {
  mkdirSync(assetsDir, { recursive: true });

  const [ghStats, npmStats] = await Promise.all([
    fetchGithubStats(config.github.accounts),
    fetchNpmStats(config.npm.account),
  ]);
  const gh = aggregateGithub(ghStats);
  const npm = aggregateNpm(npmStats);
  const avatar = await fetchAvatarDataUri(ghStats.user.avatarUrl);
  const userWithAvatar = { ...ghStats.user, avatarUrl: avatar };

  const sections: string[] = [];

  if (config.cards.user.enabled) {
    const p = writePair("github-user", (t) =>
      renderUserCard(userWithAvatar, gh, t, { topLanguages: config.cards.user.topLanguages }),
    );
    sections.push(linkedPicture(ghStats.user.url, p.light, p.dark, ghStats.user.name, 420));
  }

  const row: string[] = [];
  if (config.cards.githubTotals.enabled) {
    const p = writePair("github-total", (t) => renderGithubTotalCounts(gh.totals, t));
    row.push(picture(p.light, p.dark, "GitHub totals", 420));
  }
  if (config.cards.npmTotals.enabled) {
    const p = writePair("npm-total", (t) => renderNpmTotalCounts(npm.totals, t));
    row.push(picture(p.light, p.dark, "npm totals", 420));
  }
  if (row.length) sections.push(row.join(" "));

  if (config.cards.githubDaytime.enabled) {
    const p = writePair("github-daytime", (t) => renderDaytimeChart("Daytime Chart — Commits", gh.commitsPerHour, t));
    sections.push(picture(p.light, p.dark, "GitHub daytime", 860));
  }
  if (config.cards.npmDaytime.enabled) {
    const p = writePair("npm-daytime", (t) => renderDaytimeChart("Daytime Chart — Publishes", npm.publishesPerHour, t));
    sections.push(picture(p.light, p.dark, "npm daytime", 860));
  }

  if (config.cards.popularRepos.enabled) {
    const repos = topRepositories(ghStats, {
      count: config.cards.popularRepos.count,
      exclude: config.cards.popularRepos.exclude,
    });
    const leader = repos[0]?.stargazerCount ?? 0;
    const header = writePair("repos/_header", (t) => renderPopularHeader("Popular Repositories", t));
    const tiles = [picture(header.light, header.dark, "Popular Repositories", 420)];
    for (const repo of repos) {
      const slug = uniqueSlug("repos", repo.name);
      const accent =
        ghStats.languageColors[repo.primaryLanguage ?? ""] ?? themes.light.series[0] ?? themes.light.foregroundLight;
      const pair = writePair(`repos/${slug}`, (t) =>
        renderPopularTile({
          name: repo.name,
          description: repo.description,
          value: repo.stargazerCount,
          valueLabel: repo.stargazerCount.toLocaleString("en-US"),
          leaderValue: leader,
          accent,
          theme: t,
          valueIcon: "star",
        }),
      );
      tiles.push(linkedPicture(repo.url, pair.light, pair.dark, repo.name, 420));
    }
    sections.push(tiles.join("<br>"));
  }

  if (config.cards.popularPackages.enabled) {
    const pkgs = topPackages(npmStats, {
      count: config.cards.popularPackages.count,
      exclude: config.cards.popularPackages.exclude,
    });
    const leader = pkgs[0]?.downloads ?? 0;
    const header = writePair("packages/_header", (t) => renderPopularHeader("Popular Packages", t));
    const tiles = [picture(header.light, header.dark, "Popular Packages", 420)];
    for (const pkg of pkgs) {
      const slug = uniqueSlug("packages", pkg.name);
      const pair = writePair(`packages/${slug}`, (t) =>
        renderPopularTile({
          name: pkg.name,
          description: pkg.description,
          value: pkg.downloads,
          valueLabel: pkg.downloads.toLocaleString("en-US"),
          leaderValue: leader,
          accent: themes.light.blue,
          theme: t,
          valueIcon: "download",
        }),
      );
      tiles.push(linkedPicture(pkg.url, pair.light, pair.dark, pkg.name, 420));
    }
    sections.push(tiles.join("<br>"));
  }

  const block = sections.join("\n\n");
  const readmePath = config.output.readme;
  const current = readFileSync(readmePath, "utf8");
  writeFileSync(readmePath, replaceBlock(current, block));
  console.log("README updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
