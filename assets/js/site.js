// 全站行为（阶段①）· 1:1 移植源站 header.js / scroll-progress / cursor-glow
// 药丸弹簧参数与源站一致：stiffness=7000, damping exp(-96t), 阈值 0.1/0.6

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// ---------- glide 药丸（源站 header.js 精确移植） ----------
const GLIDE_TRACK = "[data-glide-track]";
const GLIDE_PILL = "[data-glide-pill]";
const GLIDE_ITEM = "[data-glide-item]";
const STRETCH_K = 0.002, STRETCH_MAX = 10, SETTLE_POS = 0.1, SETTLE_VEL = 0.6, PILL_SCALE_HIDDEN = 0.92;
const round2 = (v) => Math.round(v * 100) / 100;

function makePillState(track) {
  const pill = track.querySelector(`:scope > ${GLIDE_PILL}`);
  if (!pill) return null;
  return {
    container: track, pill, aimed: null,
    centerX: { value: 0, velocity: 0 }, centerY: { value: 0, velocity: 0 },
    width: { value: 0, velocity: 0 }, height: { value: 0, velocity: 0 },
    targetCenterX: 0, targetCenterY: 0, targetWidth: 0, targetHeight: 0,
    visible: false, frame: 0, lastTime: 0,
  };
}

function aimPill(state, item) {
  const tb = state.container.getBoundingClientRect();
  const rb = item.getBoundingClientRect();
  const ox = rb.left - (tb.left + state.container.clientLeft);
  const oy = rb.top - (tb.top + state.container.clientTop);
  state.targetCenterX = ox + rb.width / 2;
  state.targetCenterY = oy + rb.height / 2;
  state.targetWidth = rb.width;
  state.targetHeight = rb.height;
}

function renderPill(state) {
  const vx = state.centerX.velocity;
  const dir = vx > 0 ? 1 : vx < 0 ? -1 : 0;
  const stretch = Math.min(Math.abs(vx) * STRETCH_K, STRETCH_MAX);
  const w = Math.max(state.width.value, 0);
  const h = Math.max(state.height.value, 0);
  const half = w / 2;
  const left = state.centerX.value - half - (dir > 0 ? stretch : 0);
  const right = state.centerX.value + half + (dir < 0 ? stretch : 0);
  const top = state.centerY.value - h / 2;
  const scale = state.visible ? 1 : PILL_SCALE_HIDDEN;
  state.pill.style.transform = `translate3d(${round2(left)}px, ${round2(top)}px, 0) scale(${scale})`;
  state.pill.style.width = `${round2(right - left)}px`;
  state.pill.style.height = `${round2(h)}px`;
}

function springTo(prop, target, dt) {
  prop.velocity += (target - prop.value) * 7000 * dt;
  prop.velocity *= Math.exp(-96 * dt);
  prop.value += prop.velocity * dt;
  return Math.abs(target - prop.value) < SETTLE_POS && Math.abs(prop.velocity) < SETTLE_VEL;
}

function pillFrame(state, t) {
  if (!state.pill.isConnected) { state.frame = 0; return; }
  const dt = Math.min(Math.max((state.lastTime ? t - state.lastTime : 1000 / 60) / 1000, 0.001), 1 / 30);
  state.lastTime = t;
  const doneX = springTo(state.centerX, state.targetCenterX, dt);
  const doneY = springTo(state.centerY, state.targetCenterY, dt);
  const doneW = springTo(state.width, state.targetWidth, dt);
  const doneH = springTo(state.height, state.targetHeight, dt);
  if (doneX && doneY && doneW && doneH) {
    state.centerX.value = state.targetCenterX; state.centerY.value = state.targetCenterY;
    state.width.value = state.targetWidth; state.height.value = state.targetHeight;
    state.centerX.velocity = 0; state.centerY.velocity = 0; state.width.velocity = 0; state.height.velocity = 0;
    state.lastTime = 0; state.frame = 0;
    renderPill(state);
    return;
  }
  renderPill(state);
  state.frame = requestAnimationFrame((tt) => pillFrame(state, tt));
}

