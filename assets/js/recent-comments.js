// Artalk/Twikoo 最新评论（源站 recent-comments.js 移植）：抓取 + 过滤 + 表情还原 + 相对时间 + localStorage 缓存
// 注：Ecoku 没有公开的最近评论接口（见 DejavuMoe/Ecoku），provider=ecoku 时模板层不渲染任何宿主
const CACHE_PREFIX = "newest-comments-";
const CACHE_TTL = 7200 * 1000;
const FETCH_LIMIT = 20;
const DISPLAY_LIMIT = 4;
const CONTENT_MAX = 150;
const EMOTICON_TOKEN_PREFIX = "__RECENT_COMMENT_EMOTICON_";
const EMOTICON_TOKEN_RE = /__RECENT_COMMENT_EMOTICON_(\d+)__/g;

function escapeHtml(v) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function decodeEntities(v) {
  return v.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attrValue(html, attr) {
  const m = html.match(new RegExp(`\\s${attr}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>=]+)))?`, "i"));
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "") : "";
}

function hasAttr(html, attr) {
  return new RegExp(`\\s${attr}(?:\\s|=|/?>)`, "i").test(html);
}

function safeUrl(url, base) {
  if (!url.trim()) return "";
  try {
    const u = new URL(url, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

function extractEmoticon(imgHtml, origin) {
  if (!hasAttr(imgHtml, "atk-emoticon")) return null;
  const src = safeUrl(attrValue(imgHtml, "src"), origin);
  if (!src) return null;
  return { src, alt: attrValue(imgHtml, "atk-emoticon") || attrValue(imgHtml, "alt") || "表情" };
}

function collectEmoticons(content, origin) {
  const emoticons = [];
  const replaced = content
    .replace(/<pre><code>[\s\S]*?<\/code><\/pre>/gi, "[代码]")
    .replace(/<code>[\s\S]*?<\/code>/gi, "[代码]")
    .replace(/<img\b[^>]*>/gi, (img) => {
      const item = extractEmoticon(img, origin);
      return item ? ` ${EMOTICON_TOKEN_PREFIX}${emoticons.push(item) - 1}__ ` : "[图片]";
    })
    .replace(/<a[^>]*>.*?<\/a>/gi, "[链接]")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { content: replaced, emoticons };
}

function renderWithEmoticons(text, emoticons) {
  const parts = [];
  let used = 0;
  let last = 0;
  const pushText = (chunk) => {
    if (!chunk || used >= CONTENT_MAX) return;
    const slice = chunk.slice(0, CONTENT_MAX - used);
    used += slice.length;
    parts.push(escapeHtml(slice));
  };
  const withTokens = text.replace(EMOTICON_TOKEN_RE, (token, index, offset) => {
    pushText(text.slice(last, offset));
    const item = emoticons[Number(index)];
    if (item && used < CONTENT_MAX) {
      parts.push(`<img class="recent-comment-emoticon" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async">`);
      used += 1;
    }
    last = offset + token.length;
    return token;
  });
  pushText(withTokens.slice(last));
  return parts.join("").trim();
}

function summarize(content, origin) {
  if (!content) return { content: "", contentHtml: "" };
  const { content: plain, emoticons } = collectEmoticons(content, origin);
  return {
    content: plain.replace(EMOTICON_TOKEN_RE, "[表情]").slice(0, CONTENT_MAX),
    contentHtml: renderWithEmoticons(plain, emoticons),
  };
}

function gravatarUrl(conf, email) {
  if (!email) return "";
  const gravatar = conf.frontend_conf?.gravatar;
  const mirror = gravatar?.mirror || "https://cravatar.cn/avatar/";
  const params = gravatar?.params || gravatar?.default || "mp";
  const dParam = params.startsWith("d=") ? params : `d=${params}`;
  try {
    const base = mirror.endsWith("/") ? mirror : `${mirror}/`;
    const url = new URL(encodeURIComponent(email), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.search = dParam;
    return url.href;
  } catch {
    return "";
  }
}

function normalizeKey(key) {
  const trimmed = key.replace(/\/index\.html$/, "");
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function pageUrl(url, origin) {
  try {
    return new URL(url, origin);
  } catch {
    return new URL("/", origin);
  }
}

function sameSite(url, origin) {
  try {
    return pageUrl(url, origin).hostname === new URL(origin).hostname;
  } catch {
    return false;
  }
}

function commentIdOf(item, origin) {
  if (typeof item.id === "number" && Number.isFinite(item.id)) return item.id;
  const id = Number(pageUrl(item.page_url, origin).searchParams.get("atk_comment"));
  return Number.isFinite(id) && id > 0 ? id : null;
}

function mapComment(item, conf, origin) {
  const url = pageUrl(item.page_url, origin);
  const id = commentIdOf(item, origin);
  const summary = summarize(item.content_marked, origin);
  return {
    nick: item.nick,
    avatar: gravatarUrl(conf, item.email_encrypted),
    content: summary.content,
    contentHtml: summary.contentHtml,
    url: url.href,
    pagePath: normalizeKey(url.pathname),
    commentId: id,
    anchor: id ? `atk-comment-${id}` : "comment-section",
    date: item.date,
  };
}

function sortComments(list) {
  return [...list].sort((a, b) => {
    const delta = new Date(b.date).getTime() - new Date(a.date).getTime();
    return delta !== 0 ? delta : (b.commentId ?? 0) - (a.commentId ?? 0);
  });
}

export function relativeTime(value) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}个月前`;
  return `${Math.floor(months / 12)}年前`;
}

function latestRequest(server, site, limit) {
  return {
    url: `${server}/api/v2/stats/latest_comments?${new URLSearchParams({ site_name: site, limit: String(limit) })}`,
    extract: (data) => {
      const list = data?.data;
      return Array.isArray(list) ? list : [];
    },
  };
}

async function fetchMapped(request, server, siteOrigin, fetchLimit, authorFilter) {
  const [commentsRes, confRes] = await Promise.all([
    fetch(request.url),
    fetch(`${server}/api/v2/conf`),
  ]);
  const commentsData = await commentsRes.json();
  const conf = await confRes.json();
  return sortComments(
    request.extract(commentsData)
      .filter((item) => !authorFilter || item.nick !== authorFilter)
      .filter((item) => sameSite(item.page_url, siteOrigin))
      .slice(0, Math.min(fetchLimit, FETCH_LIMIT))
      .map((item) => mapComment(item, conf, siteOrigin))
  );
}

// ---- Twikoo：POST { event: "GET_RECENT_COMMENT" } ----
async function fetchTwikoo({ envId, siteOrigin, fetchLimit, authorFilter }) {
  const res = await fetch(envId, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "GET_RECENT_COMMENT" }),
  });
  const payload = await res.json();
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return sortComments(
    list
      .filter((item) => !authorFilter || item.nick !== authorFilter)
      .slice(0, Math.min(fetchLimit, FETCH_LIMIT))
      .map((item) => {
        const link = safeUrl(item.href || item.url || "", siteOrigin);
        const summary = summarize(item.content || "", siteOrigin);
        const created = item.created ? new Date(typeof item.created === "number" ? item.created : String(item.created)) : null;
        return {
          nick: item.nick || "匿名访客",
          avatar: item.avatar || "",
          content: summary.content,
          contentHtml: summary.contentHtml,
          url: link || siteOrigin,
          pagePath: normalizeKey(link || siteOrigin),
          commentId: null,
          anchor: "comment-section",
          date: created && !Number.isNaN(created.getTime()) ? created.toISOString() : "",
        };
      })
  );
}

// ---- localStorage 缓存（站点级，TTL 内复用；按 provider 分键） ----
function readCache(provider) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + provider);
    if (!raw) return { ts: 0, data: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ts: 0, data: [] };
    return {
      ts: typeof parsed.ts === "number" ? parsed.ts : 0,
      data: Array.isArray(parsed.data) ? parsed.data : [],
    };
  } catch {
    return { ts: 0, data: [] };
  }
}

function writeCache(provider, entry) {
  try {
    localStorage.setItem(CACHE_PREFIX + provider, JSON.stringify(entry));
  } catch {
    // 忽略写入失败
  }
}

export async function fetchLatestComments({
  provider = "artalk",
  server = "",
  site = "",
  envId = "",
  authorFilter = "",
  displayLimit = DISPLAY_LIMIT,
  fetchLimit = FETCH_LIMIT,
  siteOrigin,
}) {
  const now = Date.now();
  const cache = readCache(provider);
  if (cache.data.length && now - cache.ts <= CACHE_TTL) {
    return sortComments(cache.data).slice(0, displayLimit);
  }
  let list;
  if (provider === "twikoo") {
    if (!envId) throw new Error("twikoo envId missing");
    list = await fetchTwikoo({ envId, siteOrigin, fetchLimit, authorFilter });
  } else {
    if (!server || !site) throw new Error("artalk server/site missing");
    list = await fetchMapped(latestRequest(server, site, fetchLimit), server, siteOrigin, fetchLimit, authorFilter);
  }
  writeCache(provider, { ts: now, data: list });
  return list.slice(0, displayLimit);
}
