// 流量数据卡（首页右栏 / 文章侧栏共用）：Umami 公开分享接口取数
// 数据链路：GET {base}/api/share/{shareId} → {websiteId, token}
//           GET {base}/api/websites/{websiteId}/stats?startAt&endAt      (x-umami-share-token)
//           GET {base}/api/websites/{websiteId}/pageviews?unit=hour      (x-umami-share-token)
// Umami 不记录字节流量/请求数/响应耗时，因此三个指标对应：浏览量 / 访客数 / 平均停留。
const CACHE_KEY = "umami-traffic-v1";
const DEFAULT_TTL = 3600;
const DEFAULT_TZ = "Asia/Shanghai";
const WINDOW_MS = 24 * 60 * 60 * 1000;
const WAVE_WIDTH = 220;
const WAVE_POINTS = 24;

function readCache(ttlSeconds) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== "number" || !parsed.data) return null;
    if (Date.now() - parsed.ts > ttlSeconds * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // 忽略写入失败
  }
}

function setStatus(card, text) {
  const el = card.querySelector("[data-traffic-status]");
  if (el) el.textContent = text;
}

function setValue(card, selector, text) {
  const el = card.querySelector(selector);
  if (el) el.textContent = text;
}

function formatCount(value) {
  return Math.max(0, Math.round(value || 0)).toLocaleString("zh-CN");
}

// 秒 → “1分20秒” / “45秒”
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  if (total < 60) return `${total}秒`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m}分${s}秒` : `${m}分`;
}

// 时间序列降采样到 24 个点并映射到 220×56 的 SVG 画布
function drawWaveform(card, series) {
  const line = card.querySelector("[data-traffic-waveform-line]");
  if (!(line instanceof SVGElement)) return;
  const values = (Array.isArray(series) ? series : []).map((item) => Number(item?.y ?? item?.value ?? 0) || 0);
  // 无数据：画一条贴底的平线，避免保留模板里的假波形
  if (values.length < 2) {
    line.setAttribute("points", `0,48 ${WAVE_WIDTH},48`);
    return;
  }
  const step = Math.max(1, Math.floor(values.length / WAVE_POINTS));
  const sampled = [];
  for (let i = 0; i < values.length; i += step) {
    const slice = values.slice(i, i + step);
    sampled.push(slice.reduce((sum, v) => sum + v, 0) / slice.length);
  }
  if (sampled.length < 2) return;
  const max = Math.max(...sampled);
  const min = Math.min(...sampled);
  const span = Math.max(max - min, 1);
  const points = sampled
    .map((v, i) => {
      const x = (i / (sampled.length - 1)) * WAVE_WIDTH;
      const y = 48 - ((v - min) / span) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  line.setAttribute("points", points);
}

function render(card, data) {
  setValue(card, "[data-traffic-value]", formatCount(data.pageviews));
  setValue(card, "[data-request-value]", formatCount(data.visitors));
  const avg = data.visits > 0 ? data.totaltime / data.visits : 0;
  setValue(card, "[data-response-value]", formatDuration(avg));
  drawWaveform(card, data.series);
  setStatus(card, "已更新");
}

async function fetchJson(url, headers, signal) {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal });
  if (!res.ok) throw new Error(`umami api failed: ${res.status}`);
  return res.json();
}

async function fetchTraffic({ base, share, tz }, signal) {
  const now = Date.now();
  const startAt = now - WINDOW_MS;
  const shareInfo = await fetchJson(`${base}/api/share/${encodeURIComponent(share)}`, {}, signal);
  const websiteId = shareInfo.websiteId || shareInfo.website?.id;
  const token = shareInfo.token;
  if (!websiteId || !token) throw new Error("umami share info incomplete");

  // v3 起分享态请求必须同时带 share-context，否则 401
  const auth = { "x-umami-share-token": token, "x-umami-share-context": "1" };
  const statsUrl = `${base}/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${now}&timezone=${encodeURIComponent(tz)}`;
  const viewsUrl = `${base}/api/websites/${websiteId}/pageviews?startAt=${startAt}&endAt=${now}&unit=hour&timezone=${encodeURIComponent(tz)}`;

  const [stats, views] = await Promise.all([
    fetchJson(statsUrl, auth, signal),
    fetchJson(viewsUrl, auth, signal).catch(() => ({})),
  ]);

  const series = Array.isArray(views?.pageviews) ? views.pageviews : Array.isArray(views) ? views : [];
  return {
    pageviews: Number(stats.pageviews) || 0,
    visitors: Number(stats.visitors) || 0,
    visits: Number(stats.visits) || 0,
    totaltime: Number(stats.totaltime) || 0,
    series,
  };
}

export async function initTrafficOverview(signal) {
  const card = document.querySelector("[data-traffic-card]");
  if (!(card instanceof HTMLElement) || card.dataset.loaded === "true") return;
  card.dataset.loaded = "true";

  const base = (card.dataset.umamiBase || "").replace(/\/+$/, "");
  const share = card.dataset.umamiShare || "";
  if (!base || !share) {
    setStatus(card, "未配置");
    return;
  }

  const ttl = Number(card.dataset.cacheTtl) || DEFAULT_TTL;
  const tz = card.dataset.timezone || DEFAULT_TZ;
  const cached = readCache(ttl);
  if (cached) {
    render(card, cached);
    return;
  }

  try {
    const data = await fetchTraffic({ base, share, tz }, signal);
    if (signal?.aborted) return;
    writeCache(data);
    render(card, data);
  } catch {
    if (signal?.aborted) return;
    setStatus(card, "离线");
  }
}
