// ---------- 文章页行为：TOC 结构规范化 + scroll spy / 代码复制展开 / AI 摘要打字 / 标题锚链接 ----------
// 移植自源站 anchor-scroll.BWY_1I0P.js 与 post.DSi_Q-zJ.js，行为 1:1。

function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

// Hugo 的 .TableOfContents 是纯嵌套 <ul>/<li>/<a>；源站 DOM 需要
// ul.sidebar-toc-list / ul.toc-children / li[data-toc-section] /
// a[data-toc-link][data-toc-depth]，在此统一补齐。
function normalizeTocRoots() {
  document.querySelectorAll('[data-toc-root]').forEach((root) => {
    const nav = root.querySelector('#TableOfContents') || (root.matches('nav#TableOfContents') ? root : null);
    const scope = nav || root;
    const rootUl = scope.querySelector('ul');
    if (!rootUl) return;
    if (nav) nav.removeAttribute('id');
    rootUl.classList.add('sidebar-toc-list');
    scope.querySelectorAll('ul ul').forEach((ul) => ul.classList.add('toc-children'));
    scope.querySelectorAll('li').forEach((li) => li.setAttribute('data-toc-section', ''));
    scope.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const slug = decodeURIComponent(href.slice(1));
      a.setAttribute('data-toc-link', slug);
      let depth = 2;
      let el = a.parentElement;
      while (el && el !== rootUl) {
        if (el.tagName === 'UL') depth += 1;
        el = el.parentElement;
      }
      a.setAttribute('data-toc-depth', String(depth));
      a.setAttribute('href', '#' + slug);
    });
  });
}

function scrollToHeading(heading, opts) {
  if (opts?.hash) {
    const hash = '#' + opts.hash;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }
  heading.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  for (const delay of (opts?.delays ?? [500, 1000])) {
    window.setTimeout(() => { opts?.signal?.aborted || heading.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }, delay);
  }
}

// TOC scroll spy：高亮当前所在小节，展开祖先分组，滚动侧栏列表保持可见。
function initTocSpy(root, signal) {
  const links = Array.from(root.querySelectorAll('[data-toc-link]'));
  if (!links.length) return;
  const items = links
    .map((link) => {
      const slug = link.dataset.tocLink;
      const heading = slug ? document.getElementById(slug) : null;
      return slug && heading ? { slug, link, heading } : null;
    })
    .filter(Boolean);
  if (!items.length) return;
  const sections = root.querySelectorAll('[data-toc-section]');
  const ancestors = new Map();
  sections.forEach((section) => {
    const direct = section.querySelector(':scope > [data-toc-link]');
    if (!direct?.dataset.tocLink) return;
    const chain = [section];
    let parent = section.parentElement?.closest('[data-toc-section]');
    while (parent) {
      chain.push(parent);
      parent = parent.parentElement?.closest('[data-toc-section]');
    }
    ancestors.set(direct.dataset.tocLink, chain);
  });
  let activeSlug = '';
  const apply = (slug) => {
    if (slug === activeSlug) return;
    activeSlug = slug;
    items.forEach(({ slug: s, link }) => link.classList.toggle('toc-active', s === slug));
    const chain = ancestors.get(slug) ?? [];
    sections.forEach((section) => section.classList.toggle('toc-expanded', chain.includes(section)));
    const activeLink = items.find((item) => item.slug === slug)?.link;
    const list = root.querySelector('.sidebar-toc-list');
    if (!activeLink || !list) return;
    const top = activeLink.offsetTop - list.offsetTop;
    const bottom = top + activeLink.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  };
  const update = () => {
    let slug = items[0].slug;
    for (const { slug: s, heading } of items) {
      if (heading.getBoundingClientRect().top <= 120) slug = s;
      else break;
    }
    apply(slug);
  };
  root.addEventListener('click', (event) => {
    const link = event.target.closest('[data-toc-link]');
    if (!link) return;
    event.preventDefault();
    const slug = link.dataset.tocLink;
    if (!slug) return;
    const heading = document.getElementById(slug);
    if (!heading) return;
    scrollToHeading(heading, { hash: slug, signal });
    root.dispatchEvent(new CustomEvent('toc:navigate', { bubbles: true, detail: { slug } }));
  }, { signal });
  update();
  document.addEventListener('scroll', update, { passive: true, signal });
  window.addEventListener('resize', update, { signal });
}

