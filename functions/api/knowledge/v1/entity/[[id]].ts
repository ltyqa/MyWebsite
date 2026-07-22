import { proxyKnowledge, type KnowledgeEnv } from "../../_proxy";

export function onRequestGet({ request, env, params }: { request: Request; env: KnowledgeEnv; params: { id?: string } }) {
  if (!params.id) return Response.json({ error: "entity-id-required" }, { status: 400 });
  return proxyKnowledge(request, env, `/api/knowledge/v1/entity/${encodeURIComponent(params.id)}`);
}

