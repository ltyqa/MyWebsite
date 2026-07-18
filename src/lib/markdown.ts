import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const allowedTags = [
  ...sanitizeHtml.defaults.allowedTags,
  "img",
  "details",
  "summary",
  "del",
  "input",
];

export function renderMarkdown(markdown: string) {
  const rendered = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: false,
  });

  return sanitizeHtml(rendered, {
    allowedTags,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "loading", "width", "height"],
      code: ["class"],
      input: ["type", "checked", "disabled"],
      ol: ["start"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noreferrer noopener",
      }),
      img: sanitizeHtml.simpleTransform("img", {
        loading: "lazy",
      }),
    },
  });
}
