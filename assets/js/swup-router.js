// swup 页面路由（源站 swup-router 1:1）：容器 #swup 无刷新跳转，
// head 元数据/样式/资源同步、body 脚本重注入、容器内脚本重执行、
// site:* 生命周期事件、加载进度状态。音乐胶囊等容器外组件不受影响。
import Swup from "swup";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupScrollPlugin from "@swup/scroll-plugin";

// 进度条节奏（源站 fe/pe）：最短展示 320ms，超时上限 1800ms
const MIN_DURATION = 320;
const MAX_DURATION = 1800;

// 换页后需要同步的 head 元数据（源站 K）
const META_SELECTOR = [
  "title",
  'meta[name="referrer"]',
  'meta[name="robots"]',
  'meta[name="description"]',
  'meta[name="author"]',
  'meta[name="keywords"]',
  'meta[name="theme-color"]',
  'meta[property^="og:"]',
  'meta[property^="twitter:"]',
  'meta[property^="article:"]',
  'link[rel="canonical"]',
  'link[rel="alternate"]',
  'link[rel="sitemap"]',
  'script[type="application/ld+json"]',
].join(",");

// head 内需要跨页同步的资源（源站 G）
const RESOURCE_SELECTOR = ['style', 'link[rel="stylesheet"]', 'link[rel="modulepreload"]', 'link[rel="preload"]', "script[src]"].join(",");

// content:replace 前必须加载完成的样式（源站 he）
const STYLE_SELECTOR = ["style", 'link[rel="stylesheet"]'].join(",");

const BEFORE_SWAP_EVENTS = ["site:before-swap", "astro:before-swap"];
const AFTER_SWAP_EVENTS = ["site:after-swap", "astro:after-swap"];
const PAGE_LOAD_EVENTS = ["site:page-load", "astro:page-load"];

// ---- 资源指纹：用于新旧 head 资源去重（源站 Y） ----
function resourceKey(el) {
  if (el instanceof HTMLLinkElement) return `link:${el.rel}:${el.as}:${el.href}`;
  if (el instanceof HTMLScriptElement && el.src) return `script:${el.type}:${el.src}`;
  return `${el.tagName.toLowerCase()}:${el.textContent ?? ""}`;
}

function cloneResource(el) {
  const clone = el.cloneNode(true);
  clone.dataset.swupResource = "true";
  return clone;
}

// 等待样式表加载完成（源站 ve，带兜底超时）
function awaitStylesheet(el) {
  if (!(el instanceof HTMLLinkElement) || el.rel !== "stylesheet" || el.sheet) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      el.removeEventListener("load", done);
      el.removeEventListener("error", done);
      resolve();
    };
    el.addEventListener("load", done, { once: true });
    el.addEventListener("error", done, { once: true });
    const timer = window.setTimeout(done, 400);
  });
}

function dispatchEvents(events, detail = {}) {
  for (const type of events) {
    const event = new CustomEvent(type, { detail });
    document.dispatchEvent(Object.assign(event, detail));
  }
}

// 重执行作用域内的脚本（源站 J）：跳过非 JS 与已执行标记
function runScopeScripts(scope = document) {
  const scripts = Array.from(scope.querySelectorAll("script"));
  for (const script of scripts) {
    if (script.type && script.type !== "module" && script.type !== "text/javascript") continue;
    if (script.dataset.siteExecuted === "true") continue;
    const clone = document.createElement("script");
    for (const attr of Array.from(script.attributes)) clone.setAttribute(attr.name, attr.value);
    clone.dataset.siteExecuted = "true";
    clone.textContent = script.textContent;
    script.replaceWith(clone);
  }
}

// 标记作用域内脚本已执行（源站 _e，防止初始化时重复执行）
function markScriptsExecuted(scope = document) {
  scope.querySelectorAll("script").forEach((script) => {
    script.dataset.siteExecuted = "true";
  });
}

// 换页前加载新页样式（源站 Z）：缺失的 style/stylesheet 先插入并等待加载
async function loadStyles(newDocument) {
  if (!newDocument) return;
  const current = new Set(Array.from(document.head.querySelectorAll(STYLE_SELECTOR)).map(resourceKey));
  const pending = [];
  for (const node of Array.from(newDocument.head.querySelectorAll(STYLE_SELECTOR))) {
    const key = resourceKey(node);
    if (current.has(key)) continue;
    const clone = node.cloneNode(true);
    document.head.append(clone);
    current.add(key);
    pending.push(awaitStylesheet(clone));
  }
  await Promise.all(pending);
}

// 同步 head 资源（源站 ye）：清掉本页专属资源，补上目标页资源
function syncResources(newDocument) {
  if (!newDocument) return;
  const incoming = Array.from(newDocument.head.querySelectorAll(RESOURCE_SELECTOR));
  const incomingKeys = new Set(incoming.map(resourceKey));
  const currentKeys = new Set(Array.from(document.head.querySelectorAll(RESOURCE_SELECTOR)).map(resourceKey));
  document.head.querySelectorAll('[data-swup-resource="true"]').forEach((el) => {
    if (!incomingKeys.has(resourceKey(el))) el.remove();
  });
  for (const node of incoming) {
    const key = resourceKey(node);
    if (!currentKeys.has(key)) {
      document.head.append(cloneResource(node));
      currentKeys.add(key);
    }
  }
}

