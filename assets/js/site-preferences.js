// 站点偏好存取（源站 site-preferences 1:1）：localStorage `site-settings`，
// 兼容旧键 theme / site-preferences-v1 的迁移，变更派发 site:preferences-change
const SETTINGS_KEY = "site-settings";
const LEGACY_THEME_KEY = "theme";
const LEGACY_PREFS_KEY = "site-preferences-v1";
const PREFS_EVENT = "site:preferences-change";

const MODES = ["auto", "light", "dark"];

const DEFAULTS = {
  "theme-mode": "auto",
  "music-capsule": true,
  "recent-comments": true,
  "context-menu": true,
  "yozai-font": true,
};

const BOOL_KEYS = {
  "music-capsule": "musicCapsule",
  "recent-comments": "recentComments",
  "context-menu": "contextMenu",
  "yozai-font": "yozaiFont",
};

function isObject(v) {
  return typeof v === "object" && !!v;
}

function isMode(v) {
  return typeof v === "string" && MODES.includes(v);
}

function readJSON(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readLegacyTheme() {
  try {
    const v = window.localStorage.getItem(LEGACY_THEME_KEY);
    return isMode(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

function readLegacyPrefs() {
  const raw = readJSON(LEGACY_PREFS_KEY);
  return {
    musicCapsule: typeof raw.musicCapsule === "boolean" ? raw.musicCapsule : undefined,
    recentComments: typeof raw.recentComments === "boolean" ? raw.recentComments : undefined,
    contextMenu: typeof raw.contextMenu === "boolean" ? raw.contextMenu : undefined,
    yozaiFont: typeof raw.yozaiFont === "boolean" ? raw.yozaiFont : undefined,
  };
}

function merge(settings, legacyPrefs, legacyTheme) {
  return {
    themeMode: isMode(settings["theme-mode"]) ? settings["theme-mode"] : legacyTheme ?? DEFAULTS["theme-mode"],
    musicCapsule: typeof settings["music-capsule"] === "boolean" ? settings["music-capsule"] : legacyPrefs.musicCapsule ?? DEFAULTS["music-capsule"],
    recentComments: typeof settings["recent-comments"] === "boolean" ? settings["recent-comments"] : legacyPrefs.recentComments ?? DEFAULTS["recent-comments"],
    contextMenu: typeof settings["context-menu"] === "boolean" ? settings["context-menu"] : legacyPrefs.contextMenu ?? DEFAULTS["context-menu"],
    yozaiFont: typeof settings["yozai-font"] === "boolean" ? settings["yozai-font"] : legacyPrefs.yozaiFont ?? DEFAULTS["yozai-font"],
  };
}

function toSettings(prefs) {
  return {
    "theme-mode": prefs.themeMode,
    "music-capsule": prefs.musicCapsule,
    "recent-comments": prefs.recentComments,
    "context-menu": prefs.contextMenu,
    "yozai-font": prefs.yozaiFont,
  };
}

function persist(prefs) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSettings(prefs)));
    window.localStorage.removeItem(LEGACY_THEME_KEY);
    window.localStorage.removeItem(LEGACY_PREFS_KEY);
  } catch {
    // 存储失败仅作渐进增强，忽略
  }
}

function emit(prefs, key) {
  document.dispatchEvent(new CustomEvent(PREFS_EVENT, {
    detail: { key, preferences: toFeaturePrefs(prefs), settings: prefs },
  }));
}

function toFeaturePrefs(prefs) {
  return {
    musicCapsule: prefs.musicCapsule,
    recentComments: prefs.recentComments,
    contextMenu: prefs.contextMenu,
    yozaiFont: prefs.yozaiFont,
  };
}

function hasLegacyState() {
  try {
    return window.localStorage.getItem(LEGACY_THEME_KEY) !== null
      || window.localStorage.getItem(LEGACY_PREFS_KEY) !== null;
  } catch {
    return false;
  }
}

function load() {
  if (typeof window === "undefined") return merge({}, {}, DEFAULTS["theme-mode"]);
  const settings = readJSON(SETTINGS_KEY);
  const prefs = merge(settings, readLegacyPrefs(), readLegacyTheme());
  if (!Object.keys(settings).length || hasLegacyState()) persist(prefs);
  return prefs;
}

export function getPreferences() {
  return toFeaturePrefs(load());
}

export function getPreference(key) {
  return getPreferences()[key];
}

export function setPreference(key, value) {
  const prefs = load();
  if (prefs[key] === value) return toFeaturePrefs(prefs);
  const next = { ...prefs, [key]: value };
  persist(next);
  emit(next, key);
  return toFeaturePrefs(next);
}

export function getThemeMode() {
  return load().themeMode;
}

export function setThemeMode(mode) {
  const prefs = load();
  if (prefs.themeMode === mode) return prefs;
  const next = { ...prefs, themeMode: mode };
  persist(next);
  emit(next, "themeMode");
  return next;
}

export function onPreferenceChange(handler, signal) {
  const listener = (event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail;
    const settings = detail.settings ?? load();
    handler(detail.preferences ?? toFeaturePrefs(settings), detail.key);
  };
  document.addEventListener(PREFS_EVENT, listener, { signal });
  return () => document.removeEventListener(PREFS_EVENT, listener);
}
