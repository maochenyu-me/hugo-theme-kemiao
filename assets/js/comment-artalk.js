// Artalk 评论加载器（阶段⑥，1:1 源站 comment.Vj6d3Bu_.js 核心语义）
// init(server, site, pageKey) → 主题联动 + 评论图片灯箱 + owo 表情放大
// Artalk 库从 /vendor/artalk.js 运行时动态加载（192KB，不进主 bundle）
let instance = null;
let themeObserver = null;
let controller = null;

async function loadArtalkLib() {
  // new Function 规避打包器对绝对路径动态 import 的静态分析
  const mod = await new Function("u", "return import(u)")("/vendor/artalk.js");
  return mod.default ?? mod;
}

function normalizePageKey(pathname) {
  let p = pathname.replace(/\/index\.html$/, "");
  return p.endsWith("/") ? p : `${p}/`;
}

// ---------- 评论图片灯箱（与说说页 shuoshuo-lightbox 同构的轻量实现） ----------
function buildLightbox(items, index) {
  document.querySelector(".comment-lightbox")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "comment-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <button class="comment-lightbox-close" aria-label="关闭">✕</button>
    <div class="comment-lightbox-stage"><img alt="${items[index].caption || ""}"></div>
    ${items.length > 1 ? '<button class="comment-lightbox-prev" aria-label="上一张">‹</button><button class="comment-lightbox-next" aria-label="下一张">›</button>' : ""}
    <div class="comment-lightbox-counter">${index + 1} / ${items.length}</div>`;
  const img = overlay.querySelector("img");
  const counter = overlay.querySelector(".comment-lightbox-counter");
  let cur = index;
  const show = (i) => {
    cur = (i + items.length) % items.length;
    img.src = items[cur].src;
    img.alt = items[cur].caption || "";
    if (counter) counter.textContent = `${cur + 1} / ${items.length}`;
  };
  show(cur);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest(".comment-lightbox-close")) overlay.remove();
    else if (e.target.closest(".comment-lightbox-prev")) show(cur - 1);
    else if (e.target.closest(".comment-lightbox-next")) show(cur + 1);
  });
  const onKey = (e) => {
    if (!overlay.isConnected) {
      document.removeEventListener("keydown", onKey);
      return;
    }
    if (e.key === "Escape") { overlay.remove(); document.removeEventListener("keydown", onKey); }
    if (e.key === "ArrowLeft") show(cur - 1);
    if (e.key === "ArrowRight") show(cur + 1);
  };
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-open"));
}

function bindCommentImages(rootEl) {
  const sel = ".atk-content img:not([atk-emoticon])";
  rootEl.querySelectorAll(sel).forEach((img) => {
    if (img.dataset.commentLightbox === "true") return;
    img.dataset.commentLightbox = "true";
    img.style.cursor = "zoom-in";
    img.addEventListener("click", (e) => {
      e.preventDefault();
      const scope = img.closest(".atk-comment-children") || rootEl;
      const all = Array.from(scope.querySelectorAll(sel)).filter((i) => i.currentSrc || i.src);
      const idx = Math.max(0, all.indexOf(img));
      buildLightbox(all.map((i) => ({ src: i.currentSrc || i.src, caption: i.alt })), idx);
    });
  });
}

// ---------- owo 表情 hover 放大（源站 1:1） ----------
function ensureOwoBig() {
  let el = document.getElementById("owo-big");
  if (!el) {
    el = document.createElement("div");
    el.id = "owo-big";
    document.body.append(el);
  }
  return el;
}

function bindOwoZoom() {
  if (window.__artalkOwoZoomBound) return;
  window.__artalkOwoZoomBound = true;
  let timer = 0;
  let current = null;
  document.body.addEventListener("mouseover", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const item = target.closest(".atk-item");
    const img = item?.querySelector("img");
    if (!item || !(img instanceof HTMLImageElement) || current === item) return;
    current = item;
    window.clearTimeout(timer);
    const owo = ensureOwoBig();
    owo.innerHTML = "";
    owo.append(img.cloneNode());
    owo.style.display = "block";
    owo.style.opacity = "0";
    requestAnimationFrame(() => {
      const rect = item.getBoundingClientRect();
      const left = rect.left + window.scrollX + rect.width / 2 - owo.offsetWidth / 2;
      const top = rect.top + window.scrollY - owo.offsetHeight - 8;
      owo.style.left = `${Math.max(10, Math.min(left, document.body.clientWidth - owo.offsetWidth - 10))}px`;
      owo.style.top = `${Math.max(10, top)}px`;
      owo.style.opacity = "1";
    });
  });
  document.body.addEventListener("mouseout", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const item = target.closest(".atk-item");
    const rel = e.relatedTarget instanceof Element ? e.relatedTarget.closest(".atk-item") : null;
    if (!item || item === rel) return;
    current = null;
    const owo = ensureOwoBig();
    owo.style.opacity = "0";
    timer = window.setTimeout(() => { owo.style.display = "none"; }, 200);
  });
}

export async function initArtalk(signal, { server, site }) {
  controller = new AbortController();
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const mount = document.getElementById("artalk-comments");
  if (!mount || instance) return;

  let Artalk;
  try {
    Artalk = await loadArtalkLib();
    instance = Artalk.init({
      el: mount,
      server,
      site,
      pageKey: normalizePageKey(window.location.pathname),
      pageTitle: document.title,
      darkMode: document.documentElement.getAttribute("data-theme") === "dark",
    });
  } catch (err) {
    console.error("[comment] Artalk init failed:", err);
    mount.innerHTML = '<div class="comment-failed">评论加载失败，请检查网络或稍后再试。</div>';
    return;
  }

  instance.on("comment-rendered", (comment) => {
    bindCommentImages(comment.getEl());
  });

  document.dispatchEvent(new CustomEvent("artalk-loaded"));

  themeObserver = new MutationObserver(() => {
    instance?.setDarkMode(document.documentElement.getAttribute("data-theme") === "dark");
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  bindOwoZoom();
}

export function destroyArtalk() {
  instance?.destroy();
  instance = null;
  themeObserver?.disconnect();
  themeObserver = null;
}
