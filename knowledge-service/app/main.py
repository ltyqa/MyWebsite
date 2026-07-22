import asyncio
import hashlib
import hmac
import json
import secrets
import time
from collections import defaultdict, deque

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .config import settings
from .db import connect, init_db
from .indexer import COLLECTION, purge_repository, qdrant, sync_all, sync_repository
from .search import entity, search

app = FastAPI(title="Ltyqa Knowledge API", version="1.0.0", docs_url="/api/knowledge/docs", openapi_url="/api/knowledge/openapi.json")
requests_by_key: dict[str, deque[float]] = defaultdict(deque)


class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    repositories: list[str] | None = Field(default=None, max_length=20)
    contentTypes: list[str] | None = Field(default=None, max_length=10)
    topK: int = Field(default=6, ge=1, le=20)


def authorize(request: Request, authorization: str | None = Header(default=None)) -> str:
    key = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not key or not any(secrets.compare_digest(key, known) for known in settings.api_keys):
        raise HTTPException(401, "A valid bearer API key is required")
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    client_ip = forwarded or (request.client.host if request.client else "unknown")
    identity = hashlib.sha256((key + client_ip).encode()).hexdigest()
    now = time.monotonic()
    bucket = requests_by_key[identity]
    while bucket and bucket[0] < now - 60:
        bucket.popleft()
    if len(bucket) >= settings.rate_limit_per_minute:
        raise HTTPException(429, "Rate limit exceeded", headers={"Retry-After": "60"})
    bucket.append(now)
    return identity


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/knowledge/v1/health")
def health(_: str = Depends(authorize)):
    with connect() as conn:
        last_sync = conn.execute("SELECT value FROM metadata WHERE key='last_sync'").fetchone()
        counts = conn.execute("SELECT (SELECT count(*) FROM documents) documents,(SELECT count(*) FROM chunks) chunks,(SELECT count(*) FROM nodes) nodes,(SELECT count(*) FROM edges) edges").fetchone()
    qdrant_ok = False
    try:
        qdrant_ok = qdrant().collection_exists(COLLECTION)
    except Exception:
        pass
    return {"status": "ok" if qdrant_ok else "degraded", "indexVersion": COLLECTION, "lastSync": last_sync[0] if last_sync else None, **dict(counts)}


@app.post("/api/knowledge/v1/search")
def knowledge_search(body: SearchRequest, _: str = Depends(authorize)):
    return {"query": body.query, "results": search(body.query, body.repositories, body.contentTypes, body.topK)}


@app.get("/api/knowledge/v1/entity/{entity_id:path}")
def knowledge_entity(entity_id: str, _: str = Depends(authorize)):
    result = entity(entity_id)
    if not result:
        raise HTTPException(404, "Entity not found")
    return result


@app.post("/api/knowledge/v1/admin/sync")
async def admin_sync(background_tasks: BackgroundTasks, _: str = Depends(authorize)):
    background_tasks.add_task(sync_all)
    return {"accepted": True}


@app.post("/api/knowledge/webhook/github", status_code=202)
async def github_webhook(request: Request, x_hub_signature_256: str = Header(default=""), x_github_event: str = Header(default="")):
    raw = await request.body()
    expected = "sha256=" + hmac.new(settings.knowledge_webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_hub_signature_256):
        raise HTTPException(401, "Invalid webhook signature")
    payload = json.loads(raw)
    repo = payload.get("repository") or {}
    if repo.get("owner", {}).get("login", "").lower() != settings.github_owner.lower():
        raise HTTPException(403, "Repository owner is not allowed")
    name = repo.get("name")
    if not name:
        return {"accepted": False}
    if repo.get("private") or payload.get("deleted"):
        asyncio.create_task(asyncio.to_thread(purge_repository, name))
    elif x_github_event in {"push", "repository"}:
        asyncio.create_task(sync_repository(name, payload.get("after") or repo.get("default_branch", "HEAD")))
    return {"accepted": True}
