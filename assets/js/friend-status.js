// 友链可达性状态：1:1 源站 friend-link-status 模块（fc.link.json → 状态标签）
function normalize(url) {
  if (typeof url !== "string" || !url.trim()) return "";
  try {
    const u = new URL(url.trim());
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${path === "/" ? "" : path}${u.search}`;
  } catch {
    return url.trim().replace(/\/+$/, "").toLowerCase();
  }
}

function buildIndex(data) {
  const rows = Array.isArray(data?.link_data) ? data.link_data.filter((x) => typeof x === "object" && x && "link" in x) : [];
  const map = new Map();
  for (const row of rows) {
    const key = normalize(row.link);
    if (key) map.set(key, row);
  }
  return map;
}

function checkedTime(row) {
  const s = (typeof row?.statistical_data === "object" && row.statistical_data) || (typeof row?.statical_data === "object" && row.statical_data) || null;
  return s ? String(s.link_last_checked_time || "") : "";
}

function statusView(row) {
  if (!row) return null;
  if (row.reachable === false) {
    const fails = Number(row.fail_count) || 0;
    return {
      className: "friend-status-tag--down",
      label: "不可达",
      title: fails > 0 ? `最近检测不可达，连续失败 ${fails} 次` : "最近检测不可达",
    };
  }
  if (row.reachable !== true) return null;
  const latency = Number(row.latency);
  if (latency === null || !Number.isFinite(latency) || latency < 0) {
    return { className: "friend-status-tag--ok", label: "可达", title: "最近检测可达" };
  }
  const label = latency < 1 ? `${Math.round(latency * 1e3)} MS` : `${latency.toFixed(latency >= 10 ? 0 : 1)} S`;
  if (latency <= 1) return { className: "friend-status-tag--fast", label, title: `最近检测可达，响应约 ${Math.round(latency * 1e3)} ms` };
  if (latency <= 3) return { className: "friend-status-tag--ok", label, title: `最近检测可达，响应约 ${Math.round(latency * 1e3)} ms` };
  return { className: "friend-status-tag--slow", label, title: `最近检测可达，但响应偏慢，约 ${Math.round(latency * 1e3)} ms` };
}

function apply(root, data) {
  const index = buildIndex(data);
  root.querySelectorAll(".friend-status-tag").forEach((t) => t.remove());
  root.querySelectorAll(".friend-card-status-ready").forEach((c) => c.classList.remove("friend-card-status-ready"));
  const cards = Array.from(root.querySelectorAll(".friend-card[data-href]"));
  let i = 0;
  for (const card of cards) {
    const view = statusView(index.get(normalize(card.dataset.href)));
    if (!view) continue;
    card.classList.add("friend-card-status-ready");
    const tag = document.createElement("span");
    tag.className = `friend-status-tag ${view.className}`;
    tag.textContent = view.label;
    tag.title = view.title;
    tag.setAttribute("aria-label", view.title);
    tag.style.setProperty("--friend-status-delay", `${Math.min(i, 12) * 34}ms`);
    card.append(tag);
    i += 1;
  }
}

async function refresh(signal) {
  const root = document;
  const cards = root.querySelectorAll(".friend-card[data-href]");
  if (!cards.length) return;
  const statusApi = document.querySelector("[data-fc-status-api]")?.dataset.fcStatusApi || "";
  if (!statusApi) return;
  try {
    const res = await fetch(statusApi, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    apply(root, await res.json());
  } catch (e) {
    if (e?.name === "AbortError") return;
  }
}

// 卡片整卡可点（头像角标链接触发默认行为）
export function initLinkPage(signal) {
  const grids = document.querySelectorAll(".friend-card[data-href]");
  grids.forEach((card) => {
    if (card.dataset.bound) return;
    card.dataset.bound = "1";
    card.addEventListener("click", (e) => {
      if (e.target.closest(".friend-avatar-overlay")) return;
      window.open(card.dataset.href, "_blank", "noopener,noreferrer");
    }, { signal });
  });
  refresh(signal);
}
