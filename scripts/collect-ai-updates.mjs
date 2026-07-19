import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";

const DATA_PATH = resolve("src/data/ai-updates.json");
const RETENTION_DAYS = 90;
const EXTENDED_RETENTION_DAYS = 365;
const EXTENDED_RETENTION_PRODUCTS = new Set(["Kimi", "DeepSeek", "豆包"]);
const USER_AGENT = "ltyqa-ai-updates/1.0 (+https://mywebsite.pages.dev)";
const xmlParser = new XMLParser({ ignoreAttributes: false, trimValues: true });
const sourceById = new Map();

const sources = [
  {
    id: "openai-news",
    company: "OpenAI",
    product: "GPT",
    kind: "news",
    format: "rss",
    categories: ["Product", "Research", "Engineering"],
    keyword: /gpt|chatgpt|codex|sora|openai api|model/i,
    url: "https://openai.com/news/rss.xml",
  },
  {
    id: "claude-apps",
    company: "Anthropic",
    product: "Claude",
    kind: "product",
    format: "dated-html",
    url: "https://support.claude.com/en/articles/12138966-release-notes",
  },
  {
    id: "claude-platform",
    company: "Anthropic",
    product: "Claude",
    kind: "api",
    format: "dated-html",
    url: "https://platform.claude.com/docs/en/release-notes/overview",
  },
  {
    id: "gemini-apps",
    company: "Google",
    product: "Gemini",
    kind: "product",
    format: "dated-html",
    url: "https://gemini.google/us/release-notes/?hl=en",
  },
  {
    id: "gemini-api",
    company: "Google",
    product: "Gemini",
    kind: "api",
    format: "dated-html",
    url: "https://ai.google.dev/gemini-api/docs/changelog?hl=en",
  },
  {
    id: "deepmind-news",
    company: "Google DeepMind",
    product: "Gemini",
    kind: "news",
    format: "rss",
    keyword: /gemini|gemma|veo|imagen/i,
    url: "https://deepmind.google/blog/rss.xml",
  },
  {
    id: "google-ai-news",
    company: "Google",
    product: "Gemini",
    kind: "news",
    format: "rss",
    keyword: /gemini|gemma|veo|imagen|google ai/i,
    url: "https://blog.google/technology/ai/rss/",
  },
  {
    id: "kimi-platform",
    company: "Moonshot AI",
    product: "Kimi",
    kind: "product",
    format: "blog-index",
    language: "zh",
    url: "https://platform.kimi.com/blog",
  },
  {
    id: "deepseek-api",
    company: "DeepSeek",
    product: "DeepSeek",
    kind: "api",
    format: "dated-html-nested",
    language: "zh",
    url: "https://api-docs.deepseek.com/zh-cn/updates",
  },
  {
    id: "doubao-news",
    company: "火山引擎",
    product: "豆包",
    kind: "product",
    format: "volc-news",
    language: "zh",
    keyword: /豆包|Doubao|方舟.*模型|模型.*方舟/i,
    url: "https://www.volcengine.com/news",
  },
];

