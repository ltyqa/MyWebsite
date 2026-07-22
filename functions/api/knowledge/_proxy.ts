export type KnowledgeEnv = {
  KNOWLEDGE_BASE_URL?: string;
  KNOWLEDGE_API_KEY?: string;
};

const allowedResponseHeaders = ["content-type", "retry-after"];

export async function proxyKnowledge(request: Request, env: KnowledgeEnv, upstreamPath: string) {
  if (!env.KNOWLEDGE_BASE_URL) {
    return Response.json({ error: "knowledge-not-configured" }, { status: 503 });
  }

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization) {
    return Response.json({ error: "api-key-required" }, { status: 401 });
  }

  const headers = new Headers({
    Accept: "application/json",
    Authorization: authorization,
    "X-Forwarded-For": request.headers.get("CF-Connecting-IP") || "unknown",
  });
  if (request.method !== "GET") headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(`${env.KNOWLEDGE_BASE_URL.replace(/\/+$/, "")}${upstreamPath}`, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    });
    const responseHeaders = new Headers({
      "Cache-Control": request.method === "GET" ? "private, max-age=30" : "no-store",
    });
    for (const name of allowedResponseHeaders) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: "knowledge-unreachable" }, { status: 502 });
  }
}
