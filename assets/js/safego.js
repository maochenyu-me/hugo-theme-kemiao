// 安全跳转页（源站 safego 1:1）：base64url 解码 ?u=、协议白名单校验、倒计时/进度/复制/取消
function decodeTarget(encoded) {
  if (!encoded) return null;
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function initSafego() {
  const card = document.querySelector("[data-safego]");
  if (!card || card.dataset.bound === "true") return;
  card.dataset.bound = "true";

  const param = card.dataset.param || "u";
  const countdown = Number(card.dataset.countdown || 10);
  const protocols = (card.dataset.protocols || "").split(",").map((p) => p.trim()).filter(Boolean);
  const urlBox = document.getElementById("safego-url");
  const countEl = card.querySelector("[data-safego-count]");
  const progressEl = card.querySelector("[data-safego-progress]");
  const tipEl = card.querySelector("[data-safego-tip]");
  const copyBtn = card.querySelector("[data-safego-copy]");
  const cancelBtn = card.querySelector("[data-safego-cancel]");
  const jumpBtn = card.querySelector("[data-safego-jump]");

  let target = null;
  try {
    target = decodeTarget(new URLSearchParams(window.location.search).get(param));
    if (!target || !protocols.some((p) => (target ?? "").toLowerCase().startsWith(`${p.toLowerCase()}://`))) {
      target = window.location.origin;
      tipEl && (tipEl.textContent = "参数错误，已将目标地址重置为本站首页。");
    }
  } catch {
    target = window.location.origin;
    tipEl && (tipEl.textContent = "参数错误，已将目标地址重置为本站首页。");
  }

  urlBox && (urlBox.textContent = target);
  const jump = () => { window.location.href = target; };

  copyBtn?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(target);
    copyBtn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
    window.setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i>'; }, 1500);
  });
  cancelBtn?.addEventListener("click", () => window.close());
  jumpBtn?.addEventListener("click", jump);

  let left = countdown;
  (function tick() {
    countEl && (countEl.textContent = String(left));
    progressEl && (progressEl.style.width = `${Math.max(left, 0) / countdown * 100}%`);
    if (left <= 0) { jump(); return; }
    left -= 1;
    window.setTimeout(tick, 1000);
  })();
}
