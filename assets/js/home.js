// 首页行为（阶段②）· 1:1 移植源站 home.js / home-ticker.js / webinfo.js
// 赞赏者轮播 2.8s、说说跑马灯 3s、网站信息相对时间、卡片光斑跟随

function initPatronCarousel(signal) {
  const card = document.querySelector("[data-patron-card]");
  if (!card) return;
  const slides = Array.from(card.querySelectorAll("[data-patron-slide]"));
  if (slides.length <= 1) return;
  let idx = Math.max(slides.findIndex((s) => s.classList.contains("patron-slide-active")), 0);
  let timer = null;
  const stop = () => { if (timer) { window.clearInterval(timer); timer = null; } };
  const show = (n) => {
    idx = (n + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("patron-slide-active", i === idx));
  };
  const start = () => { stop(); timer = window.setInterval(() => show(idx + 1), 2800); };
  card.addEventListener("mouseenter", stop, { signal });
  card.addEventListener("mouseleave", start, { signal });
  signal.addEventListener("abort", stop, { once: true });
  start();
}

function startTicker(list) {
  if (list.children.length <= 1) return;
  // swup 换页重挂：先清掉上一页遗留的跑马灯计时器
  if (window.__homeTickerTimer) { window.clearInterval(window.__homeTickerTimer); window.__homeTickerTimer = null; }
  window.__homeTickerTimer = window.setInterval(() => {
    if (list.children.length <= 1) return;
    const first = list.children[0];
    const second = list.children[1];
    if (!first || !second) return;
    first.classList.remove("is-active");
    first.classList.add("is-leaving");
    second.classList.remove("is-leaving", "is-active");
    window.setTimeout(() => second.classList.add("is-active"), 40);
    window.__homeTickerAnimationTimer = window.setTimeout(() => {
      if (list.contains(first)) {
        first.classList.remove("is-leaving");
        list.appendChild(first);
      }
    }, 680);
  }, 3000);
}

/**
 * tg 数据源：首页跑马灯运行时拉取最新 N 条。
 * 与列表页同源（/api/v1/messages/latest），只取文本与资源图标。
 * 失败时保留模板里的占位文案，不抛错、不影响首页其余行为。
 */
async function loadTgTicker(section, signal) {
  const list = section.querySelector(".talk-list");
  if (!list) return;
  const baseUrl = (section.dataset.tgBase || "").replace(/\/+$/, "");
  const channelId = section.dataset.tgChannel || "";
  const count = Math.max(1, Number(section.dataset.tgCount) || 5);
  if (!baseUrl || !channelId) return;
  try {
    const u = new URL(`${baseUrl}/api/v1/messages/latest`);
    u.searchParams.set("channel", channelId);
    u.searchParams.set("limit", String(count));
    const res = await fetch(u.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    if (!res.ok) throw new Error(`tg-api ${res.status}`);
    const payload = await res.json();
    const items = Array.isArray(payload?.items) ? payload.items.slice(0, count) : [];
    if (!items.length) return;

    list.replaceChildren();
    items.forEach((raw, i) => {
      const text = String(raw?.content?.text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 64);
      const li = document.createElement("li");
      li.className = `item${i === 0 ? " is-active" : ""}`;
      const span = document.createElement("span");
      span.className = "talk-text";
      span.textContent = text || "分享了一条说说";
      li.append(span);

      // 资源图标：按 media 类型推断（对齐 local 模式的图标语义）
      const media = Array.isArray(raw?.media) ? raw.media : [];
      const icons = [];
      if (media.some((m) => m.kind === "photo" || m.kind === "animation")) icons.push("fa-solid fa-image");
      if (media.some((m) => m.kind === "video")) icons.push("fa-solid fa-film");
      if (media.some((m) => m.kind === "audio" || m.kind === "voice")) icons.push("fa-solid fa-microphone");
      if (raw?.sourceUrl) icons.push("fa-solid fa-link");
      if (icons.length) {
        const box = document.createElement("span");
        box.className = "talk-resource-icons";
        icons.forEach((cls) => {
          const ic = document.createElement("i");
          ic.className = cls;
          ic.setAttribute("aria-hidden", "true");
          box.append(ic);
        });
        li.append(box);
      }
      list.append(li);
    });
    startTicker(list);
  } catch (e) {
    if (signal?.aborted) return;
    // 静默降级：保留占位文案
  }
}

function initWebinfoTime() {
  const el = document.querySelector("#webinfo-last-build");
  if (!el) return;
  const ts = Number(el.dataset.buildTimestamp);
  if (!Number.isFinite(ts)) return;
  const elapsed = Math.max(0, Date.now() - ts);
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour, month = 30 * day, year = 365 * day;
  el.textContent =
    elapsed < min ? "刚刚" :
    elapsed < hour ? `${Math.floor(elapsed / min)}分钟前` :
    elapsed < day ? `${Math.floor(elapsed / hour)}小时前` :
    elapsed < month ? `${Math.floor(elapsed / day)}天前` :
    elapsed < year ? `${Math.floor(elapsed / month)}个月前` :
    `${Math.floor(elapsed / year)}年前`;
}

// 卡片光斑：hover 时把鼠标坐标写进 --mouse-x/--mouse-y（与源站 aurora-mouse 一致）
function initCardGlow(signal) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.addEventListener("mousemove", (e) => {
    const card = e.target instanceof Element && e.target.closest(".card-glow");
    if (!card) return;
    const effect = card.querySelector(".card-glow-effect") || card;
    const rect = card.getBoundingClientRect();
    effect.style.setProperty("--mouse-x", `${Math.round(e.clientX - rect.left)}px`);
    effect.style.setProperty("--mouse-y", `${Math.round(e.clientY - rect.top)}px`);
  }, { passive: true, signal });
}

// 欢迎卡片访客信息（占位：源站走 IP 地理接口，接好统计后在 home 配置里补）
export function initHome(signal) {
  initPatronCarousel(signal);
  const talk = document.getElementById("bber-talk");
  const list = talk?.querySelector(".talk-list");
  if (talk && talk.hasAttribute("data-tg-ticker")) {
    // tg 源：运行时拉取后再启动跑马灯（否则只有占位 1 条，startTicker 会直接返回）
    loadTgTicker(talk, signal);
  } else if (list) {
    startTicker(list);
  }
  initWebinfoTime();
  initCardGlow(signal);
}
