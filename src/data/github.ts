import {
  activities as fallbackActivities,
  notes as fallbackNotes,
  projects as fallbackProjects,
} from "./content";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const owner = "ltyqa";
const notesRepo = "MyNote";
const siteRepo = "MyWebsite";
const apiBase = "https://api.github.com";
const rawBase = "https://raw.githubusercontent.com";
const localVaultPath = "C:\\Users\\12480\\Documents\\Obsidian Vault";
let notesCache: Promise<SiteNote[]> | undefined;
let projectsCache: Promise<Awaited<ReturnType<typeof loadGitHubProjects>>> | undefined;
let activitiesCache: Promise<string[][]> | undefined;

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

export type SiteNote = {
  title: string;
  meta: string;
  category: string;
  excerpt: string;
  link: string;
  sourceUrl: string;
  rawUrl: string;
  path: string;
  slug: string;
  localPath?: string;
};

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

function logFallback(message: string) {
  console.warn(`[site data] ${message}`);
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

function slugFromPath(path: string) {
  return path.replace(/\.md$/i, "");
}

function noteHref(slug: string) {
  return `/notes/${slug
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}/`;
}

function githubBlobUrl(path: string) {
  return `https://github.com/${owner}/${notesRepo}/blob/main/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function githubRawUrl(path: string) {
  return `${rawBase}/${owner}/${notesRepo}/main/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function fallbackNoteHref(title: string) {
  return `/notes/local/${encodeURIComponent(title)}/`;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) return [];
        return listMarkdownFiles(fullPath);
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
}

async function getLocalVaultNotes(): Promise<SiteNote[]> {
  if (!existsSync(localVaultPath)) return [];

  const files = await listMarkdownFiles(localVaultPath);

  return files
    .map((file) => {
      const path = relative(localVaultPath, file).split(sep).join("/");
      const category = categoryFromPath(path);
      const slug = slugFromPath(path);

      return {
        title: cleanTitle(path),
        meta: `${category} / ${estimateReadingTimeFromPath(path)}`,
        category,
        excerpt: `收在「${category}」里的笔记，适合回看概念、方法和当时的判断。`,
        link: noteHref(slug),
        sourceUrl: githubBlobUrl(path),
        rawUrl: githubRawUrl(path),
        path,
        slug,
        localPath: file,
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category, "zh-CN"));
}

function getFallbackNotes(): SiteNote[] {
  return fallbackNotes.map((note) => ({
    ...note,
    link: fallbackNoteHref(note.title),
    sourceUrl: "https://github.com/ltyqa/MyNote",
    rawUrl: "",
    path: `local/${note.title}.md`,
    slug: `local/${note.title}`,
  }));
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

async function loadGitHubProjects() {
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
    logFallback("GitHub projects unavailable, using local fallback.");
    return fallbackProjects;
  }
}

async function loadGitHubNotes() {
  const localNotes = await getLocalVaultNotes();

  if (localNotes.length) {
    return localNotes;
  }

  try {
    const tree = await fetchJson<GitTreeResponse>(
      `${apiBase}/repos/${owner}/${notesRepo}/git/trees/main?recursive=1`,
    );

    const notes: SiteNote[] = tree.tree
      .filter((item) => item.type === "blob" && item.path.endsWith(".md"))
      .filter((item) => !item.path.startsWith("."))
      .map((item) => {
        const category = categoryFromPath(item.path);
        const slug = slugFromPath(item.path);

        return {
          title: cleanTitle(item.path),
          meta: `${category} / ${estimateReadingTimeFromPath(item.path)}`,
          category,
          excerpt: `收在「${category}」里的笔记，适合回看概念、方法和当时的判断。`,
          link: noteHref(slug),
          sourceUrl: githubBlobUrl(item.path),
          rawUrl: githubRawUrl(item.path),
          path: item.path,
          slug,
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category, "zh-CN"));

    return notes.length ? notes : fallbackNotes;
  } catch (error) {
    logFallback("GitHub notes unavailable, using local fallback.");
    return getFallbackNotes();
  }
}

export async function getGitHubNoteBySlug(slug: string) {
  const notes = await getGitHubNotes();
  const note = notes.find((item) => item.slug === slug);

  if (!note) {
    return undefined;
  }

  if (note.localPath) {
    return {
      ...note,
      markdown: await readFile(note.localPath, "utf-8"),
    };
  }

  if (!note.rawUrl) {
    return {
      ...note,
      markdown: `# ${note.title}\n\n${note.excerpt}`,
    };
  }

  const response = await fetch(note.rawUrl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch note markdown: ${response.status} ${note.rawUrl}`);
  }

  return {
    ...note,
    markdown: await response.text(),
  };
}

async function loadGitHubActivities() {
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
    logFallback("GitHub activity unavailable, using local fallback.");
    return fallbackActivities;
  }
}

export async function getGitHubProjects() {
  projectsCache ||= loadGitHubProjects();
  return projectsCache;
}

export async function getGitHubNotes() {
  notesCache ||= loadGitHubNotes();
  return notesCache;
}

export async function getGitHubActivities() {
  activitiesCache ||= loadGitHubActivities();
  return activitiesCache;
}