// 同步 head 元数据（源站 xe）：title/meta/canonical/ld+json 等
function replaceHeadMeta(newDocument) {
  if (!newDocument) return;
  document.head.querySelectorAll(META_SELECTOR).forEach((el) => el.remove());
  document.head.prepend(...Array.from(newDocument.head.querySelectorAll(META_SELECTOR)).map((el) => el.cloneNode(true)));
}

// 重注入 body 外部脚本（源站 be）：新页 body 中、容器外、且当前未加载过的 script[src]
function runBodyScripts(newDocument) {
  if (!newDocument) return;
  const container = newDocument.querySelector("#swup");
  const candidates = Array.from(newDocument.body.querySelectorAll("script[src]")).filter((s) => !container || !container.contains(s));
  const loaded = new Set(Array.from(document.body.querySelectorAll("script[src]")).map((s) => s.src));
  for (const script of candidates) {
    if (loaded.has(script.src)) continue;
    loaded.add(script.src);
    const clone = document.createElement("script");
    for (const attr of Array.from(script.attributes)) clone.setAttribute(attr.name, attr.value);
    document.body.appendChild(clone);
  }
}

// 进度状态机（源站 Q）：html.is-swup-loading / -rendering / -done
function setProgressState(state) {
  const root = document.documentElement;
  if (setProgressState.timer) {
    window.clearTimeout(setProgressState.timer);
    setProgressState.timer = undefined;
  }
  root.classList.toggle("is-swup-loading", state === "loading");
  root.classList.toggle("is-swup-rendering", state === "rendering");
  root.classList.toggle("is-swup-done", state === "done");
  if (state === "loading") setProgressState.startedAt = performance.now();
  if (state === "done") {
    setProgressState.timer = window.setTimeout(() => {
      root.classList.remove("is-swup-done");
      setProgressState.timer = undefined;
    }, 240);
  }
}

// 瞬时滚顶（源站 Se）：临时关闭 smooth 滚动，滚完恢复
function instantScrollTop() {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo({ left: 0, top: 0, behavior: "auto" });
  root.scrollTop = 0;
  document.body.scrollTop = 0;
  window.requestAnimationFrame(() => {
    root.style.scrollBehavior = previous;
  });
  return true;
}

function boot() {
  if (window.__siteSwupBooted) return;
  window.__siteSwupBooted = true;

  const swup = new Swup({
    containers: ["#swup"],
    animateHistoryBrowsing: false,
    animationSelector: "#swup",
    linkSelector:
      'a[href]:not([target="_blank"]):not([download]):not([data-no-swup]):not([href^="#"]):not([href^="mailto:"]):not([href^="tel:"])',
    ignoreVisit: (url, { el } = {}) => {
      const target = el?.getAttribute("target");
      return !!target && target !== "_self";
    },
    plugins: [
      new SwupPreloadPlugin({ preloadVisibleLinks: false, preloadHoveredLinks: true }),
      new SwupScrollPlugin(),
    ],
  });
  window.__siteSwup = swup;

  swup.hooks.on("scroll:top", instantScrollTop, { replace: true });

  swup.hooks.on("visit:start", (visit) => {
    setProgressState("loading");
    dispatchEvents(BEFORE_SWAP_EVENTS, { visit, newDocument: visit.to.document });
  });

  swup.hooks.before("content:replace", async (visit) => {
    await loadStyles(visit.to.document);
  });

  swup.hooks.on("content:replace", (visit) => {
    const detail = { visit, newDocument: visit.to.document };
    setProgressState("rendering");
    replaceHeadMeta(detail.newDocument);
    syncResources(detail.newDocument);
    runBodyScripts(detail.newDocument);
    runScopeScripts(document.querySelector("#swup") ?? document);
    // 源站 $()：after-swap 与 page-load 各派发两次（立即 + rAF）
    dispatchEvents(AFTER_SWAP_EVENTS, detail);
    dispatchEvents(PAGE_LOAD_EVENTS, detail);
    window.requestAnimationFrame(() => {
      dispatchEvents(AFTER_SWAP_EVENTS, detail);
      dispatchEvents(PAGE_LOAD_EVENTS, detail);
    });
  });

  swup.hooks.on("page:view", (visit) => {
    dispatchEvents(AFTER_SWAP_EVENTS, { visit, newDocument: visit.to.document });
    dispatchEvents(PAGE_LOAD_EVENTS, { visit, newDocument: visit.to.document });
    const elapsed = performance.now() - (setProgressState.startedAt ?? 0);
    window.setTimeout(() => setProgressState("done"), Math.max(0, MIN_DURATION - elapsed));
  });

  markScriptsExecuted();
  runScopeScripts(document.querySelector("#swup") ?? document);
  dispatchEvents(["site:router-ready"]);
}

boot();
