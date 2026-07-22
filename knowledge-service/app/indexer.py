import io
import json
import re
import tarfile
import uuid
from pathlib import PurePosixPath

import httpx
from qdrant_client import QdrantClient, models

from .config import settings
from .db import now, transaction
from .parsers import DOC_EXTENSIONS, CODE_EXTENSIONS, digest, parse_code_structure, split_markdown
from .semantic import enrich_document

COLLECTION = "knowledge_bge_small_zh_v1_5"
VECTOR_SIZE = 512


def qdrant() -> QdrantClient:
    return QdrantClient(url=settings.qdrant_url, timeout=60)


def ensure_collection(client: QdrantClient) -> None:
    if not client.collection_exists(COLLECTION):
        client.create_collection(COLLECTION, vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE))


def github_headers() -> dict[str, str]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "ltyqa-knowledge-service"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return headers


async def public_repositories() -> list[dict]:
    async with httpx.AsyncClient(headers=github_headers(), timeout=30) as client:
        response = await client.get(f"https://api.github.com/users/{settings.github_owner}/repos", params={"per_page": 100, "type": "public"})
        response.raise_for_status()
        return [repo for repo in response.json() if not repo["private"] and not repo["fork"]]


def site_url(repo: str, path: str) -> str | None:
    if repo == "MyNote" and path.lower().endswith((".md", ".mdx")):
        slug = re.sub(r"\.(md|mdx)$", "", path, flags=re.I)
        return f"{settings.public_site_url}/notes/{'/'.join(httpx.URL('').copy_with(path=p).path for p in slug.split('/'))}/"
    if repo == "MyWebsite":
        return settings.public_site_url
    return None


