# 手绘 3D 作品集风格设计文档

## 设计定位

这类网站的核心不是传统信息流，而是一个可以探索的“手绘 3D 空间”。页面像一本被画出来的互动作品集：用户进入一个带纸张质感的走廊或房间，通过门、地图、按钮、弹窗进入项目、关于、联系等区域。

适合用于：

- 个人作品集
- 创意开发者主页
- 3D / WebGL / 动效作品展示
- 想强调“探索感”和“手作感”的个人网站

不适合用于：

- 高密度笔记阅读
- 严肃后台系统
- 需要快速查找大量信息的工具站

## 关键词

- 手绘
- 纸张
- 撕边
- 走廊
- 画廊
- 房间
- 成就弹窗
- 地图导航
- 游戏式交互
- WebGL 场景
- 轻微粗糙感

## 视觉基调

整体应该像“手绘稿 + 可交互空间”，避免太干净、太企业化、太 SaaS。

主背景使用浅纸色，不使用纯白：

```css
--paper: #fafafa;
--ink: #1a1a1a;
--muted: #666;
--line: #1a1a1a;
--soft-line: #ccc;
```

主要材质：

- 纸张纹理背景
- 黑色手绘描边
- 虚线分割线
- 不规则裁切边缘
- 轻微投影

页面不追求玻璃拟态、渐变科技感或极简高级感，而是要保留“像手工剪贴出来”的不平整边缘。

## 字体系统

字体需要形成“正文理性 + 标题手绘”的对比。

推荐组合：

```css
body {
  font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
}

.hand-title {
  font-family: "Cabin Sketch", "Gloria Hallelujah", "Caveat", cursive;
}

.note-text {
  font-family: "Patrick Hand", "Caveat", cursive;
}
```

使用建议：

- 正文：Inter，保持可读
- 标题：Cabin Sketch / Gloria Hallelujah，制造手绘感
- 小提示、说明、成就文字：Patrick Hand / Caveat
- 不要全站都用手写字体，否则会显得乱

## 核心布局

## 体验流程

这个参考站的体验不是直接进入内容，而是分成几个明确阶段。后续复现时要按“加载 -> 入口 -> 进入空间 -> 房间探索”的节奏来设计。

### 1. 纸张裂缝加载页

加载页是一张满屏白色纸张，背景带明显揉皱纹理。画面中央是一条竖向不规则裂缝，加载百分比贴在裂缝中心附近。

关键特征：

- 全屏纸张纹理
- 中央竖向裂缝线
- 百分比数字位于画面中心
- 百分比外有虚线圆环
- 整体只有黑、白、灰，没有多余色彩
- 加载完成后像纸张从裂缝处打开或分离

结构建议：

```html
<div class="paper-loader">
  <div class="paper-loader__half paper-loader__half--left"></div>
  <div class="paper-loader__half paper-loader__half--right"></div>
  <svg class="paper-loader__crack">...</svg>
  <div class="paper-loader__progress">
    <span>90%</span>
  </div>
</div>
```

样式方向：

```css
.paper-loader {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  background:
    linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.72)),
    url("/textures/paper-texture.webp") center / cover;
}

.paper-loader__crack {
  position: absolute;
  top: -10%;
  left: 50%;
  width: 120px;
  height: 120%;
  transform: translateX(-50%);
  stroke: #1a1a1a;
  stroke-width: 2;
  fill: none;
}

.paper-loader__progress {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 96px;
  height: 96px;
  place-items: center;
  transform: translate(-50%, -50%);
  font-weight: 800;
  font-size: 32px;
}

.paper-loader__progress::before,
.paper-loader__progress::after {
  content: "";
  position: absolute;
  inset: 6px;
  border: 2px dashed rgba(26, 26, 26, 0.72);
  border-radius: 50%;
}

.paper-loader__progress::after {
  inset: 16px;
  opacity: 0.45;
  animation: loader-spin 8s linear infinite;
}
```

动效建议：

- 百分比递增时，虚线圆环缓慢旋转
- 裂缝线可以轻微抖动或逐段绘制
- 加载完成后左右两半纸张向两侧移开
- 转场不要淡出，要像“纸被打开”

### 2. 外部门廊入口

加载后不是直接进入走廊，而是先出现一个手绘的建筑外立面：砖墙、树、门、窗、招牌和小物件。中心是可点击的双开门，门上贴着技术栈贴纸，顶部木牌写着 Portfolio。

关键特征：

- 黑白线稿场景
- 少量彩色技术贴纸作为视觉焦点
- 入口门位于画面中心
- 底部有撕边纸条提示
- 鼠标点击门进入下一阶段
- 画面像手绘插画，而不是真实 3D 渲染

