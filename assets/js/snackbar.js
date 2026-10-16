// 站内通知条（源站 snackbar.js 1:1）：右下角堆叠卡片，window.snackbarShow 对外
const DEFAULT_DURATION = 2000;
const CARD_CLASS = "site-snackbar-card";
const RECENT_COMMENTS_SELECTOR = "[data-floating-recent-comments]";
let seq = 0;
let measureRaf = 0;
let mutationObserver = null;
let resizeObserver = null;
let observedHost = null;

function getRoot() {
  return document.getElementById("site-snackbar-root");
}

function visibleRecentCommentsHost() {
  const host = document.querySelector(RECENT_COMMENTS_SELECTOR);
  if (!(host instanceof HTMLElement) || host.hidden || host.dataset.floatingRecentCommentsVisible !== "true") return null;
  const style = window.getComputedStyle(host);
  if (style.display === "none" || style.visibility === "hidden") return null;
  const rect = host.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? host : null;
}

function hostGap(host) {
  const { rowGap, gap } = window.getComputedStyle(host);
  const value = Number.parseFloat(rowGap || gap);
  return Number.isFinite(value) ? value : 12;
}

function hostOffset(host, gap) {
  const { bottom } = window.getComputedStyle(host);
  const parsed = Number.parseFloat(bottom);
  if (Number.isFinite(parsed) && host.offsetHeight > 0) return parsed + host.offsetHeight + gap;
  const rect = host.getBoundingClientRect();
  return window.innerHeight - rect.top + gap;
}

function updateOffset() {
  measureRaf = 0;
  const root = getRoot();
  if (!root) return;
  const host = visibleRecentCommentsHost();
  if (!host) {
    root.style.removeProperty("--site-snackbar-bottom-offset");
    return;
  }
  const offset = Math.max(12, hostOffset(host, hostGap(host)));
  root.style.setProperty("--site-snackbar-bottom-offset", `${Math.ceil(offset)}px`);
}

function scheduleOffset() {
  if (!measureRaf) measureRaf = window.requestAnimationFrame(updateOffset);
}

function watchRecentCommentsHost() {
  const host = document.querySelector(RECENT_COMMENTS_SELECTOR);
  if (host === observedHost) {
    scheduleOffset();
    return;
  }
  mutationObserver?.disconnect();
  resizeObserver?.disconnect();
  mutationObserver = null;
  resizeObserver = null;
  observedHost = host;
  if (!host) {
    scheduleOffset();
    return;
  }
  mutationObserver = new MutationObserver(scheduleOffset);
  mutationObserver.observe(host, {
    attributes: true,
    attributeFilter: ["aria-hidden", "class", "data-floating-recent-comments-visible", "hidden", "style"],
  });
  resizeObserver = new ResizeObserver(scheduleOffset);
  resizeObserver.observe(host);
  scheduleOffset();
}

function closeCard(card) {
  if (!card.isConnected || card.classList.contains("is-closing")) return;
  card.style.maxHeight = `${card.clientHeight}px`;
  card.classList.add("is-closing");
  window.setTimeout(() => {
    card.style.maxHeight = "0";
    card.style.marginBottom = "0";
    card.classList.remove("is-visible");
  }, 25);
  window.setTimeout(() => card.remove(), 300);
}

function trimOverflow(root) {
  root.querySelectorAll(`.${CARD_CLASS}:nth-last-child(n + 4)`).forEach(closeCard);
}

function buildCard(root, text) {
  const card = document.createElement("div");
  const header = document.createElement("div");
  const avatar = document.createElement("img");
  const title = document.createElement("span");
  const close = document.createElement("button");
  const icon = document.createElement("i");
  const body = document.createElement("div");

  card.id = `site-snackbar-${seq++}`;
  card.className = CARD_CLASS;
  card.setAttribute("role", "status");

  header.className = "site-snackbar-header";
  avatar.className = "site-snackbar-avatar";
  avatar.src = root.dataset.siteMessageAvatar || "/info/avatar.ico";
  avatar.alt = "";
  avatar.loading = "lazy";
  avatar.decoding = "async";
  title.className = "site-snackbar-title";
  title.textContent = root.dataset.siteMessageTitle || "站内消息";
  icon.className = "fa-solid fa-xmark";
  icon.setAttribute("aria-hidden", "true");
  close.className = "site-snackbar-close";
  close.type = "button";
  close.setAttribute("aria-label", "关闭通知");
  close.append(icon);

  body.className = "site-snackbar-text";
  body.textContent = text;

  header.append(avatar, title, close);
  card.append(header, body);
  return card;
}

function snackbarShow(message, duration = DEFAULT_DURATION) {
  const text = typeof message === "string" ? message : message.text;
  const time = typeof message === "string" ? duration : message.time ?? DEFAULT_DURATION;
  const root = getRoot();
  if (!root) return { close: () => {} };

  const card = buildCard(root, text);
  const closeBtn = card.querySelector(".site-snackbar-close");
  let timer;
  const dismiss = () => {
    if (timer) window.clearTimeout(timer);
    closeCard(card);
  };
  const schedule = () => {
    timer = window.setTimeout(dismiss, time);
  };

  closeBtn?.addEventListener("click", dismiss);
  card.addEventListener("mouseenter", () => timer && window.clearTimeout(timer));
  card.addEventListener("mouseleave", schedule);

  watchRecentCommentsHost();
  root.appendChild(card);
  trimOverflow(root);
  window.requestAnimationFrame(() => card.classList.add("is-visible"));
  schedule();

  return { close: dismiss };
}

watchRecentCommentsHost();
window.addEventListener("resize", scheduleOffset, { passive: true });
window.snackbarShow = snackbarShow;
