import data from "./ai-updates.json";

export type AiProduct = "GPT" | "Claude" | "Gemini";
export type AiUpdateKind = "product" | "api" | "news";

export type AiUpdate = {
  id: string;
  sourceId: string;
  company: string;
  product: AiProduct;
  kind: AiUpdateKind;
  title: string;
  summary: string;
  titleZh: string;
  summaryZh: string;
  translationStatus: "pending" | "translated" | "failed";
  publishedAt: string;
  url: string;
  collectedAt: string;
};

export const aiUpdates = (data.entries as AiUpdate[]).sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

export const aiUpdatesGeneratedAt = data.updatedAt;

export function formatAiUpdateDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export function aiUpdateKindLabel(kind: AiUpdateKind) {
  return {
    product: "产品更新",
    api: "API 更新",
    news: "官方动态",
  }[kind];
}
