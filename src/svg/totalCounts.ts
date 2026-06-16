import type { GithubTotals, NpmTotals } from "../aggregate";
import type { Theme } from "../theme";
import { bar, cardBackground, hr, legendRows, svgDocument, textPath } from "./primitives";

const W = 420;
const H = 170;

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function headline(heading: string, sub: string, theme: Theme): string {
  return (
    textPath({ text: heading, x: 18, y: 38, size: 22, weight: "bold", color: theme.foreground }) +
    textPath({ text: sub, x: 18, y: 58, size: 13, weight: "regular", color: theme.foregroundLight })
  );
}

export function renderGithubTotalCounts(totals: GithubTotals, theme: Theme): string {
  const items = [
    { label: "Additions", value: formatNumber(totals.additions), color: theme.green },
    { label: "Deletions", value: formatNumber(totals.deletions), color: theme.blue },
    {
      label: "Changed Files",
      value: formatNumber(totals.changedFiles),
      color: theme.series[0] ?? theme.foregroundLight,
    },
  ];
  const body =
    cardBackground(W, H, theme) +
    headline(`${formatNumber(totals.commitCount)} Commits`, "In Total", theme) +
    hr(18, 76, theme) +
    legendRows({ x: 18, y: 100, items, theme }) +
    bar({
      x: 18,
      y: 150,
      width: W - 36,
      height: 8,
      sections: [
        { value: totals.additions, color: theme.green },
        { value: totals.deletions, color: theme.blue },
      ],
      theme,
    });
  return svgDocument(W, H, body);
}

export function renderNpmTotalCounts(totals: NpmTotals, theme: Theme): string {
  const items = [
    { label: "Packages", value: formatNumber(totals.packageCount), color: theme.series[0] ?? theme.foregroundLight },
    { label: "Versions Published", value: formatNumber(totals.versions), color: theme.blue },
  ];
  const body =
    cardBackground(W, H, theme) +
    headline(`${formatNumber(totals.downloads)} Downloads`, "In Total", theme) +
    hr(18, 76, theme) +
    legendRows({ x: 18, y: 100, items, theme });
  return svgDocument(W, H, body);
}
