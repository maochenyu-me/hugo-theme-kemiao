// 右键菜单（源站 context-menu.js 1:1）：分区菜单、动作分发、评论桥接助手
import { getPreference, onPreferenceChange } from "./site-preferences.js";

// ---- 评论桥接（源站 comment-actions.js 对应函数） ----
const ADDLINK_TEMPLATE = `> name: 站点名称
> link: 站点地址
> avatar: 头像地址
> descr: 一句话描述
> siteshot: 站点截图（可选）
> atom: RSS / Atom 订阅地址（可选）

您好博主，本站已添加贵站友链，想申请与贵站互链。以上是本站信息，麻烦审核一下，感谢！`;
const READY_TIMEOUT = 1600;
const READY_POLL = 80;

function getCommentRoot() {
  return document.getElementById("artalk-comments") || document.getElementById("ecoku-comments");
}

function getCommentSection() {
  return document.getElementById("comment-section");
}

function getCommentTextarea() {
  return (
    document.querySelector("#artalk-comments textarea") ||
    document.querySelector("#twikoo .tk-input textarea") ||
    document.querySelector("#comment-section textarea")
  );
}

function scrollToComments() {
  const target = getCommentSection();
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function ensureCommentTextarea(timeout = READY_TIMEOUT) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const textarea = getCommentTextarea();
    if (textarea) return textarea;
    await new Promise((r) => window.setTimeout(r, READY_POLL));
  }
  return getCommentTextarea();
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const caret = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(caret, caret);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function setCommentValue(textarea, text) {
  if (!textarea) return null;
  textarea.value = text;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
  const caret = text.length;
  textarea.setSelectionRange(caret, caret);
  return textarea;
}

