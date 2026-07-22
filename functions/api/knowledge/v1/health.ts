import { proxyKnowledge, type KnowledgeEnv } from "../_proxy";

export function onRequestGet({ request, env }: { request: Request; env: KnowledgeEnv }) {
  return proxyKnowledge(request, env, "/api/knowledge/v1/health");
}

