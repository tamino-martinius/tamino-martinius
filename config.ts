export interface PopularCardConfig {
  enabled: boolean;
  count: number;
  sortBy: "stars" | "downloads";
  exclude: string[];
}

export const config = {
  github: { accounts: ["tamino-martinius", "tamino-cookieai"] },
  npm: { account: "tamino-martinius" },
  cards: {
    user: { enabled: true, topLanguages: 4 },
    githubTotals: { enabled: true },
    npmTotals: { enabled: true },
    daytime: { enabled: true },
    popularRepos: { enabled: true, count: 10, sortBy: "stars" as const, exclude: [] as string[] },
    popularPackages: { enabled: true, count: 10, sortBy: "downloads" as const, exclude: [] as string[] },
  },
  output: { assetsDir: "assets", readme: "README.md" },
} as const satisfies {
  github: { accounts: readonly string[] };
  npm: { account: string };
  cards: {
    user: { enabled: boolean; topLanguages: number };
    githubTotals: { enabled: boolean };
    npmTotals: { enabled: boolean };
    daytime: { enabled: boolean };
    popularRepos: PopularCardConfig;
    popularPackages: PopularCardConfig;
  };
  output: { assetsDir: string; readme: string };
};

export type Config = typeof config;
