export type WeeklyReviewLink = {
  title: string;
  issueNumber: number;
  sourceUrl: string;
  href: string;
};

export function stripWeeklyTitle(markdown: string) {
  return markdown.replace(/^#\s+.+\r?\n+/, "");
}

function getReviewSection(markdown: string) {
  const heading = markdown.match(/^##\s+往年回顾\s*$/m);
  if (!heading || heading.index === undefined) {
    return "";
  }

  const section = markdown.slice(heading.index);
  const done = section.match(/\r?\n[（(]完[）)]\s*$/m);
  return done && done.index !== undefined ? section.slice(0, done.index) : section;
}

export function removeWeeklyReviewSection(markdown: string) {
  const heading = markdown.match(/^##\s+往年回顾\s*$/m);
  if (!heading || heading.index === undefined) {
    return markdown;
  }

  const beforeReview = markdown.slice(0, heading.index).trimEnd();
  const section = markdown.slice(heading.index);
  const done = section.match(/\r?\n[（(]完[）)]\s*$/m);

  if (!done || done.index === undefined) {
    return beforeReview;
  }

  const afterDone = section.slice(done.index + done[0].length).trimStart();
  return [beforeReview, afterDone].filter(Boolean).join("\n\n");
}

export function extractWeeklyReviewLinks(markdown: string): WeeklyReviewLink[] {
  const section = getReviewSection(markdown);
  const links: WeeklyReviewLink[] = [];
  const seen = new Set<number>();
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)\s*[（(]#(\d+)[）)]/g;
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

  return links;
}

export function proxyWeeklyImages(markdown: string) {
  return markdown.replace(/!\[([^\]]*)\]\((https:\/\/cdn\.beekka\.com\/[^)]+)\)/g, (_match, alt, src) => {
    return `![${alt}](/weekly-image?src=${encodeURIComponent(src)})`;
  });
}
