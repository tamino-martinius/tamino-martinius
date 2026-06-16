import type { GithubAggregate } from "../aggregate";
import type { Theme } from "../theme";
import type { GithubUser } from "../types";
import { cardBackground, escapeXml, hr, legendRows, svgDocument, textPath, truncateToWidth } from "./primitives";

const W = 420;

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

  const H = 96 + Math.max(langs.length, 1) * 22;

  const avatar = `<clipPath id="avatar-clip"><circle cx="36" cy="36" r="18" /></clipPath><image href="${escapeXml(user.avatarUrl)}" x="18" y="18" width="36" height="36" clip-path="url(#avatar-clip)" />`;
  const name = textPath({ text: user.name, x: 64, y: 34, size: 16, weight: "bold", color: theme.foreground });
  const bio = textPath({
    text: truncateToWidth(user.bio, 13, "regular", W - 84),
    x: 64,
    y: 50,
    size: 13,
    weight: "regular",
    color: theme.foregroundLight,
  });
  const divider = hr(18, 74, theme);
  const legend = legendRows({ x: 18, y: 96, items: langs, theme });

  return svgDocument(W, H, cardBackground(W, H, theme) + avatar + name + bio + divider + legend);
}
