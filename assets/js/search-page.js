// 独立搜索页（源站 search.astro 1:1）：双后端绑定 + ?q= 同步 + backUrl 会话记忆
export function initSearchPage(signal) {
  const container = document.getElementById("algolia-search");
  if (!container || container.dataset.bound === "true") return;
  container.dataset.bound = "true";

  const params = new URLSearchParams(window.location.search);

  async function bind() {
    const provider = container.dataset.searchProvider || "pagefind";
    const mod = provider === "algolia"
      ? await import("./algolia-ui.js")
      : await import("./pagefind-ui.js");
    const config = provider === "algolia"
      ? {
        appId: container.dataset.algoliaAppId,
        apiKey: container.dataset.algoliaApiKey,
        indexName: container.dataset.algoliaIndex,
        hitsPerPage: Number(container.dataset.algoliaHitsPerPage) || 5,
      }
      : {
        basePath: container.dataset.pagefindBasePath || "/pagefind/",
        hitsPerPage: Number(container.dataset.pagefindHitsPerPage) || 5,
      };
    const ui = mod.bindSearchUI({ element: "#algolia-search", config, signal });

    // 结果链接点击时记录回跳地址（源站语义：从文章页返回搜索可恢复关键词）
    container.addEventListener("click", (e) => {
      if (e.target.closest(".algolia-ui__result-link")) {
        sessionStorage.setItem("backUrl", container.dataset.backurl || "/search/");
      }
    }, { signal });

    const initial = params.get("q");
    if (initial) ui.triggerSearch(initial);

    const input = container.querySelector(".algolia-ui__search-input");
    const clear = container.querySelector(".algolia-ui__search-clear");
    function syncUrl(value) {
      if (value.trim()) {
        params.set("q", value);
        history.replaceState(history.state, "", `?${params.toString()}`);
        sessionStorage.setItem("backUrl", (container.dataset.backurl || "/search/") + `?${params.toString()}`);
      } else {
        history.replaceState(history.state, "", window.location.pathname);
      }
    }
    input?.addEventListener("input", () => syncUrl(input.value), { signal });
    clear?.addEventListener("click", () => syncUrl(""), { signal });
  }

  bind().catch(() => {
    const message = container.querySelector(".algolia-ui__message");
    if (message) message.textContent = "Search is temporarily unavailable.";
  });
}
