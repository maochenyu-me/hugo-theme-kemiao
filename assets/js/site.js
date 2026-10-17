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

// ---------- 移动端目录抽屉（源站 header.js A/j/M/E 1:1；文档级委托，切页不重绑） ----------
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
  document.addEventListener("toc:navigate", () => setMobileToc(false), { signal });
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

// ============================================================
// 初始化管线（swup 架构）：
// - 全局一次：文档级委托 / swup 容器外的元素（snackbar、主题、搜索弹窗、
//   右键菜单、滚动进度条、音乐胶囊等，切页不重绑、播放不中断）
// - 每页重挂：swup 容器内的元素（header、药丸、文章页、评论等），
//   由 site:page-load 事件驱动，上一页监听随 AbortController 一并作废
// ============================================================

const globalController = new AbortController();
const globalSignal = globalController.signal;

initScrollProgress(globalSignal);
initCursorGlow();
initMobileMenu(globalSignal);
initMobileToc(globalSignal);

// ---------- 站内通知条（全局） ----------
import("./snackbar.js");

// ---------- 主题模块（全局） ----------
import("./theme.js");

// ---------- 右键菜单（容器外，全局一次） ----------
if (document.getElementById("site-context-menu-root")) {
  import("./context-menu.js").then((m) => m.initContextMenu(globalSignal));
}

// ---------- 搜索弹窗（容器外，全局一次） ----------
if (document.getElementById("search-modal")) {
  import("./search-modal.js").then((m) => m.initSearchModal());
}

// ---------- 音乐胶囊（容器外，全局一次；换页不刷新播放） ----------
if (document.getElementById("nav-music")) {
  import("./music-capsule.js").then((m) => m.initMusicCapsule(globalSignal));
}

// ---------- swup 页面路由（全局一次；派发 site:page-load） ----------
import("./swup-router.js");

// ---------- 每页初始化 ----------
let pageController = null;
let lastPageToken = Symbol("initial");

function onPageReady(importPromise, setup, controller) {
  // 动态 import 是单例缓存；但初始化完成前页面可能已再次切换，
  // 以 controller 身份校验避免过期实例挂到新页面上
  importPromise.then((m) => {
    if (!controller.signal.aborted && controller === pageController) setup(m);
  });
}

