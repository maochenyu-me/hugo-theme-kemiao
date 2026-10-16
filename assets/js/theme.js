// 主题模块（源站 theme.js 1:1）：与防白闪内联脚本协作，补齐 toggle/reflect/fade/auto 巡检
import { getThemeMode as readStoredMode, setThemeMode as writeStoredMode } from "./site-preferences.js";

const AUTO = "auto";
const LIGHT = "light";
const DARK = "dark";
const MODES = [AUTO, LIGHT, DARK];
const FADE_CLASS = "theme-fade-transition";
const FADE_MS = 160;

function isMode(v) {
  return v !== null && MODES.includes(v);
}

function resolveAuto() {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 8 ? DARK : LIGHT;
}

function resolve(mode) {
  return mode === AUTO ? resolveAuto() : mode;
}

function nextMode(mode) {
  return mode === AUTO ? LIGHT : mode === LIGHT ? DARK : AUTO;
}

let mode = isMode(window.theme?.themeMode) ? window.theme.themeMode : readStoredMode();
let resolved = resolve(mode);

function reflect() {
  resolved = resolve(mode);
  syncWindow();
  document.firstElementChild?.setAttribute("data-theme", resolved);
  const body = document.body;
  if (body) {
    const bg = window.getComputedStyle(body).backgroundColor;
    document.querySelector("meta[name='theme-color']")?.setAttribute("content", bg);
  }
}

function syncWindow() {
  if (!window.theme) return;
  window.theme.themeMode = mode;
  window.theme.resolvedTheme = resolved;
  window.theme.themeValue = resolved;
}

function applyPreference(newMode) {
  mode = newMode;
  resolved = resolve(mode);
  writeStoredMode(mode);
  syncWindow();
  reflect();
}

function modeLabel(m) {
  return m === AUTO ? "自动模式" : m === DARK ? "深色模式" : "浅色模式";
}

function notify(m) {
  window.snackbarShow?.(`已切换为${modeLabel(m)}`);
}

function canFade() {
  return window.matchMedia("(min-width: 768px)").matches
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setFade(on) {
  document.documentElement.classList.toggle(FADE_CLASS, on);
}

function toggleThemeMode(options = {}) {
  const target = nextMode(mode);
  const fade = canFade();
  if (fade) {
    document.documentElement.style.setProperty("--theme-fade-bg", window.getComputedStyle(document.body).backgroundColor);
    setFade(true);
  }
  applyPreference(target);
  if (!options.silent) notify(target);
  if (fade) window.setTimeout(() => setFade(false), FADE_MS);
}

if (window.theme) {
  window.theme.themeMode = mode;
  window.theme.resolvedTheme = resolved;
  window.theme.themeValue = resolved;
  window.theme.setPreference = () => applyPreference(readStoredMode());
  window.theme.reflectPreference = reflect;
  window.theme.getTheme = () => resolved;
  window.theme.getThemeMode = () => mode;
  window.theme.toggleThemeMode = toggleThemeMode;
  window.theme.setTheme = (v) => {
    if (v === LIGHT || v === DARK) {
      resolved = v;
      window.theme.resolvedTheme = v;
      window.theme.themeValue = v;
    }
  };
  window.theme.setThemeMode = (v) => {
    if (isMode(v)) {
      mode = v;
      resolved = resolve(mode);
      syncWindow();
    }
  };
} else {
  window.theme = {
    themeMode: mode,
    resolvedTheme: resolved,
    themeValue: resolved,
    setPreference: () => applyPreference(readStoredMode()),
    reflectPreference: reflect,
    getTheme: () => resolved,
    getThemeMode: () => mode,
    toggleThemeMode,
    setTheme: (v) => {
      if (v === LIGHT || v === DARK) {
        resolved = v;
        window.theme.resolvedTheme = v;
        window.theme.themeValue = v;
      }
    },
    setThemeMode: (v) => {
      if (isMode(v)) {
        mode = v;
        resolved = resolve(mode);
        syncWindow();
      }
    },
  };
}

reflect();

// 自动模式下按小时巡检亮暗
window.setInterval(() => {
  if (mode !== AUTO) return;
  const next = resolveAuto();
  if (next !== resolved) {
    resolved = next;
    syncWindow();
    reflect();
  }
}, 60 * 1000);
