// Twikoo 评论加载器（阶段⑥）：CDN 加载 UMD 版 → init → 主题联动
let api = null;
let themeObserver = null;

const TWIKOO_CDN = "https://jsd.liiiu.cn/npm/twikoo@1.6.44/dist/twikoo.all.min.js";

function loadTwikooScript() {
  return new Promise((resolve, reject) => {
    if (window.twikoo) return resolve(window.twikoo);
    const script = document.createElement("script");
    script.src = TWIKOO_CDN;
    script.async = true;
    script.onload = () => (window.twikoo ? resolve(window.twikoo) : reject(new Error("twikoo global missing")));
    script.onerror = () => reject(new Error("twikoo script failed to load"));
    document.head.append(script);
  });
}

export async function initTwikoo({ envId, path }) {
  const mount = document.getElementById("twikoo-comments");
  if (!mount || api) return;
  try {
    const twikoo = await loadTwikooScript();
    if (!document.contains(mount)) return;
    await twikoo.init({
      envId,
      el: mount,
      path: path || window.location.pathname,
      onCommentLoaded: () => {
        document.dispatchEvent(new CustomEvent("twikoo-loaded"));
      },
    });
    api = twikoo;
    // 深色模式联动：twikoo 会用自己的 #twikoo 容器替换挂载点，darkMode 状态写到该容器
    const rootEl = () => document.getElementById("twikoo") || mount;
    const applyDark = () => {
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      rootEl().classList.toggle("tk-dark", dark);
    };
    themeObserver = new MutationObserver(applyDark);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    applyDark();
  } catch (err) {
    console.error("[comment] Twikoo init failed:", err);
    mount.innerHTML = '<div class="comment-failed">评论加载失败，请检查网络或稍后再试。</div>';
  }
}
