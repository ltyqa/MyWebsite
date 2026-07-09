const allowedHost = "cdn.beekka.com";
const allowedPathPrefix = "/blogimg/";

function badRequest(message: string) {
  return new Response(message, {
    status: 400,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function contentTypeFor(pathname: string, fallback: string | null) {
  if (fallback?.startsWith("image/")) return fallback;
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export async function onRequestGet({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const src = requestUrl.searchParams.get("src");

  if (!src) return badRequest("Missing image source.");

  let imageUrl: URL;
  try {
    imageUrl = new URL(src);
  } catch {
    return badRequest("Invalid image source.");
  }

  if (
    imageUrl.protocol !== "https:" ||
    imageUrl.hostname !== allowedHost ||
    !imageUrl.pathname.startsWith(allowedPathPrefix)
  ) {
    return badRequest("Image source is not allowed.");
  }

  const upstream = await fetch(imageUrl.toString(), {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; ltyqa-personal-site/1.0)",
      Referer: "https://www.ruanyifeng.com/",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Image unavailable.", {
      status: upstream.status === 404 ? 404 : 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "Content-Type": contentTypeFor(imageUrl.pathname, upstream.headers.get("Content-Type")),
    },
  });
}
