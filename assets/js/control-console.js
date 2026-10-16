// 中控台（源站 control-console.js 1:1）：最近评论速览 + 偏好开关 + 主题/全屏
import { fetchLatestComments, relativeTime } from "./recent-comments.js";
import {
  getPreferences,
  getThemeMode as readStoredMode,
  setPreference,
  setThemeMode,
  onPreferenceChange,
} from "./site-preferences.js";

const DISPLAY_LIMIT = 10;
const FETCH_LIMIT = 20;
const RECENT_COMMENTS_HOST = "[data-recent-comments-host]";

const TOGGLE_ACTIONS = new Set(["musicCapsule", "recentComments", "contextMenu", "yozaiFont"]);

const MESSAGES = {
  musicCapsule: { enabled: "音乐胶囊已显示。", disabled: "音乐胶囊已隐藏，并已暂停当前播放。" },
  recentComments: { enabled: "最近评论弹窗已开启。", disabled: "最近评论弹窗已隐藏。" },
  contextMenu: { enabled: "右键菜单已开启。", disabled: "右键菜单已关闭，将使用浏览器原生菜单。" },
  yozaiFont: { enabled: "已切换为悠哉文楷。", disabled: "已切换为系统字体。" },
  theme: { changed: (mode) => `主题模式已切换为${mode}。` },
  fullscreen: { enabled: "已进入全屏模式。", disabled: "已退出全屏模式。" },
};

function escapeHtml(v) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function contentOf(item) {
  return item.contentHtml || escapeHtml(item.content);
}

