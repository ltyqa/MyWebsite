const weeklyOwner = "ruanyf";
const weeklyRepo = "weekly";
const apiBase = "https://api.github.com";

type GitHubContentItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
  html_url: string;
};

type GitCommit = {
  html_url: string;
  commit: {
    committer: {
      date: string;
    };
  };
};

export type WeeklyIssue = {
  number: number;
  title: string;
  markdown: string;
  publishedAt: string;
  publishedLabel: string;
  sourceUrl: string;
  rawUrl: string;
  commitUrl: string;
};

let weeklyCache: Promise<WeeklyIssue> | undefined;
const fallbackIssueNumber = 402;
const fallbackIssuePath = `docs/issue-${fallbackIssueNumber}.md`;
const fallbackPublishedAt = "2026-07-03T02:23:53Z";

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "User-Agent": "ltyqa-personal-site",
};

if (import.meta.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${import.meta.env.GITHUB_TOKEN}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${url}`);
  }

  return response.json() as Promise<T>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function titleFromMarkdown(markdown: string, issueNumber: number) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || `科技爱好者周刊（第 ${issueNumber} 期）`;
}

async function loadLatestWeeklyIssue(): Promise<WeeklyIssue> {
  try {
    const files = await fetchJson<GitHubContentItem[]>(
      `${apiBase}/repos/${weeklyOwner}/${weeklyRepo}/contents/docs`,
    );

    const latest = files
      .map((file) => {
        const match = file.name.match(/^issue-(\d+)\.md$/);
        return match
          ? {
              ...file,
              number: Number(match[1]),
            }
          : undefined;
      })
      .filter((file): file is GitHubContentItem & { number: number } => Boolean(file))
      .sort((a, b) => b.number - a.number)[0];

    if (!latest || !latest.download_url) {
      throw new Error("Unable to find the latest ruanyf/weekly issue.");
    }

    const [markdownResponse, commits] = await Promise.all([
      fetch(latest.download_url, { headers }),
      fetchJson<GitCommit[]>(
        `${apiBase}/repos/${weeklyOwner}/${weeklyRepo}/commits?path=${encodeURIComponent(latest.path)}&per_page=1`,
      ),
    ]);

    if (!markdownResponse.ok) {
      throw new Error(`Failed to fetch weekly markdown: ${markdownResponse.status}`);
    }

    const markdown = await markdownResponse.text();
    const commit = commits[0];
    const publishedAt = commit?.commit.committer.date || new Date().toISOString();

    return {
      number: latest.number,
      title: titleFromMarkdown(markdown, latest.number),
      markdown,
      publishedAt,
      publishedLabel: formatDate(publishedAt),
      sourceUrl: latest.html_url,
      rawUrl: latest.download_url,
      commitUrl: commit?.html_url || latest.html_url,
    };
  } catch (error) {
    console.warn("[weekly data] GitHub API unavailable, using pinned latest weekly issue.");
    return loadFallbackWeeklyIssue();
  }
}

async function loadFallbackWeeklyIssue(): Promise<WeeklyIssue> {
  const rawUrl = `https://raw.githubusercontent.com/${weeklyOwner}/${weeklyRepo}/master/${fallbackIssuePath}`;
  const sourceUrl = `https://github.com/${weeklyOwner}/${weeklyRepo}/blob/master/${fallbackIssuePath}`;
  const response = await fetch(rawUrl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch fallback weekly markdown: ${response.status}`);
  }

  const markdown = await response.text();

  return {
    number: fallbackIssueNumber,
    title: titleFromMarkdown(markdown, fallbackIssueNumber),
    markdown,
    publishedAt: fallbackPublishedAt,
    publishedLabel: formatDate(fallbackPublishedAt),
    sourceUrl,
    rawUrl,
    commitUrl: sourceUrl,
  };
}

export async function getLatestWeeklyIssue() {
  weeklyCache ||= loadLatestWeeklyIssue();
  return weeklyCache;
}
