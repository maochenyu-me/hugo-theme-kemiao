// 音乐胶囊（源站 music-capsule 1:1）：APlayer/Meting 资产懒加载、播放态、拉伸、贴底隐藏
import { getPreference } from "./site-preferences.js";

const CONFIG = {
  aplayerCss: "",
  aplayerScript: "",
  metingScript: "",
  endHideWidth: 1600, endHideBottom: 120,
};

function readConfig() {
  const box = document.getElementById("nav-music");
  if (!box) return;
  CONFIG.aplayerCss = box.dataset.aplayerCss || CONFIG.aplayerCss;
  CONFIG.aplayerScript = box.dataset.aplayerScript || CONFIG.aplayerScript;
  CONFIG.metingScript = box.dataset.metingScript || CONFIG.metingScript;
}

const runtime = (window.__musicCapsuleRuntime ??= {});
let wantsPlay = false;
let signal = null;

function prefEnabled() {
  try {
    return getPreference("musicCapsule") !== false;
  } catch { return true; }
}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const exist = document.querySelector(`script[src="${src}"]`);
    if (exist) {
      if (exist.dataset.loaded === "true") { resolve(); return; }
      exist.addEventListener("load", () => resolve(), { once: true });
      exist.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = "true"; resolve(); };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function host() {
  const hosts = Array.from(document.querySelectorAll("#nav-music"));
  const main = runtime.playerHost && document.contains(runtime.playerHost) ? runtime.playerHost : hosts[0];
  hosts.forEach((h) => { if (h !== main) h.remove(); });
  runtime.playerHost = main;
  return main ?? null;
}

const metingEl = () => host()?.querySelector("meting-js") ?? null;

function setPlaying(playing) {
  const box = host();
  const btn = box?.querySelector("[data-music-capsule-toggle]");
  box?.classList.toggle("playing", playing);
  box?.classList.toggle("stretch", playing);
  btn?.setAttribute("aria-label", playing ? "暂停音乐" : "播放音乐");
}

function pause() {
  wantsPlay = false;
  (runtime.player ?? metingEl()?.aplayer)?.pause();
  setPlaying(false);
}

function applyUserHidden() {
  const enabled = prefEnabled();
  const box = host();
  box?.classList.toggle("is-user-hidden", !enabled);
  box?.setAttribute("aria-hidden", String(!enabled));
  if (!enabled) pause();
  return enabled;
}

function isPlaying() {
  const player = runtime.player ?? metingEl()?.aplayer;
  if (player?.audio) return !player.audio.paused;
  return host()?.classList.contains("playing") === true;
}

function attachPlayer(player) {
  if (!player) return;
  const box = host();
  runtime.player = player;
  box?.classList.add("is-ready");
  if (!applyUserHidden()) return;
  if (!runtime.playerSynced) {
    runtime.playerSynced = true;
    player.on?.("play", () => setPlaying(true));
    player.on?.("pause", () => setPlaying(false));
    player.audio?.addEventListener("playing", () => setPlaying(true));
    player.audio?.addEventListener("pause", () => setPlaying(false));
    player.audio?.addEventListener("ended", () => setPlaying(false));
  }
  setPlaying(!player.audio?.paused);
  if (wantsPlay) {
    wantsPlay = false;
    Promise.resolve(player.play()).then(() => setPlaying(true)).catch(() => setPlaying(false));
  }
}

function waitForPlayer() {
  const start = Date.now();
  (function poll() {
    if (signal && signal.aborted) return;
    const player = runtime.player ?? metingEl()?.aplayer;
    if (player) { attachPlayer(player); bindInner(); return; }
    if (Date.now() - start < 20000) window.setTimeout(poll, 200);
  })();
}

function loadAssets() {
  if (runtime.assetsLoaded) return Promise.resolve();
  runtime.assetsPromise ??= (async () => {
    loadCss(CONFIG.aplayerCss);
    await loadScript(CONFIG.aplayerScript);
    await loadScript(CONFIG.metingScript);
    runtime.assetsLoaded = true;
  })().catch((e) => { runtime.assetsPromise = null; throw e; });
  return runtime.assetsPromise;
}

function preload() {
  if (!prefEnabled()) return;
  if (runtime.assetsLoaded || runtime.player) { waitForPlayer(); return; }
  (window.requestIdleCallback || ((f) => window.setTimeout(f, 1)))(() => {
    loadAssets().then(waitForPlayer).catch(() => { wantsPlay = false; });
  });
}

function toggle() {
  if (!prefEnabled()) return;
  const player = runtime.player ?? metingEl()?.aplayer;
  if (!player) { wantsPlay = true; preload(); return; }
  if (isPlaying()) { player.pause(); setPlaying(false); return; }
  Promise.resolve(player.play()).then(() => setPlaying(true)).catch(() => setPlaying(false));
}

function bindInner() {
  const box = host();
  if (!box || !signal) return;
  const music = box.querySelector(".aplayer-music");
  const button = box.querySelector(".aplayer-button");
  // APlayer 自身在 .aplayer-pic 上监听 click 并调用 player.toggle()，
  // 这里再绑一个 toggle 会导致一次点击触发两次（先 pause 再 play，表现为"点了没反应"）。
  // 源站同理只绑 .aplayer-music（拉伸），播放/暂停交给 APlayer 原生处理。
  if (runtime.innerBound === button) {
    attachPlayer(runtime.player ?? metingEl()?.aplayer);
    return;
  }
  runtime.innerBound = button;
  music?.addEventListener("click", (e) => {
    e.stopPropagation();
    box.classList.toggle("stretch");
  }, { signal: signal });
  attachPlayer(runtime.player ?? metingEl()?.aplayer);
}

function endHideCheck() {
  const box = host();
  if (!box) return;
  const total = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const bottom = total - window.innerHeight - (window.scrollY || document.documentElement.scrollTop || 0);
  const hide = window.innerWidth <= CONFIG.endHideWidth && bottom <= CONFIG.endHideBottom;
  box.classList.toggle("is-end-hide", hide);
}

export function initMusicCapsule(s) {
  signal = s;
  readConfig();
  const box = host();
  const toggleBtn = box?.querySelector("[data-music-capsule-toggle]");
  if (!box || !toggleBtn) return;

  setPlaying(isPlaying());
  applyUserHidden();

  // 懒加载：APlayer/Meting 体积不小，且会额外请求歌单与封面，
  // 改为用户第一次 hover / 聚焦 / 点击胶囊时才加载，首屏不再产生音乐相关请求
  let armed = false;
  const arm = () => {
    if (armed || !applyUserHidden()) return;
    armed = true;
    preload();
  };
  box.addEventListener("pointerenter", arm, { signal, once: true });
  box.addEventListener("focusin", arm, { signal, once: true });

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    arm();
    toggle();
  }, { signal: signal });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause();
  }, { signal: signal });

  document.addEventListener("scroll", endHideCheck, { passive: true, signal: signal });
  window.addEventListener("resize", endHideCheck, { passive: true, signal: signal });
  endHideCheck();

  document.addEventListener("site:preferences-change", () => {
    applyUserHidden();
  }, { signal: signal });
}
