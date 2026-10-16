// 搜索弹窗（源站 SearchModal 1:1）：开关、⌘K/Ctrl+K、Esc、光晕、空态与后端懒加载
let controller = null;

export function initSearchModal() {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  const modal = document.getElementById("search-modal");
  if (!modal) return;

  const card = modal.querySelector("[data-modal-card]");
  const glow = modal.querySelector("[data-modal-glow]");
  const emptyState = modal.querySelector("[data-search-empty]");
  let backendBound = false;

  if (card && glow) {
    card.addEventListener("mousemove", (e) => {
      requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        glow.style.setProperty("--gx", `${e.clientX - rect.left}px`);
        glow.style.setProperty("--gy", `${e.clientY - rect.top}px`);
        glow.style.opacity = "1";
      });
    }, { signal });
    card.addEventListener("mouseleave", () => {
      glow.style.opacity = "0";
    }, { signal });
  }

  function open() {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    if (!backendBound) {
      backendBound = true;
      bindBackend();
    }
    setTimeout(() => {
      modal.querySelector(".algolia-ui__search-input")?.focus();
    }, 100);
  }

  function close() {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  modal.addEventListener("keydown", (e) => {
    const inInput = document.activeElement?.classList.contains("algolia-ui__search-input");
    const links = Array.from(modal.querySelectorAll(".algolia-ui__result-link"));
    const active = document.activeElement;
    const index = links.indexOf(active);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (inInput && links.length > 0) links[0].focus();
      else if (index >= 0 && index < links.length - 1) links[index + 1].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) links[index - 1].focus();
      else if (index === 0) modal.querySelector(".algolia-ui__search-input")?.focus();
    } else if (e.key === "Enter" && index >= 0) {
      active.click();
    }
  }, { signal });

  async function bindBackend() {
    const container = document.getElementById("modal-search");
    if (!container) return;
    const provider = container.dataset.searchProvider || "pagefind";
    try {
      const mod = provider === "algolia"
        ? await import("./algolia-ui.js")
        : await import("./pagefind-ui.js");
      if (signal.aborted) return;
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
      mod.bindSearchUI({ element: "#modal-search", config, signal });
      const input = modal.querySelector(".algolia-ui__search-input");
      if (input && emptyState) {
        input.addEventListener("input", () => {
          emptyState.style.display = input.value.trim() ? "none" : "";
        }, { signal });
      }
      if (modal.classList.contains("active")) {
        setTimeout(() => input?.focus(), 200);
      }
    } catch {
      // 后端加载失败时保持空态展示
    }
  }

  modal.querySelectorAll("[data-search-close]").forEach((el) => {
    el.addEventListener("click", close, { signal });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      e.preventDefault();
      close();
    }
  }, { signal });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (modal.classList.contains("active")) close();
      else open();
    }
  }, { signal });

  document.querySelectorAll("[data-search-trigger]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    }, { signal });
  });

  modal.addEventListener("click", (e) => {
    if (e.target.closest(".algolia-ui__result-link")) close();
  }, { signal });
}
