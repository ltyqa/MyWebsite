import { proxyKnowledge, type KnowledgeEnv } from "../_proxy";

export function onRequestPost({ request, env }: { request: Request; env: KnowledgeEnv }) {
  return proxyKnowledge(request, env, "/api/knowledge/v1/search");
}

export function onRequestGet() {
  return Response.json({ error: "method-not-allowed" }, { status: 405 });
}

