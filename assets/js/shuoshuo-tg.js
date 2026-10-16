// 说说页 · tg 数据源（koharu-suite / Telegram 频道归档）
//
// 接口契约（见 koharu-suite/packages/koharu-astro/src/client.ts）：
//   GET {baseUrl}/api/v1/messages/latest?channel=<uuid>&limit=N[&cursor=<nextCursor>]
//   → { items: PublicMessage[], nextCursor: string|null }
//   PublicMessage = {
//     id, publishedAt (canonical UTC, 形如 2026-10-08T16:54:06.000Z), sourceUrl (t.me 原帖),
//     content: { kind: 'text'|'caption'|'none', text: string|null, html: string|null, entities: [] },
//     media: [{ kind: 'photo'|'video'|'audio'|'voice'|'animation'|'document',
//               originalUrl: '/api/v1/media/<uuid>'|null, thumbnailUrl: ...|null,
//               width, height, mimeType, cacheStatus }],
//   }
//
// 设计要点：
// - 渲染出的 DOM 与 shuoshuo-card.html（本地源）**逐类名对齐**，因此瀑布流 / 灯箱 / 卡片光斑 /
//   回复引用全部复用既有 site.css，无需为卡片新增样式（仅分页控件是本模块新增）。
// - 分页用 nextCursor 游标，点「加载更多」追加一页；每页条数由 [params.shuoshuo.tg].pageSize 配置。
// - 图片：网格用 thumbnailUrl 缩略图，灯箱用 originalUrl 大图，均由 baseUrl 解析成绝对地址。

const FEED = document.getElementById("shuoshuo-feed");

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function readConfig() {
  const d = FEED.dataset;
  return {
    baseUrl: (d.tgBase || "").replace(/\/+$/, ""),
    channelId: d.tgChannel || "",
    pageSize: Math.max(1, Number(d.tgPageSize) || 12),
    author: d.author || "LiuShen",
    avatar: d.avatar || "",
    detailLink: d.tgDetailLink !== "false",
  };
}

/** 把 suite 的相对媒体路径解析成绝对 URL（同 koharu-astro resolveUrl 语义） */
function resolveMedia(path, baseUrl) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("//")) return `https:${path}`;
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** UTC ISO → 本地「YYYY-MM-DD HH:mm」 */
function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * #标签 处理（抽取 + 从正文省略）统一走 shuoshuo-tags.js，
 * 与 api 数据源共用同一套规则，避免两处实现漂移。
 */
import {
  extractTags,
  stripTagsFromText,
  stripTagsFromHtml,
} from "./shuoshuo-tags.js";

// 注意：innerHTML 解析后 tagName 恒为大写，故用 "TG-SPOILER" 而非 "TG_SPOILER"
const ALLOWED_TAGS = new Set([
  "A", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "INS", "MARK",
  "CODE", "PRE", "SPAN", "BR", "P", "DIV",
  "BLOCKQUOTE", "UL", "OL", "LI",
  "TG-SPOILER", "TG-EMOJI", "TG-MENTION",
]);
const SAFE_SCHEMES = /^(https?:|mailto:|tg:)/i;