async def download_repo(repo: str, ref: str) -> bytes:
    url = f"https://api.github.com/repos/{settings.github_owner}/{repo}/tarball/{ref}"
    async with httpx.AsyncClient(headers=github_headers(), timeout=120, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


async def sync_repository(repo: str, commit_sha: str = "HEAD") -> dict:
    job_id = None
    with transaction() as conn:
        cursor = conn.execute("INSERT INTO sync_jobs(repo,commit_sha,status,started_at) VALUES(?,?,?,?)", (repo, commit_sha, "running", now()))
        job_id = cursor.lastrowid
    try:
        archive = await download_repo(repo, commit_sha)
        parsed = []
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
            for member in tar.getmembers():
                if not member.isfile() or member.size > 1_000_000:
                    continue
                relative = "/".join(PurePosixPath(member.name).parts[1:])
                if not relative or any(part.startswith(".") for part in PurePosixPath(relative).parts):
                    continue
                ext = PurePosixPath(relative).suffix.lower()
                if ext not in DOC_EXTENSIONS and ext not in CODE_EXTENSIONS:
                    continue
                raw = tar.extractfile(member)
                if not raw:
                    continue
                text = raw.read().decode("utf-8", errors="replace")
                chunks = split_markdown(text) if ext in DOC_EXTENSIONS else parse_code_structure(relative, text)
                if chunks:
                    parsed.append((relative, ext, digest(text), chunks))

        client = qdrant()
        ensure_collection(client)
        new_chunk_ids: set[str] = set()
        deleted_vector_ids: list[str] = []
        points = []
        semantic_items: list[tuple[str, str, str]] = []
        with transaction() as conn:
            repo_node = f"repo:{repo}"
            conn.execute("INSERT OR REPLACE INTO nodes(id,type,name,metadata) VALUES(?,?,?,?)", (repo_node, "Repository", repo, "{}"))
            current_doc_ids = [digest(f"{repo}:{path}") for path, _, _, _ in parsed]
            stale_rows = conn.execute(
                "SELECT c.id FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.repo=? AND d.id NOT IN (%s)" % (",".join("?" for _ in current_doc_ids) or "''"),
                (repo, *current_doc_ids),
            ).fetchall()
            deleted_vector_ids.extend(row[0] for row in stale_rows)
            conn.execute(
                "DELETE FROM chunks_fts WHERE chunk_id IN (SELECT c.id FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.repo=? AND d.id NOT IN (%s))" % (",".join("?" for _ in current_doc_ids) or "''"),
                (repo, *current_doc_ids),
            )
            conn.execute(
                "DELETE FROM documents WHERE repo=? AND id NOT IN (%s)" % (",".join("?" for _ in current_doc_ids) or "''"),
                (repo, *current_doc_ids),
            )
            for path, ext, file_sha, chunks in parsed:
                doc_id = digest(f"{repo}:{path}")
                existing = conn.execute("SELECT sha FROM documents WHERE id=?", (doc_id,)).fetchone()
                if existing and existing[0] == file_sha:
                    continue
                title = PurePosixPath(path).stem
                source = f"https://github.com/{settings.github_owner}/{repo}/blob/{commit_sha}/{path}"
                deleted_vector_ids.extend(row[0] for row in conn.execute("SELECT id FROM chunks WHERE document_id=?", (doc_id,)).fetchall())
                conn.execute("INSERT OR REPLACE INTO documents(id,repo,path,sha,title,kind,language,source_url,site_url,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (doc_id, repo, path, file_sha, title, chunks[0].kind, chunks[0].language, source, site_url(repo, path), now()))
                conn.execute("DELETE FROM chunks_fts WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id=?)", (doc_id,))
                conn.execute("DELETE FROM chunks WHERE document_id=?", (doc_id,))
                conn.execute("DELETE FROM edges WHERE source_document_id=?", (doc_id,))
                semantic_items.append((doc_id, title, "\n".join(chunk.content for chunk in chunks)[:5000]))
                doc_node = f"doc:{doc_id}"
                conn.execute("INSERT OR REPLACE INTO nodes(id,type,name,source_document_id,metadata) VALUES(?,?,?,?,?)", (doc_node, "Document", title, doc_id, json.dumps({"path": path}, ensure_ascii=False)))
                conn.execute("INSERT OR REPLACE INTO edges VALUES(?,?,?,?,1)", (repo_node, doc_node, "CONTAINS", doc_id))
                for ordinal, chunk in enumerate(chunks):
                    content_hash = digest(f"{repo}:{path}:{chunk.heading}:{chunk.content}")
                    chunk_id = str(uuid.UUID(content_hash[:32]))
                    new_chunk_ids.add(chunk_id)
                    conn.execute("INSERT INTO chunks(id,document_id,ordinal,heading,content,content_hash) VALUES(?,?,?,?,?,?)", (chunk_id, doc_id, ordinal, chunk.heading, chunk.content, content_hash))
                    conn.execute("INSERT INTO chunks_fts(chunk_id,title,heading,content) VALUES(?,?,?,?)", (chunk_id, title, chunk.heading, chunk.content))
                    section_node = f"section:{chunk_id}"
                    conn.execute("INSERT OR REPLACE INTO nodes(id,type,name,source_document_id,metadata) VALUES(?,?,?,?,?)", (section_node, "Section", chunk.heading or title, doc_id, "{}"))
                    conn.execute("INSERT OR REPLACE INTO edges VALUES(?,?,?,?,1)", (doc_node, section_node, "CONTAINS", doc_id))
                    for symbol in chunk.symbols:
                        symbol_id = f"symbol:{digest(repo + ':' + path + ':' + symbol)[:24]}"
                        conn.execute("INSERT OR REPLACE INTO nodes(id,type,name,source_document_id,metadata) VALUES(?,?,?,?,?)", (symbol_id, "CodeSymbol", symbol, doc_id, json.dumps({"language": chunk.language})))
                        conn.execute("INSERT OR REPLACE INTO edges VALUES(?,?,?,?,1)", (doc_node, symbol_id, "DECLARES", doc_id))
                    points.append(models.PointStruct(id=chunk_id, vector=models.Document(text=f"{title}\n{chunk.heading}\n{chunk.content}", model=settings.embedding_model), payload={"repo": repo, "document_id": doc_id, "path": path, "kind": chunk.kind, "source_url": source}))
            conn.execute("DELETE FROM nodes WHERE source_document_id IS NOT NULL AND source_document_id NOT IN (SELECT id FROM documents)")
        if points:
            client.upload_points(COLLECTION, points=points, batch_size=32, wait=True)
        obsolete_vectors = list(set(deleted_vector_ids) - new_chunk_ids)
        if obsolete_vectors:
            client.delete(COLLECTION, models.PointIdsList(points=obsolete_vectors), wait=True)
        for document_id, title, content in semantic_items:
            await enrich_document(document_id, title, content)
        with transaction() as conn:
            conn.execute("UPDATE sync_jobs SET status='complete',finished_at=?,processed=? WHERE id=?", (now(), len(points), job_id))
            conn.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('last_sync',?)", (now(),))
        return {"repo": repo, "chunks": len(points), "documents": len(parsed)}
    except Exception as exc:
        with transaction() as conn:
            conn.execute("UPDATE sync_jobs SET status='failed',finished_at=?,error=? WHERE id=?", (now(), str(exc)[:2000], job_id))
        raise


async def sync_all() -> list[dict]:
    repositories = await public_repositories()
    public_names = {repo["name"] for repo in repositories}
    with transaction() as conn:
        indexed_names = {row[0] for row in conn.execute("SELECT DISTINCT repo FROM documents").fetchall()}
    for stale_repo in indexed_names - public_names:
        purge_repository(stale_repo)
    results = []
    for repo in repositories:
        results.append(await sync_repository(repo["name"], repo["default_branch"]))
    return results


def purge_repository(repo: str) -> None:
    client = qdrant()
    ensure_collection(client)
    with transaction() as conn:
        vector_ids = [row[0] for row in conn.execute("SELECT c.id FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.repo=?", (repo,)).fetchall()]
        conn.execute("DELETE FROM chunks_fts WHERE chunk_id IN (SELECT c.id FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.repo=?)", (repo,))
        conn.execute("DELETE FROM documents WHERE repo=?", (repo,))
        conn.execute("DELETE FROM edges WHERE source_id=? OR target_id=?", (f"repo:{repo}", f"repo:{repo}"))
        conn.execute("DELETE FROM nodes WHERE id=? OR (source_document_id IS NOT NULL AND source_document_id NOT IN (SELECT id FROM documents))", (f"repo:{repo}",))
    if vector_ids:
        client.delete(COLLECTION, models.PointIdsList(points=vector_ids), wait=True)