function startPill(state) {
  if (!state.frame) { state.lastTime = 0; state.frame = requestAnimationFrame((t) => pillFrame(state, t)); }
}
function stopPill(state) {
  if (state.frame) cancelAnimationFrame(state.frame);
  state.frame = 0; state.lastTime = 0;
}
function pillAim(state, item) {
  const first = !state.visible;
  state.aimed = item;
  state.visible = true;
  state.pill.classList.add("is-active");
  snapPillOrSpring(state, item, first || reducedMotion.matches);
}
function pillReset(state) {
  if (!state.visible) return;
  state.visible = false;
  state.aimed = null;
  state.pill.classList.remove("is-active");
  renderPill(state);
  startPill(state);
}
function snapPillOrSpring(state, item, snap) {
  aimPill(state, item);
  if (snap) { snapPillFinal(state); return; }
  startPill(state);
}
function snapPillFinal(state) {
  stopPill(state);
  state.centerX.value = state.targetCenterX; state.centerY.value = state.targetCenterY;
  state.width.value = state.targetWidth; state.height.value = state.targetHeight;
  state.centerX.velocity = 0; state.centerY.velocity = 0; state.width.velocity = 0; state.height.velocity = 0;
  renderPill(state);
}
function bindPillTrack(state, signal) {
  const container = state.container;
  const findItem = (e) => {
    if (!(e instanceof Element)) return null;
    const t = e.closest(GLIDE_ITEM);
    return t && t.closest(GLIDE_TRACK) === container ? t : null;
  };
  container.addEventListener("pointerover", (e) => {
    const item = findItem(e.target);
    item && pillAim(state, item);
  }, { signal });
  container.addEventListener("pointerleave", () => pillReset(state), { signal });
  container.addEventListener("focusin", (e) => {
    const item = findItem(e.target);
    item && pillAim(state, item);
  }, { signal });
  container.addEventListener("focusout", (e) => {
    if (e.relatedTarget instanceof Node && container.contains(e.relatedTarget)) return;
    pillReset(state);
  }, { signal });
  const reaim = () => { state.visible && state.aimed && snapPillOrSpring(state, state.aimed, reducedMotion.matches); };
  window.addEventListener("resize", reaim, { passive: true, signal });
  document.addEventListener("scroll", reaim, { passive: true, signal });
}
function initGlidePills(signal) {
  document.querySelectorAll(GLIDE_TRACK).forEach((track) => {
    const state = makePillState(track);
    state && bindPillTrack(state, signal);
  });
}

// ---------- 头部滚动态（源站行为：border 线恒为 opacity-0） ----------
function initHeaderScroll(signal) {
  const header = document.getElementById("main-header");
  const border = document.getElementById("header-border");
  if (!header || !border) return;
  let raf = false;
  const onScroll = () => {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      header.classList.toggle("header-scrolled", window.scrollY > 15);
      border.classList.toggle("opacity-0", true);
      border.classList.toggle("opacity-100", false);
      raf = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true, signal });
  onScroll();
}

// ---------- 头部返回顶部按钮（conic-gradient 进度环） ----------
function initScrollTopButton(signal) {
  const btn = document.querySelector("[data-header-scroll-top]");
  const percent = btn?.querySelector("[data-header-scroll-percent]");
  const ring = btn?.querySelector("[data-header-scroll-progress]");
  if (!btn || !percent || !ring) return;
  let raf = false;
  const update = () => {
    const doc = document.documentElement;
    const top = doc.scrollTop || window.scrollY || 0;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? Math.round((Math.min(top / max, 1) || 0) * 100) : 0;
    const show = top > 15 && max > 0;
    btn.classList.toggle("is-visible", show);
    btn.tabIndex = show ? 0 : -1;
    btn.setAttribute("aria-hidden", String(!show));
    percent.textContent = String(pct);
    ring.style.backgroundImage = `conic-gradient(var(--accent) ${pct}%, transparent ${pct}%)`;
  };
  const onScroll = () => {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => { update(); raf = false; });
  };
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" }), { signal });
  document.addEventListener("scroll", onScroll, { passive: true, signal });
  window.addEventListener("resize", onScroll, { passive: true, signal });
  update();
}

