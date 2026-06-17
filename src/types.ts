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
