type Env = { OPENCLAW_BASE_URL?: string };

export async function onRequestGet({ env }: { env: Env }) {
  if (!env.OPENCLAW_BASE_URL) {
    return Response.json({ ok: false, status: "unconfigured" }, { status: 503 });
  }

  try {
    const response = await fetch(`${env.OPENCLAW_BASE_URL.replace(/\/+$/, "")}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return Response.json(
      { ok: response.ok, status: response.ok ? "online" : "unavailable" },
      { status: response.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, status: "offline" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