// ---------- 移动抽屉 ----------
function setMobileMenu(open) {
  const btn = document.getElementById("menu-btn");
  const menu = document.getElementById("mobile-menu");
  if (!btn || !menu) return;
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  btn.setAttribute("aria-label", open ? "Close Menu" : "Open Menu");
  menu.classList.toggle("is-open", open);
  menu.setAttribute("aria-hidden", open ? "false" : "true");
}
function initMobileMenu(signal) {
  setMobileMenu(false);
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("#menu-btn")) { 
      const btn = document.getElementById("menu-btn");
      setMobileMenu(btn?.getAttribute("aria-expanded") !== "true");
      return;
    }
    if (t.closest(".mobile-menu-close, .mobile-menu-backdrop")) { setMobileMenu(false); return; }
    if (t.closest("#mobile-menu a")) setMobileMenu(false);
  }, { signal });
  document.addEventListener("keydown", (e) => { e.key === "Escape" && setMobileMenu(false); }, { signal });
}

// ---------- 移动端目录抽屉（源站 header.js A/j/M/E 1:1） ----------
function getMobileToc() {
  const trigger = document.querySelector("[data-mobile-toc-trigger]");
  const drawer = document.querySelector("[data-mobile-toc-drawer]");
  return !trigger || !drawer ? null : { trigger, drawer };
}
function setMobileToc(open) {
  const parts = getMobileToc();
  if (!parts) return;
  const { trigger, drawer } = parts;
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
  trigger.setAttribute("aria-label", open ? "关闭目录" : "打开目录");
  drawer.classList.toggle("is-open", open);
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
}
function initMobileToc(signal) {
  const parts = getMobileToc();
  if (!parts) return;
  setMobileToc(false);
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("[data-mobile-toc-trigger]")) {
      const cur = getMobileToc();
      setMobileToc(cur.trigger.getAttribute("aria-expanded") !== "true");
      return;
    }
    if (t.closest("[data-mobile-toc-close]")) setMobileToc(false);
  }, { signal });
  parts.drawer.addEventListener("toc:navigate", () => setMobileToc(false), { signal });
  document.addEventListener("keydown", (e) => { e.key === "Escape" && setMobileToc(false); }, { signal });
}

// ---------- 下拉菜单（hover 由 CSS 驱动；JS 只管键盘与点外关闭） ----------
function initDropdowns(signal) {
  document.querySelectorAll(".nav-dropdown-trigger").forEach((trigger) => {
    const item = trigger.closest(".nav-menu-item");
    const dropdown = item?.querySelector(".nav-dropdown");
    if (!item || !dropdown) return;
    trigger.addEventListener("keydown", (e) => {
      if (!(e instanceof KeyboardEvent) || e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const open = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", (!open).toString());
      dropdown.classList.toggle("opacity-100");
      dropdown.classList.toggle("visible");
      dropdown.classList.toggle("opacity-0");
      dropdown.classList.toggle("invisible");
    }, { signal });
    document.addEventListener("click", (e) => {
      if (e.target instanceof Node && item.contains(e.target)) return;
      trigger.setAttribute("aria-expanded", "false");
      dropdown.classList.add("opacity-0", "invisible");
      dropdown.classList.remove("opacity-100", "visible");
    }, { signal });
  });
}

// ---------- 鼠标跟随光晕 ----------
function initCursorGlow() {
  const glow = document.querySelector(".site-cursor-glow");
  if (!glow) return;
  if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
  let raf = false, active = false;
  document.addEventListener("mousemove", (e) => {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      glow.style.setProperty("--site-cx", `${e.clientX}px`);
      glow.style.setProperty("--site-cy", `${e.clientY}px`);
      if (!active) { glow.classList.add("active"); active = true; }
      raf = false;
    });
  }, { passive: true });
  document.addEventListener("mouseleave", () => { glow.classList.remove("active"); active = false; });
}

// ---------- 滚动进度条 ----------
function initScrollProgress(signal) {
  const bar = document.querySelector("[data-scroll-progress-bar]");
  if (!bar) return;
  let raf = false;
  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? window.scrollY / max : 0;
    bar.style.width = `${(pct * 100).toFixed(2)}%`;
  };
  const onScroll = () => {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => { update(); raf = false; });
  };
  document.addEventListener("scroll", onScroll, { passive: true, signal });
  window.addEventListener("resize", onScroll, { passive: true, signal });
  update();
}