可复现结构：

```html
<section class="entrance-scene">
  <img class="scene-layer wall" src="/scenes/brick-wall.webp" alt="" />
  <img class="scene-layer tree" src="/scenes/tree.webp" alt="" />
  <button class="portfolio-door" aria-label="进入作品集">
    <img src="/scenes/door.webp" alt="" />
  </button>
  <div class="paper-hint">
    <strong>EXPLORER</strong>
    <span>点击门进入</span>
  </div>
</section>
```

布局原则：

- 门必须在第一视觉中心
- 提示纸条贴近底部中心
- 场景元素可以左右延展，允许宽屏有更多插画细节
- 不要在入口页放大量正文

### 3. 开门后的走廊

点击门后进入室内走廊。画面有明显透视：地板线条向远处收束，墙面和天花形成空间深度。中心是角色或品牌标识，后方有大字标志。

关键特征：

- 走廊透视强
- 线稿密度比入口页更高
- 中央角色或 logo 作为锚点
- 底部继续使用撕边提示纸条
- 右上角出现地图、音频、菜单等纸片按钮
- 页面可滚动或可移动进入不同房间

这个阶段的目标是告诉用户：“你已经进入可探索空间”，而不是展示完整信息。

### 4. 房间探索

走廊之后再进入不同房间：

- 项目画廊
- 关于工作室
- 联系房间
- 奖项 / 成就墙

每个房间都应该有一个明确的空间隐喻，而不是普通页面换标题。

例如：

- 项目：画框、展台、贴纸、墙面海报
- 笔记：书桌、便签、纸张堆、抽屉
- 关于：工作室、工具、草稿、电脑桌
- 联系：信箱、电话、公告板

### 1. 全屏 3D 舞台

页面主体是全屏画布：

```css
.app {
  width: 100%;
  height: 100dvh;
  position: relative;
  overflow: hidden;
}

.canvas-wrapper {
  position: absolute;
  inset: 0;
  z-index: 1;
}
```

3D 场景承载主要叙事，例如：

- 走廊
- 画廊
- 工作室
- 联系房间
- 项目展板

HTML UI 不应抢占主视觉，而是漂浮在 3D 场景之上。

### 2. 固定 UI 层

所有按钮、地图、音频控制、提示浮层放在固定 UI 层：

```css
.ui-overlay,
.navigation-ui {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
}

.ui-overlay button,
.navigation-ui button,
.navigation-ui a {
  pointer-events: auto;
}
```

这样可以让 3D 场景和界面控件分层清晰。

## 组件规范

### 1. 撕边纸片按钮

按钮不是普通圆角矩形，而是“被撕出来的纸片”。

特征：

- 白色纸张背景
- 纸纹理
- 不规则 `clip-path`
- 黑色描边
- 小投影
- hover 时轻微上移

示例：

```css
.paper-button {
  position: relative;
  width: 50px;
  height: 55px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 0.2s ease;
  filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.1));
}

.paper-button::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)),
    url("/textures/paper-texture.webp") center / cover;
  clip-path: polygon(
    0% 0%, 100% 0%, 98% 10%, 100% 20%,
    97% 35%, 100% 50%, 98% 65%, 100% 80%,
    97% 90%, 100% 100%, 90% 97%, 80% 100%,
    70% 96%, 60% 100%, 50% 97%, 40% 100%,
    30% 96%, 20% 100%, 10% 97%, 0% 100%
  );
}

.paper-button:hover {
  transform: translateY(-2px);
}

.paper-button:active {
  transform: translateY(1px);
}
```

### 2. 地图面板

地图是用户理解空间结构的关键组件。

布局：

- 顶部居中弹出
- 宽度 90%，最大 500px
- 白色纸张卡片
- 撕边轮廓
- 标题用手绘大写字
- 内部放一张手绘地图
- 地图上有可点击区域或图钉

交互：

- 打开：从顶部滑入
- 关闭：向上滑出
- 当前房间用图钉标记
- hover 房间区域时有轻微反馈

### 3. 成就弹窗

成就弹窗让网站有游戏感。

出现时机：

- 第一次进入
- 打开地图
- 进入某个房间
- 查看某个项目
- 打开音效

结构：

- 左侧 checkbox / 图标
- 右侧标题和描述
- 底部居中浮出
- 入场有弹性曲线
- 离场下沉淡出

文案要短，像小游戏提示：

- Map discovered
- Gallery unlocked
- Sound enabled
- Project inspected

### 4. 音频控制面板

音频面板使用纸片卡片风格，控制项包括：

- 背景音乐音量
- 音效音量
- 静音开关

