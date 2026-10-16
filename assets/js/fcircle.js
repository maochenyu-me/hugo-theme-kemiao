// 友链朋友圈：1:1 移植源站 fcircle 模块（统计/随机阅读/卡片流/分页/弹窗）
const CFG = {
  api: document.querySelector("[data-fc-root]")?.dataset.fcApi || "",
  pageSize: 24,
  cacheTtl: 600000,
  errorAvatar: "https://i.p-i.vip/30/20240815-66bced9226a36.webp",
  projectUrl: "https://github.com/willow-god/Friend-Circle-Lite",
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function openUrl(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

let articles = [];
let cursor = 0;
let root, randomBox, listBox, moreBtn, metaEl, updatedEl;

function showError(msg) {
  randomBox.innerHTML = "";
  const box = el("div", "fc-error");
  const span = el("span", "", msg);
  const btn = el("button", "", "重新加载");
  btn.type = "button";
  btn.addEventListener("click", () => load(true));
  box.append(span, btn);
  randomBox.append(box);
}

function stat(num, label) {
  const n = el("div", "fc-stat");
  n.append(el("strong", "", String(num)), el("span", "", label));
  return n;
}

function showRandom(data) {
  const pick = () => articles[Math.floor(Math.random() * articles.length)];
  const item = pick();
  if (!item) return;
  randomBox.innerHTML = "";
  const stats = el("div", "fc-stats");
  const s = data.statistical_data;
  stats.append(stat(s.friends_num, "订阅"), stat(s.active_num, "活跃"), stat(s.article_num, "文章"), stat(s.error_num, "异常"));
  const panel = el("div", "fc-random-panel");
  const content = el("div", "fc-random-content");
  content.append(el("div", "fc-kicker", "Random Walk"));
  const title = el("button", "fc-random-title", item.title);
  title.type = "button";
  title.addEventListener("click", () => openUrl(item.link));
  content.append(title, el("div", "fc-random-info", `${item.author} · ${item.created.slice(0, 10)}`));
  const actions = el("div", "fc-random-actions");
  const swap = el("button", "", "换一篇");
  swap.type = "button";
  swap.addEventListener("click", () => showRandom(data));
  const read = el("button", "", "阅读文章");
  read.type = "button";
  read.addEventListener("click", () => openUrl(item.link));
  actions.append(swap, read);
  panel.append(content, actions);
  randomBox.append(stats, panel);
}

function showAuthorModal(item) {
  document.getElementById("fc-modal")?.remove();
  const modal = el("div", "fc-modal");
  modal.id = "fc-modal";
  const card = el("div", "fc-modal-card");
  const avatar = el("img", "fc-modal-avatar");
  avatar.src = item.avatar || CFG.errorAvatar;
  avatar.alt = "";
  avatar.onerror = () => (avatar.src = CFG.errorAvatar);
  const bg = el("img", "fc-modal-bg");
  bg.src = avatar.src;
  bg.alt = "";
  bg.onerror = () => (bg.src = CFG.errorAvatar);
  const author = el("a", "", item.author);
  author.href = new URL(item.link).origin;
  author.target = "_blank";
  author.rel = "noopener noreferrer nofollow";
  const posts = el("div", "fc-modal-posts");
  articles
    .filter((a) => a.author === item.author)
    .slice(0, 4)
    .forEach((a) => {
      const link = el("a", "fc-modal-post");
      link.href = a.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer nofollow";
      link.append(el("span", "", a.title), el("time", "", a.created.slice(0, 10)));
      posts.append(link);
    });
  card.append(bg, avatar, author, posts);
  modal.append(card);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("fc-modal-open");
  });
  modal.addEventListener("transitionend", (e) => {
    if (e.target === modal && !modal.classList.contains("fc-modal-open")) modal.remove();
  });
  document.body.append(modal);
  requestAnimationFrame(() => modal.classList.add("fc-modal-open"));
}

function makeCard(item, idx) {
  const card = el("article", "fc-card app-card");
  card.style.animationDelay = `${Math.min(idx, 8) * 0.03}s`;
  const title = el("a", "fc-card-title", item.title);
  title.title = item.title;
  title.href = item.link;
  title.target = "_blank";
  title.rel = "noopener noreferrer nofollow";
  const author = el("button", "fc-author");
  author.type = "button";
  const avatar = el("img");
  avatar.src = item.avatar || CFG.errorAvatar;
  avatar.alt = "";
  avatar.loading = "lazy";
  avatar.decoding = "async";
  avatar.onerror = () => (avatar.src = CFG.errorAvatar);
  author.append(avatar, el("span", "", item.author));
  author.addEventListener("click", () => showAuthorModal(item));
  const date = el("time", "fc-date", item.created.slice(0, 10));
  const bgImg = el("img", "fc-card-bg");
  bgImg.src = item.avatar || CFG.errorAvatar;
  bgImg.alt = "";
  bgImg.loading = "lazy";
  bgImg.decoding = "async";
  bgImg.onerror = () => (bgImg.src = CFG.errorAvatar);
  card.append(title, author, date, bgImg);
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
  });
  return card;
}

function loadMore() {
  const batch = articles.slice(cursor, cursor + CFG.pageSize);
  const frag = document.createDocumentFragment();
  batch.forEach((a, i) => frag.append(makeCard(a, i)));
  listBox.append(frag);
  cursor += batch.length;
  moreBtn.hidden = cursor >= articles.length;
}

function apply(data) {
  articles = data.article_data || [];
  cursor = 0;
  listBox.innerHTML = "";
  moreBtn.hidden = true;
  if (updatedEl && data.statistical_data) updatedEl.textContent = `更新于 ${data.statistical_data.last_updated_time}`;
  const link = el("a", "", "FriendCircleLite");
  link.href = CFG.projectUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  metaEl.textContent = "Powered by ";
  metaEl.append(link, document.createElement("br"), `共 ${articles.length} 篇文章 · ${data.statistical_data.last_updated_time}`);
  showRandom(data);
  loadMore();
}

async function load(force = false) {
  listBox.innerHTML = "";
  randomBox.innerHTML = `<div class="fc-loading"><span class="fc-spinner" aria-hidden="true"></span><span>正在加载友链动态...</span></div>`;
  try {
    const res = await fetch(CFG.api, force ? { cache: "no-store" } : {});
    if (!res.ok) throw new Error("network");
    apply(await res.json());
  } catch {
    showError("友链朋友圈加载失败，请稍后重试。");
  }
}

export function initFcircle() {
  root = document.querySelector("[data-fc-root]");
  randomBox = document.querySelector("[data-fc-random]");
  listBox = document.querySelector("[data-fc-list]");
  moreBtn = document.querySelector("[data-fc-more]");
  metaEl = document.querySelector("[data-fc-meta]");
  updatedEl = document.querySelector("[data-fc-updated]");
  if (!root || !randomBox || !listBox || !moreBtn || !metaEl) return;
  if (root.dataset.bound === "true") return;
  root.dataset.bound = "true";
  CFG.api = root.dataset.fcApi || CFG.api;
  moreBtn.addEventListener("click", loadMore);
  load();
}