/** 白名单清洗：非白名单标签降级为纯文本，属性只留 a[href] 与 class */
function sanitize(html) {
  if (!html) return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(document.createTextNode(child.textContent || ""));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const keep = name === "class" || (child.tagName === "A" && name === "href");
        if (!keep) {
          child.removeAttribute(attr.name);
          continue;
        }
        if (name === "href" && !SAFE_SCHEMES.test(attr.value.trim())) child.removeAttribute("href");
      }
      if (child.tagName === "A" && child.getAttribute("href")) {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "nofollow noopener noreferrer");
      }
      walk(child);
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/** PublicMessage → 卡片视图模型 */
function mapMessage(raw, c) {
  const content = raw.content || {};
  const text = content.text || "";
  const media = Array.isArray(raw.media) ? raw.media : [];

  const images = media
    .filter((m) => m.kind === "photo" || m.kind === "animation")
    .map((m) => ({
      thumb: resolveMedia(m.thumbnailUrl || m.originalUrl, c.baseUrl),
      full: resolveMedia(m.originalUrl || m.thumbnailUrl, c.baseUrl),
      width: m.width,
      height: m.height,
    }))
    .filter((m) => m.thumb || m.full);

  const videos = media
    .filter((m) => m.kind === "video")
    .map((m) => resolveMedia(m.originalUrl, c.baseUrl))
    .filter(Boolean);

  const audios = media
    .filter((m) => m.kind === "audio" || m.kind === "voice")
    .map((m) => resolveMedia(m.originalUrl, c.baseUrl))
    .filter(Boolean);

  const tags = extractTags(text);
  // 正文省略已被渲染成标签 pill 的 #xxx，避免同一信息出现两遍
  const bodyText = stripTagsFromText(text, tags);
  const rawHtml = content.html || (text ? escapeText(text) : "");
  const bodyHtml = stripTagsFromHtml(sanitize(rawHtml), tags);

  return {
    id: raw.id || "",
    author: c.author,
    avatar: c.avatar,
    dateText: fmtDate(raw.publishedAt),
    publishedAt: raw.publishedAt || "",
    contentHtml: bodyHtml,
    contentPlain: bodyText,
    images,
    videos,
    audios,
    tags,
    detailUrl: raw.sourceUrl || "",
  };
}

// ── 卡片 DOM（类名与 shuoshuo-card.html 严格一致）──────────────────────

function mediaGrid(item) {
  if (!item.images.length) return null;
  const n = item.images.length;
  const grid = el("div", "shuoshuo-media-grid");
  grid.dataset.layout = n === 1 ? "single" : n === 2 ? "pair" : n === 3 ? "triple" : n === 4 ? "quad" : "lead-grid";
  const group = `shuoshuo-${item.id}`;
  item.images.forEach((m, i) => {
    const a = el("a", "shuoshuo-media-link");
    a.href = m.full || m.thumb;
    a.dataset.shuoshuoFancybox = "true";
    a.dataset.fancybox = group;
    a.dataset.caption = "说说配图";
    a.dataset.layout = n === 1 ? "single" : n > 4 && i === 0 ? "lead" : "grid";
    const img = el("img", "shuoshuo-media-image");
    img.src = m.thumb || m.full;
    img.alt = `${item.author} 的说说配图`;
    img.loading = "lazy";
    img.decoding = "async";
    if (m.width) img.width = m.width;
    if (m.height) img.height = m.height;
    a.append(img);
    grid.append(a);
  });
  return grid;
}

function makeCard(item, c) {
  const card = el("article", "shuoshuo-card card-glow");
  card.dataset.shuoshuoCard = item.id;
  card.dataset.shuoshuoUrl = item.detailUrl || "/shuoshuo/";
  const glow = el("div", "shuoshuo-card-glow card-glow-effect");
  glow.setAttribute("aria-hidden", "true");
  const inner = el("div", "shuoshuo-card-inner");

  const header = el("header", "shuoshuo-card-header");
  const avatar = el("img", "shuoshuo-avatar");
  avatar.src = item.avatar;
  avatar.alt = `${item.author} 的头像`;
  avatar.loading = "lazy";
  avatar.decoding = "async";
  const meta = el("div", "shuoshuo-meta");
  meta.append(el("div", "shuoshuo-author", item.author));
  const time = el("time", "shuoshuo-date", item.dateText);
  if (item.publishedAt) time.dateTime = item.publishedAt;
  meta.append(time);
  header.append(avatar, meta);
  inner.append(header);

  if (item.contentHtml) {
    const text = el("div", "shuoshuo-text");
    text.innerHTML = item.contentHtml;
    inner.append(text);
  }

  const grid = mediaGrid(item);
  if (grid) inner.append(grid);

  item.videos.forEach((src) => {
    const box = el("div", "shuoshuo-video");
    const v = el("video", "shuoshuo-video-player");
    v.src = src;
    v.controls = true;
    v.preload = "metadata";
    v.playsInline = true;
    box.append(v);
    inner.append(box);
  });
  item.audios.forEach((src) => {
    const box = el("div", "shuoshuo-video");
    const a = el("audio", "shuoshuo-video-player");
    a.src = src;
    a.controls = true;
    a.preload = "metadata";
    box.append(a);
    inner.append(box);
  });

  const footer = el("footer", "shuoshuo-card-footer");
  const tags = el("div", "shuoshuo-tags");
  item.tags.forEach((t) => tags.append(el("span", "shuoshuo-pill", `# ${t}`)));
  const actions = el("div", "shuoshuo-card-actions");
  if (c.detailLink && item.detailUrl) {
    const detail = el("a", "shuoshuo-action-button shuoshuo-detail-button");
    detail.href = item.detailUrl;
    detail.target = "_blank";
    detail.rel = "nofollow noopener noreferrer";
    detail.title = "在 Telegram 查看原帖";
    detail.setAttribute("aria-label", "在 Telegram 查看这条说说的原帖");
    detail.append(el("i", "fa-solid fa-arrow-up-right-from-square"));
    actions.append(detail);
  }
  const reply = el("button", "shuoshuo-action-button shuoshuo-reply-button");
  reply.type = "button";
  reply.title = "回复这条说说";
  reply.setAttribute("aria-label", "回复这条说说");
  reply.append(el("i", "fa-solid fa-comment-dots"));
  reply.addEventListener("click", () => replyToShuoshuo(item));
  actions.append(reply);
  footer.append(tags, actions);
  inner.append(footer);

  card.append(glow, inner);
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
  });
  return card;
}

