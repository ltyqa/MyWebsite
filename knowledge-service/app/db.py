import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .config import settings


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, repo TEXT NOT NULL, path TEXT NOT NULL, sha TEXT NOT NULL,
  title TEXT NOT NULL, kind TEXT NOT NULL, language TEXT, source_url TEXT NOT NULL,
  site_url TEXT, updated_at TEXT NOT NULL, UNIQUE(repo, path)
);
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL, heading TEXT, content TEXT NOT NULL, content_hash TEXT NOT NULL UNIQUE
);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_id UNINDEXED, title, heading, content, tokenize='unicode61'
);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, source_document_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS edges (
  source_id TEXT NOT NULL, target_id TEXT NOT NULL, relation TEXT NOT NULL,
  source_document_id TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 1,
  PRIMARY KEY(source_id, target_id, relation, source_document_id)
);
CREATE TABLE IF NOT EXISTS sync_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, repo TEXT, commit_sha TEXT, status TEXT NOT NULL,
  started_at TEXT NOT NULL, finished_at TEXT, processed INTEGER NOT NULL DEFAULT 0, error TEXT
);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_documents_repo ON documents(repo);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    Path(settings.knowledge_db).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.knowledge_db, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        conn.execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('embedding_model',?)", (settings.embedding_model,))


@contextmanager
def transaction():
    conn = connect()
    try:
        conn.execute("BEGIN")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def row_dict(row):
    result = dict(row)
    if "metadata" in result:
        result["metadata"] = json.loads(result["metadata"] or "{}")
    return result

