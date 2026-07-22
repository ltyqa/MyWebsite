#!/usr/bin/env sh
set -eu
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p /srv/knowledge/backups
cp /srv/knowledge/data/knowledge.sqlite3 "/srv/knowledge/backups/knowledge-$stamp.sqlite3"
curl -fsS -X POST "http://127.0.0.1:6333/collections/knowledge_bge_small_zh_v1_5/snapshots"
find /srv/knowledge/backups -type f -mtime +30 -delete

