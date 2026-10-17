// 说说页：memos echo feed（1:1 源站 shuoshuo-core 数据流 + 卡片渲染子集：文本/图片/标签/链接卡）
import { stripTagsFromText } from "./shuoshuo-tags.js";
import { openAnchorLightbox } from "./lightbox.js";

const FEED = document.getElementById("shuoshuo-feed");

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function apiBase() {
  return {
    api: FEED?.dataset.api || "",
    mediaOrigin: FEED?.dataset.mediaOrigin || "",
    limit: Number(FEED?.dataset.limit) || 30,
    author: FEED?.dataset.author || "LiuShen",
    avatar: FEED?.dataset.avatar || "",
  };
}

function absUrl(u, origin) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return `${origin.replace(/\/+$/, "")}/${u.replace(/^\/+/, "")}`;
}

function fmtDate(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || !n) return "";
  const d = new Date(n < 1e10 ? n * 1e3 : n);
  if (Number.isNaN(d.getTime())) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function extractImages(item, origin) {
  const files = Array.isArray(item?.echo_files)
    ? item.echo_files
    : Array.isArray(item?.extension?.echo_files)
      ? item.extension.echo_files
      : Array.isArray(item?.files)
        ? item.files
        : [];
  return files
    .map((f) => (f && f.file ? f.file : f))
    .filter((f) => {
      const cat = String(f?.category || "").toLowerCase();
      const ct = String(f?.content_type || "").toLowerCase();
      return cat === "image" || ct.startsWith("image/") || (typeof f === "string" && /\.(png|jpe?g|webp|gif|avif)/i.test(f));
    })
    .map((f) => absUrl(String(f?.url || (typeof f === "string" ? f : "")), origin))
    .filter(Boolean);
}

