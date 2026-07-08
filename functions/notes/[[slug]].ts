const owner = "ltyqa";
const notesRepo = "MyNote";
const rawBase = "https://raw.githubusercontent.com";

type Env = {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  GITHUB_TOKEN?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function titleFromSlug(slug: string) {
  return decodeURIComponent(slug)
    .split("/")
    .pop()
    ?.replace(/\.md$/i, "")
    .replace(/^\d+\s*/, "") || "笔记";
}

function categoryFromSlug(slug: string) {
  return decodeURIComponent(slug).split("/")[0] || "笔记";
}

function rewriteMarkdownAssets(markdown: string, slug: string) {
  const baseDir = slug.split("/").slice(0, -1).join("/");

  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    if (/^(https?:|data:|\/)/i.test(src)) return match;

    const normalized = [baseDir, src]
      .filter(Boolean)
      .join("/")
      .replace(/\/\.\//g, "/");

    return `![${alt}](${rawBase}/${owner}/${notesRepo}/main/${encodePath(normalized)})`;
  });
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inCode = false;
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      if (inCode) {
        html.push("</code></pre>");
      } else {
        html.push("<pre><code>");
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      html.push(`${escapeHtml(rawLine)}\n`);
      continue;
    }

    if (!line.trim()) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(listItem[1])}</li>`);
      continue;
    }

    if (inList) {
      html.push("</ul>");
      inList = false;
    }

    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inCode) html.push("</code></pre>");
  if (inList) html.push("</ul>");

  return html.join("\n");
}

function pageHtml({
  title,
  category,
  slug,
  content,
}: {
  title: string;
  category: string;
  slug: string;
  content: string;
}) {
  const sourceUrl = `https://github.com/${owner}/${notesRepo}/blob/main/${encodePath(slug)}.md`;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | 笔记</title>
    <style>
      :root { color-scheme: light; --ink: #1d2230; --paper: #faf7ef; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-width: 320px;
        background:
          linear-gradient(rgba(250, 247, 239, 0.82), rgba(250, 247, 239, 0.82)),
          url("/images/room-sketch.png") center / cover fixed no-repeat,
          #faf7ef;
        color: var(--ink);
        font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
        line-height: 1.75;
      }
      main { width: min(920px, calc(100% - 34px)); margin: 0 auto; padding: 44px 0 72px; }
      .paper {
        border: 3px solid #1a1a1a;
        background:
          linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)),
          repeating-linear-gradient(0deg, transparent 0 31px, rgba(26, 26, 26, 0.055) 31px 32px);
        padding: clamp(24px, 5vw, 54px);
        box-shadow: 5px 6px 0 rgba(26, 26, 26, 0.08);
      }
      a { color: inherit; font-weight: 900; text-decoration-thickness: 2px; text-underline-offset: 5px; }
      .back { display: inline-flex; margin-bottom: 24px; }
      .meta { color: rgba(29, 34, 48, 0.64); font-family: ui-monospace, Consolas, monospace; }
      h1 { margin: 10px 0 22px; font-size: clamp(42px, 7vw, 78px); line-height: 1; }
      h2 { margin-top: 2rem; font-size: clamp(28px, 4vw, 44px); line-height: 1.12; }
      h3 { margin-top: 1.5rem; font-size: 26px; }
      p, li { font-size: 18px; }
      img { max-width: 100%; border: 2px solid #1a1a1a; }
      pre { overflow-x: auto; border: 3px solid #1a1a1a; background: #1a1a1a; color: #fffdfa; padding: 18px; }
      code { font-family: ui-monospace, Consolas, monospace; }
      .actions { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 36px; }
    </style>
  </head>
  <body>
    <main>
      <article class="paper">
        <a class="back" href="/notes/">返回笔记目录</a>
        <p class="meta">${escapeHtml(category)} / Cloudflare 动态读取</p>
        <h1>${escapeHtml(title)}</h1>
        ${content}
        <div class="actions">
          <a href="/notes/">继续看笔记</a>
          <a href="${sourceUrl}" target="_blank" rel="noreferrer">查看源文件</a>
        </div>
      </article>
    </main>
  </body>
</html>`;
}

async function fetchRawMarkdown(slug: string, env: Env) {
  const requestHeaders: Record<string, string> = {
    "User-Agent": "ltyqa-personal-site-runtime",
  };

  if (env.GITHUB_TOKEN) {
    requestHeaders.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`${rawBase}/${owner}/${notesRepo}/main/${encodePath(slug)}.md`, {
    headers: requestHeaders,
  });

  if (!response.ok) return undefined;

  return response.text();
}

export async function onRequestGet({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) return assetResponse;

  const url = new URL(request.url);
  const rawSlug = decodeURIComponent(url.pathname.replace(/^\/notes\/?/, "").replace(/\/$/, ""));
  if (!rawSlug) return assetResponse;

  const markdown = await fetchRawMarkdown(rawSlug, env);
  if (!markdown) return assetResponse;

  const category = categoryFromSlug(rawSlug);
  const title = titleFromSlug(rawSlug);
  const rewritten = rewriteMarkdownAssets(markdown, rawSlug);

  return new Response(
    pageHtml({
      title,
      category,
      slug: rawSlug,
      content: renderMarkdown(rewritten),
    }),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}
