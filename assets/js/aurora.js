// Aurora 光效：Hero 鼠标跟随 + 卡片极光/描边 + card-glow 光斑（1:1 源站 aurora-mouse.js）
let cleanup = null;

function initAurora() {
  cleanup?.abort();
  cleanup = new AbortController();
  const { signal } = cleanup;
  const fineMotion =
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("[data-aurora-hero]").forEach((hero) => {
    const mouse = hero.querySelector("[data-aurora-mouse]");
    if (!mouse) return;
    if (fineMotion) {
      hero.addEventListener(
        "mousemove",
        (e) => {
          requestAnimationFrame(() => {
            const r = hero.getBoundingClientRect();
            mouse.style.setProperty("--mx", `${e.clientX - r.left}px`);
            mouse.style.setProperty("--my", `${e.clientY - r.top}px`);
            mouse.style.opacity = "1";
          });
        },
        { signal, passive: true }
      );
    }
    hero.addEventListener("mouseleave", () => (mouse.style.opacity = "0"), { signal });
  });

  document.querySelectorAll("[data-aurora-card]").forEach((card) => {
    const aurora = card.querySelector("[data-card-aurora]");
    const border = card.querySelector("[data-card-border]");
    if (!aurora) return;
    if (fineMotion) {
      card.addEventListener(
        "mousemove",
        (e) => {
          requestAnimationFrame(() => {
            const r = card.getBoundingClientRect();
            const mx = `${e.clientX - r.left}px`;
            const my = `${e.clientY - r.top}px`;
            aurora.style.setProperty("--mx", mx);
            aurora.style.setProperty("--my", my);
            aurora.style.opacity = "1";
            if (border) {
              border.style.setProperty("--mx", mx);
              border.style.setProperty("--my", my);
              border.style.opacity = "1";
            }
          });
        },
        { signal, passive: true }
      );
    }
    card.addEventListener(
      "mouseleave",
      () => {
        aurora.style.opacity = "0";
        if (border) border.style.opacity = "0";
      },
      { signal }
    );
  });

  document.querySelectorAll(".card-glow").forEach((el) => {
    el.addEventListener(
      "mousemove",
      (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
        el.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
      },
      { signal, passive: true }
    );
  });
}

export function initAuroraEffects(signal) {
  initAurora();
}
