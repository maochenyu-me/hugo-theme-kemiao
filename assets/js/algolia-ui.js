// Algolia 搜索后端（源站 algolia-ui 1:1 语义，客户端精简为 REST 查询）
// bindSearchUI({ element, config, signal })：输入防抖、清空、消息与结果渲染
const escapeHtml = (v) => v.replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c] || c);

function stripTags(v) {
  return v.replace(/<[^>]+>/g, "");
}

function highlight(hit, field) {
  return hit._highlightResult?.[field]?.value;
}

function excerptOf(hit) {
  const raw = hit._snippetResult?.content?.value
    || highlight(hit, "content")
    || highlight(hit, "description")
    || hit.description
    || hit.content
    || "";
  const text = raw.trim();
  if (!text) return "";
  if (text.includes("<mark>")) return text;
  const plain = stripTags(text);
  return plain.length > 180 ? `${plain.slice(0, 180)}…` : plain;
}

function resultHtml(hit) {
  const title = highlight(hit, "title") || escapeHtml(hit.title || "Untitled");
  const excerpt = excerptOf(hit);
  return `
    <li class="algolia-ui__result">
      <div class="algolia-ui__result-inner">
        <p class="algolia-ui__result-title">
          <a class="algolia-ui__result-link" href="${escapeHtml(hit.url || "/")}">${title}</a>
        </p>
        ${excerpt ? `<p class="algolia-ui__result-excerpt">${excerpt}</p>` : ""}
      </div>
    </li>
  `;
}

async function algoliaQuery(config, term) {
  const url = `https://${config.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(config.indexName)}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-algolia-application-id": config.appId,
      "x-algolia-api-key": config.apiKey,
    },
    body: JSON.stringify({
      query: term,
      hitsPerPage: config.hitsPerPage,
      attributesToRetrieve: ["title", "description", "content", "url"],
      attributesToHighlight: ["title", "description", "content"],
      attributesToSnippet: ["content:35", "description:35"],
      highlightPreTag: "<mark>",
      highlightPostTag: "</mark>",
    }),
  });
  if (!response.ok) throw new Error(`algolia ${response.status}`);
  return response.json();
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
      const data = await algoliaQuery(config, query);
      if (current !== seq) return;
      results.innerHTML = data.hits.map(resultHtml).join("");
      message.textContent = data.nbHits ? `${data.nbHits} results found` : `No results for “${query}”`;
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