for (const source of sources) sourceById.set(source.id, source);

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function array(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function cleanText(value = "") {
  return cheerio.load(`<main>${value}</main>`)("main")
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(sourceId, publishedAt, title) {
  return createHash("sha256")
    .update(`${sourceId}\n${publishedAt}\n${title}`)
    .digest("hex")
    .slice(0, 20);
}

function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeEntry(source, entry) {
  const publishedAt = parseDate(entry.publishedAt);
  const title = cleanText(entry.title);
  const summary = cleanText(entry.summary).slice(0, 6000);
  const url = entry.url || source.url;
  if (!publishedAt || !title) return undefined;

  return {
    id: stableId(source.id, publishedAt, title),
    sourceId: source.id,
    company: source.company,
    product: source.product,
    kind: source.kind,
    title,
    summary,
    content: entry.content || (source.format === "dated-html" ? summary : ""),
    contentZh: "",
    titleZh: "",
    summaryZh: "",
    translationStatus: "pending",
    publishedAt,
    url,
    collectedAt: new Date().toISOString(),
  };
}

async function collectArticleContent(entry) {
  if (entry.content) return entry;
  const readerUrl = `https://r.jina.ai/${entry.url}`;
  const response = await fetch(readerUrl, {
    headers: {
      Accept: "text/markdown",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Reader ${response.status}: ${response.statusText}`);
  const raw = await response.text();
  const content = raw.split("Markdown Content:").slice(1).join("Markdown Content:").trim();
  if (content.length < 200) throw new Error("Reader returned no usable article content");
  return { ...entry, content: content.slice(0, 80000) };
}

function contentChunks(markdown, maxLength = 7000) {
  const blocks = markdown.split(/\n{2,}/);
  const chunks = [];
  let current = "";
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > maxLength) {
      chunks.push(current);
      current = "";
    }
    if (block.length > maxLength) {
      if (current) chunks.push(current);
      for (let offset = 0; offset < block.length; offset += maxLength) {
        chunks.push(block.slice(offset, offset + maxLength));
      }
      current = "";
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateContent(markdown) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || !markdown) return "";
  const translated = [];
  for (const chunk of contentChunks(markdown)) {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "将以下科技文章忠实翻译为简体中文。保留 Markdown 标题、列表、链接、图片和代码格式；不总结、不删减、不扩写。只返回译文。",
          },
          { role: "user", content: chunk },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) throw new Error(`DeepSeek content ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("DeepSeek returned empty article content");
    translated.push(text);
  }
  return translated.join("\n\n");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchReaderMarkdown(url) {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: "text/markdown", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Reader ${response.status}: ${response.statusText}`);
  const raw = await response.text();
  return raw.split("Markdown Content:").slice(1).join("Markdown Content:").trim();
}

async function collectRss(source) {
  const document = xmlParser.parse(await fetchText(source.url));
  const items = array(document?.rss?.channel?.item ?? document?.feed?.entry);

  return items
    .map((item) => {
      const title = typeof item.title === "object" ? item.title["#text"] : item.title;
      const linkValue = item.link;
      const url = typeof linkValue === "object" ? linkValue["@_href"] : linkValue;
      const summary = item.description ?? item.summary ?? item.content?.["#text"] ?? item["content:encoded"];
      const publishedAt = item.pubDate ?? item.published ?? item.updated;
      const searchable = `${title || ""} ${cleanText(summary || "")}`;
      const categories = array(item.category).map((category) =>
        typeof category === "object" ? category["#text"] : category,
      );
      const categoryMatch = source.categories?.some((category) => categories.includes(category));
      if (source.categories && !categoryMatch && !source.keyword?.test(searchable)) return undefined;
      if (!source.categories && source.keyword && !source.keyword.test(searchable)) return undefined;
      return normalizeEntry(source, { title, summary, publishedAt, url });
    })
    .filter(Boolean);
}

const datePattern = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*|\s+)20\d{2}$/i;

function sectionText($, heading) {
  const $heading = $(heading);
  const fragments = [];
  let current = $heading.next();
  while (current.length && !/^H[1-3]$/.test(current[0]?.tagName?.toUpperCase() || "")) {
    fragments.push(current.text());
    current = current.next();
  }
  if (fragments.join(" ").trim().length >= 20) return fragments.join(" ");

  current = $heading.parent().next();
  while (current.length) {
    const nestedHeading = current.find("h2, h3").first().text().trim();
    if (nestedHeading && (/20\d{2}/.test(nestedHeading) || datePattern.test(nestedHeading))) break;
    fragments.push(current.text());
    current = current.next();
  }
  if (fragments.join(" ").trim().length >= 20) return fragments.join(" ");

  let parent = $heading.parent();
  for (let depth = 0; depth < 3 && parent.length; depth += 1) {
    const text = parent.text().replace($heading.text(), "").trim();
    if (text.length >= 20 && text.length <= 8000) return text;
    parent = parent.parent();
  }
  return "";
}

async function collectDatedHtml(source) {
  const $ = cheerio.load(await fetchText(source.url));
  const results = [];
  $("h2, h3").each((_index, heading) => {
    const rawDateLabel = cleanText($(heading).text()).replace(/(\d)(st|nd|rd|th)/i, "$1");
    const monthDate = rawDateLabel.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+20\d{2}/i)?.[0];
    const isoDate = rawDateLabel.match(/20\d{2}[.-]\d{2}[.-]\d{2}/)?.[0]?.replaceAll(".", "-");
    const dateLabel = monthDate || isoDate;
    if (!dateLabel) return;
    const summary = cleanText(sectionText($, heading));
    if (!summary) return;
    const title = summary.split(/(?<=[.!?])\s+/)[0].slice(0, 180) || `${source.product} update`;
    const normalized = normalizeEntry(source, {
      title,
      summary,
      publishedAt: dateLabel,
      url: source.url,
    });
    if (normalized) results.push(normalized);
  });
  return results;
}

async function collectBlogIndex(source) {
  const $ = cheerio.load(await fetchText(source.url));
  const results = [];
  $('a[href^="/blog/posts/"]').each((_index, anchor) => {
    const title = cleanText($(anchor).text());
    const publishedAt = $(anchor).closest("h3").next("time").attr("datetime");
    const href = $(anchor).attr("href");
    const normalized = normalizeEntry(source, {
      title,
      summary: title,
      publishedAt,
      url: new URL(href, source.url).href,
    });
    if (normalized) results.push(normalized);
  });
  return results;
}

async function collectNestedDatedHtml(source) {
  const $ = cheerio.load(await fetchText(source.url));
  const results = [];
  $("h2").each((_index, heading) => {
    const dateLabel = cleanText($(heading).text()).match(/20\d{2}-\d{2}-\d{2}/)?.[0];
    if (!dateLabel) return;
    const nodes = $(heading).nextUntil("h2");
    const titles = nodes.filter("h3").map((_i, node) => cleanText($(node).text())).get();
    const title = titles.join(" / ") || `${source.product} update`;
    const content = cleanText(nodes.map((_i, node) => $(node).text()).get().join(" "));
    const normalized = normalizeEntry(source, {
      title,
      summary: content.slice(0, 6000),
      content,
      publishedAt: dateLabel,
      url: source.url,
    });
    if (normalized) results.push(normalized);
  });
  return results;
}

async function collectVolcNews(source) {
  const markdown = await fetchReaderMarkdown(source.url);
  const lines = markdown.split("\n").map((line) => line.trim()).filter(Boolean);
  const results = [];
  const dateLine = /^(新产品|新功能|产品迭代)\s+(20\d{2})(?:年|-)(\d{1,2})(?:月|-)(\d{1,2})日?$/;
  for (let index = 2; index < lines.length; index += 1) {
    const match = lines[index].match(dateLine);
    if (!match) continue;
    const title = lines[index - 1];
    const category = lines[index - 2];
    if (!source.keyword.test(title)) continue;
    const publishedAt = `${match[2]}-${match[3].padStart(2, "0")}-${match[4].padStart(2, "0")}`;
    const normalized = normalizeEntry(source, {
      title,
      summary: `${category} · ${match[1]}`,
      content: `## ${title}\n\n${category} · ${match[1]}`,
      publishedAt,
      url: source.url,
    });
    if (normalized && !results.some((entry) => entry.id === normalized.id)) results.push(normalized);
  }
  return results;
}

async function collectSource(source) {
  if (source.format === "rss") return collectRss(source);
  if (source.format === "blog-index") return collectBlogIndex(source);
  if (source.format === "dated-html-nested") return collectNestedDatedHtml(source);
  if (source.format === "volc-news") return collectVolcNews(source);
  return collectDatedHtml(source);
}

async function translate(entry) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return entry;

  const contentZh = entry.contentZh || await translateContent(entry.content);
  if (entry.translationStatus === "translated" && entry.titleZh) {
    return { ...entry, contentZh };
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "你是忠实的科技资讯翻译。只翻译，不扩写、不总结、不添加事实。保留产品名、模型名、代码和 URL。返回 JSON：{\"titleZh\":\"\",\"summaryZh\":\"\"}。",
        },
        {
          role: "user",
          content: JSON.stringify({ title: entry.title, summary: entry.summary }),
        },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const translated = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
  if (!translated.titleZh) throw new Error("DeepSeek returned an empty title");
  return {
    ...entry,
    titleZh: translated.titleZh.trim(),
    summaryZh: (translated.summaryZh || "").trim(),
    contentZh,
    translationStatus: "translated",
  };
}

async function loadData() {
  try {
    return JSON.parse(await readFile(DATA_PATH, "utf8"));
  } catch {
    return { version: 1, updatedAt: null, sources: [], entries: [] };
  }
}

export async function collectUpdates() {
  const existing = await loadData();
  const byId = new Map(
    existing.entries.map((entry) => {
      const id = stableId(entry.sourceId, entry.publishedAt, entry.title);
      return [id, { ...entry, id }];
    }),
  );
  const previousById = new Map(byId);
  const sourceResults = [];
  let successfulSources = 0;

  for (const source of sources) {
    try {
      const entries = await collectSource(source);
      for (const [id, entry] of byId) {
        if (entry.sourceId === source.id) byId.delete(id);
      }
      for (const entry of entries) {
        const previous = previousById.get(entry.id);
        byId.set(entry.id, previous ? { ...entry, ...previous, collectedAt: entry.collectedAt } : entry);
      }
      sourceResults.push({ id: source.id, url: source.url, status: "ok", count: entries.length });
      successfulSources += 1;
      console.log(`[ai-updates] ${source.id}: ${entries.length} entries`);
    } catch (error) {
      sourceResults.push({ id: source.id, url: source.url, status: "error", message: error.message });
      console.warn(`[ai-updates] ${source.id}: ${error.message}`);
    }
  }

  if (successfulSources === 0) throw new Error("All AI update sources failed; existing data was preserved.");

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const extendedCutoff = Date.now() - EXTENDED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const retained = [...byId.values()]
    .filter((entry) => {
      const entryCutoff = EXTENDED_RETENTION_PRODUCTS.has(entry.product) ? extendedCutoff : cutoff;
      return new Date(entry.publishedAt).getTime() >= entryCutoff;
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  for (let index = 0; index < retained.length; index += 1) {
    const source = sourceById.get(retained[index].sourceId);
    if (source?.language === "zh") {
      retained[index].titleZh = retained[index].titleZh || retained[index].title;
      retained[index].summaryZh = retained[index].summaryZh || retained[index].summary;
      if (retained[index].content) retained[index].contentZh = retained[index].content;
      retained[index].translationStatus = "translated";
    }
    if (source?.format === "dated-html" && retained[index].content && !retained[index].contentZh) {
      retained[index].contentZh = retained[index].summaryZh || "";
    }
  }

  if (process.env.AI_SKIP_CONTENT !== "1") {
    for (let index = 0; index < retained.length; index += 1) {
      if (retained[index].content) continue;
      try {
        retained[index] = await collectArticleContent(retained[index]);
        const source = sourceById.get(retained[index].sourceId);
        if (source?.language === "zh") retained[index].contentZh = retained[index].content;
        console.log(`[ai-updates] content ${retained[index].id}: ${retained[index].content.length} chars`);
      } catch (error) {
        console.warn(`[ai-updates] content ${retained[index].id}: ${error.message}`);
      }
      await wait(3200);
    }
  }

  for (let index = 0; index < retained.length; index += 1) {
    if (retained[index].translationStatus === "translated" && retained[index].contentZh) continue;
    try {
      retained[index] = await translate(retained[index]);
    } catch (error) {
      retained[index] = { ...retained[index], translationStatus: "failed" };
      console.warn(`[ai-updates] translation ${retained[index].id}: ${error.message}`);
    }
  }

  const output = {
    version: 1,
    updatedAt: new Date().toISOString(),
    sources: sourceResults,
    entries: retained,
  };
  await writeFile(DATA_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`[ai-updates] saved ${retained.length} entries`);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await collectUpdates();
}
