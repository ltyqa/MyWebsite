# 自成长知识库

知识库只索引 `ltyqa` 账号下的公开、非 fork 仓库。GitHub 是唯一内容来源，网站聊天不会写入知识库。

## API

所有查询都需要 `Authorization: Bearer <API_KEY>` 请求头。

```http
POST /api/knowledge/v1/search
Content-Type: application/json

{
  "query": "个人网站如何同步笔记",
  "repositories": ["MyNote", "MyWebsite"],
  "contentTypes": ["document", "code_structure"],
  "topK": 6
}
```

其他接口：

```text
GET /api/knowledge/v1/entity/<entity-id>
GET /api/knowledge/v1/health
GET /api/knowledge/openapi
```

API Key 由站点所有者人工签发。接口禁止匿名调用，默认每个 Key 与 IP 组合每分钟最多 30 次请求。

## GitHub App

创建仅安装到 `ltyqa` 账号的 GitHub App：

- Repository permissions：Contents `Read-only`、Metadata `Read-only`。
- Subscribe to events：Push、Repository。
- Webhook URL：`https://ltyqaon.com/api/knowledge/webhook/github`；Cloudflare 会转发到当前知识服务 Tunnel。
- Webhook secret：与服务器 `KNOWLEDGE_WEBHOOK_SECRET` 完全一致。
- 安装范围选择 `All repositories`，未来新增的公开仓库即可自动同步。

GitHub App 创建属于账号授权操作，不能通过仓库提交自动完成。创建前，每日一致性任务仍会发现新增公开仓库。

## 运行与恢复

- `/srv/knowledge/.env` 保存 API Key、Webhook Secret 与可选 GitHub Token。
- 每日同步补偿漏掉的 Webhook；每周备份 SQLite 并创建 Qdrant snapshot。
- `docker compose up -d --build` 原地升级；回滚时切回上一 Git commit 并重新构建。
- Embedding 模型升级时使用新 collection 全量重建，验证后再切换 collection。
