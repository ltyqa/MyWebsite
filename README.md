# 个人网站

基于 Astro 和 Cloudflare Pages Functions 的个人网站，用于展示项目、同步 GitHub 笔记和阅读每周内容。

## 技术栈

- Astro 5 + TypeScript
- Cloudflare Pages Functions
- GitHub API / Markdown
- GitHub Actions 自动构建和部署

## 本地开发

需要 Node.js 22。

```bash
npm ci
npm run dev
```

## 检查与构建

```bash
npm run check
npm run build
```

`npm run check` 执行 Astro 类型检查；`npm run build` 优化图片并生成静态站点到 `dist`。

## 环境变量

- `GITHUB_TOKEN`：可选，提高 GitHub API 请求额度。
- `DEEPSEEK_API_KEY`：可选，为 AI 官方动态生成中文翻译；未配置时保留英文原文。
- `DEEPSEEK_MODEL`：可选，默认使用 `deepseek-chat`。
- `OPENCLAW_BASE_URL`：OpenClaw Gateway 的 HTTPS 地址，不含 `/v1`。
- `OPENCLAW_TOKEN`：OpenClaw Gateway Token，仅配置为 Cloudflare 服务端密钥。
- `OPENCLAW_MODEL`：可选，默认使用 `openclaw/default`。
- `OPENCLAW_PUBLIC_MODEL`：可选，公开聊天页专用 Agent，推荐设置为 `openclaw/website`。
- `OPENCLAW_SYSTEM_PROMPT`：可选，公开聊天页固定追加的系统上下文。
- `SITE_URL`：可选，站点正式地址；默认使用 `https://mywebsite.pages.dev`。
- `CLOUDFLARE_ACCOUNT_ID`：GitHub Actions 部署使用。
- `CLOUDFLARE_API_TOKEN`：GitHub Actions 部署使用。

本地变量应放在 `.env` 中，不要提交到 Git。

## 内容与路由

- `src/pages`：Astro 静态页面。
- `src/data`：构建阶段的 GitHub 和周刊数据读取。
- `functions`：Cloudflare Pages Functions 运行时接口。
- `/api/site-data`：运行时站点数据。
- `/api/openclaw-chat`：网站聊天页使用的 OpenClaw 服务端代理。
- `/chat/`：AI 聊天交互页面。
- `/notes/*`：笔记页面及动态回退。
- `/weekly/*`：周刊页面及动态回退。
- `/ai-news/`：GPT、Claude 与 Gemini 官方更新聚合，保留最近 90 天。

## AI 动态同步

```bash
npm run collect:ai
```

采集器读取 OpenAI、Anthropic、Claude、Google 和 Google DeepMind 的官方 RSS、产品更新日志及 API 更新日志，按内容指纹去重。单个来源不可用时会保留已有归档，不会用空数据覆盖。GitHub Actions 每天北京时间 11:00 自动同步。

## 部署

推送到 `main` 后，GitHub Actions 会依次安装依赖、运行类型检查、构建，并部署到 Cloudflare Pages。工作流也支持定时构建和手动触发。
