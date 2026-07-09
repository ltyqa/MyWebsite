export type WeeklyReviewLink = {
  title: string;
  issueNumber: number;
  sourceUrl: string;
  href: string;
};

export function stripWeeklyTitle(markdown: string) {
  return markdown.replace(/^#\s+.+\r?\n+/, "");
}

function getReviewSectionRanges(markdown: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const headingPattern = /^##\s+(往年回顾|历史上的本周)\s*$/gm;
  let heading: RegExpExecArray | null;

  while ((heading = headingPattern.exec(markdown))) {
    const start = heading.index;
    const rest = markdown.slice(start);
    const afterHeading = markdown.slice(headingPattern.lastIndex);
    const nextHeading = afterHeading.match(/\r?\n##\s+/);
    const done = rest.match(/\r?\n[（(]完[）)]\s*$/m);
    const endCandidates = [
      nextHeading?.index === undefined ? undefined : headingPattern.lastIndex + nextHeading.index,
      done?.index === undefined ? undefined : start + done.index + done[0].length,
    ].filter((value): value is number => typeof value === "number");

    ranges.push({
      start,
      end: endCandidates.length ? Math.min(...endCandidates) : markdown.length,
    });
  }

  return ranges;
}

function getReviewSections(markdown: string) {
  return getReviewSectionRanges(markdown).map(({ start, end }) => markdown.slice(start, end));
}

export function removeWeeklyReviewSection(markdown: string) {
  const ranges = getReviewSectionRanges(markdown);
  if (ranges.length === 0) {
    return markdown;
  }

  let result = "";
  let cursor = 0;

  for (const range of ranges) {
    result += markdown.slice(cursor, range.start).trimEnd();
    cursor = range.end;
  }

  result += markdown.slice(cursor).trimStart();
  return result.trim();
}

export function extractWeeklyReviewLinks(markdown: string): WeeklyReviewLink[] {
  const sections = getReviewSections(markdown);
  const links: WeeklyReviewLink[] = [];
  const seen = new Set<number>();
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)\s*[（(][^）)]*#\s*(\d+)[^）)]*[）)]/g;

  for (const section of sections) {
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(section))) {
      const issueNumber = Number(match[3]);
      if (!Number.isInteger(issueNumber) || seen.has(issueNumber)) {
        continue;
      }

      seen.add(issueNumber);
      links.push({
        title: match[1].trim(),
        sourceUrl: match[2].trim(),
        issueNumber,
        href: `/weekly/${issueNumber}/`,
      });
    }
  }

  return links;
}

export function proxyWeeklyImages(markdown: string) {
  return markdown.replace(/!\[([^\]]*)\]\((https:\/\/cdn\.beekka\.com\/[^)]+)\)/g, (_match, alt, src) => {
    return `![${alt}](/weekly-image?src=${encodeURIComponent(src)})`;
  });
}