async function replyToShuoshuo(item) {
  const { quoteIntoComment } = await import("./context-menu.js");
  const lines = (item.contentPlain || "").split("\n").map((l) => `> ${l}`).join("\n");
  // 只引用正文；原帖入口已有「查看详情」按钮，不再往评论框里塞链接
  await quoteIntoComment(
    lines ? `${lines}\n\n` : "",
    lines
      ? "已将这条说说作为引用插入评论框，光标已定位到下方空行，可以直接继续输入回复内容。"
      : "这条说说没有文字内容，已在评论框定位到输入位置。"
  );
}

// ── 瀑布流 / 灯箱（与 shuoshuo-local.js 同款）──────────────────────────

function columns() {
  const w = window.innerWidth;
  return w >= 1280 ? 3 : w >= 720 ? 2 : 1;
}

function masonry(list, cols) {
  const items = Array.from(list.querySelectorAll(":scope > .shuoshuo-feed-item"));
  if (!items.length) return;
  if (cols <= 1) {
    list.style.height = "";
    items.forEach((i) => {
      i.style.position = "";
      i.style.width = "";
      i.style.transform = "";
    });
    return;
  }
  const gap = parseFloat(getComputedStyle(list).rowGap) || 16;
  const w = (list.clientWidth - gap * (cols - 1)) / cols;
  const heights = Array(cols).fill(0);
  items.forEach((item) => {
    item.style.position = "absolute";
    item.style.width = `${w}px`;
    let min = 0;
    for (let c = 1; c < cols; c++) if (heights[c] < heights[min]) min = c;
    item.style.transform = `translate3d(${min * (w + gap)}px,${heights[min]}px,0)`;
    heights[min] += item.offsetHeight + gap;
  });
  list.style.height = `${Math.max(...heights) - gap}px`;
}

function watchMasonry(list, signal) {
  const relayout = () => masonry(list, columns());
  relayout();
  window.addEventListener("resize", () => requestAnimationFrame(relayout), { signal });
  list.addEventListener(
    "load",
    (e) => {
      if (e.target?.tagName === "IMG") setTimeout(relayout, 200);
    },
    { capture: true, signal }
  );
}

/** 灯箱：事件委托，后追加的卡片自动生效 */
function initLightbox(root, signal) {
  const overlay = el("div", "shuoshuo-lightbox");
  overlay.hidden = true;
  const img = el("img");
  overlay.append(img);
  overlay.addEventListener(
    "click",
    () => {
      overlay.classList.remove("is-open");
      setTimeout(() => (overlay.hidden = true), 200);
    },
    { signal }
  );
  document.body.append(overlay);
  root.addEventListener(
    "click",
    (e) => {
      const a = e.target instanceof Element && e.target.closest("[data-shuoshuo-fancybox='true']");
      if (!a) return;
      e.preventDefault();
      img.src = a.getAttribute("href") || "";
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add("is-open"));
    },
    { signal }
  );
}

