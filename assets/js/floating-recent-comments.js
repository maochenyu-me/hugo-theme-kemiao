// 浮动最近评论（源站 FloatingRecentComments.astro 1:1）：右下角评论轮播 + 下一篇推荐。
// provider=artalk/twikoo 时由 baseof 渲染浮窗；ecoku 无最近评论接口，模板层不渲染本组件。
// 行为：评论区未滚出视口时轮播最近评论（5s/条，280ms 双面板交叉动画）；
// 滚过评论区后切换为"下一篇文章"推荐（无下一篇则隐藏）；偏好/手动关闭即时隐藏。
import { fetchLatestComments } from "./recent-comments.js";
import { getPreference, onPreferenceChange } from "./site-preferences.js";

const ROTATE_INTERVAL = 5000;
const PANEL_ANIMATION = 280;
const MODE_COMMENTS = "comments";
const MODE_NEXT_POST = "next-post";
const DISPLAY_LIMIT = 8;

// ---- 工具 ----
function prefEnabled() {
  return getPreference("recentComments") !== false;
}

function getCommentSection() {
  return document.getElementById("comment-section");
}

function scrolledPastTop(el) {
  return el.getBoundingClientRect().top <= 0;
}

function getNextPost() {
  const el = document.querySelector("[data-floating-next-post-title][data-floating-next-post-href]");
  const title = el?.dataset.floatingNextPostTitle?.trim();
  const href = el?.dataset.floatingNextPostHref?.trim();
  return title && href ? { title, href } : null;
}

function getItems(card) {
  try {
    return JSON.parse(card.dataset.items || "[]");
  } catch {
    return [];
  }
}

function currentItem(card) {
  return getItems(card)[Number(card.dataset.index || 0)] ?? null;
}

function getPanels(card) {
  return Array.from(card.querySelectorAll("[data-recent-comment-panel]"));
}

function activePanel(card) {
  const panels = getPanels(card);
  return panels.find((p) => p.dataset.recentCommentPanelActive === "true") ?? panels[0] ?? null;
}

function normalizePageKey(pathname) {
  let p = String(pathname).replace(/\/index\.html$/, "");
  return p.endsWith("/") ? p : `${p}/`;
}

// ---- 显隐 ----
function clearVisibilityTimer(card) {
  const timer = Number(card.dataset.floatingRecentCommentsVisibilityTimer);
  if (Number.isFinite(timer)) window.clearTimeout(timer);
  delete card.dataset.floatingRecentCommentsVisibilityTimer;
}

function finalizeHide(card) {
  clearVisibilityTimer(card);
  if (card.dataset.floatingRecentCommentsVisible === "false") card.hidden = true;
}

function hide(card, { immediate = false } = {}) {
  if (card.hidden && card.dataset.floatingRecentCommentsVisible !== "true") return;
  if (!immediate && card.dataset.floatingRecentCommentsVisible === "false") return;
  clearVisibilityTimer(card);
  card.dataset.floatingRecentCommentsVisible = "false";
  card.setAttribute("aria-hidden", "true");
  card.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0");
  card.classList.add("opacity-0", "pointer-events-none", "translate-y-2");
  if (immediate) {
    card.hidden = true;
    return;
  }
  const onEnd = (e) => {
    if (e.target !== card) return;
    card.removeEventListener("transitionend", onEnd);
    finalizeHide(card);
  };
  card.addEventListener("transitionend", onEnd);
  const timer = window.setTimeout(() => {
    card.removeEventListener("transitionend", onEnd);
    finalizeHide(card);
  }, 380);
  card.dataset.floatingRecentCommentsVisibilityTimer = String(timer);
}

function show(card) {
  if (!prefEnabled() || card.dataset.floatingRecentCommentsVisible === "true") return;
  clearVisibilityTimer(card);
  card.dataset.floatingRecentCommentsVisible = "true";
  card.hidden = false;
  card.setAttribute("aria-hidden", "false");
  card.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0");
  card.classList.add("opacity-0", "pointer-events-none", "translate-y-2");
  // 强制回流后下一帧过渡到可见位
  void card.offsetHeight;
  window.requestAnimationFrame(() => {
    if (card.hidden || card.dataset.floatingRecentCommentsVisible !== "true") return;
    if (card.dataset.floatingRecentCommentsClosed === "true" || !prefEnabled()) return;
    card.classList.remove("opacity-0", "pointer-events-none", "translate-y-2");
    card.classList.add("opacity-100", "pointer-events-auto", "translate-y-0");
  });
}