function formatQuote(text) {
  return `${text.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
}

// ---- 菜单定义 ----
const MENU_SECTIONS = [
  {
    id: "navigation",
    items: [
      { action: "history-back", label: "后退上一页", icon: "IconArrowLeft" },
      { action: "history-forward", label: "前进下一页", icon: "IconArrowRight" },
      { action: "refresh", label: "刷新当前页", icon: "IconRefresh" },
      { action: "go-home", label: "返回首页", icon: "IconHome" },
    ],
  },
  {
    id: "selection",
    items: [
      { action: "copy-selection", label: "复制选中文字", icon: "IconCopy", conditions: ["hasSelection"] },
      { action: "quote-selection", label: "引用到评论区", icon: "IconMessageCircle", conditions: ["hasSelection", "hasComments"] },
    ],
  },
  {
    id: "target",
    items: [
      { action: "open-link", label: "打开当前链接", icon: "IconExternalLink", conditions: ["targetLink"] },
      { action: "copy-link", label: "复制链接地址", icon: "IconCopy", conditions: ["targetLink"] },
      { action: "open-image", label: "打开图片原图", icon: "IconImage", conditions: ["targetImage"] },
      { action: "copy-image", label: "复制图片地址", icon: "IconCopy", conditions: ["targetImage"] },
    ],
  },
  {
    id: "page",
    items: [
      { action: "goto-archives", label: "文章时间线", icon: "IconArchive" },
      { action: "goto-categories", label: "文章分大类", icon: "IconFolder" },
      { action: "goto-tags", label: "文章小标签", icon: "IconHash" },
      { action: "goto-comments", label: "跳转评论区", icon: "IconMessageCircle", conditions: ["hasComments"] },
      { action: "print-page", label: "打印整个页面", icon: "IconPrint" },
      { action: "goto-statement", label: "网站声明", icon: "IconInfo" },
      { action: "fill-addlink-template", label: "填充友链申请模板", icon: "IconEdit", conditions: ["onAddLinkPage", "hasComments"] },
    ],
  },
];

const ICONS = {
  IconHome: "fa-solid fa-house",
  IconCamera: "fa-solid fa-camera",
  IconFolder: "fa-solid fa-folder",
  IconArchive: "fa-solid fa-box-archive",
  IconHash: "fa-solid fa-hashtag",
  IconChart: "fa-solid fa-chart-simple",
  IconUsers: "fa-solid fa-users",
  IconLink: "fa-solid fa-link",
  IconMail: "fa-solid fa-envelope",
  IconMessageCircle: "fa-regular fa-comment-dots",
  IconPenTool: "fa-solid fa-pen-nib",
  IconShare: "fa-solid fa-share-nodes",
  IconCode: "fa-solid fa-code",
  IconRss: "fa-solid fa-rss",
  IconInfo: "fa-solid fa-circle-info",
  IconMonitor: "fa-solid fa-desktop",
  IconHeart: "fa-solid fa-heart",
  IconGitHub: "fa-brands fa-github",
  IconMenuDeep: "fa-solid fa-bars-staggered",
  IconMusic: "fa-solid fa-music",
  IconEdit: "fa-regular fa-pen-to-square",
  IconSearch: "fa-solid fa-magnifying-glass",
  IconArrowLeft: "fa-solid fa-arrow-left",
  IconArrowRight: "fa-solid fa-arrow-right",
  IconRefresh: "fa-solid fa-arrow-rotate-right",
  IconCopy: "fa-regular fa-copy",
  IconPrint: "fa-solid fa-print",
  IconImage: "fa-regular fa-image",
  IconExternalLink: "fa-solid fa-arrow-up-right-from-square",
};

const ROOT_ID = "site-context-menu-root";
const MENU_ID = "site-context-menu";
const MASK_CLASS = "site-context-menu-mask";
const MENU_CLASS = "site-context-menu";
const OPEN_CLASS = "is-open";
const HINT_INTERVAL = 300 * 1000;
const NAV_SECTION = "navigation";
const MOBILE_MAX = 768;
const USER_SCROLL_GRACE = 420;
const DRIFT_THRESHOLD = 10;

function isNavSection(id) {
  return id === NAV_SECTION;
}

function isMobile() {
  return window.innerWidth <= MOBILE_MAX;
}

function contextMenuEnabled() {
  return getPreference("contextMenu");
}

function currentScrollY() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function getRoot() {
  return document.getElementById(ROOT_ID);
}

function isEditable(target) {
  return target instanceof HTMLElement && !!target.closest("input, textarea, [contenteditable='true'], [contenteditable='']");
}

function selectionText() {
  return window.getSelection?.()?.toString().trim() || "";
}

function linkOf(target) {
  return target instanceof HTMLElement ? target.closest("a[href]") : null;
}

function imageOf(target) {
  if (!(target instanceof HTMLElement)) return null;
  return target instanceof HTMLImageElement ? target : target.closest("img");
}

function buildContext(target) {
  const selection = selectionText();
  return {
    pathname: window.location.pathname,
    hasSelection: !!selection,
    selectionText: selection,
    selectionInEditable: isEditable(target),
    hasComments: !!getCommentRoot(),
    commentRoot: getCommentRoot(),
    commentTextarea: getCommentTextarea(),
    targetLink: linkOf(target),
    targetImage: imageOf(target),
    onAddLinkPage: window.location.pathname === "/addlink/" || !!document.querySelector("[data-fill-apply-template]"),
  };
}

function testCondition(context, condition) {
  switch (condition) {
    case "hasSelection": return context.hasSelection;
    case "hasComments": return context.hasComments;
    case "targetLink": return !!context.targetLink;
    case "targetImage": return !!context.targetImage;
    case "onAddLinkPage": return context.onAddLinkPage;
    default: return false;
  }
}

function filterSections(context) {
  return MENU_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.conditions?.every((c) => testCondition(context, c)) ?? true),
    }))
    .filter((section) => section.items.length > 0);
}

function buildIcon(name) {
  const icon = document.createElement("i");
  icon.className = ICONS[name];
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function buildMenuItem(item, compact = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = compact ? "site-context-menu-item site-context-menu-item-compact" : "site-context-menu-item";
  button.dataset.contextAction = item.action;
  button.title = item.label;
  button.setAttribute("aria-label", item.label);

  const iconWrap = document.createElement("span");
  iconWrap.className = "site-context-menu-icon";
  iconWrap.append(buildIcon(item.icon));
  button.append(iconWrap);

  if (!compact) {
    const label = document.createElement("span");
    label.className = "site-context-menu-label";
    label.textContent = item.label;
    button.append(label);
  }
  return button;
}

function closeMenu() {
  const root = getRoot();
  if (!root) return;
  const win = window;
  win.__siteContextMenuOpenScrollY = undefined;
  win.__siteContextMenuUserScrollUntil = undefined;
  document.documentElement.removeAttribute("data-context-menu-open");

  const menu = root.querySelector(`#${MENU_ID}`);
  if (!menu) {
    root.replaceChildren();
    return;
  }
  menu.classList.remove(OPEN_CLASS);
  win.__siteContextMenuCloseTimer = window.setTimeout(() => {
    if (root.querySelector(`#${MENU_ID}`) === menu && !menu.classList.contains(OPEN_CLASS)) root.replaceChildren();
    win.__siteContextMenuCloseTimer = undefined;
  }, 200);
}