// 代码块：Copy 按钮 + 超高代码的展开/折叠按钮（1:1 post.js 的 f()）。
function initCodeBlocks(signal) {
  const pres = Array.from(document.querySelectorAll('#article pre'));
  const wrappers = pres.map((pre) => (getComputedStyle(pre).getPropertyValue('--file-name-offset').trim() === '' ? '-top-3' : 'top-(--file-name-offset)'));
  pres.forEach((pre, index) => {
    let parent = pre.parentElement;
    if (!parent?.hasAttribute('data-code-block-wrapper')) {
      parent = document.createElement('div');
      parent.style.position = 'relative';
      parent.setAttribute('data-code-block-wrapper', '');
      pre.parentNode?.insertBefore(parent, pre);
      parent.appendChild(pre);
    }
    pre.setAttribute('tabindex', '0');
    if (!pre.querySelector('.copy-code')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-code absolute end-3 ' + wrappers[index] + ' rounded bg-muted border border-muted px-2 py-1 text-xs leading-4 text-foreground font-medium';
      button.textContent = 'Copy';
      pre.appendChild(button);
      button.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        await navigator.clipboard.writeText(code?.innerText ?? '');
        button.textContent = 'Copied';
        window.setTimeout(() => { signal.aborted || (button.textContent = 'Copy'); }, 700);
      }, { signal });
    }
    const code = pre.querySelector('code');
    if (code instanceof HTMLElement && code.scrollHeight > code.clientHeight && !pre.querySelector('.code-expand-btn')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-expand-btn';
      button.setAttribute('aria-label', '展开代码块');
      button.setAttribute('title', '展开代码块');
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-chevron-down code-expand-icon';
      icon.setAttribute('aria-hidden', 'true');
      button.appendChild(icon);
      pre.appendChild(button);
    }
  });
}

// AI 摘要打字机：18ms/字（1:1 post.js 的 p()）。
function typeAiSummaries() {
  const nodes = Array.from(document.querySelectorAll('[data-ai-summary]'));
  for (const node of nodes) {
    if (node.dataset.typed === 'true') continue;
    const text = node.dataset.aiSummary ?? '';
    node.dataset.typed = 'true';
    node.textContent = '';
    let i = 0;
    const tick = () => {
      node.textContent = text.slice(0, i);
      i += 1;
      if (i <= text.length) window.setTimeout(tick, 18);
    };
    tick();
  }
}

// 标题锚链接（源站 addHeadingLinks）。
function addHeadingLinks() {
  const headings = Array.from(document.querySelectorAll('#article h2, #article h3, #article h4, #article h5, #article h6'));
  for (const heading of headings) {
    if (heading.querySelector('.heading-link')) continue;
    heading.classList.add('group');
    const link = document.createElement('a');
    link.className = 'heading-link ms-2 no-underline opacity-75 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100';
    link.href = '#' + heading.id;
    const span = document.createElement('span');
    span.ariaHidden = 'true';
    span.innerText = '#';
    link.appendChild(span);
    link.ariaLabel = 'link to heading';
    heading.appendChild(link);
  }
}

// 返回按钮：优先回到来路页（源站读 sessionStorage.backUrl）。
function initBackButton() {
  const button = document.querySelector('#back-button');
  if (!(button instanceof HTMLAnchorElement)) return;
  const raw = sessionStorage.getItem('backUrl');
  let href = '/';
  if (raw) {
    try {
      const url = new URL(raw, window.location.origin);
      const sameOrigin = url.origin === window.location.origin;
      const safe = url.protocol === 'http:' || url.protocol === 'https:';
      href = !sameOrigin || !safe ? '/' : `${url.pathname}${url.search}${url.hash}` || '/';
    } catch { href = '/'; }
  }
  button.href = href;
}

function initArticle(signal) {
  normalizeTocRoots();
  document.querySelectorAll('[data-toc-root]').forEach((root) => initTocSpy(root, signal));
  initCodeBlocks(signal);
  typeAiSummaries();
  addHeadingLinks();
  initBackButton();
}

function init() {
  const controller = new AbortController();
  initArticle(controller.signal);
  return controller;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

export { initArticle };
