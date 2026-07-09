import { marked } from "marked";

const owner = "ruanyf";
const repo = "weekly";
const branch = "master";
const apiBase = "https://api.github.com";

type Env = {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  GITHUB_TOKEN?: string;
};

type GitCommit = {
  html_url: string;
  commit: {
    committer: {
      date: string;
    };
  };
};

type WeeklyIssue = {
  number: number;
  title: string;
  markdown: string;
  publishedAt: string;
  publishedLabel: string;
  sourceUrl: string;
  commitUrl: string;
};

type WeeklyReviewLink = {
  title: string;
  issueNumber: number;
  href: string;
};

function headers(env: Env) {
  const requestHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ltyqa-personal-site-runtime",
  };

  if (env.GITHUB_TOKEN) {
    requestHeaders.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  return requestHeaders;
}

async function fetchJson<T>(url: string, env: Env): Promise<T> {
  const response = await fetch(url, { headers: headers(env) });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${url}`);
  }

  return response.json() as Promise<T>;
}

function issuePath(issueNumber: number) {
  return `docs/issue-${issueNumber}.md`;
}

function rawIssueUrl(issueNumber: number) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${issuePath(issueNumber)}`;
}

function sourceIssueUrl(issueNumber: number) {
  return `https://github.com/${owner}/${repo}/blob/${branch}/${issuePath(issueNumber)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleFromMarkdown(markdown: string, issueNumber: number) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || `科技爱好者周刊（第 ${issueNumber} 期）`;
}

async function loadIssueCommit(issueNumber: number, env: Env) {
  try {
    const commits = await fetchJson<GitCommit[]>(
      `${apiBase}/repos/${owner}/${repo}/commits?path=${encodeURIComponent(issuePath(issueNumber))}&per_page=1`,
      env,
    );

    return commits[0];
  } catch {
    return undefined;
  }
}

async function loadWeeklyIssue(issueNumber: number, env: Env): Promise<WeeklyIssue> {
  const [markdownResponse, commit] = await Promise.all([
    fetch(rawIssueUrl(issueNumber), {
      headers: {
        "User-Agent": "ltyqa-personal-site-runtime",
      },
    }),
    loadIssueCommit(issueNumber, env),
  ]);

  if (!markdownResponse.ok) {
    throw new Error(`Weekly issue ${issueNumber} not found.`);
  }

  const markdown = await markdownResponse.text();
  const publishedAt = commit?.commit.committer.date || "";

  return {
    number: issueNumber,
    title: titleFromMarkdown(markdown, issueNumber),
    markdown,
    publishedAt,
    publishedLabel: publishedAt ? formatDate(publishedAt) : "发布日期见源文件",
    sourceUrl: sourceIssueUrl(issueNumber),
    commitUrl: commit?.html_url || sourceIssueUrl(issueNumber),
  };
}

function stripWeeklyTitle(markdown: string) {
  return markdown.replace(/^#\s+.+\r?\n+/, "");
}

function getReviewSectionRanges(markdown: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const headingPattern = /^##\s+(往年回顾|历史上的本周)\s*$/gm;
  let heading: RegExpExecArray | null;

  while ((heading = headingPattern.exec(markdown))) {
    const start = heading.index;
    const rest = markdown.slice(start);
    const afterHeading = markdown.slice(headingPattern.lastIndex);
    const nextHeading = afterHeading.match(/\r?\n##\s+/);
    const done = rest.match(/\r?\n[（(]完[）)]\s*$/m);
    const endCandidates = [
      nextHeading?.index === undefined ? undefined : headingPattern.lastIndex + nextHeading.index,
      done?.index === undefined ? undefined : start + done.index + done[0].length,
    ].filter((value): value is number => typeof value === "number");

    ranges.push({
      start,
      end: endCandidates.length ? Math.min(...endCandidates) : markdown.length,
    });
  }

  return ranges;
}

function getReviewSections(markdown: string) {
  return getReviewSectionRanges(markdown).map(({ start, end }) => markdown.slice(start, end));
}

function removeWeeklyReviewSection(markdown: string) {
  const ranges = getReviewSectionRanges(markdown);
  if (ranges.length === 0) return markdown;

  let result = "";
  let cursor = 0;

  for (const range of ranges) {
    result += markdown.slice(cursor, range.start).trimEnd();
    cursor = range.end;
  }

  result += markdown.slice(cursor).trimStart();
  return result.trim();
}

function extractWeeklyReviewLinks(markdown: string): WeeklyReviewLink[] {
  const sections = getReviewSections(markdown);
  const links: WeeklyReviewLink[] = [];
  const seen = new Set<number>();
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)\s*[（(][^）)]*#\s*(\d+)[^）)]*[）)]/g;

  for (const section of sections) {
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(section))) {
      const issueNumber = Number(match[3]);
      if (!Number.isInteger(issueNumber) || seen.has(issueNumber)) continue;

      seen.add(issueNumber);
      links.push({
        title: match[1].trim(),
        issueNumber,
        href: `/weekly/${issueNumber}/`,
      });
    }
  }

  return links;
}

function proxyWeeklyImages(markdown: string) {
  return markdown.replace(/!\[([^\]]*)\]\((https:\/\/cdn\.beekka\.com\/[^)]+)\)/g, (_match, alt, src) => {
    return `![${alt}](/weekly-image?src=${encodeURIComponent(src)})`;
  });
}

function renderReviewPanel(links: WeeklyReviewLink[]) {
  const linksHtml = links.length
    ? `<div class="weekly-review-links">${links
        .map(
          (link) => `<a href="${link.href}">
            <span>${escapeHtml(link.title)}</span>
            <em>#${link.issueNumber}</em>
          </a>`,
        )
        .join("")}</div>`
    : `<p class="weekly-review-empty">本期没有找到往年回顾链接。</p>`;

  return `<section class="page-shell article-shell weekly-review-panel" aria-labelledby="weekly-review-title">
    <div class="weekly-review-header">
      <div>
        <p class="note-meta">站内阅读</p>
        <h2 id="weekly-review-title">往年回顾</h2>
      </div>
      <a class="weekly-latest-link" href="/weekly/" aria-label="跳转到最新一期每周新闻">
        <span>最新一期</span>
        <em>NEW</em>
      </a>
    </div>
    ${linksHtml}
    <form class="weekly-issue-jump" data-weekly-jump novalidate>
      <label for="weekly-issue-input">按期号阅读</label>
      <div class="weekly-issue-jump-row">
        <input id="weekly-issue-input" name="issue" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="例如 355" aria-describedby="weekly-issue-message">
        <button type="submit">跳转</button>
      </div>
      <p id="weekly-issue-message" class="weekly-issue-message" data-weekly-jump-message aria-live="polite"></p>
    </form>
  </section>
  <script data-astro-rerun>
    (() => {
      document.querySelectorAll("[data-weekly-jump]").forEach((form) => {
        if (form.dataset.weeklyJumpBound === "1") return;
        form.dataset.weeklyJumpBound = "1";

        form.addEventListener("submit", (event) => {
          event.preventDefault();

          const input = form.querySelector('input[name="issue"]');
          const message = form.querySelector("[data-weekly-jump-message]");
          const value = input?.value?.trim() || "";

          if (!/^\\d+$/.test(value)) {
            if (message) message.textContent = "请输入数字期号";
            input?.focus();
            return;
          }

          window.location.href = \`/weekly/\${Number(value)}/\`;
        });
      });
    })();
  </script>`;
}

function renderIssueMain(issue: WeeklyIssue, articleHtml: string, reviewLinks: WeeklyReviewLink[]) {
  const published = issue.publishedAt
    ? `<time datetime="${escapeHtml(issue.publishedAt)}">发布于 ${escapeHtml(issue.publishedLabel)}</time>`
    : `<span>${escapeHtml(issue.publishedLabel)}</span>`;

  return `<section class="article-hero notes-sketch-article-hero weekly-news-hero">
    <div class="page-shell article-shell">
      <p class="note-meta">信息来源：ruanyf/weekly</p>
      <h1>每周新闻</h1>
      <p class="hero-copy">${escapeHtml(issue.title)}</p>
      <div class="weekly-issue-meta">
        <span>第 ${issue.number} 期</span>
        ${published}
      </div>
      <div class="tag-row">
        <span class="tag">动态读取</span>
        <span class="tag">GitHub 同步</span>
      </div>
      <a class="inline-link" href="${issue.sourceUrl}" target="_blank" rel="noreferrer">
        查看来源文件
      </a>
    </div>
  </section>
  <article class="page-shell article-shell article-body notes-sketch-article weekly-news-article">${articleHtml}</article>
  ${renderReviewPanel(reviewLinks)}`;
}

function renderNotFoundMain(issueNumber: number | undefined) {
  const message = issueNumber
    ? `没有找到第 ${issueNumber} 期周刊。`
    : "请输入有效的周刊期号。";

  return `<section class="article-hero notes-sketch-article-hero weekly-news-hero">
    <div class="page-shell article-shell">
      <p class="note-meta">信息来源：ruanyf/weekly</p>
      <h1>每周新闻</h1>
      <p class="hero-copy">${message}</p>
    </div>
  </section>
  <section class="page-shell article-shell article-body notes-sketch-article weekly-news-article weekly-not-found">
    <h2>没有找到这一期</h2>
    <p>${message}</p>
    <a class="inline-link" href="/weekly/">返回最新一期</a>
  </section>`;
}

function replaceMain(shell: string, mainHtml: string) {
  return shell.replace(
    /(<main class="dashboard-main route-main notes-sketch-main weekly-news-main">)[\s\S]*?(<\/main>)/,
    `$1${mainHtml}$2`,
  );
}

async function loadShell(request: Request, env: Env) {
  const url = new URL(request.url);
  url.pathname = "/weekly/";
  url.search = "";
  const response = await env.ASSETS.fetch(new Request(url.toString(), request));

  if (!response.ok) {
    throw new Error("Unable to load weekly shell.");
  }

  return response.text();
}

export async function onRequestGet({ request, env, params }: { request: Request; env: Env; params: { issue?: string } }) {
  const issueParam = Array.isArray(params.issue) ? params.issue[0] : params.issue;
  const issueNumber = Number(issueParam);
  const isValidIssueNumber = Number.isInteger(issueNumber) && issueNumber > 0;
  const shell = await loadShell(request, env);

  try {
    if (!isValidIssueNumber) {
      throw new Error("Invalid weekly issue number.");
    }

    const issue = await loadWeeklyIssue(issueNumber, env);
    const articleMarkdown = removeWeeklyReviewSection(stripWeeklyTitle(issue.markdown));
    const articleHtml = marked.parse(proxyWeeklyImages(articleMarkdown), {
      async: false,
      gfm: true,
      breaks: false,
    });
    const reviewLinks = extractWeeklyReviewLinks(issue.markdown);
    const html = replaceMain(shell, renderIssueMain(issue, articleHtml, reviewLinks))
      .replace(/<title>[\s\S]*?<\/title>/, `<title>每周新闻 | ${escapeHtml(issue.title)}</title>`)
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/,
        `<meta name="description" content="${escapeHtml(`来自 ruanyf/weekly 的第 ${issue.number} 期：${issue.title}`)}" />`,
      );

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (error) {
    const html = replaceMain(shell, renderNotFoundMain(isValidIssueNumber ? issueNumber : undefined))
      .replace(/<title>[\s\S]*?<\/title>/, "<title>每周新闻 | 未找到这一期</title>")
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/,
        '<meta name="description" content="没有找到这一期周刊。" />',
      );

    return new Response(html, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=30",
      },
    });
  }
}
