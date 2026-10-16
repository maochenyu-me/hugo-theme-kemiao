// Pagefind 搜索后端（双后端之一）：与 algolia-ui 同一 bind 契约，UI 复用 algolia-ui__* 样式
const escapeHtml = (v) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c] || c);

function resultHtml(data) {
  const excerpt = (data.excerpt || "").trim();
  return `
    <li class="algolia-ui__result">
      <div class="algolia-ui__result-inner">
        <p class="algolia-ui__result-title">
          <a class="algolia-ui__result-link" href="${escapeHtml(data.url || "/")}">${data.meta?.title || data.title || "Untitled"}</a>
        </p>
        ${excerpt ? `<p class="algolia-ui__result-excerpt">${excerpt}</p>` : ""}
      </div>
    </li>
  `;
}

export function bindSearchUI({ element, config, signal }) {
  const container = document.querySelector(element);
  if (!container) throw new Error(`Search container not found: ${element}`);
  const input = container.querySelector(".algolia-ui__search-input");
  const clear = container.querySelector(".algolia-ui__search-clear");
  const message = container.querySelector(".algolia-ui__message");
  const results = container.querySelector(".algolia-ui__results");
  if (!input || !clear || !message || !results) throw new Error(`Search markup is incomplete: ${element}`);

  let seq = 0;
  let pagefind = null;

  async function loadPagefind() {
    if (pagefind) return pagefind;
    pagefind = await import(/* @vite-ignore */ `${config.basePath}pagefind.js`);
    await pagefind.options?.({ baseUrl: "/" });
    return pagefind;
  }

  async function run(term) {
    const query = term.trim();
    const current = ++seq;
    clear.classList.toggle("is-visible", !!query);
    if (!query) {
      results.innerHTML = "";
      message.textContent = "";
      return;
    }
    message.textContent = "Searching…";
    try {
      const pf = await loadPagefind();
      const search = await pf.search(query);
      if (current !== seq) return;
      const hits = await Promise.all(
        search.results.slice(0, config.hitsPerPage).map((r) => r.data())
      );
      if (current !== seq) return;
      results.innerHTML = hits.map(resultHtml).join("");
      message.textContent = search.results.length
        ? `${search.results.length} results found`
        : `No results for “${query}”`;
    } catch {
      if (current !== seq) return;
      results.innerHTML = "";
      message.textContent = "Search is temporarily unavailable.";
    }
  }

  const setValue = (value) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  input.addEventListener("input", () => run(input.value), { signal });
  clear.addEventListener("click", () => setValue(""), { signal });
  container.querySelector(".algolia-ui__form")?.addEventListener("submit", (e) => e.preventDefault(), { signal });

  return { triggerSearch: setValue };
}
