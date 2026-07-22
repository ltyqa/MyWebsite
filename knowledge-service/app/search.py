import re
from collections import defaultdict

from qdrant_client import models

from .config import settings
from .db import connect, row_dict
from .indexer import COLLECTION, ensure_collection, qdrant


def fts_query(query: str) -> str:
    terms = re.findall(r"[\w\u3400-\u9fff]+", query, flags=re.UNICODE)
    return " OR ".join(f'"{term}"' for term in terms[:12])


def search(query: str, repositories: list[str] | None, content_types: list[str] | None, top_k: int) -> list[dict]:
    rankings: dict[str, float] = defaultdict(float)
    vector_scores: dict[str, float] = {}
    with connect() as conn:
        expression = fts_query(query)
        lexical = [] if not expression else conn.execute("SELECT chunk_id FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts) LIMIT 30", (expression,)).fetchall()
        for rank, row in enumerate(lexical, 1):
            rankings[row[0]] += 1 / (60 + rank)

    client = qdrant()
    ensure_collection(client)
    filters = []
    if repositories:
        filters.append(models.FieldCondition(key="repo", match=models.MatchAny(any=repositories)))
    if content_types:
        filters.append(models.FieldCondition(key="kind", match=models.MatchAny(any=content_types)))
    vector = client.query_points(COLLECTION, query=models.Document(text=query, model=settings.embedding_model), query_filter=models.Filter(must=filters) if filters else None, limit=30, with_payload=True).points
    for rank, point in enumerate(vector, 1):
        chunk_id = str(point.id)
        rankings[chunk_id] += 1 / (60 + rank)
        vector_scores[chunk_id] = float(point.score)

    ordered = sorted(rankings, key=rankings.get, reverse=True)
    if not ordered:
        return []
    with connect() as conn:
        placeholders = ",".join("?" for _ in ordered)
        rows = conn.execute(f"SELECT c.id,c.heading,c.content,d.id document_id,d.title,d.repo,d.path,d.kind,d.language,d.source_url,d.site_url,d.updated_at FROM chunks c JOIN documents d ON d.id=c.document_id WHERE c.id IN ({placeholders})", ordered).fetchall()
        by_id = {row["id"]: dict(row) for row in rows}
        results = []
        for chunk_id in ordered:
            row = by_id.get(chunk_id)
            if not row or (repositories and row["repo"] not in repositories) or (content_types and row["kind"] not in content_types):
                continue
            related = conn.execute("SELECT n.id,n.type,n.name,e.relation,e.confidence FROM edges e JOIN nodes n ON n.id=e.target_id WHERE e.source_document_id=? LIMIT 12", (row["document_id"],)).fetchall()
            row["score"] = round(rankings[chunk_id], 6)
            row["vectorScore"] = round(vector_scores.get(chunk_id, 0), 6)
            row["url"] = row.pop("site_url") or row["source_url"]
            row["relatedEntities"] = [dict(item) for item in related]
            results.append(row)
            if len(results) >= top_k:
                break
        return results


def entity(entity_id: str):
    with connect() as conn:
        node = conn.execute("SELECT * FROM nodes WHERE id=?", (entity_id,)).fetchone()
        if not node:
            return None
        edges = conn.execute("SELECT e.relation,e.confidence,n.id,n.type,n.name FROM edges e JOIN nodes n ON n.id=CASE WHEN e.source_id=? THEN e.target_id ELSE e.source_id END WHERE e.source_id=? OR e.target_id=? LIMIT 100", (entity_id, entity_id, entity_id)).fetchall()
        result = row_dict(node)
        result["relations"] = [dict(row) for row in edges]
        return result