function maybeShowNativeHint() {
  const win = window;
  const now = Date.now();
  if ((win.__siteContextMenuLastHintAt ?? 0) + HINT_INTERVAL > now) return;
  win.__siteContextMenuLastHintAt = now;
  window.snackbarShow?.("按住 Ctrl 再右键，可以使用浏览器原生菜单。", 3200);
}

function positionMenu(menu, x, y) {
  const rect = menu.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 10;
  const maxY = window.innerHeight - rect.height - 10;
  const left = Math.max(10, Math.min(x, maxX));
  const top = Math.max(10, Math.min(y, maxY));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function openInNewTab(url) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

async function copyText(text, message) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    window.snackbarShow?.(message);
  } catch {
    window.snackbarShow?.("复制失败，请稍后再试");
  }
}

async function quoteSelection(context) {
  scrollToComments();
  const textarea = await ensureCommentTextarea();
  if (!textarea) {
    window.snackbarShow?.("评论输入框暂未就绪，请稍后再试");
    return;
  }
  insertAtCursor(textarea, formatQuote(context.selectionText));
  window.snackbarShow?.("已将选中文字作为引用插入评论框，可以继续输入你的内容。", 2600);
}

// 跨模块桥接（说说回复等）：整段写入评论框并定位光标
export async function quoteIntoComment(text, message = "已插入评论框，可以继续输入你的内容。", timeout = READY_TIMEOUT) {
  scrollToComments();
  const textarea = await ensureCommentTextarea(timeout);
  if (!textarea) {
    window.snackbarShow?.("没有找到评论输入框，请稍后再试");
    return;
  }
  setCommentValue(textarea, text);
  window.snackbarShow?.(message, 2600);
}

function runAction(action, context) {
  switch (action) {
    case "history-back": window.history.back(); return;
    case "history-forward": window.history.forward(); return;
    case "refresh": window.location.reload(); return;
    case "go-home": window.location.href = "/"; return;
    case "copy-selection": copyText(context.selectionText, "已复制选中文字，请注意引用来源。"); return;
    case "quote-selection": quoteSelection(context); return;
    case "open-link": openInNewTab(context.targetLink?.href || null); return;
    case "copy-link": copyText(context.targetLink?.href || "", "已复制链接地址。"); return;
    case "open-image": openInNewTab(context.targetImage?.currentSrc || context.targetImage?.src || null); return;
    case "copy-image": copyText(context.targetImage?.currentSrc || context.targetImage?.src || "", "已复制图片地址。"); return;
    case "goto-archives": window.location.href = "/archives/"; return;
    case "goto-categories": window.location.href = "/categories/"; return;
    case "goto-tags": window.location.href = "/tags/"; return;
    case "goto-statement": window.location.href = "/statement/"; return;
    case "goto-comments": scrollToComments(); return;
    case "fill-addlink-template": {
      if (!setCommentValue(getCommentTextarea(), ADDLINK_TEMPLATE)) {
        scrollToComments();
        window.snackbarShow?.("评论输入框暂未就绪，已帮你滚动到评论区。", 2600);
        return;
      }
      scrollToComments();
      window.snackbarShow?.("已填充友链申请模板，可以直接补充并提交。", 2600);
      return;
    }
    case "print-page": window.print(); return;
  }
}