function initPage(event) {
  // swup 一次换页会派发多次 site:page-load（content:replace / rAF / page:view），
  // 同一份 newDocument 只初始化一次，避免 abort 掉刚绑好的监听
  const token = event?.detail?.newDocument ?? event?.detail?.visit ?? null;
  if (token && token === lastPageToken) return;
  lastPageToken = token;

  pageController?.abort();
  const controller = new AbortController();
  pageController = controller;
  const signal = controller.signal;

  initHeaderScroll(signal);
  initScrollTopButton(signal);
  initGlidePills(signal);
  initDropdowns(signal);
  setMobileMenu(false);
  setMobileToc(false);

  // Aurora 光效：光球/光斑跟随的宿主都在容器内
  onPageReady(import("./aurora.js"), (m) => m.initAuroraEffects(signal), controller);

  // 中控台（触发按钮在 header 内）
  if (document.querySelector("[data-control-console-trigger]")) {
    onPageReady(import("./control-console.js"), (m) => m.initControlConsole(signal), controller);
  }

  // 首页行为
  if (document.getElementById("bber-talk") || document.querySelector("[data-patron-card]")) {
    onPageReady(import("./home.js"), (m) => m.initHome(signal), controller);
  }

  // 欢迎来访者卡（首页右栏 / 文章侧栏共用）
  if (document.getElementById("welcome-info")) {
    onPageReady(import("./welcome-info.js"), (m) => m.initWelcomeInfo(signal), controller);
  }

  // 流量数据卡（Umami 分享接口）
  if (document.querySelector("[data-traffic-card]")) {
    onPageReady(import("./traffic-overview.js"), (m) => m.initTrafficOverview(signal), controller);
  }

  // 文章页行为（原 single.html 容器内脚本，改为管线统一加载）
  if (document.getElementById("article")) {
    onPageReady(import("./article.js"), (m) => m.initArticle(signal), controller);
  }

  // 全局灯箱：文章正文图片（说说/评论/赞赏码由各自模块经 openAnchorLightbox/openLightbox 打开）
  onPageReady(import("./lightbox.js"), (m) => m.initLightbox(signal), controller);

  // 浮动最近评论（容器外元素，但按页重置状态；ecoku 下模板不渲染、模块内部直接隐藏）
  onPageReady(import("./floating-recent-comments.js"), (m) => m.initFloatingRecentComments(signal), controller);

  // 说说页：列表页按数据源，详情页单卡走本地渲染
  const shuoshuoFeed = document.getElementById("shuoshuo-feed");
  if (shuoshuoFeed && shuoshuoFeed.dataset.source === "local") {
    onPageReady(import("./shuoshuo-local.js"), (m) => m.initShuoshuoPage(signal), controller);
  } else if (shuoshuoFeed && shuoshuoFeed.dataset.source === "tg") {
    onPageReady(import("./shuoshuo-tg.js"), (m) => m.initShuoshuoPage(signal), controller);
  } else if (shuoshuoFeed && shuoshuoFeed.dataset.source === "api") {
    onPageReady(import("./shuoshuo-page.js"), (m) => m.initShuoshuoPage(signal), controller);
  } else if (document.querySelector(".shuoshuo-feed")) {
    onPageReady(import("./shuoshuo-local.js"), (m) => m.initShuoshuoPage(signal), controller);
  }

  // 朋友圈
  if (document.querySelector("[data-fc-root]")) {
    onPageReady(import("./fcircle.js"), (m) => m.initFcircle(), controller);
  }

  // 友链可达性
  if (document.querySelector(".friend-card[data-href]")) {
    onPageReady(import("./friend-status.js"), (m) => m.initLinkPage(signal), controller);
  }

  // 页面杂项：RSS 复制 / 申请模板 / 赞赏码灯箱
  if (document.querySelector("[data-copy-rss]") || document.querySelector("[data-fill-apply-template]") || document.querySelector(".patron-qr-image")) {
    onPageReady(import("./page-extras.js"), (m) => m.initPageExtras(signal), controller);
  }

  // 独立搜索页
  if (document.getElementById("algolia-search")) {
    onPageReady(import("./search-page.js"), (m) => m.initSearchPage(signal), controller);
  }

  // 安全跳转页
  if (document.querySelector("[data-safego]")) {
    onPageReady(import("./safego.js"), (m) => m.initSafego(), controller);
  }

  // 文章过期提示
  if (document.querySelector("[data-post-outdate-notice]")) {
    onPageReady(import("./outdate-notice.js"), (m) => m.initOutdateNotice(), controller);
  }

  // ---------- 评论：评论区接近视口才初始化（首屏不加载评论厂商资源） ----------
  const commentSection = document.getElementById("comment-section");
  if (commentSection) {
    const startComments = () => {
      const ecoku = document.getElementById("ecoku-comments");
      if (ecoku) {
        const src = ecoku.dataset.ecokuJs;
        if (src) {
          const loader = document.createElement("script");
          loader.src = src;
          loader.defer = true;
          document.body.appendChild(loader);
        }
        return;
      }
      const artalk = document.getElementById("artalk-comments");
      if (artalk) {
        onPageReady(
          import("./comment-artalk.js"),
          (m) => m.initArtalk(signal, { server: artalk.dataset.server, site: artalk.dataset.site }),
          controller
        );
        return;
      }
      const twikoo = document.getElementById("twikoo-comments");
      if (twikoo) {
        onPageReady(import("./comment-twikoo.js"), (m) => m.initTwikoo({ envId: twikoo.dataset.envId }), controller);
      }
    };
    const commentObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      commentObserver.disconnect();
      if (!signal.aborted) startComments();
    }, { rootMargin: "600px 0px" });
    commentObserver.observe(commentSection);
    signal.addEventListener("abort", () => commentObserver.disconnect(), { once: true });
  }
}

initPage();
document.addEventListener("site:page-load", initPage);