// ── 拉取 + 游标分页 ───────────────────────────────────────────────────

function endpoint(c, cursor) {
  const u = new URL(`${c.baseUrl}/api/v1/messages/latest`);
  u.searchParams.set("channel", c.channelId);
  u.searchParams.set("limit", String(c.pageSize));
  if (cursor) u.searchParams.set("cursor", cursor);
  return u.toString();
}

async function fetchPage(c, cursor, signal) {
  const res = await fetch(endpoint(c, cursor), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`tg-api ${res.status}`);
  const payload = await res.json();
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    nextCursor: payload?.nextCursor || null,
  };
}

export function initShuoshuoPage(signal) {
  if (!(FEED instanceof HTMLElement)) return;

  const c = readConfig();
  if (!c.baseUrl || !c.channelId) {
    FEED.dataset.state = "error";
    FEED.replaceChildren(el("div", "shuoshuo-feed-state", "tg 数据源未配置 baseUrl / channelId。"));
    return;
  }

  let list = null;
  let cursor = null;
  let loading = false;
  let finished = false;

  // 分页控件（常驻，不随 replaceChildren 丢失）
  const moreHost = el("div", "shuoshuo-more-host");
  const moreWrap = el("div", "shuoshuo-more-wrap");
  const moreBtn = el("button", "shuoshuo-more-button");
  moreBtn.type = "button";
  moreBtn.append(el("span", "shuoshuo-more-label", "加载更多"));
  const spinner = el("i", "fa-solid fa-circle-notch shuoshuo-more-spinner");
  spinner.setAttribute("aria-hidden", "true");
  moreBtn.append(spinner);
  const status = el("p", "shuoshuo-more-status");
  status.setAttribute("aria-live", "polite");
  moreWrap.append(moreBtn, status);
  moreHost.append(moreWrap);

  const setMore = (state, text) => {
    moreBtn.dataset.state = state;
    moreBtn.disabled = state === "loading";
    status.textContent = text || "";
  };

  function ensureList() {
    if (list) return list;
    FEED.replaceChildren();
    list = el("div", "shuoshuo-feed-list");
    list.dataset.reveal = "pending";
    FEED.append(list, moreHost);
    return list;
  }

  async function loadMore() {
    if (loading || finished) return;
    loading = true;
    setMore("loading", "正在加载...");
    try {
      const page = await fetchPage(c, cursor, signal);
      if (signal?.aborted) return;
      const l = ensureList();
      const start = l.children.length;
      page.items.forEach((raw, i) => {
        const wrap = el("div", "shuoshuo-feed-item shuoshuo-feed-item-reveal");
        wrap.style.setProperty("--shuoshuo-reveal-index", String(Math.min(start + i, 12)));
        wrap.append(makeCard(mapMessage(raw, c), c));
        l.append(wrap);
      });
      cursor = page.nextCursor;

      if (!FEED.dataset.masonryReady) {
        FEED.dataset.masonryReady = "1";
        watchMasonry(l, signal);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            l.dataset.reveal = "ready";
          });
        });
      } else {
        masonry(l, columns());
      }

      if (!page.nextCursor || page.items.length === 0) {
        finished = true;
        setMore("end", "没有更多了");
        moreBtn.hidden = true;
      } else {
        setMore("idle", "");
      }
      FEED.dataset.state = "ready";
    } catch (e) {
      if (signal?.aborted) return;
      if (!list) {
        FEED.dataset.state = "error";
        FEED.replaceChildren(el("div", "shuoshuo-feed-state", "说说暂时加载失败，稍后再来看看吧。"));
        return;
      }
      setMore("error", "加载失败，点此重试");
    } finally {
      loading = false;
    }
  }

  moreBtn.addEventListener(
    "click",
    () => {
      if (moreBtn.dataset.state === "error") {
        setMore("idle", "");
        loadMore();
        return;
      }
      loadMore();
    },
    { signal }
  );

  FEED.dataset.state = "loading";
  initLightbox(FEED, signal);
  loadMore();
}
