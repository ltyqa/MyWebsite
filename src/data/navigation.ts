export type SiteNavKey = "home" | "projects" | "notes" | "weekly" | "ai-news" | "chat" | "about";

export type SiteNavItem = {
  key: SiteNavKey;
  label: string;
  entranceLabel: string;
  href: string;
  icon?: string;
  iconText?: string;
};

export const siteNavigation: SiteNavItem[] = [
  {
    key: "home",
    label: "首页",
    entranceLabel: "首页",
    href: "/?skipIntro=1",
    icon: "/images/icon-home.svg",
  },
  {
    key: "projects",
    label: "项目",
    entranceLabel: "项目",
    href: "/projects/",
    icon: "/images/icon-projects.svg",
  },
  {
    key: "notes",
    label: "笔记",
    entranceLabel: "笔记",
    href: "/notes/",
    icon: "/images/icon-notes.svg",
  },
  {
    key: "weekly",
    label: "每周新闻",
    entranceLabel: "周刊",
    href: "/weekly/",
    icon: "/images/icon-weekly.svg",
  },
  {
    key: "ai-news",
    label: "AI 动态",
    entranceLabel: "AI 动态",
    href: "/ai-news/",
    icon: "/images/icon-activity.svg",
  },
  {
    key: "chat",
    label: "AI 聊天",
    entranceLabel: "AI 聊天",
    href: "/chat/",
    icon: "/images/icon-chat.svg",
  },
  {
    key: "about",
    label: "作者信息",
    entranceLabel: "关于",
    href: "/about/",
    icon: "/images/icon-about.svg",
  },
];
