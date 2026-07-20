type Env = {
  OPENCLAW_BASE_URL?: string;
  OPENCLAW_TOKEN?: string;
  OPENCLAW_MODEL?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input)) return null;

  const messages = input.slice(-12).flatMap((item): ChatMessage[] => {
    if (!item || typeof item !== "object") return [];
    const role = "role" in item ? item.role : undefined;
    const content = "content" in item ? item.content : undefined;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return [];

    const normalized = content.trim().slice(0, 4000);
    return normalized ? [{ role, content: normalized }] : [];
  });

  return messages.length && messages.at(-1)?.role === "user" ? messages : null;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  if (!env.OPENCLAW_BASE_URL || !env.OPENCLAW_TOKEN) {
    return json(
      {
        error: "openclaw-not-configured",
        message: "聊天服务尚未连接 OpenClaw，请配置服务端环境变量后再试。",
      },
      503,
    );
  }

  let body: { messages?: unknown; conversationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid-json", message: "请求内容不是有效的 JSON。" }, 400);
  }

  const messages = normalizeMessages(body.messages);
  if (!messages) {
    return json({ error: "invalid-messages", message: "请输入有效的聊天内容。" }, 400);
  }

  const rawConversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const conversationId = /^[a-zA-Z0-9:_-]{8,80}$/.test(rawConversationId)
    ? rawConversationId
    : crypto.randomUUID();
  const baseUrl = env.OPENCLAW_BASE_URL.replace(/\/+$/, "");

  try {
    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENCLAW_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENCLAW_MODEL || "openclaw/default",
        user: `website:${conversationId}`,
        messages,
        stream: false,
      }),
    });

    const payload = (await upstream.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
      | null;

    if (!upstream.ok) {
      const detail = payload?.error?.message || `OpenClaw 返回了 ${upstream.status}`;
      return json({ error: "openclaw-request-failed", message: detail }, 502);
    }

    const reply = payload?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return json({ error: "empty-openclaw-response", message: "OpenClaw 没有返回可显示的内容。" }, 502);
    }

    return json({ reply, conversationId });
  } catch {
    return json(
      {
        error: "openclaw-unreachable",
        message: "暂时无法连接 OpenClaw，请检查 Gateway 地址和网络状态。",
      },
      502,
    );
  }
}

export function onRequestGet() {
  return json({ error: "method-not-allowed", message: "请使用 POST 请求。" }, 405);
}