// ---- 面板渲染 ----
function setPanelActive(card, target) {
  delete card.dataset.floatingRecentCommentsAnimating;
  getPanels(card).forEach((panel) => {
    const active = panel === target;
    panel.dataset.recentCommentPanelActive = String(active);
    panel.setAttribute("aria-hidden", String(!active));
    panel.classList.remove("recent-comment-panel-out", "recent-comment-panel-in", "opacity-0", "opacity-100", "pointer-events-none");
    panel.classList.add(active ? "opacity-100" : "opacity-0");
    if (!active) panel.classList.add("pointer-events-none");
  });
}

function renderComment(panel, item) {
  const avatar = panel.querySelector("[data-recent-comment-avatar]");
  const nick = panel.querySelector("[data-recent-comment-nick]");
  const content = panel.querySelector("[data-recent-comment-content]");
  const link = panel.querySelector("[data-recent-comment-link]");
  if (avatar) avatar.src = item.avatar || "/info/avatar.ico";
  if (nick) nick.textContent = item.nick || "匿名访客";
  if (content) {
    if (item.contentHtml) content.innerHTML = item.contentHtml;
    else content.textContent = item.content || "留下了一条评论";
  }
  if (link) link.href = item.anchor ? `#${item.anchor}` : "#comment-section";
}

function renderNextPost(panel, post) {
  const avatar = panel.querySelector("[data-recent-comment-avatar]");
  const nick = panel.querySelector("[data-recent-comment-nick]");
  const content = panel.querySelector("[data-recent-comment-content]");
  const link = panel.querySelector("[data-recent-comment-link]");
  const sectionLink = panel.querySelector("[data-recent-comment-section-link]");
  if (avatar) avatar.src = "/favicon.ico";
  if (nick) nick.textContent = "下一篇文章";
  if (content) content.textContent = post.title;
  if (link) link.href = post.href;
  if (sectionLink) sectionLink.hidden = true;
}

// target 面板填内容并激活；animate 时做 280ms 交叉过渡
function renderPanel(card, fill, { animate = false, renderKey = "", signal } = {}) {
  if (renderKey && card.dataset.floatingRecentCommentsRenderKey === renderKey) return;
  const current = activePanel(card);
  if (!current) return;
  const other = getPanels(card).find((p) => p !== current) ?? current;
  if (renderKey) card.dataset.floatingRecentCommentsRenderKey = renderKey;
  if (!animate || current === other) {
    fill(current);
    setPanelActive(card, current);
    return;
  }
  fill(other);
  card.dataset.floatingRecentCommentsAnimating = "true";
  other.dataset.recentCommentPanelActive = "true";
  other.setAttribute("aria-hidden", "false");
  other.classList.remove("recent-comment-panel-out", "pointer-events-none", "opacity-0");
  other.classList.add("recent-comment-panel-in");
  current.dataset.recentCommentPanelActive = "false";
  current.setAttribute("aria-hidden", "true");
  current.classList.remove("recent-comment-panel-in");
  current.classList.add("recent-comment-panel-out", "pointer-events-none");
  window.setTimeout(() => {
    if (!signal?.aborted) setPanelActive(card, other);
  }, PANEL_ANIMATION);
}

function showCommentAt(card, index, opts = {}) {
  const item = getItems(card)[index];
  if (!item) return;
  renderPanel(card, (panel) => renderComment(panel, item), { ...opts, renderKey: `${MODE_COMMENTS}:${index}` });
}

function showNextPost(card, post, opts = {}) {
  renderPanel(card, (panel) => renderNextPost(panel, post), { ...opts, renderKey: `${MODE_NEXT_POST}:${post.href}` });
}

// ---- 评论锚点滚动 ----
function scrollToComment(target, hash, signal) {
  const anchor = hash === "comment-section" ? target : document.getElementById(hash) || target;
  if (!anchor) return;
  if (window.location.hash !== `#${hash}`) window.history.replaceState(null, "", `#${hash}`);
  anchor.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  for (const delay of [450, 900]) {
    window.setTimeout(() => {
      if (!signal?.aborted) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }, delay);
  }
}

// ---- 滚动联动（评论模式 ⇄ 下一篇模式） ----
function switchMode(card, mode) {
  return card.dataset.floatingRecentCommentsMode !== mode && ((card.dataset.floatingRecentCommentsMode = mode), true);
}

