# kemiao

一个为 Hugo 打造的博客主题，支持 PWA、双主题、多语言评论、说说三数据源等功能。

玻璃拟态顶栏、终端风 Hero、swup 无刷新跳转、全站统一灯箱、跑马灯技能区、IP 定位欢迎卡、Umami 流量卡、三数据源说说、多云评论后端——功能核心基本都在，并且针对静态站做了首屏优化。

**当前版本不是完整复刻原站项目**，保留了核心视觉与交互，但在配置、数据源、部分组件上做了自改与精简。你可以参考本主题自行改造使用，无需完全照搬。

> 文档位置：本文件位于**主题仓库根目录**。文中出现的 `themes/kemiao/...` 表示「本站点项目里的主题目录」，`tools/...`、`content/...`、`hugo.toml` 均指**站点项目根目录**（即主题的上一级），因为主题需要与站点配置、数据、工具脚本配合才能跑起来。

---

## 目录

- [一、特性](#一特性)
- [二、技术栈与架构](#二技术栈与架构)
- [三、目录结构](#三目录结构)
- [四、环境要求](#四环境要求)
- [五、快速开始](#五快速开始)
- [六、配置说明](#六配置说明)
- [七、部署](#七部署)
- [八、维护点](#八维护点)
- [九、性能基线](#九性能基线)
- [十、已知坑与排障](#十已知坑与排障)
- [十一、附录：组件清单](#十一附录组件清单)
- [十二、附录：推荐配置组合](#十二附录推荐配置组合)
- [十三、致谢](#十三致谢)

---

## 一、特性

**视觉**

- 玻璃拟态顶栏（`backdrop-filter`）、滚动渐显边界线
- 终端风格 Hero：`~ /hello-world $` + 打字光标 + 社交图标
- 明暗双主题（light / dark / auto 三档，localStorage 持久化，head 内联脚本防白闪）
- 页面背景：明暗各一套壁纸，走 CSS `blur + saturate + opacity`，可只配底色
- 网格 + 噪点装饰层
- 标签页轨道式卡片、文章卡、行卡三种列表形态
- 关于页 6 卡片布局（profile / skills / projects / personality / evaluation / contact）
- 技能区左右无缝跑马灯，鼠标悬浮暂停，`prefers-reduced-motion` 下退化为可横向滚动

**交互**

- swup 无刷新跳转：页面过渡、hover 预加载、滚动位置恢复、无刷新换页后脚本重建
- 中控台（右侧抽屉）：主题切换、字体切换、动效开关、最近评论、各功能入口
- 搜索弹窗（⌘K / Ctrl+K）：pagefind 或 algolia 双后端
- 全站统一灯箱：文章图、说说图、评论图、赞赏码共用一套（多图分组 / 方向键 / 计数 / 锁滚动）
- 右键菜单、站内消息条（snackbar）、返回顶部（带滚动百分比）
- 移动端抽屉菜单、移动端目录抽屉
- 浮动最近评论面板：右下角轮播，滚过评论区自动切「下一篇」
- 音乐胶囊（APlayer + MetingJS）：首次交互才加载，不占首屏

**内容**

- 说说三数据源：本地 md / memos echo 接口 / koharu-suite（Telegram 频道归档），游标分页
- 归档、分类、标签、友链、友链朋友圈动态、设备、留言、订阅、打赏、隐私声明等页面
- 文章目录、AI 摘要卡、分享按钮、版权声明、上一篇/下一篇、过期提醒
- 外链安全跳转中转页（`/safego/?u=<base64>`，带倒计时）

**集成**

- 评论：Artalk / Twikoo / Ecoku 三选一，切换 `provider` 即换后端；评论区懒加载
- 统计：Umami（自部署）+ 不蒜子（自部署），均延迟注入不阻塞首屏
- 流量数据卡：读 Umami 公开分享接口，无需后端
- 欢迎来访者卡：IP 定位 + 城市彩蛋 + 距离（haversine）+ 时段问候
- PWA：manifest、favicon 套件、Apple Touch Icon、OG 图，可一键关闭

**性能**

- 单入口 JS 打包，无 code splitting，无额外请求
- 三份 CSS 合并为单包，装饰样式内联
- 图标字体 / 图标 CSS / 拉丁 UI 字体全部子集化（FontAwesome 字体 237KB → 12KB，CSS 73KB → 12KB）
- 悠哉体按需加载（默认走系统字体，控制台可开）
- 评论、音乐、统计、背景全部后置加载

---

## 二、技术栈与架构

| 层 | 方案 | 关键约束 |
| --- | --- | --- |
| 构建 | Hugo 0.166+ extended | 用 `module.mounts` 手动挂载，**不用 `theme =`** |
| 样式 | Hugo Pipes `resources.Concat` | 只有一个样式入口，见下 |
| 脚本 | `js.Build` 单入口 `assets/js/site.js` | 无 code splitting，模块用动态 `import()` |
| 路由 | swup v4 + preload / scroll 插件 | 容器 `#swup`，事件 `site:*` |
| 搜索 | pagefind（默认）或 algolia | pagefind 索引在 `/pagefind/` |
| 字体 | FontAwesome 7（自托管）+ Cascadia + Cartograph + Sriracha + 悠哉体 | 前三者已子集化 |

### 样式只有一个入口

`layouts/partials/head.html` 把 `footer.css`（源站主样式包）、`main.css`、`site.css`（本项目补充）按固定顺序 `resources.Concat` 成 `css/bundle.css`，再 minify + fingerprint。页面背景由 `background-style.html` 生成，**内联**成 `<style>`。

- 顺序不能改：`footer → main → site`，后面的覆盖前面的。
- **不要在模板里再单独 `<link>` 一份 CSS**，会打乱顺序、多一个阻塞请求。
- 自定义样式一律加到 `themes/kemiao/assets/css/site.css` 末尾。

### JS 只有一个入口

页面行为全部在 `assets/js/site.js` 的管线里，模块按需 `import()`。分两类：

```js
// 全局一次：容器外元素（snackbar / 主题 / 右键菜单 / 搜索弹窗 / 音乐胶囊 / 滚动进度）
initXxx();

// 每页重挂：容器内元素（顶栏 / 文章 / 评论 / 侧栏卡 …）
onPageReady(import("./xxx.js"), (m) => m.initXxx(signal), controller);
```

- 每次换页换一个 `AbortController`，旧的监听自动解除，不需要手动 `removeEventListener`。
- **swup 一次换页会派发 3 次 `site:page-load`**，管线用 `detail.newDocument` 作 token 去重，否则会把刚绑好的监听 abort 掉。
- 事件约定：`site:before-swap` / `site:after-swap` / `site:page-load`（另有 `astro:*` 别名），`detail = { visit, newDocument }`。

---

## 三、目录结构

```
themes/kemiao/
├── archetypes/            # hugo new 模板（default.md / shuoshuo.md）
├── assets/
│   ├── css/
│   │   ├── footer.css     # 源站主样式包（约 198KB，来自源站编译产物）
│   │   ├── main.css       # 少量基础变量
│   │   └── site.css       # 本项目所有补充样式（自定义改这里）
│   └── js/
│       ├── site.js        # 唯一入口：初始化管线
│       ├── swup-router.js # swup 配置 + 钩子
│       ├── lightbox.js    # 全站统一灯箱
│       └── ...            # 其余按功能拆分，由 site.js 动态 import
├── data/                  # 主题内置兜底数据（站点根目录 data/ 优先）
├── layouts/
│   ├── _default/          # baseof / list / single / taxonomy / term / 各独立页
│   ├── partials/          # head / header / footer / 侧栏卡 / 控制台 / 弹窗 …
│   ├── posts/             # 文章列表
│   └── shuoshuo/          # 说说详情
└── static/
    ├── config/            # 运行时配置
    ├── fontawesome/       # 图标字体 + all.subset.min.css（子集化产物）
    ├── fonts/             # 子集化后的 woff2
    ├── imgs/ info/ pwa/   # 图片、信息页资源、PWA 资产
    └── vendor/            # 第三方静态资源
```

站点侧（与主题配合，不属于主题仓库）：

```
blog/
├── hugo.toml              # 站点配置（module.mounts 在这里）
├── package.json           # swup / pagefind 依赖
├── content/               # posts / shuoshuo / 各独立页 md
├── data/                  # nav.yaml / apps.yaml / links.yaml …（站点数据只认这里）
├── static/                # 站点自己的图片等
└── tools/
    ├── build.mjs          # 干净构建（清 public → hugo → pagefind → 自检）
    ├── subset-fonts.py    # FontAwesome 字体子集化
    ├── subset-fa-css.py   # FontAwesome CSS 子集化
    ├── subset-latin-fonts.py  # 拉丁 UI 字体子集化
    └── gen-pwa-assets.py  # PWA / favicon / OG 图生成
```

---

## 四、环境要求

| 工具 | 版本 | 用途 |
| --- | --- | --- |
| Hugo | **extended 0.166+** | 必须 extended（`scss`/`js.Build`） |
| Node.js | 22+ | swup 打包依赖、pagefind、构建脚本 |
| Python | 3.12+ | 仅在重跑子集化 / PWA 资产脚本时需要 |
| Chrome | 任意近期版本 | 仅在跑可视化验证脚本时需要 |

Python 侧依赖：

```bash
pip install fonttools brotli pillow pyyaml
```

---

## 五、快速开始

### 1. 内容目录

主题按固定路径取内容，缺目录会渲染空白列表，但不会报错：

```
content/
├── _index.md          # 首页 front matter
├── about.md           # 关于（用 cards: 结构化参数驱动 6 卡片）
├── archives.md
├── comment.md  link.md  addlink.md  fcircle.md  devices.md
├── info.md  rewards.md  subscribe.md  statement.md  search.md  safego.md
├── posts/             # 文章
└── shuoshuo/          # 说说（source = local 时使用）
```

分类和标签页由 taxonomy 自动生成，不需要手写 md。

页面用的标题/描述从对应 md 的 front matter 读取，正文一般留空。

### 2. 站点配置挂载

主题**不使用 `theme = 'kemiao'`**，而是在 `hugo.toml` 里显式 `module.mounts`：

```toml
[module]
  # 站点自身目录在前（高优先级，同名文件站点赢）
  [[module.mounts]]
    source = 'content'
    target = 'content'
  [[module.mounts]]
    source = 'data'
    target = 'data'
  [[module.mounts]]
    source = 'assets'
    target = 'assets'
  [[module.mounts]]
    source = 'static'
    target = 'static'
  [[module.mounts]]
    source = 'layouts'
    target = 'layouts'
  [[module.mounts]]
    source = 'archetypes'
    target = 'archetypes'

  # 主题在后（低优先级）。注意：故意不挂 themes/kemiao/data
  [[module.mounts]]
    source = 'themes/kemiao/layouts'
    target = 'layouts'
  [[module.mounts]]
    source = 'themes/kemiao/assets'
    target = 'assets'
  [[module.mounts]]
    source = 'themes/kemiao/static'
    target = 'static'
  [[module.mounts]]
    source = 'themes/kemiao/archetypes'
    target = 'archetypes'
```

> **为什么不挂 `themes/kemiao/data`**：主题 data/ 里的 YAML 是数组结构，一旦与站点 data/ 同名就会被判为 `overridden` 并刷警告。干脆不挂——数据只认站点根目录 `data/`，主题 `data/` 只作为模板参考。
>
> 主题本身没有 i18n 文案（界面文字直接写在模板里），所以不挂 `i18n`；如果你的站点有自己的 `i18n/`，按同样方式补一条 `[[module.mounts]]` 即可。

主题是 git submodule，克隆站点后要先拉取：

```bash
git submodule update --init --recursive
```

### 3. 安装依赖

```bash
npm ci        # 或 npm install
```

依赖只有四个：`swup`、`@swup/preload-plugin`、`@swup/scroll-plugin`、`pagefind`。

### 4. 本地预览

```bash
hugo server -D
```

注意：

- 本地 dev server **不压缩**，看页面体积会虚高（CSS 原始 400KB）；真实传输量要按 gzip 估。
- 本地会多出 `livereload.js`（约 78KB），生产没有。

### 5. 构建

```bash
node tools/build.mjs          # 含草稿（本地默认）
node tools/build.mjs --prod   # 不含草稿，发布用
node tools/build.mjs --no-pf  # 跳过 pagefind 索引
```

脚本做四件事：清空 `public/` → `hugo --gc --minify` → 生成 pagefind 索引 → 自检 `public/css` 有无孤儿 fingerprint 文件。

> 为什么要清 `public/`：Hugo 改了 CSS 会生成新哈希文件，但**旧的不会自动删**，`--gc` 也不管。不清就会堆一堆 `bundle.min.*.css`，排查时容易误判「改动没生效」。

---

## 六、配置说明

以下字段都在 `hugo.toml` 的 `[params]` 下，未写即用默认值。

### 站点基础

| 字段 | 说明 |
| --- | --- |
| `title` | 站点标题 |
| `description` / `keywords` | SEO 描述与关键词 |
| `author` | 作者名（页脚、版权、分享） |
| `avatar` | 头像 URL |
| `ogImage` | 分享图路径 |
| `defaultTheme` | `light` / `dark` / `auto`，默认 `auto` |
| `runtimeStart` | 页脚「已运行 xxx」起点（RFC3339） |
| `copyrightStartYear` | 版权起始年 |
| `footerCredit` | 页脚技术署名 |
| `beianIcp` / `beianPolice` / `beianPoliceCode` | 备案信息，留空不显示 |

### 图标 `[params.icons]`

| 字段 | 说明 |
| --- | --- |
| `provider` | `local`（推荐，自托管子集）或 `cdn` |
| `cdn` | `provider = cdn` 时使用的 CSS 地址 |

`local` 会引用 `themes/kemiao/static/fontawesome/css/all.subset.min.css`，**新增图标后必须重跑子集化脚本**（见[维护点](#八维护点)）。

### 搜索 `[params.search]`

| 字段 | 说明 |
| --- | --- |
| `provider` | `pagefind`（默认）或 `algolia` |
| `pagefind.basePath` | pagefind 索引路径，默认 `/pagefind/` |
| `pagefind.hitsPerPage` | 每页结果数 |
| `algolia.appId` / `apiKey` / `indexName` / `hitsPerPage` | algolia 后端凭据 |

### 评论 `[params.comments]`

| 字段 | 说明 |
| --- | --- |
| `provider` | `artalk` / `twikoo` / `ecoku` |
| `artalk.server` / `artalk.site` | Artalk 服务端与站点名 |
| `twikoo.envId` | Twikoo 环境 ID |
| `ecoku.serverUrl` / `siteId` / `pageSize` / `theme` / `i18n` | Ecoku 自托管参数 |
| `ecoku.jsUrl` / `cssUrl` | 可选，自定义加载器与样式（主题已内置观感适配，一般不用配） |
| `recentComments.authorFilter` | 站主昵称过滤，命中不计入「最近评论」，逗号分隔 |

> 最近评论（浮动面板 + 中控台区块）依赖 artalk/twikoo 的公开接口；`provider = ecoku` 时主题会自动关闭该功能（模板层门控，不会渲染空面板）。
> 评论区在接近视口时才初始化（`IntersectionObserver`，rootMargin 600px），所以首屏不产生评论请求。
>
> **Ecoku 观感适配**：主题已通过 ecoku 的「默认样式 + 变量」机制（见 [custom-css 文档](https://ecoku.zsh.moe/integration/custom-css)）把评论区的配色、字号、按钮、分页对齐到 Artalk 的观感，样式在 `assets/css/site.css` 的「Ecoku 评论样式」段——颜色全部映射 `--foreground` / `--background` / `--border` / `--accent`，明暗随主题切换。改 Ecoku 样式改那里，不要动 `data-css-url`。

### 文章 `[params.article]`

| 字段 | 说明 |
| --- | --- |
| `aiSummary.brand` / `aiSummary.model` | AI 摘要卡的品牌名与模型名 |
| `share.whatsapp` / `facebook` / `x` / `telegram` / `pinterest` / `email` | 分享按钮开关 |

### 字体 `[params.fonts]`

| 字段 | 说明 |
| --- | --- |
| `yozaiCss` | 悠哉体分片 CSS 地址 |

悠哉体**默认关闭**（走系统字体，省约 900KB）。读者可在中控台开关里自行打开，偏好存 localStorage。

### 欢迎来访者卡 `[params.welcome]`

| 字段 | 说明 |
| --- | --- |
| `api` | IP 定位接口地址 |
| `originLat` / `originLng` | 博主坐标，用于算访客距离；任一为 0 则不显示距离行 |
| `cacheTtl` | 定位结果缓存秒数，默认 3600 |

返回结构约定：`{ code, data: { ip, country, prov, city, lat, lng, isp } }`。结果存 localStorage，命中缓存后 0 请求；请求 8s 超时，失败渲染错误态。

### 页面背景 `[params.background]`

| 字段 | 说明 |
| --- | --- |
| `enable` | 总开关，false 时只保留底色 |
| `position` / `size` / `scale` | 壁纸铺法（`scale` 用于盖住 blur 毛边） |
| `light.image` / `light.color` / `light.opacity` / `light.blur` / `light.saturate` | 亮色一套 |
| `dark.*` | 暗色一套，只填 light 时深色复用同一张 |

整段删掉 = 回到主题内置默认配色。

### 统计 `[params.umami]`

| 字段 | 说明 |
| --- | --- |
| `enable` | 开关 |
| `src` | 脚本地址，如 `https://um.example.com/script.js` |
| `websiteId` | 站点 ID |
| `domains` | 可选，只在这些域名上报，留空不限 |

脚本在 `window.load` 之后才注入，**不阻塞首屏**；它自带 `pushState` 监听，swup 换页自动上报，**不要手动调 `umami.track()`**（会翻倍）。

### 流量数据卡 `[params.traffic]`

| 字段 | 说明 |
| --- | --- |
| `umamiBase` | Umami 站点根，如 `https://um.example.com/` |
| `umamiShareId` | 分享链接 `/share/` 之后那一段 |
| `timezone` | 统计时区，如 `Asia/Shanghai` |
| `cacheTtl` | 缓存秒数 |

走 Umami 公开 Share 接口，静态站零后端。`umamiBase` 或 `umamiShareId` 缺任一，**整张卡不渲染**（不会出现空卡）。

> Umami v3 的分享接口除 `x-umami-share-token` 外还必须带 `x-umami-share-context: 1`，否则 stats/pageviews 一律 401。主题已内置。

### 不蒜子 `[params.busuanzi]`

| 字段 | 说明 |
| --- | --- |
| `enable` | 开关 |
| `src` | 自部署地址，如 `https://bsz.example.com/js` |

脚本注入后自动填充 `#busuanzi_{site_pv,site_uv,page_pv,page_uv}`。同样在 `window.load` 之后注入；换页时立即刷新以重新计数。

### 音乐胶囊 `[params.musicCapsule]`

| 字段 | 说明 |
| --- | --- |
| `enable` | 开关 |
| `id` / `server` / `type` | 歌单 ID、平台（netease）、类型（playlist） |
| `volume` | 初始音量 |
| `api` | Meting 接口模板 |
| `aplayerCss` / `aplayerScript` / `metingScript` | 依赖地址 |

首次 hover / 聚焦 / 点击才加载 APlayer + Meting + 歌单接口，首屏 0 请求。

### 安全跳转 `[params.safego]`

| 字段 | 说明 |
| --- | --- |
| `param` | 参数名，默认 `u` |
| `countdown` | 倒计时秒数 |
| `protocols` | 允许中转的协议，逗号分隔 |

### PWA `[params.pwa]`

| 字段 | 说明 |
| --- | --- |
| `enable` | 总开关，false 时只输出 `/favicon.ico`，其余 PWA 引用不渲染 |
| `shortName` / `themeColor` / `backgroundColor` / `display` / `startUrl` | manifest 字段 |

资产由 `python tools/gen-pwa-assets.py` 生成到 `themes/kemiao/static/`。素材未就绪时请把 `enable` 置 false，避免 404。

### Hero `[params.hero]`

| 字段 | 说明 |
| --- | --- |
| `title` | 大标题 |
| `terminalPrefix` / `terminalPath` / `terminalSuffix` | 终端行三要素 |
| `avatar` / `authorLabel` / `authorName` / `authorUrl` | 作者区 |
| `[[params.hero.socials]]` | 社交图标数组：`icon` / `title` / `url` / 可选 `accent` |

### 侧栏 `[params.sidebar]`

| 字段 | 说明 |
| --- | --- |
| `postPerIndex` | 首页文章数 |
| `welcome.enable` | 欢迎来访者卡 |
| `patron.enable` / `moreLabel` / `moreUrl` | 赞赏榜卡 |
| `traffic.enable` | 流量数据卡 |
| `webinfo.enable` | 站点信息卡（不蒜子 PV/UV） |

### 说说 `[params.shuoshuo]`

| 字段 | 说明 |
| --- | --- |
| `source` | `local` / `api` / `tg` 三选一 |
| `tickerCount` | 首页滚动条条数（local） |
| `api` / `mediaOrigin` / `fetchLimit` | memos echo 接口（api） |
| `tg.baseUrl` / `tg.channelId` / `tg.pageSize` / `tg.detailLink` | koharu-suite（tg） |

`tg` 模式接口契约：`GET {baseUrl}/api/v1/messages/latest?channel=<uuid>&limit=N&cursor=<nextCursor>`，返回 `{ items, nextCursor }`。

> **本地说说数据的开关**：`content/shuoshuo/_index.md` 里有一个 `cascade.build`（list/render = never）。`source` 用 `tg` / `api` 时保留它——本地说说 md 不构建单页、不进任何列表（含标签/分类），`/shuoshuo/<slug>/` 直接 404；切回 `source = 'local'` 时删除该段即可恢复。标签/分类页在模板层已按 `Type = posts` 过滤，说说永远不会混进去。

### 独立页面文案：`data/pages/*.yaml`

友链申请（addlink）、订阅（subscribe）、留言板（comment）这类「结构化 UI 页」的文案不在 md 里，在 `data/pages/<页面名>.yaml`，由对应模板（`layouts/_default/<page>.html`）渲染，**改文案改 YAML，不动模板**。

长 prose 页（隐私政策 statement、发展历程 info）同走这个模式，但数据是 `blocks` 块列表（`h2/h3/h4` 标题、`p` 段落、`ul/ol` 列表，行内允许 HTML 片段，列表项支持 `text + sub` 一层嵌套），由 `prose-hero.html` + `prose-list-items.html` 渲染：

- 站点相关信息（站名、域名、头像、RSS 地址、友链申请的「本站信息」模板）**不放在文案文件里**，模板直接读 `hugo.toml` 的参数（`title` / `baseURL` / `avatar` / `description` / `siteshot`），一处配置全站生效。
- `content/<page>.md` 只保留 front matter（title / description / hero），正文留空；删掉对应 data 文件时模板会回退渲染 md 正文（向后兼容）。
- 新增同类型页面照抄这个模式：文案进 `data/pages/`，结构进模板，样式进 `site.css`。

### 友链朋友圈 `[params.fcircle]`

| 字段 | 说明 |
| --- | --- |
| `api` | Friend-Circle-Lite 动态 JSON |
| `statusApi` | 友链状态 JSON |

### 分页 `[pagination]`

| 字段 | 说明 |
| --- | --- |
| `pagerSize` | 每页条数，默认 12 |

---

## 七、部署

### 通用要求

1. **必须开启 gzip 或 brotli 压缩**。主题的 CSS 合并包原始约 400KB，gzip 后 61KB；不开压缩等于白白多传 340KB。
2. 建议 HTTP/2（多资源并行，主题的指纹文件名天然适合长缓存）。
3. `baseURL` 必须与线上域名一致，否则 OG / RSS / PWA 清单里的绝对地址会错。
4. 构建命令统一用 `node tools/build.mjs --prod`（会清 `public/` 再构建并生成搜索索引）。

### Cloudflare Pages

| 项 | 值 |
| --- | --- |
| 构建命令 | `npm ci && git submodule update --init --recursive && npm run build:prod` |
| 输出目录 | `public` |
| 环境变量 `HUGO_VERSION` | `0.166.0`（必须是 extended 版） |
| 环境变量 `NODE_VERSION` | `22` |

Cloudflare 默认开启 brotli，无需额外配置。

### GitHub Pages

```yaml
# .github/workflows/deploy.yml 关键片段
- uses: actions/checkout@v4
  with:
    submodules: recursive
- uses: peaceiris/actions-hugo@v3
  with:
    hugo-version: '0.166.0'
    extended: true
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npm ci
- run: node tools/build.mjs --prod
- uses: peaceiris/actions-gh-pages@v4
  with:
    publish_dir: ./public
```

> 自定义域名 / 子路径部署时记得把 `baseURL` 写成带子路径的形式（如 `https://user.github.io/blog/`），否则资源路径会 404。

### Nginx

```nginx
server {
    listen 80;
    server_name blog.example.com;
    root /var/www/blog/public;

    gzip on;
    gzip_comp_level 6;
    gzip_types text/css application/javascript application/json image/svg+xml text/plain;

    # 指纹资源长缓存
    location ~* \.(css|js|woff2|webp|avif|png|jpg|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 不缓存，保证发布即生效
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }

    try_files $uri $uri/ /404.html;
}
```

### PWA 资产

首次部署前生成一遍：

```bash
python tools/gen-pwa-assets.py --src your-logo.png   # 建议 >=512x512 透明 PNG
```

产物写入 `themes/kemiao/static/`（favicon 套件、apple-touch-icon、pwa 图标、og 图）。没有素材就把 `[params.pwa].enable` 设为 `false`。

---

## 八、维护点

这一节是「改动前后必须知道」的东西，都是踩过坑总结出来的。

### 1. 子集化三件套：新增图标 / 文案后必须重跑

图标字体和部分拉丁字体是**按项目实际用到的字符裁剪过**的。用到了新的东西却不重跑，表现是**静默缺失**——图标空白、文字掉回 fallback，控制台不报错。

| 场景 | 命令 | 影响文件 |
| --- | --- | --- |
| 新增 / 更换 FontAwesome 图标 | `python tools/subset-fonts.py` | `static/fontawesome/webfonts/*.woff2` |
| 同上（CSS 定义） | `python tools/subset-fa-css.py` | `static/fontawesome/css/all.subset.min.css` |
| 新增文案、特殊符号、emoji 之外的生僻标点 | `python tools/subset-latin-fonts.py` | `static/fonts/*.woff2`（Cartograph / Wotfard / Sriracha） |

两个 FA 脚本都自带自检：字体脚本验证「每个用到的图标都能画出轮廓」，CSS 脚本验证「输出里仍包含所有用到的图标名」，不通过会直接退出。原字体备份在 `tools/fonts/full/`，可随时回滚。

> `subset-fa-css.py` 解析的是**组合选择器**（如 `.fa-computer-mouse,.fa-mouse{--fa:"\f8cc"}`），不要改成按单类名匹配，会漏图标。

### 2. 样式只能有一个入口

- 所有 CSS 必须在 `themes/kemiao/assets/css/` 下，由 `head.html` 的 `resources.Concat` 统一合并。
- **不要在模板里写 `<link rel="stylesheet">`**，也不要给 CSS 加新的 `fingerprint` 单文件。
- 装饰性、只有几百字节的生成样式（如页面背景）→ 内联 `<style>`，别单独发请求。
- 自定义样式追加到 `site.css` 末尾，它能覆盖 `footer.css`（因为合并顺序在后面）。

### 3. 脚本只能有一个入口

- 页面行为写进 `assets/js/` 下的模块，在 `site.js` 里按「全局一次 / 每页重挂」注册。
- **不要在模板里写 `<script type="module">`**（会造成重复初始化，也会绕过 swup 的重建逻辑）。
- 容器内的元素用 `onPageReady(import(...), fn, controller)`，容器外的用全局一次。

### 4. swup 相关：三个必须遵守的点

1. 一次换页会派发 **3 次** `site:page-load`，必须用 `detail.newDocument` 做 token 去重。
2. 容器外元素（音乐胶囊、snackbar、搜索弹窗、右键菜单、浮动最近评论）不要放进 `#swup` 容器，否则会被换页销毁重建。
3. 灯箱 / 事件绑定的清理用 `AbortController`；重复绑定用 `WeakMap` 记录 signal，已 abort 的允许重绑。

### 5. 外部脚本一律不阻塞首屏

统计、评论、音乐全部后置加载。新增第三方脚本时遵守同样原则：

- 不要用 `<script src>` 直接放在 head（`defer` 也会阻塞 `DOMContentLoaded`）。
- 用 `window.load` + `requestIdleCallback` 后再 `createElement("script")` 插入。

> 反面教材：Umami 脚本曾用 `defer`，因为自部署服务首字节 2~5 秒，直接把 DCL 从 1s 拖到 5.6s。

### 6. 评论后端切换的连带影响

`provider` 改成 `ecoku` 后要连带关闭「最近评论」相关三处渲染（浮窗 partial、中控台区块、按钮），主题已在模板层用 `provider != ecoku` 门控，新增类似接口依赖时照此处理。

### 7. 灯箱只有一套

文章图、说说图、评论图、赞赏码全部走 `assets/js/lightbox.js`：文章图自动绑定，说说用 `openAnchorLightbox(anchor)`，其他模块用 `openLightbox(items, index)`。**不要再造局部灯箱**。

### 8. 改完必须做的验证

- **像素级对比**：Playwright 双主题全页截图 + Pillow diff，只统计单通道差 > 12 的像素。不设阈值的话，1 个色阶的抖动会把「差异像素」撑到几十万，全是噪声。
- **图标字形**：遍历 `[class*="fa-"]` 元素的 `::before` content，必须全部非空。
- **换页回归**：`about → archives → tags → 首页` 走一遍，检查 window 上的标记是否保留（证明没有整页刷新）、每次换页统计是否只上报一次。
- **与源站对照**：涉及交互/布局的改动，拿对应的原始站点跑同一套探测做对照。只看几何容易误判——曾经因为两边盒子坐标完全一致，差点漏掉真正的层叠问题。

### 9. 发布前清 `public/`

用 `node tools/build.mjs`，不要手动 `hugo`。旧 fingerprint 文件不清会堆积，还会让「改了没生效」的排查误判。

---

## 九、性能基线

本地 `hugo server`（首页，冷启动，不含压缩）：

| 指标 | 数值 |
| --- | --- |
| TTFB | ~3 ms |
| DOMContentLoaded | ~250–380 ms |
| load | ~280–400 ms |
| 请求数 | 16（含 dev 专属 `livereload.js`） |

生产构建（`--minify` + gzip）实际传输：

| 资源 | 原始 | gzip |
| --- | --- | --- |
| 首页 HTML | 56 KB | 12 KB |
| CSS 合并包 | 390 KB | 61 KB |
| FontAwesome CSS（子集） | 12 KB | 3 KB |
| `site.js` | 168 KB | 51 KB |
| 字体（子集，不压缩） | ~40 KB | — |
| 背景壁纸 webp | 39 KB | — |

首页首屏真实传输约 **200 KB**。字体从最初的 1299KB（24 个文件）降到 61KB（5 个文件）。

---

## 十、已知坑与排障

**「改了 CSS / JS 但页面没变」**
先确认 `public/css` 下是不是堆了多份 fingerprint 文件，或者浏览器缓存了旧的 `site.js`。用 `node tools/build.mjs` 重来一遍。

**「统计静默失效，后台没数据」**
检查注入脚本的 `data-website-id` 是不是变成了带引号的字符串（形如 `"\"xxx\""`）。Hugo 的 `jsonify` 在 `<script>` 上下文会被二次转义，必须写成 `{{ .websiteId | jsonify | safeJS }}`。

**「流量卡一直加载中 / 401」**
Umami v3 需要 `x-umami-share-context: 1`，且 `umamiShareId` 必须是分享链接里 `/share/` 之后那一段。

**「欢迎卡转圈好几秒」**
60s IP 接口首访约 4 秒（接口本身慢，不是主题问题）。命中 localStorage 缓存后 0 请求。

**「鼠标下移进子菜单，菜单被收回」**
排查有没有 1px / 全宽的装饰层压在 `.nav-dropdown`（`z-index: 80`）之上。`#header-border` 已经加了 `pointer-events: none`；新增装饰元素时同理。

**「图标空白」**
忘了重跑子集化脚本。按[维护点第 1 条](#1-子集化三件套新增图标--文案后必须重跑)处理。

**「hugo server 报 bind: Only one usage of each socket address」**
上一个 hugo 进程没退干净。Windows 上 `taskkill /F /IM hugo.exe` 后再启动。

**「pagefind 索引缺失，搜索没结果」**
`npm ci` 没装成功，`pagefind` 不存在时构建脚本会回退 `npx`，离线环境会失败。检查 `node_modules/.bin/pagefind`。

---

## 十一、附录：组件清单

改东西前先在这两张表里定位文件，比全局搜索快。

### partials（`themes/kemiao/layouts/partials/`）

| 文件 | 职责 |
| --- | --- |
| `head.html` | head 全部内容：meta/OG/RSS、**样式合并唯一入口**、preconnect、统计注入 |
| `header.html` | 顶栏、下拉导航、顶栏功能按钮 |
| `footer.html` | 页脚、运行时长、备案、署名 |
| `backdrop.html` | 网格 + 噪点装饰层，并挂 snackbar / 右键菜单根节点 |
| `background-style.html` | 按 `params.background` 生成背景样式（内联 `<style>`） |
| `theme-script.html` | 防白闪 + 字体模式（含悠哉体按需注入） |
| `hero.html` | 首页终端风 Hero |
| `home-sidebar.html` | 首页右栏容器（决定四张卡是否渲染） |
| `post-sidebar.html` | 文章页右栏 |
| `welcome-card.html` | 欢迎来访者卡（IP 定位） |
| `traffic-card.html` | 流量数据卡（Umami 分享接口） |
| `webinfo-card.html` | 站点信息卡（不蒜子 PV/UV） |
| `post-card.html` / `post-grid-card.html` / `post-row-card.html` | 三种文章卡形态 |
| `post-header.html` | 文章标题区（含页面 PV/UV） |
| `post-footer.html` | 文章页脚：版权、上一篇/下一篇 |
| `shuoshuo-card.html` / `talk-card.html` | 说说卡片 |
| `comment-section.html` | 评论区容器（三后端 + 懒加载标记） |
| `control-console.html` | 中控台抽屉 |
| `floating-recent-comments.html` | 浮动最近评论（`provider = ecoku` 时不渲染） |
| `search-modal.html` | 搜索弹窗 |
| `music-capsule.html` | 音乐胶囊容器 |
| `mobile-drawer.html` / `mobile-toc.html` | 移动端抽屉菜单 / 目录 |
| `more-app-button.html` | 「应用列表」按钮（中控台入口之一） |
| `logo.html` / `logo-svg.html` | 站点 logo |
| `breadcrumb.html` / `page-hero.html` | 面包屑 / 内页头部 |

### layouts（`themes/kemiao/layouts/`）

| 文件 | 对应页面 |
| --- | --- |
| `_default/baseof.html` | 全站骨架（`#swup` 容器、脚本注入） |
| `_default/single.html` | 文章详情 |
| `_default/list.html` | 列表页通用 |
| `posts/list.html` | 文章列表（分页） |
| `_default/taxonomy.html` / `term.html` | 分类/标签总览 / 单标签页 |
| `_default/archives.html` | 归档 |
| `_default/about.html` | 关于（6 卡片） |
| `_default/link.html` / `addlink.html` | 友链 / 申请友链 |
| `_default/fcircle.html` | 友链朋友圈 |
| `_default/devices.html` | 我的设备 |
| `_default/rewards.html` | 打赏 / 赞赏榜 |
| `_default/subscribe.html` | 订阅 |
| `_default/comment.html` | 留言板 |
| `_default/search.html` | 独立搜索页 |
| `_default/safego.html` | 外链安全跳转 |
| `_default/shuoshuo.html` + `shuoshuo/single.html` | 说说列表 / 详情 |
| `_default/prose-hero.html` | 纯文本页头部 |

### JS 模块（`themes/kemiao/assets/js/`）

全部由 `site.js` 调度，不要单独引入。

| 模块 | 职责 |
| --- | --- |
| `site.js` | 唯一入口：全局初始化 + 每页管线 + `onPageReady` |
| `swup-router.js` | swup 配置、钩子、事件派发、head 同步 |
| `theme.js` / `site-preferences.js` | 主题切换 / 偏好存取 |
| `control-console.js` | 中控台行为 |
| `lightbox.js` | 全站灯箱（`openLightbox` / `openAnchorLightbox` / `initLightbox`） |
| `home.js` | 首页行为 |
| `article.js` | 文章页：TOC 规范化、scroll spy、阅读进度 |
| `aurora.js` | Hero 鼠标跟随与卡片极光/描边 |
| `outdate-notice.js` | 文章过期提示 |
| `page-extras.js` | 订阅复制、申请模板填充等小工具 |
| `snackbar.js` / `context-menu.js` | 站内消息条 / 右键菜单 |
| `search-modal.js` | 搜索弹窗开关与交互 |
| `search-page.js` | 独立搜索页 |
| `pagefind-ui.js` / `algolia-ui.js` | 两种搜索后端 |
| `comment-artalk.js` / `comment-twikoo.js` | 评论加载器（ecoku 用官方 loader） |
| `recent-comments.js` / `floating-recent-comments.js` | 最近评论数据 / 浮动面板 |
| `shuoshuo-local.js` / `shuoshuo-page.js` / `shuoshuo-tg.js` | 说说三种数据源 |
| `shuoshuo-tags.js` | 说说 #标签 共用处理 |
| `fcircle.js` / `friend-status.js` | 友链朋友圈 / 友链可达性 |
| `music-capsule.js` | 音乐胶囊（首次交互才加载） |
| `welcome-info.js` / `traffic-overview.js` | 两张侧栏卡的数据与渲染 |
| `safego.js` | 安全跳转页逻辑 |

---

## 十二、附录：推荐配置组合

按需加减，别一股脑全开——每开一项都是额外请求。

| 场景 | 建议配置 |
| --- | --- |
| **纯静态极简**<br>无统计、无评论 | `umami.enable = false`、`busuanzi.enable = false`、`musicCapsule.enable = false`、`pwa.enable = false`、`comments` 任意但不进文章页也行 |
| **标准个人博客**<br>（推荐起点） | `search.provider = pagefind`、`comments.provider = artalk`、`umami.enable = true`、`busuanzi.enable = true` |
| **全家桶** | 标准 + `traffic`（需 Umami 分享 ID）+ `musicCapsule` + `pwa` + `shuoshuo.source = tg` |

几个组合上的硬约束：

- **`traffic` 与 `umami` 相互独立**：流量卡读的是公开分享接口，即使不启用 `umami` 埋点也能显示（但没埋点就没数据）。反过来，`umamiBase` / `umamiShareId` 缺任一，整卡不渲染。
- **`comments.provider = ecoku` 时没有最近评论**：浮窗、中控台区块、按钮三处会自动不渲染，不用手动关。
- **`shuoshuo.source` 只能三选一**：`local` 走构建期渲染，`api` / `tg` 走运行时拉取。切到远程后 `content/shuoshuo/` 里的 md 不再参与渲染。
- **`icons.provider = local` 才用子集**：切 `cdn` 会加载完整的 FontAwesome CSS（约 73KB），但省掉维护子集的步骤。
- **`pwa.enable` 与资产强绑定**：没跑过 `gen-pwa-assets.py` 就置 false，否则一堆 404。

---

## 十三、致谢

- 视觉与交互设计参考自公开的静态博客主题实践，本主题为其 Hugo 方向的独立实现。
- 图标 [Font Awesome](https://fontawesome.com/)（Free 版，子集化使用）。
- 路由 [swup](https://swup.js.org/)。
- 搜索 [Pagefind](https://pagefind.app/)。
- 音乐 [APlayer](https://aplayer.js.org/) + [MetingJS](https://github.com/metingjs/Meting)。
- 访问统计 [Umami](https://umami.is/)、[soxft/busuanzi](https://github.com/soxft/busuanzi)。
