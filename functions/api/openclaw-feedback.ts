export async function onRequestPost({ request }: { request: Request }) {
  const body = (await request.json().catch(() => null)) as
    | { helpful?: unknown; conversationId?: unknown; messagePreview?: unknown }
    | null;

  if (!body || typeof body.helpful !== "boolean") {
    return Response.json({ ok: false, message: "反馈格式无效。" }, { status: 400 });
  }

  console.log("openclaw-feedback", {
    helpful: body.helpful,
    conversationId: typeof body.conversationId === "string" ? body.conversationId.slice(0, 80) : "unknown",
    messagePreview: typeof body.messagePreview === "string" ? body.messagePreview.slice(0, 160) : "",
  });

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