function updateForScroll({ card, commentSection, signal }) {
  if (card.dataset.floatingRecentCommentsClosed === "true" || !prefEnabled()) {
    hide(card);
    return;
  }
  if (scrolledPastTop(commentSection)) {
    const post = getNextPost();
    if (!post) {
      hide(card);
      return;
    }
    showNextPost(card, post, { animate: switchMode(card, MODE_NEXT_POST), signal });
    show(card);
    return;
  }
  const changed = switchMode(card, MODE_COMMENTS);
  if (!getItems(card).length) {
    hide(card);
    return;
  }
  showCommentAt(card, Number(card.dataset.index || 0), { animate: changed, signal });
  show(card);
}

function watchScroll({ card, commentSection, signal }) {
  let raf = 0;
  const update = () => updateForScroll({ card, commentSection, signal });
  const schedule = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      update();
    });
  };
  window.addEventListener("scroll", schedule, { passive: true, signal });
  window.addEventListener("resize", schedule, { signal });
  signal.addEventListener("abort", () => {
    if (raf) window.cancelAnimationFrame(raf);
  }, { once: true });
  update();
}

// ---- 主流程（每页重挂，signal 为页面级 AbortController） ----
export function initFloatingRecentComments(signal) {
  const card = document.querySelector("[data-floating-recent-comments]");
  if (!(card instanceof HTMLElement)) return;
  if (signal.aborted) return;

  const commentSection = getCommentSection();
  const onPrefs = (prefs, key) => {
    if (key !== "recentComments") return;
    // 开关即时生效：关闭立即隐藏；重新打开时按当前滚动位置重估显隐
    if (!prefs.recentComments) hide(card, { immediate: true });
    else if (commentSection) updateForScroll({ card, commentSection, signal });
  };
  onPreferenceChange(onPrefs, signal);

  // 无评论区（或偏好关闭 / 用户已关闭）→ 直接隐藏
  if (!commentSection || !prefEnabled() || card.dataset.floatingRecentCommentsClosed === "true") {
    hide(card, { immediate: true });
    return;
  }

  const pageKey = normalizePageKey(window.location.pathname);
  if (card.dataset.floatingRecentCommentsPageKey !== pageKey) {
    card.dataset.floatingRecentCommentsPageKey = pageKey;
    card.dataset.floatingRecentCommentsClosed = "false";
    card.dataset.floatingRecentCommentsMode = MODE_COMMENTS;
    card.dataset.items = "[]";
    card.dataset.index = "0";
    delete card.dataset.floatingRecentCommentsRenderKey;
    delete card.dataset.floatingRecentCommentsAnimating;
  }

  card.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-recent-comment-close]")) {
      e.preventDefault();
      card.dataset.floatingRecentCommentsClosed = "true";
      hide(card);
      return;
    }
    if (t.closest("[data-recent-comment-section-link]")) {
      e.preventDefault();
      scrollToComment(commentSection, "comment-section", signal);
      return;
    }
    if (t.closest("[data-recent-comment-link]")) {
      if (card.dataset.floatingRecentCommentsMode === MODE_NEXT_POST) return;
      e.preventDefault();
      const item = currentItem(card);
      scrollToComment(commentSection, item?.anchor || "comment-section", signal);
    }
  }, { signal });

  watchScroll({ card, commentSection, signal });

  const server = card.dataset.server;
  const site = card.dataset.site;
  const envId = card.dataset.envId;
  const provider = card.dataset.provider || "artalk";
  const siteOrigin = card.dataset.siteOrigin;
  const authorFilter = card.dataset.authorFilter || "";
  if (provider === "twikoo" ? !envId : !server || !site) return;

  fetchLatestComments({ provider, server, site, envId, siteOrigin, authorFilter, displayLimit: DISPLAY_LIMIT, fetchLimit: 20 })
    .then((list) => {
      if (signal.aborted) return;
      card.dataset.items = JSON.stringify(list);
      card.dataset.index = "0";
      updateForScroll({ card, commentSection, signal });
      if (list.length > 1) {
        const timer = window.setInterval(() => {
          if (card.hidden || card.dataset.floatingRecentCommentsClosed === "true" || card.dataset.floatingRecentCommentsMode !== MODE_COMMENTS || !prefEnabled()) return;
          const next = (Number(card.dataset.index || 0) + 1) % list.length;
          card.dataset.index = String(next);
          showCommentAt(card, next, { animate: true, signal });
        }, ROTATE_INTERVAL);
        signal.addEventListener("abort", () => window.clearInterval(timer), { once: true });
      }
    })
    .catch(() => {
      if (signal.aborted) return;
      card.dataset.items = "[]";
      card.dataset.index = "0";
      updateForScroll({ card, commentSection, signal });
    });
}
