import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { config } from "../config";
import { aggregateGithub, aggregateNpm, combineEqualWeight, topPackages, topRepositories } from "./aggregate";
import { fetchGithubStats, fetchNpmStats } from "./fetch";
import { linkedPicture, picture, replaceBlock } from "./readme";
import { renderDaytimeChart } from "./svg/daytimeChart";
import { renderPopularHeader, renderPopularTile } from "./svg/popularTile";
import { renderGithubTotalCounts, renderNpmTotalCounts } from "./svg/totalCounts";
import { renderUserCard } from "./svg/userCard";
import { type Theme, themes } from "./theme";

const assetsDir = config.output.assetsDir;

// Rendered image widths. 416 (not 420) so two cards fit side by side in GitHub's
// narrower repo README file view; WIDE_W keeps the daytime chart at the two-column width.
const CARD_W = 416;
const WIDE_W = CARD_W * 2;

function slugify(name: string): string {
  return name
    .replace(/[@/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^-+/, "");
}

const usedSlugs = new Set<string>(["repos/_header", "packages/_header"]);

/** Slugify within a namespace; on collision append -2, -3, … so a nightly run never hard-fails. */
function uniqueSlug(namespace: string, name: string): string {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (usedSlugs.has(`${namespace}/${slug}`)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  usedSlugs.add(`${namespace}/${slug}`);
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
  rmSync(assetsDir, { recursive: true, force: true });
  mkdirSync(assetsDir, { recursive: true });

  const [ghStats, npmStats] = await Promise.all([
    fetchGithubStats(config.github.accounts),
    fetchNpmStats(config.npm.account),
  ]);
  const gh = aggregateGithub(ghStats);
  const npm = aggregateNpm(npmStats);
  const avatar = await fetchAvatarDataUri(ghStats.user.avatarUrl);
  const userWithAvatar = { ...ghStats.user, avatarUrl: avatar };

  // Profile links derived from config (first GitHub account, the npm account).
  const githubUser = config.github.accounts[0] ?? ghStats.user.username;
  const reposUrl = `https://github.com/${githubUser}?tab=repositories`;
  const npmUserUrl = `https://www.npmjs.com/~${config.npm.account}`;

  const sections: string[] = [];

  // Right-aligned "Updated" timestamp as the first line.
  const updatedAt = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
  sections.push(`<p align="right"><sub>Updated ${updatedAt}</sub></p>`);

  if (config.cards.user.enabled) {
    const p = writePair("github-user", (t) =>
      renderUserCard(userWithAvatar, gh, t, { topLanguages: config.cards.user.topLanguages }),
    );
    sections.push(linkedPicture(ghStats.user.url, p.light, p.dark, ghStats.user.name, CARD_W));
  }

  const row: string[] = [];
  if (config.cards.githubTotals.enabled) {
    const p = writePair("github-total", (t) => renderGithubTotalCounts(gh.totals, t));
    row.push(picture(p.light, p.dark, "GitHub totals", CARD_W));
  }
  if (config.cards.npmTotals.enabled) {
    const p = writePair("npm-total", (t) => renderNpmTotalCounts(npm.totals, t));
    row.push(linkedPicture(npmUserUrl, p.light, p.dark, "npm totals", CARD_W));
  }
  if (row.length) sections.push(row.join(" "));

  if (config.cards.daytime.enabled) {
    // Combine commit + publish activity with equal weight into one chart.
    const daytime = combineEqualWeight(gh.commitsPerHour, npm.publishesPerHour);
    const p = writePair("daytime", (t) => renderDaytimeChart("Daytime Chart", daytime, t));
    sections.push(picture(p.light, p.dark, "Daytime chart (commits + npm publishes)", WIDE_W));
  }

  // Popular Repositories and Popular Packages, shown as two side-by-side columns of
  // linked tiles (inline images with <br> line breaks, matching the stats-card row).
  let reposColumn: string[] = [];
  let packagesColumn: string[] = [];

  if (config.cards.popularRepos.enabled) {
    const repos = topRepositories(ghStats, {
      count: config.cards.popularRepos.count,
      exclude: config.cards.popularRepos.exclude,
    });
    const leader = repos[0]?.stargazerCount ?? 0;
    const header = writePair("repos/_header", (t) => renderPopularHeader("Popular Repositories", t));
    reposColumn = [linkedPicture(reposUrl, header.light, header.dark, "Popular Repositories", CARD_W)];
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
      reposColumn.push(linkedPicture(repo.url, pair.light, pair.dark, repo.name, CARD_W));
    }
  }

  if (config.cards.popularPackages.enabled) {
    const pkgs = topPackages(npmStats, {
      count: config.cards.popularPackages.count,
      exclude: config.cards.popularPackages.exclude,
    });
    const leader = pkgs[0]?.downloads ?? 0;
    const header = writePair("packages/_header", (t) => renderPopularHeader("Popular Packages", t));
    packagesColumn = [linkedPicture(npmUserUrl, header.light, header.dark, "Popular Packages", CARD_W)];
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
      packagesColumn.push(linkedPicture(pkg.url, pair.light, pair.dark, pkg.name, CARD_W));
    }
  }

  if (reposColumn.length && packagesColumn.length) {
    const rowCount = Math.max(reposColumn.length, packagesColumn.length);
    const lines: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      lines.push(`${reposColumn[i] ?? ""} ${packagesColumn[i] ?? ""}`.trim());
    }
    sections.push(lines.join("<br>"));
  } else if (reposColumn.length) {
    sections.push(reposColumn.join("<br>"));
  } else if (packagesColumn.length) {
    sections.push(packagesColumn.join("<br>"));
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