const controller = new AbortController();
initHeaderScroll(controller.signal);
initScrollTopButton(controller.signal);
initMobileMenu(controller.signal);
initMobileToc(controller.signal);
initDropdowns(controller.signal);
initGlidePills(controller.signal);
initScrollProgress(controller.signal);
initCursorGlow();

// ---------- 站内通知条（阶段⑤，全局） ----------
import("./snackbar.js");

// ---------- 主题模块（阶段⑤）：补齐 toggle/reflect/fade/auto ----------
import("./theme.js");

// ---------- 中控台（阶段⑤） ----------
if (document.querySelector("[data-control-console-trigger]")) {
  import("./control-console.js").then((m) => m.initControlConsole(controller.signal));
}

// ---------- 右键菜单（阶段⑤） ----------
if (document.getElementById("site-context-menu-root")) {
  import("./context-menu.js").then((m) => m.initContextMenu(controller.signal));
}

// ---------- 搜索弹窗（阶段⑤） ----------
if (document.getElementById("search-modal")) {
  import("./search-modal.js").then((m) => m.initSearchModal());
}

// ---------- 首页行为（阶段②）----------
if (document.getElementById("bber-talk") || document.querySelector("[data-patron-card]")) {
  import("./home.js").then((m) => m.initHome(controller.signal));
}

// ---------- Aurora 光效（阶段④，全站）----------
import("./aurora.js").then((m) => m.initAuroraEffects(controller.signal));

// ---------- 页面级行为（阶段④）----------
if (document.querySelector("[data-fc-root]")) {
  import("./fcircle.js").then((m) => m.initFcircle());
}
const shuoshuoFeed = document.getElementById("shuoshuo-feed");
if (shuoshuoFeed && shuoshuoFeed.dataset.source === "local") {
  import("./shuoshuo-local.js").then((m) => m.initShuoshuoPage(controller.signal));
} else if (shuoshuoFeed && shuoshuoFeed.dataset.source === "tg") {
  import("./shuoshuo-tg.js").then((m) => m.initShuoshuoPage(controller.signal));
} else if (shuoshuoFeed) {
  import("./shuoshuo-page.js").then((m) => m.initShuoshuoPage(controller.signal));
}
if (document.querySelector(".friend-card[data-href]")) {
  import("./friend-status.js").then((m) => m.initLinkPage(controller.signal));
}
if (document.querySelector("[data-copy-rss]") || document.querySelector("[data-fill-apply-template]") || document.querySelector(".patron-qr-image")) {
  import("./page-extras.js").then((m) => m.initPageExtras(controller.signal));
}

// ---------- 独立搜索页（查漏补缺） ----------
if (document.getElementById("algolia-search")) {
  import("./search-page.js").then((m) => m.initSearchPage(controller.signal));
}

// ---------- 安全跳转页（查漏补缺） ----------
if (document.querySelector("[data-safego]")) {
  import("./safego.js").then((m) => m.initSafego());
}

// ---------- 文章过期提示（查漏补缺） ----------
if (document.querySelector("[data-post-outdate-notice]")) {
  import("./outdate-notice.js").then((m) => m.initOutdateNotice());
}

// ---------- 音乐胶囊（查漏补缺） ----------
if (document.getElementById("nav-music")) {
  import("./music-capsule.js").then((m) => m.initMusicCapsule(controller.signal));
}

// ---------- 评论（阶段⑥）：按 provider 加载对应 bundle ----------
if (document.getElementById("artalk-comments")) {
  import("./comment-artalk.js").then((m) =>
    m.initArtalk(controller.signal, {
      server: document.getElementById("artalk-comments").dataset.server,
      site: document.getElementById("artalk-comments").dataset.site,
    })
  );
}
if (document.getElementById("twikoo-comments")) {
  import("./comment-twikoo.js").then((m) =>
    m.initTwikoo({ envId: document.getElementById("twikoo-comments").dataset.envId })
  );
}

