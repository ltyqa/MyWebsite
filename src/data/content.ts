export const projects = [
  {
    name: "知页 Notes",
    description: "一个给个人笔记准备的轻量阅读系统，专注于清晰的目录、标签和长文排版。",
    stack: ["Astro", "Markdown", "GitHub"],
    meta: "TypeScript / 内容系统 / 本周更新",
    status: "维护中",
    link: "https://github.com/",
  },
  {
    name: "静态部署手册",
    description: "整理个人网站从构建、预览到上线的流程，把容易忘的部署细节固定下来。",
    stack: ["Node", "CI", "OSS"],
    meta: "Node.js / 自动化 / 可复用",
    status: "稳定",
    link: "https://github.com/",
  },
  {
    name: "界面实验室",
    description: "存放一些小而完整的界面练习：布局、动效、组件状态和视觉细节。",
    stack: ["CSS", "Design", "Playground"],
    meta: "CSS / 视觉实验 / 长期更新",
    status: "实验中",
    link: "https://github.com/",
  },
  {
    name: "本地资料库",
    description: "保存网页摘录、命令片段和问题记录，让零散资料可以被再次找到。",
    stack: ["SQLite", "CLI", "Markdown"],
    meta: "Go / 命令行 / 原型",
    status: "打磨中",
    link: "https://github.com/",
  },
];

export const notes = [
  {
    title: "给个人网站选择一个轻的起点",
    meta: "2026.07.05 / 前端 / 6 分钟",
    category: "前端",
    excerpt: "记录我为什么先从静态站开始，而不是一上来就把系统做得很重。",
  },
  {
    title: "把仓库变成内容入口",
    meta: "2026.07.03 / 工具 / 8 分钟",
    category: "工具",
    excerpt: "项目、笔记和变更记录都可以从仓库里长出来，维护成本会低很多。",
  },
  {
    title: "一个小项目怎样才算完成",
    meta: "2026.06.28 / 方法 / 5 分钟",
    category: "方法",
    excerpt: "不是写完代码就结束，还要让别人能打开、看懂，并知道它解决什么问题。",
  },
  {
    title: "让个人站在国内访问更稳",
    meta: "2026.06.21 / 部署 / 7 分钟",
    category: "部署",
    excerpt: "梳理备案、对象存储、CDN 和境外节点之间的取舍，给正式上线留一条清楚的路。",
  },
  {
    title: "把常用命令收进工具箱",
    meta: "2026.06.12 / 工具 / 4 分钟",
    category: "工具",
    excerpt: "重复三次的命令就值得整理，省下来的不是时间，是注意力。",
  },
];

export const timeline = [
  ["现在", "整理入口", "先把项目、笔记和近况放到一个清楚的位置。"],
  ["近期", "打磨作品", "给每个项目补上截图、说明、使用方式和维护状态。"],
  ["长期", "沉淀判断", "把解决问题的过程写下来，留下能反复使用的经验。"],
  ["以后", "持续更新", "让这个网站像一份会生长的工作档案。"],
];

export const activities = [
  ["今天", "重排首页内容", "把最重要的近况、作品和笔记放到更容易扫读的位置。"],
  ["昨天", "整理项目说明", "补齐两个项目的背景、技术栈和下一步计划。"],
  ["本周", "写下第一组笔记", "从部署、工具和前端实践里挑出几篇先整理。"],
  ["持续中", "维护个人档案", "让这里保持简洁、真实，并且能长期更新。"],
];
