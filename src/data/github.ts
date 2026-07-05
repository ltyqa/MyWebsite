import {
  activities as fallbackActivities,
  notes as fallbackNotes,
  projects as fallbackProjects,
} from "./content";

const owner = "ltyqa";
const notesRepo = "MyNote";
const siteRepo = "MyWebsite";
const apiBase = "https://api.github.com";

type GitHubRepo = {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  updated_at: string;
  topics?: string[];
};

type GitTreeItem = {
  path: string;
  type: "blob" | "tree";
  url: string;
};

type GitTreeResponse = {
  tree: GitTreeItem[];
};

type GitCommit = {
  commit: {
    message: string;
    committer: {
      date: string;
    };
  };
};

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "ltyqa-personal-site",
};

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

function cleanTitle(path: string) {
  const fileName = decodeURIComponent(path)
    .split("/")
    .pop()
    ?.replace(/\.md$/i, "");

  return fileName?.replace(/^\d+\s*/, "") || path;
}

function categoryFromPath(path: string) {
  return decodeURIComponent(path).split("/")[0] || "笔记";
}

function estimateReadingTimeFromPath(path: string) {
  const base = Math.max(4, Math.min(12, Math.round(path.length / 12)));
  return `${base} 分钟`;
}

function repoStatus(repo: GitHubRepo) {
  if (repo.archived) return "已归档";

  const daysSincePush =
    (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSincePush < 14) return "维护中";
  if (daysSincePush < 90) return "稳定";
  return "存档";
}

function repoDescription(repo: GitHubRepo) {
  if (repo.description) return repo.description;
  if (repo.name === siteRepo) return "个人网站的源码仓库，记录页面设计、内容同步和持续迭代。";
  if (repo.name === notesRepo) return "公开笔记仓库，整理课程笔记、设计记录和工具方法。";
  return "公开项目仓库，保留代码、说明和持续更新的记录。";
}

export async function getGitHubProjects() {
  try {
    const repos = await fetchJson<GitHubRepo[]>(
      `${apiBase}/users/${owner}/repos?sort=pushed&per_page=100`,
    );

    const projects = repos
      .filter((repo) => !repo.fork && repo.name !== notesRepo)
      .map((repo) => ({
        name: repo.name,
        description: repoDescription(repo),
        stack: [repo.language || "Repository", ...(repo.topics || []).slice(0, 2)],
        meta: `${repo.language || "GitHub"} / ${repo.stargazers_count} stars / ${formatDate(repo.pushed_at)}`,
        status: repoStatus(repo),
        link: repo.html_url,
        homepage: repo.homepage,
        updatedAt: repo.pushed_at,
      }))
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

    return projects.length ? projects : fallbackProjects;
  } catch (error) {
    console.warn(error);
    return fallbackProjects;
  }
}

export async function getGitHubNotes() {
  try {
    const tree = await fetchJson<GitTreeResponse>(
      `${apiBase}/repos/${owner}/${notesRepo}/git/trees/main?recursive=1`,
    );

    const notes = tree.tree
      .filter((item) => item.type === "blob" && item.path.endsWith(".md"))
      .filter((item) => !item.path.startsWith("."))
      .map((item) => {
        const category = categoryFromPath(item.path);

        return {
          title: cleanTitle(item.path),
          meta: `${category} / ${estimateReadingTimeFromPath(item.path)}`,
          category,
          excerpt: `收在「${category}」里的笔记，适合回看概念、方法和当时的判断。`,
          link: `https://github.com/${owner}/${notesRepo}/blob/main/${item.path
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category, "zh-CN"));

    return notes.length ? notes : fallbackNotes;
  } catch (error) {
    console.warn(error);
    return fallbackNotes;
  }
}

export async function getGitHubActivities() {
  try {
    const commits = await fetchJson<GitCommit[]>(
      `${apiBase}/repos/${owner}/${siteRepo}/commits?per_page=2`,
    );
    const noteCommits = await fetchJson<GitCommit[]>(
      `${apiBase}/repos/${owner}/${notesRepo}/commits?per_page=2`,
    );

    const items = [
      ...commits.map((commit) => [
        formatDate(commit.commit.committer.date),
        "更新个人网站",
        commit.commit.message.split("\n")[0],
      ]),
      ...noteCommits.map((commit) => [
        formatDate(commit.commit.committer.date),
        "同步笔记仓库",
        commit.commit.message.split("\n")[0],
      ]),
    ];

    return items.length ? items.slice(0, 4) : fallbackActivities;
  } catch (error) {
    console.warn(error);
    return fallbackActivities;
  }
}