function plainText(md) {
  return String(md || "")
    .replace(/#(.*?)\s/g, "")
    .replace(/\{.*?\}/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function inlineHtml(md) {
  let s = String(md || "")
    .replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" alt="" loading="lazy">')
    .replace(/\[([^\]]*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/^- \[x\] /gim, "☑ ")
    .replace(/^- \[ \] /gim, "☐ ")
    .replace(/^# (.+)$/gm, "")
    .replace(/\n/g, "<br>");
  return s;
}

function getTags(item) {
  return (Array.isArray(item?.tags) ? item.tags : [])
    .map((t) => (typeof t === "string" ? t : t?.name || ""))
    .map((t) => t.trim())
    .filter(Boolean);
}

function hostOf(u) {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

function repoName(u) {
  try {
    const p = new URL(u).pathname.split("/").filter(Boolean);
    return p.length >= 2 ? p.slice(0, 2).join("/") : p[0] || u;
  } catch {
    return u;
  }
}

function buildLinkPreview(extType, ext) {
  const pick = (k) => String(ext?.payload?.[k] || "");
  if (extType === "WEBSITE") {
    const url = pick("site") || pick("url");
    if (!url) return null;
    return { url, title: pick("title") || hostOf(url), subtitle: hostOf(url), badge: "网站", iconClass: "fa-solid fa-link" };
  }
  if (extType === "GITHUBPROJ") {
    const url = pick("repoUrl") || pick("url");
    if (!url) return null;
    return { url, title: pick("title") || repoName(url), subtitle: hostOf(url), badge: "GitHub", iconClass: "fa-brands fa-github" };
  }
  if (extType === "MUSIC") {
    const url = pick("url") || pick("link");
    if (!url) return null;
    return { url, title: pick("title") || "音乐链接", subtitle: hostOf(url), badge: "音乐", iconClass: "fa-solid fa-music" };
  }
  return null;
}

function mapItem(raw, author, avatar, origin) {
  const ext = (() => {
    try {
      return typeof raw.extension === "string" ? JSON.parse(raw.extension) : raw.extension || {};
    } catch {
      return {};
    }
  })();
  const links = extractImages(raw, origin);
  const extType = ext?.type || "";
  const createdAt = raw.createdTs ?? raw.created_at ?? raw.created;
  const tags = getTags(raw);
  const rawContent = String(raw.content || "").trim();
  // 标签已渲染成 pill，正文里省略同名 #xxx（避免同一信息出现两遍）。
  // 仅剥离「确实生成了 pill 的」标签；正文里其它 # 保持原样。
  const bodyContent = stripTagsFromText(rawContent, tags);
  return {
    id: raw.id || raw.uid || "",
    author: raw.username || (raw.author && (raw.author.name || raw.author.username)) || author,
    avatar: (raw.author && (raw.author.avatarUrl || raw.author.avatar)) || avatar,
    dateText: fmtDate(createdAt),
    createdAt,
    contentHtml: bodyContent ? inlineHtml(bodyContent) : "",
    contentPlain: bodyContent,
    images: links,
    tags,
    extType,
    detailUrl: `${origin.replace(/\/+$/, "")}/echo/${raw.id || raw.uid || ""}`,
    linkPreview: buildLinkPreview(extType, ext),
  };
}

function mediaGrid(item) {
  const { images, id, author } = item;
  if (!images.length) return null;
  const grid = el("div", "shuoshuo-media-grid");
  grid.dataset.layout = images.length === 1 ? "single" : images.length === 2 ? "pair" : images.length === 3 ? "triple" : images.length === 4 ? "quad" : "lead-grid";
  const group = `shuoshuo-${id}`;
  images.forEach((src, i) => {
    const a = el("a", "shuoshuo-media-link");
    a.href = src;
    a.dataset.shuoshuoFancybox = "true";
    a.dataset.fancybox = group;
    a.dataset.caption = "说说配图";
    a.dataset.layout = images.length === 1 ? "single" : images.length > 4 && i === 0 ? "lead" : "grid";
    const img = el("img", "shuoshuo-media-image");
    img.src = src;
    img.alt = author + (item.contentPlain ? " 的说说配图" : " 的图片");
    img.loading = "lazy";
    img.decoding = "async";
    a.append(img);
    grid.append(a);
  });
  return grid;
}

function externalCard(preview) {
  if (!preview) return null;
  const card = el("a", "shuoshuo-external-card");
  card.href = preview.url;
  card.target = "_blank";
  card.rel = "nofollow noopener noreferrer";
  const header = el("div", "shuoshuo-external-header");
  header.append(el("span", "shuoshuo-external-badge", preview.badge));
  const main = el("div", "shuoshuo-external-main");
  const icon = el("span", "shuoshuo-external-icon");
  icon.append(el("i", preview.iconClass));
  const body = el("span", "shuoshuo-external-body");
  body.append(el("span", "shuoshuo-external-title", preview.title), el("span", "shuoshuo-external-subtitle", preview.subtitle));
  const arrow = el("span", "shuoshuo-external-arrow");
  arrow.append(el("i", "fa-solid fa-arrow-up-right-from-square"));
  main.append(icon, body, arrow);
  card.append(header, main);
  return card;
}

function makeCard(item, mediaOrigin) {
  const card = el("article", "shuoshuo-card card-glow");
  card.dataset.shuoshuoCard = item.id;
  card.dataset.shuoshuoUrl = `${mediaOrigin}/echo/${item.id}`;
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
  if (item.dateText && item.createdAt) {
    time.dateTime = new Date(item.createdAt < 1e10 ? item.createdAt * 1e3 : item.createdAt).toISOString();
  }
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
  const ext = externalCard(item.linkPreview);
  if (ext) inner.append(ext);
  const footer = el("footer", "shuoshuo-card-footer");
  const tags = el("div", "shuoshuo-tags");
  const actions = el("div", "shuoshuo-card-actions");
  item.tags.forEach((t) => tags.append(el("span", "shuoshuo-pill", `# ${t}`)));
  if (!item.tags.length && item.extType) {
    const map = { WEBSITE: "网站", GITHUBPROJ: "GitHub", MUSIC: "音乐", VIDEO: "视频" };
    if (map[item.extType]) tags.append(el("span", "shuoshuo-pill shuoshuo-pill-accent", map[item.extType]));
  }
  const detail = el("a", "shuoshuo-action-button shuoshuo-detail-button");
  detail.href = `${mediaOrigin}/echo/${item.id}`;
  detail.target = "_blank";
  detail.rel = "nofollow noopener noreferrer";
  detail.title = "查看详情";
  detail.setAttribute("aria-label", "查看这条说说详情");
  detail.append(el("i", "fa-solid fa-arrow-up-right-from-square"));
  const reply = el("button", "shuoshuo-action-button shuoshuo-reply-button");
  reply.type = "button";
  reply.title = "回复这条说说";
  reply.setAttribute("aria-label", "回复这条说说");
  reply.append(el("i", "fa-solid fa-comment-dots"));
  reply.addEventListener("click", () => replyToShuoshuo(item));
  actions.append(detail, reply);
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

// 引用说说到评论框（逐行加引用前缀；原帖入口已有「查看详情」按钮，不再塞链接）
async function replyToShuoshuo(item) {
  const { quoteIntoComment } = await import("./context-menu.js");
  const lines = (item.contentPlain || "").split("\n").map((l) => `> ${l}`).join("\n");
  await quoteIntoComment(
    lines ? `${lines}\n\n` : "",
    lines
      ? "已将这条说说作为引用插入评论框，光标已定位到下方空行，可以直接继续输入回复内容。"
      : "这条说说没有文字内容，已在评论框定位到输入位置。"
  );
}

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

// 灯箱：统一走全局 lightbox 模块（分组翻页，对应源站 Fancybox 图片预览）
function initLightbox(root, signal) {
  root.querySelectorAll("[data-shuoshuo-fancybox='true']").forEach((a) => {
    if (a.dataset.siteLightbox === "true") return;
    a.dataset.siteLightbox = "true";
    a.style.cursor = "zoom-in";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openAnchorLightbox(a);
    }, { signal });
  });
}

async function loadFeed(signal) {
  if (!(FEED instanceof HTMLElement)) return;
  const cfg = apiBase();
  const countTarget = FEED.dataset.countId ? document.getElementById(FEED.dataset.countId) : null;
  FEED.replaceChildren();
  FEED.dataset.state = "loading";
  FEED.append(el("div", "shuoshuo-feed-state", "正在加载最近的说说..."));
  try {
    const res = await fetch(cfg.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: 1, pageSize: cfg.limit, search: "" }),
      signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const payload = await res.json();
    const rawItems = Array.isArray(payload?.data?.items) ? payload.data.items : Array.isArray(payload?.items) ? payload.items : [];
    const items = rawItems.slice(0, cfg.limit).map((r) => mapItem(r, cfg.author, cfg.avatar, cfg.mediaOrigin));
    if (countTarget) countTarget.textContent = `${items.length} 条说说`;
    if (!items.length) {
      FEED.dataset.state = "empty";
      FEED.replaceChildren(el("div", "shuoshuo-feed-state", "暂时还没有说说。"));
      return;
    }
    FEED.dataset.state = "ready";
    FEED.replaceChildren();
    const list = el("div", "shuoshuo-feed-list");
    list.dataset.reveal = "pending";
    items.forEach((item, i) => {
      const wrap = el("div", "shuoshuo-feed-item shuoshuo-feed-item-reveal");
      wrap.style.setProperty("--shuoshuo-reveal-index", String(Math.min(i, 12)));
      wrap.append(makeCard(item, cfg.mediaOrigin));
      list.append(wrap);
    });
    FEED.append(list);
    // 入场 reveal：下一帧置 ready 触发逐卡 fade-in（源站同款时序）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { list.dataset.reveal = "ready"; });
    });
    watchMasonry(list, signal);
    initLightbox(FEED, signal);
  } catch (e) {
    if (signal?.aborted) return;
    FEED.dataset.state = "error";
    FEED.replaceChildren(el("div", "shuoshuo-feed-state", "说说暂时加载失败，稍后再来看看吧。"));
    if (countTarget) countTarget.textContent = "加载失败";
  }
}

export function initShuoshuoPage(signal) {
  loadFeed(signal);
}