滑块不需要精致现代，要像手工工具：

```css
.paper-slider {
  appearance: none;
  width: 100%;
  height: 4px;
  background: #ccc;
  border-radius: 2px;
}

.paper-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #1a1a1a;
}
```

## 3D 场景规范

### 场景结构

推荐以“空间导航”组织内容：

- 入口走廊：首页
- 画廊：项目
- 工作室：关于
- 联系房间：联系与社交
- 墙面展板：项目卡

### 视觉语言

3D 场景不追求真实渲染，而是“手绘纸模”：

- 漫反射材质
- 低饱和色
- 手绘纹理
- 线稿描边
- 轻微不规则几何
- 避免金属、玻璃、高光过强

### 相机

相机运动要像人在空间里慢慢移动：

- 切换房间时平滑推进
- 不要快速旋转
- 可以有轻微缓入缓出
- 关键节点停稳，避免用户晕

推荐动效：

```ts
gsap.to(camera.position, {
  x: target.x,
  y: target.y,
  z: target.z,
  duration: 1.2,
  ease: "power3.inOut",
});
```

## 动效语言

动效要像“纸片、地图、手绘界面被拿出来”，不是普通网页淡入。

常用动效：

- 顶部滑入
- 底部弹出
- 纸片 hover 上浮
- checkbox 勾选绘制
- 地图图钉移动
- 3D 相机平滑转场

推荐曲线：

```css
--ease-paper: cubic-bezier(0.16, 1, 0.3, 1);
--ease-bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

避免：

- 大面积炫光
- 紫蓝渐变
- 过快转场
- 纯 CSS 卡片堆叠
- 企业官网式 hero

## 鼠标视差与画面响应

开门后的走廊界面会随鼠标移动产生轻微变化。这个变化不是夸张拖拽，而是“你在空间里微微探头看”的感觉。

### 视差目标

鼠标移动时可以影响：

- 相机朝向
- 场景容器位移
- 前景纸团、纸飞机、小物件位移
- 背景走廊轻微反向位移
- 中央角色或 logo 的微小偏移
- UI 纸片按钮保持稳定，不跟随大幅移动

### 层级速度

不同层移动速度不同，制造深度：

```text
远景墙面 / 走廊：  2px - 6px
中景 logo / 角色： 6px - 12px
前景纸团 / 小物： 12px - 24px
相机旋转：         0.5deg - 2deg
```

不要让所有元素同方向同速度移动，否则只像普通平移。

### CSS 变量方案

如果是 2D/伪 3D 插画，可以用 CSS 变量驱动：

```css
.parallax-scene {
  --mx: 0;
  --my: 0;
  perspective: 1000px;
}

.parallax-layer--back {
  transform: translate3d(calc(var(--mx) * -4px), calc(var(--my) * -3px), 0);
}

.parallax-layer--mid {
  transform: translate3d(calc(var(--mx) * 8px), calc(var(--my) * 6px), 0);
}

.parallax-layer--front {
  transform: translate3d(calc(var(--mx) * 18px), calc(var(--my) * 14px), 0);
}
```

```ts
const scene = document.querySelector(".parallax-scene");

window.addEventListener("pointermove", (event) => {
  const x = event.clientX / window.innerWidth - 0.5;
  const y = event.clientY / window.innerHeight - 0.5;

  scene?.style.setProperty("--mx", x.toFixed(3));
  scene?.style.setProperty("--my", y.toFixed(3));
});
```

### Three.js / React Three Fiber 方案

如果是真 3D 场景，鼠标应影响相机目标点，而不是直接大幅移动模型：

```ts
const pointer = {
  x: 0,
  y: 0,
};

window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX / window.innerWidth - 0.5;
  pointer.y = event.clientY / window.innerHeight - 0.5;
});

