// 页面小工具：订阅复制 / 申请模板填充 / 赞赏页灯箱与支持者跳转
import { openLightbox } from "./lightbox.js";

function toast(msg) {
  let bar = document.getElementById("kb-snackbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "kb-snackbar";
    bar.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--card-bg,#1a1a1a);color:var(--foreground,#fff);padding:8px 16px;border-radius:10px;font-size:14px;z-index:9999;opacity:0;transition:opacity .2s";
    document.body.append(bar);
  }
  bar.textContent = msg;
  bar.style.opacity = "1";
  clearTimeout(bar._t);
  bar._t = setTimeout(() => (bar.style.opacity = "0"), 1800);
}

function initCopyRss(signal) {
  const btn = document.querySelector("[data-copy-rss]");
  const code = document.getElementById("rss-url");
  if (!btn || !code || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent.trim());
      toast("已复制到剪贴板");
    } catch {
      toast("复制失败，请手动复制");
    }
  }, { signal });
}

const APPLY_TEMPLATE = [
  "name: 站点名称",
  "link: 站点地址",
  "avatar: 头像地址",
  "descr: 一句话描述",
  "siteshot: 站点截图（可选）",
  "atom: RSS / Atom 订阅地址（可选）",
].join("\n");

function initApplyFill(signal) {
  const btn = document.querySelector("[data-fill-apply-template]");
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(APPLY_TEMPLATE);
      toast("申请模板已复制，粘贴到评论框即可");
    } catch {
      toast("复制失败，请手动复制申请格式");
    }
    document.querySelector("#comment-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, { signal });
}

// 赞赏页：收款码灯箱（统一全局灯箱） + 支持者整卡跳转
function initRewards(signal) {
  const images = Array.from(document.querySelectorAll(".patron-qr-image"));
  images.forEach((box) => {
    if (box.dataset.siteLightbox === "true") return;
    box.dataset.siteLightbox = "true";
    box.style.cursor = "zoom-in";
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const img = box.querySelector("img");
      if (!img?.src) return;
      openLightbox([{ src: img.src, caption: img.alt || "收款码" }], 0);
    }, { signal });
  });
  document.querySelectorAll(".backer-linkable[data-href]").forEach((card) => {
    card.addEventListener("click", () => window.open(card.dataset.href, "_blank", "noopener,noreferrer"), { signal });
  });
}

export function initPageExtras(signal) {
  initCopyRss(signal);
  initApplyFill(signal);
  initRewards(signal);
}
