// 说说页（本地数据源）：服务端已渲染卡片，这里只负责瀑布流、入场 reveal、灯箱、回复引用
// 列表页（#shuoshuo-feed）与详情页（.shuoshuo-feed 单卡）共用
import { openAnchorLightbox } from "./lightbox.js";

const FEED = document.querySelector(".shuoshuo-feed");

function el(tag, cls) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
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

// 引用说说到评论框（逐行加引用前缀；原帖入口已有「查看详情」按钮，不再塞链接）
async function replyToShuoshuo(card) {
  const { quoteIntoComment } = await import("./context-menu.js");
  const contentPlain = (card.querySelector(".shuoshuo-text")?.textContent || "").trim();
  const lines = contentPlain.split("\n").map((l) => `> ${l}`).join("\n");
  await quoteIntoComment(
    lines ? `${lines}\n\n` : "",
    lines
      ? "已将这条说说作为引用插入评论框，光标已定位到下方空行，可以直接继续输入回复内容。"
      : "这条说说没有文字内容，已在评论框定位到输入位置。"
  );
}

function bindCards(signal) {
  FEED.querySelectorAll(".shuoshuo-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
      card.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
    });
    const reply = card.querySelector(".shuoshuo-reply-button");
    if (reply) reply.addEventListener("click", () => replyToShuoshuo(card), { signal });
  });
}

export function initShuoshuoPage(signal) {
  if (!(FEED instanceof HTMLElement)) return;
  const list = FEED.querySelector(".shuoshuo-feed-list");
  if (!list) return;
  bindCards(signal);
  initLightbox(FEED, signal);
  if (FEED.id !== "shuoshuo-feed") return; // 详情页单卡，无需瀑布流与 reveal 时序
  watchMasonry(list, signal);
  // 入场 reveal：下一帧置 ready 触发逐卡 fade-in（源站同款时序）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { list.dataset.reveal = "ready"; });
  });
}
