// 文章过期提示（源站 post-outdate-notice 1:1）：发布超 365 天时 snackbar 提醒
export function initOutdateNotice() {
  const el = document.querySelector("[data-post-outdate-notice]");
  if (!el || el.dataset.shown === "true") return;
  const publishedAt = el.dataset.publishedAt;
  if (!publishedAt) return;
  const days = Math.floor((Date.now() - new Date(publishedAt).getTime()) / 864e5);
  if (days < 365) return;
  el.dataset.shown = "true";
  window.snackbarShow?.(`😯本篇文章从发布到现在已经隔了 ${days} 天了，里面的内容可能过期了，你要自己甄别一下哟👉👈`, 6000);
}