// ---- 最近评论渲染（console 变体） ----
function renderConsoleComments(listEl, items) {
  if (!items.length) {
    listEl.innerHTML = `<li class="control-console-comment-empty">暂无评论</li>`;
    return;
  }
  listEl.innerHTML = items.map((item) => `
    <li>
      <a href="${escapeHtml(item.url)}" class="control-console-comment group/rc">
        <div class="control-console-comment-top">
          ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="" class="control-console-comment-avatar" loading="lazy" decoding="async" />` : ""}
          <span class="control-console-comment-nick">${escapeHtml(item.nick)}</span>
        </div>
        <span class="recent-comment-content control-console-comment-content">${contentOf(item)}</span>
      </a>
    </li>
  `).join("");
}

async function loadHost(host) {
  const server = host.dataset.server;
  const site = host.dataset.site;
  const displayCount = Number(host.dataset.displayCount) || DISPLAY_LIMIT;
  const fetchCount = Math.max(displayCount, Number(host.dataset.fetchCount) || FETCH_LIMIT);
  const siteOrigin = host.dataset.siteOrigin;
  const listEl = host.querySelector(".recent-comments-list");
  if (!server || !site || !(listEl instanceof HTMLElement)) return;
  host.dataset.loaded = "true";
  try {
    const items = await fetchLatestComments({ server, site, displayLimit: displayCount, fetchLimit: fetchCount, siteOrigin });
    renderConsoleComments(listEl, items);
  } catch {
    listEl.innerHTML = `<li class="text-[0.9375rem] text-foreground/40">评论加载失败</li>`;
  }
}

function loadRecentCommentsHosts() {
  document.querySelectorAll(RECENT_COMMENTS_HOST).forEach((host) => {
    if (host.dataset.loaded !== "true") loadHost(host);
  });
}

// ---- 面板行为 ----
function findParts() {
  const trigger = document.querySelector("[data-control-console-trigger]");
  const overlay = document.querySelector("[data-control-console-overlay]");
  if (!trigger || !overlay) return null;
  return { trigger, overlay, actions: Array.from(overlay.querySelectorAll("[data-control-console-action]")) };
}

function currentMode() {
  const mode = window.theme?.getThemeMode?.() ?? window.theme?.themeMode;
  return ["auto", "light", "dark"].includes(mode) ? mode : readStoredMode();
}

function nextThemeMode(mode) {
  return mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
}

function modeLabel(mode) {
  return mode === "dark" ? "深色模式" : mode === "light" ? "浅色模式" : "自动模式";
}

function fullscreenSupported() {
  return !!(document.fullscreenEnabled && document.documentElement);
}

function fullscreenActive() {
  return document.fullscreenElement !== null;
}

function notify(key, value) {
  const entry = MESSAGES[key];
  const text = key === "theme" ? entry.changed?.(String(value)) : value ? entry.enabled : entry.disabled;
  if (text) window.snackbarShow?.(text, 2600);
}

function setOpen(parts, open) {
  parts.overlay.classList.toggle("is-open", open);
  parts.overlay.setAttribute("aria-hidden", String(!open));
  parts.trigger.setAttribute("aria-expanded", String(open));
  parts.trigger.setAttribute("aria-label", open ? "关闭中控台" : "打开中控台");
  parts.trigger.setAttribute("title", open ? "关闭中控台" : "打开中控台");
}

function toggleOpen(parts) {
  setOpen(parts, parts.trigger.getAttribute("aria-expanded") !== "true");
}

function reflectToggles(parts) {
  const prefs = getPreferences();
  parts.actions.forEach((action) => {
    const key = action.dataset.controlConsoleAction;
    if (!key || !TOGGLE_ACTIONS.has(key)) return;
    const enabled = prefs[key];
    action.setAttribute("aria-pressed", String(enabled));
    action.classList.toggle("is-disabled", !enabled);
  });
}

function reflectTheme(parts) {
  const action = parts.actions.find((el) => el.dataset.controlConsoleAction === "theme");
  if (!action) return;
  const mode = currentMode();
  action.dataset.themeMode = mode;
  action.setAttribute("aria-label", modeLabel(mode));
  action.setAttribute("title", modeLabel(mode));
  action.removeAttribute("aria-pressed");
  action.classList.remove("is-disabled");
}

function reflectFullscreen(parts) {
  const action = parts.actions.find((el) => el.dataset.controlConsoleAction === "fullscreen");
  if (!action) return;
  const supported = fullscreenSupported();
  const active = fullscreenActive();
  const label = active ? "退出全屏" : "进入全屏";
  action.dataset.fullscreenState = active ? "exit" : "enter";
  action.setAttribute("aria-label", label);
  action.setAttribute("title", label);
  action.setAttribute("aria-disabled", String(!supported));
  action.toggleAttribute("disabled", !supported);
  action.classList.toggle("is-disabled", !supported);
  action.removeAttribute("aria-pressed");
}

function reflectAll(parts) {
  reflectToggles(parts);
  reflectTheme(parts);
  reflectFullscreen(parts);
}

async function toggleFullscreen(parts) {
  if (!fullscreenSupported()) {
    window.snackbarShow?.("当前浏览器不支持全屏模式。", 2600);
    return;
  }
  const enter = !fullscreenActive();
  try {
    if (enter) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
    reflectFullscreen(parts);
    notify("fullscreen", enter);
  } catch {
    window.snackbarShow?.("全屏切换失败，请检查浏览器权限。", 2600);
  }
}

function handleAction(parts, actionEl) {
  const key = actionEl.dataset.controlConsoleAction;
  if (!key) return;

  if (key === "theme") {
    window.theme?.toggleThemeMode
      ? window.theme.toggleThemeMode({ silent: true })
      : setThemeMode(nextThemeMode(readStoredMode()));
    reflectTheme(parts);
    notify("theme", modeLabel(currentMode()));
    return;
  }

  if (key === "fullscreen") {
    toggleFullscreen(parts);
    return;
  }

  if (!TOGGLE_ACTIONS.has(key)) return;
  const enabled = !getPreferences()[key];
  setPreference(key, enabled);
  // 悠哉文楷：源站由 font-mode 模块监听偏好变更即时生效（正式模块在阶段⑥补齐）
  if (key === "yozaiFont") {
    document.firstElementChild?.setAttribute("data-font-mode", enabled ? "yozai" : "system");
  }
  reflectToggles(parts);
  notify(key, enabled);
}

export function initControlConsole(signal) {
  const parts = findParts();
  if (!parts) return;

  setOpen(parts, false);
  reflectAll(parts);
  loadRecentCommentsHosts();

  parts.trigger.addEventListener("click", () => toggleOpen(parts), { signal });

  parts.overlay.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-control-console-close]")) {
      setOpen(parts, false);
      return;
    }
    const action = target.closest("[data-control-console-action]");
    if (action) handleAction(parts, action);
  }, { signal });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(parts, false);
  }, { signal });

  document.addEventListener("fullscreenchange", () => reflectFullscreen(parts), { signal });

  onPreferenceChange(() => reflectAll(parts), signal);
}
