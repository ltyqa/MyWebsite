# OpenClaw 公开网站 Agent

网站聊天建议使用独立的 `website` Agent，不要直接暴露 `main` Agent 的工具和私人工作区。

在 OpenClaw 服务器执行：

```bash
openclaw agents add website \
  --workspace ~/.openclaw/workspace-website \
  --non-interactive

cat > /tmp/openclaw-website-policy.jq <<'JQ'
(.agents.list[] | select(.id == "website")) |= (
  . + {
    name: "Website Assistant",
    tools: {
      profile: "minimal",
      deny: [
        "group:runtime",
        "group:fs",
        "gateway",
        "cron",
        "sessions_spawn",
        "sessions_send",
        "message",
        "browser",
        "web_search",
        "web_fetch"
      ]
    }
  }
)
JQ

cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.before-website-agent
jq -f /tmp/openclaw-website-policy.jq ~/.openclaw/openclaw.json > /tmp/openclaw.json
jq empty /tmp/openclaw.json
mv /tmp/openclaw.json ~/.openclaw/openclaw.json

cat > ~/.openclaw/workspace-website/USER.md <<'EOF'
# USER.md

这是李天熠个人网站的公开访客助手。只能使用网站请求中提供的公开资料回答问题，不得访问或披露任何私人资料。
EOF

openclaw gateway restart
openclaw gateway status
curl -sS http://127.0.0.1:13929/v1/models \
  -H "Authorization: Bearer $TOKEN"
```

确认输出包含 `openclaw/website` 后，在 Cloudflare Pages Production 环境变量中添加：

```text
OPENCLAW_PUBLIC_MODEL=openclaw/website
```

修改环境变量后重新部署 Cloudflare Pages。
