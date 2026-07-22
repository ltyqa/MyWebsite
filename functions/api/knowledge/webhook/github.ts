import type { KnowledgeEnv } from "../_proxy";

export async function onRequestPost({ request, env }: { request: Request; env: KnowledgeEnv }) {
  if (!env.KNOWLEDGE_BASE_URL) {
    return Response.json({ error: "knowledge-not-configured" }, { status: 503 });
  }
  const signature = request.headers.get("X-Hub-Signature-256");
  const event = request.headers.get("X-GitHub-Event");
  if (!signature || !event) {
    return Response.json({ error: "github-signature-required" }, { status: 401 });
  }
  try {
    const response = await fetch(`${env.KNOWLEDGE_BASE_URL.replace(/\/+$/, "")}/api/knowledge/webhook/github`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json",
        "X-GitHub-Delivery": request.headers.get("X-GitHub-Delivery") || crypto.randomUUID(),
        "X-GitHub-Event": event,
        "X-Hub-Signature-256": signature,
      },
      body: request.body,
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return Response.json({ error: "knowledge-unreachable" }, { status: 502 });
  }
}

export function onRequestGet() {
  return Response.json({ error: "method-not-allowed" }, { status: 405 });
}