function tick() {
  camera.rotation.y += (pointer.x * 0.035 - camera.rotation.y) * 0.06;
  camera.rotation.x += (-pointer.y * 0.025 - camera.rotation.x) * 0.06;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
```

注意：

- 必须有缓动，不要鼠标一动就立即跟随
- 移动幅度要小
- 移动端没有 hover，可以改成陀螺仪或直接关闭
- 重要文字和按钮不要跟随到难以点击

### 进入走廊的转场

门点击后建议使用两段转场：

1. 门或画面中心放大，模拟走近
2. 切入走廊，场景从轻微模糊恢复清晰

```ts
gsap.timeline()
  .to(".portfolio-door", {
    scale: 1.08,
    duration: 0.35,
    ease: "power2.out",
  })
  .to(".entrance-scene", {
    opacity: 0,
    filter: "blur(8px)",
    duration: 0.45,
    ease: "power2.inOut",
  })
  .fromTo(".corridor-scene", {
    opacity: 0,
    scale: 1.04,
    filter: "blur(8px)",
  }, {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    duration: 0.65,
    ease: "power3.out",
  });
```

## 内容组织

### 首页

首页不是普通介绍，而是“入口空间”。

需要包含：

- 一段进入提示
- 操作说明
- 地图按钮
- 音频按钮
- 进入画廊 / 工作室 / 联系房间的空间入口

### 项目页

项目展示应像画廊，而不是列表。

每个项目可以是：

- 墙上的画框
- 桌上的卡片
- 房间里的展品
- 点击后打开纸张详情面板

详情面板包含：

- 项目名
- 简短说明
- 技术栈
- 截图或视频
- GitHub / 访问链接

### 关于页

关于页可以做成工作室：

- 桌面
- 便签
- 工具
- 草稿
- 证书或奖项墙

### 联系页

联系页可以做成通讯角落：

- 信封
- 电话
- 社交图标
- 联系表单纸条

## 响应式策略

移动端不要强行保留复杂 3D 交互。

建议：

- 保留 3D 氛围，但减少镜头运动
- 关键导航按钮放到顶部或底部
- 面板宽度 95% 或 100%
- 地图可以全宽显示
- 复杂 hover 改成点击
- 字体略小，但手绘标题仍要清晰

断点：

```css
@media (max-width: 768px) {
  .nav-button {
    width: 45px;
    height: 50px;
  }

  .map-panel {
    width: 95%;
    max-width: none;
  }

  .hint {
    bottom: 24px;
    padding: 12px 20px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .map-panel {
    width: 100%;
  }
}
```

## 技术建议

如果要复现这种风格，推荐技术栈：

- Astro / React 页面框架
- Three.js 或 React Three Fiber 做 3D 场景
- GSAP 做相机和 UI 动效
- CSS `clip-path` 做撕边纸片
- WebP 纸张纹理
- GLTF / GLB 作为 3D 模型格式

性能注意：

- 纹理使用 WebP
- 3D 模型压缩
- 移动端降低阴影和纹理精度
- 首屏必须有 preloader
- 隐藏 SEO fallback 内容，保证爬虫能读到文本

## SEO 与可访问性

这种 WebGL SPA 容易被搜索引擎读不到内容，所以需要隐藏的语义 fallback：

```html
<div class="sr-only-seo">
  <h1>个人作品集</h1>
  <nav>
    <a href="/">首页</a>
    <a href="/projects">项目</a>
    <a href="/about">关于</a>
    <a href="/contact">联系</a>
  </nav>
  <main>
    <article>
      <h2>项目介绍</h2>
      <p>这里放给搜索引擎和无障碍工具读取的真实内容</p>
    </article>
  </main>
</div>
```

注意：

- 不要只依赖 Canvas 表达信息
- 所有按钮要有 aria-label
- 需要 noscript fallback
- 键盘焦点要可见
- 地图热点要能通过键盘操作

## 复现清单

最小可复现版本：

1. 全屏纸张裂缝加载页
2. 黑白线稿入口门廊
3. 可点击的 Portfolio 双开门
4. 进入后的走廊场景
5. 鼠标移动触发轻微视差
6. 右上角纸片导航按钮
7. 顶部滑入地图面板
8. 底部成就提示
9. 项目详情纸片弹窗
10. 纸张纹理和不规则边缘
11. 手写标题字体
12. SEO fallback

进阶版本：

1. 真实 3D 房间切换
2. 门打开的镜头推进
3. 图钉地图
4. 音频控制
5. 项目视频预览
6. 成就系统
7. 自定义滚动条
8. 手绘地图热点
9. 移动端简化 3D 场景
10. 陀螺仪或触摸驱动的移动端视差

## 应用于当前个人网站的建议

当前个人网站是仪表盘式信息架构，和这个参考站的“沉浸式 3D 画廊”差异很大。不要直接全量替换，否则笔记阅读会变差。

更合适的融合方式：

- 首页保留数据概览，但加入“纸张纹理”和更手绘的边缘
- 项目页改成“作品墙”而不是纯列表
- 笔记页保持阅读优先，只在分类、导航、空状态中加入纸片元素
- 加一个“地图式导航”作为趣味入口
- 只在项目展示页使用 3D 或伪 3D，不要让笔记阅读依赖 3D

推荐第一阶段改造：

1. 引入纸张纹理背景
2. 把按钮和卡片边缘改成轻微不规则
3. 项目卡增加手绘标签和 GitHub 图钉
4. 首页加入一个小地图入口
5. 保持笔记正文清爽可读
