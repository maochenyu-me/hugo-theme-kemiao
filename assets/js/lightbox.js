// 全局统一灯箱（源站 Fancybox 对应物）：多图分组、翻页、键盘导航、计数。
// 绑定范围：文章正文图片、说说配图（a[data-shuoshuo-fancybox]）、
// 评论图片（comment-artalk 调 openLightbox）、赞赏码（page-extras 调 openLightbox）。

let overlay = null;
let items = [];
let current = 0;
let keyHandler = null;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "site-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "图片预览");
  overlay.innerHTML = `
    <button type="button" class="site-lightbox-close" aria-label="关闭">✕</button>
    <div class="site-lightbox-stage"><img alt=""></div>
    <button type="button" class="site-lightbox-prev" aria-label="上一张">‹</button>
    <button type="button" class="site-lightbox-next" aria-label="下一张">›</button>
    <div class="site-lightbox-counter"></div>`;
  overlay.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t === overlay || t.closest(".site-lightbox-close")) closeLightbox();
    else if (t.closest(".site-lightbox-prev")) show(current - 1);
    else if (t.closest(".site-lightbox-next")) show(current + 1);
  });
  keyHandler = (e) => {
    if (!overlay?.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") show(current - 1);
    else if (e.key === "ArrowRight") show(current + 1);
  };
  document.addEventListener("keydown", keyHandler);
  overlay.hidden = true;
  document.body.append(overlay);
  return overlay;
}

function show(index) {
  if (!items.length) return;
  current = (index + items.length) % items.length;
  const item = items[current];
  const img = overlay.querySelector("img");
  const counter = overlay.querySelector(".site-lightbox-counter");
  img.src = item.src;
  img.alt = item.caption || "";
  const multiple = items.length > 1;
  overlay.querySelector(".site-lightbox-prev").hidden = !multiple;
  overlay.querySelector(".site-lightbox-next").hidden = !multiple;
  counter.hidden = !multiple;
  if (multiple) counter.textContent = `${current + 1} / ${items.length}`;
}

function closeLightbox() {
  overlay?.classList.remove("is-open");
  window.setTimeout(() => {
    if (overlay && !overlay.classList.contains("is-open")) {
      overlay.querySelector("img").src = "";
      overlay.hidden = true;
    }
  }, 200);
  document.documentElement.classList.remove("site-lightbox-open");
}

/**
 * 打开灯箱。items: [{ src, caption? }]，index 起始下标。
 * 供全局自动绑定与评论/赞赏码等模块复用。
 */
export function openLightbox(list, index = 0) {
  if (!Array.isArray(list) || !list.length) return;
  const el = ensureOverlay();
  items = list.filter((item) => item?.src);
  if (!items.length) return;
  el.hidden = false;
  document.documentElement.classList.add("site-lightbox-open");
  show(Math.max(0, Math.min(index, items.length - 1)));
  requestAnimationFrame(() => el.classList.add("is-open"));
}

// 绑定记录：元素 → 绑定时所用的 signal。signal 被 abort（监听已移除）后允许重绑，
// 避免"幂等标记还在、监听其实已失效"的哑火状态
const bindings = new WeakMap();

function bindGroup(elements, signal) {
  elements.forEach((el) => {
    const previous = bindings.get(el);
    if (el.dataset.siteLightbox === "true" && previous && !previous.aborted) return;
    el.dataset.siteLightbox = "true";
    el.style.cursor = "zoom-in";
    bindings.set(el, signal);
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const list = elements.map((node) => ({
        src: node.dataset.lightboxSrc || node.dataset.src || (node instanceof HTMLImageElement ? node.currentSrc || node.src : node.getAttribute("href") || ""),
        caption: node.dataset.caption || (node instanceof HTMLImageElement ? node.alt : ""),
      }));
      openLightbox(list, elements.indexOf(el));
    }, { signal });
  });
}

/**
 * 说说配图灯箱入口：按 data-fancybox 分组实时收集同组锚点（兼容动态渲染）。
 */
export function openAnchorLightbox(anchor) {
  const key = anchor.dataset.fancybox || "";
  const anchors = key
    ? Array.from(document.querySelectorAll(`a[data-shuoshuo-fancybox='true'][data-fancybox="${CSS.escape(key)}"]`))
    : [anchor];
  const items = anchors.map((a) => ({
    src: a.getAttribute("href") || "",
    caption: a.dataset.caption || "",
  }));
  openLightbox(items, Math.max(0, anchors.indexOf(anchor)));
}

// 自动绑定当前页图片（每页加载时由 site.js 管线调用；说说配图由各说说模块经 openAnchorLightbox 处理）
export function initLightbox(signal) {
  // 文章正文：#article img，封面（data-no-lightbox）与链接内的图片除外
  const articleImages = Array.from(document.querySelectorAll("#article img"))
    .filter((img) => img.currentSrc || img.src)
    .filter((img) => !img.closest("[data-no-lightbox]"))
    .filter((img) => !(img.parentElement instanceof HTMLAnchorElement));
  bindGroup(articleImages, signal);
}
