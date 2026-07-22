import hashlib
import re
from dataclasses import dataclass


CODE_EXTENSIONS = {
    ".py": "Python", ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript",
    ".jsx": "JavaScript", ".go": "Go", ".rs": "Rust", ".java": "Java", ".kt": "Kotlin",
    ".c": "C", ".h": "C", ".cpp": "C++", ".cs": "C#", ".rb": "Ruby", ".php": "PHP",
}
DOC_EXTENSIONS = {".md", ".mdx", ".rst", ".txt"}


@dataclass
class ParsedChunk:
    heading: str
    content: str
    kind: str
    language: str | None = None
    symbols: tuple[str, ...] = ()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def split_markdown(text: str, target: int = 650, overlap: int = 80) -> list[ParsedChunk]:
    text = re.sub(r"\x00", "", text).strip()
    sections, heading, buffer = [], "", []
    for line in text.splitlines():
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if match and buffer:
            sections.append((heading, "\n".join(buffer).strip()))
            buffer = []
        if match:
            heading = match.group(2).strip()
        else:
            buffer.append(line)
    if buffer:
        sections.append((heading, "\n".join(buffer).strip()))

    chunks: list[ParsedChunk] = []
    for section_heading, body in sections or [("", text)]:
        body = body.strip()
        while body:
            if len(body) <= target:
                part, body = body, ""
            else:
                cut = max(body.rfind("\n\n", 0, target), body.rfind("。", 0, target), target // 2)
                part, body = body[:cut].strip(), body[max(0, cut - overlap):].strip()
            if part:
                chunks.append(ParsedChunk(section_heading, part, "document"))
    return chunks


def parse_code_structure(path: str, text: str) -> list[ParsedChunk]:
    extension = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
    language = CODE_EXTENSIONS.get(extension)
    if not language:
        return []
    patterns = [
        r"^\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)[^\n]*",
        r"^\s*(?:def|class)\s+([A-Za-z_]\w*)[^\n]*",
        r"^\s*(?:pub\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_]\w*)[^\n]*",
        r"^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)[^\n]*",
    ]
    found: list[tuple[str, str]] = []
    for line in text.splitlines():
        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                found.append((match.group(1), line.strip()[:300]))
                break
    if not found:
        return []
    symbols = tuple(name for name, _ in found[:100])
    summary = f"File: {path}\nLanguage: {language}\nSymbols:\n" + "\n".join(signature for _, signature in found[:100])
    return [ParsedChunk(path, summary, "code_structure", language, symbols)]