function mountMenu(context, event) {
  const root = getRoot();
  if (!root) return null;
  const sections = filterSections(context);
  if (!sections.length) return null;

  root.replaceChildren();

  const mask = document.createElement("div");
  mask.className = MASK_CLASS;

  const menu = document.createElement("div");
  menu.id = MENU_ID;
  menu.className = MENU_CLASS;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "页面右键菜单");

  sections.forEach((section) => {
    const block = document.createElement("div");
    block.className = isNavSection(section.id)
      ? "site-context-menu-section site-context-menu-section-navigation"
      : "site-context-menu-section";
    section.items.forEach((item) => {
      block.append(buildMenuItem({ action: item.action, label: item.label, icon: item.icon }, isNavSection(section.id)));
    });
    menu.append(block);
  });

  root.append(mask, menu);
  positionMenu(menu, event.clientX, event.clientY);

  const win = window;
  win.__siteContextMenuOpenScrollY = currentScrollY();
  win.__siteContextMenuUserScrollUntil = undefined;
  requestAnimationFrame(() => menu.classList.add(OPEN_CLASS));
  document.documentElement.setAttribute("data-context-menu-open", "true");

  return { root, mask, menu };
}

export function initContextMenu(signal) {
  const win = window;
  win.__siteContextMenuCleanup?.abort();
  if (!getRoot()) return;

  const cleanup = new AbortController();
  win.__siteContextMenuCleanup = cleanup;

  const markUserScroll = () => {
    win.__siteContextMenuUserScrollUntil = Date.now() + USER_SCROLL_GRACE;
  };

  onPreferenceChange((prefs) => {
    if (!prefs.contextMenu) closeMenu();
  }, signal);

  document.addEventListener("contextmenu", (event) => {
    if (!contextMenuEnabled()) {
      closeMenu();
      return;
    }
    if (event.ctrlKey || window.matchMedia("(pointer: coarse)").matches || isMobile() || isEditable(event.target)) return;
    const context = buildContext(event.target);
    event.preventDefault();
    maybeShowNativeHint();
    const mounted = mountMenu(context, event);
    if (!mounted) return;
    mounted.mask.addEventListener("click", closeMenu, { signal });
    mounted.mask.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      closeMenu();
    }, { signal });
    mounted.menu.addEventListener("click", (e) => {
      const item = e.target.closest("[data-context-action]");
      if (!item?.dataset.contextAction) return;
      closeMenu();
      runAction(item.dataset.contextAction, context);
    }, { signal });
  }, { signal });

  document.addEventListener("wheel", markUserScroll, { passive: true, signal });
  document.addEventListener("touchmove", markUserScroll, { passive: true, signal });

  document.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", "Space"].includes(e.key)) markUserScroll();
    if (e.key === "Escape") closeMenu();
  }, { signal });

  document.addEventListener("scroll", () => {
    if (!document.getElementById(MENU_ID)) return;
    const until = win.__siteContextMenuUserScrollUntil ?? 0;
    if (Date.now() > until) return;
    const openScrollY = win.__siteContextMenuOpenScrollY ?? currentScrollY();
    if (Math.abs(currentScrollY() - openScrollY) < DRIFT_THRESHOLD) return;
    closeMenu();
  }, { passive: true, signal });

  document.addEventListener("click", (e) => {
    const menu = document.getElementById(MENU_ID);
    if (!menu) return;
    if (e.target instanceof Node && menu.contains(e.target)) return;
    closeMenu();
  }, { signal });

  window.addEventListener("resize", closeMenu, { passive: true, signal });
}
