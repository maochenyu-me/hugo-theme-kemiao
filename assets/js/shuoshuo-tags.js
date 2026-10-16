// 说说 #标签 的共用处理（tg / api 两个远程数据源共享）
//
// 背景：卡片底部已经把标签渲染成 pill 了，如果正文里再出现一遍同样的 #xxx，
// 同一信息会显示两次。本模块负责「从正文里省略那些已作为 pill 渲染的 #标签」。
//
// 标签的语义与 astro-koharu 的 toTags 一致：
//   - 前置负向断言排除 URL 片段（`/`、`#`、`&` 之后的 # 不算标签）
//   - 标签名 2-32 个字母/数字/下划线/汉字
//   - 最多 8 个，按出现顺序去重

export const HASHTAG_SOURCE = "(?<![A-Za-z0-9_/&#])#([\\p{L}\\p{N}_]{2,32})";
export const HASHTAG_FLAGS = "gu";

function freshRe() {
  return new RegExp(HASHTAG_SOURCE, HASHTAG_FLAGS);
}

/**
 * 剥离用正则：标签 + 紧随其后的一个空白。
 * 一起吃掉尾部空白，否则「今天 #日常 很累」会留下两个空格。
 */
const STRIP_SOURCE = "(?<![A-Za-z0-9_/&#])#([\\p{L}\\p{N}_]{2,32})\\s?";

function freshStripRe() {
  return new RegExp(STRIP_SOURCE, HASHTAG_FLAGS);
}

/** 从纯文本抽取标签名（不含 #），按出现顺序去重，最多 8 个 */
export function extractTags(text, max = 8) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  for (const m of text.matchAll(freshRe())) {
    const key = m[1].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m[1]);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 纯文本：删掉 tags 里已列出的 #xxx。
 * 连同其后空白一起吃掉——.shuoshuo-text 是 white-space:pre-wrap，
 * 只删 "#日常" 会留下一个可见的前导空格。最后再修一下首尾空白。
 */
export function stripTagsFromText(text, tags) {
  if (!text || !tags || !tags.length) return text || "";
  const keys = new Set(tags.map((t) => String(t).toLowerCase()));
  const out = text.replace(freshStripRe(), (full, name) =>
    keys.has(String(name).toLowerCase()) ? "" : full
  );
  return out.replace(/^[\s\u3000]+/, "").replace(/[\s\u3000]+$/, "");
}

/**
 * HTML：同样剥离，但只动文本节点、不破坏标签结构。
 * tg 的 content.html 可能把标签包在 <a>/<tg-spoiler> 里，所以必须递归。
 */
export function stripTagsFromHtml(html, tags) {
  if (!html || !tags || !tags.length) return html || "";
  const keys = new Set(tags.map((t) => String(t).toLowerCase()));
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const next = child.nodeValue.replace(freshStripRe(), (full, name) =>
          keys.has(String(name).toLowerCase()) ? "" : full
        );
        if (next !== child.nodeValue) child.nodeValue = next;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    }
  };
  walk(tpl.content);

  // 去掉剥离后残留的首尾空白（含全角空格），沿最外侧文本节点处理
  const trimStart = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        child.nodeValue = child.nodeValue.replace(/^[\s\u3000]+/, "");
        return;
      }
      if (child.nodeType === Node.ELEMENT_NODE) return trimStart(child);
    }
  };
  const trimEnd = (node) => {
    for (const child of Array.from(node.childNodes).reverse()) {
      if (child.nodeType === Node.TEXT_NODE) {
        child.nodeValue = child.nodeValue.replace(/[\s\u3000]+$/, "");
        return;
      }
      if (child.nodeType === Node.ELEMENT_NODE) return trimEnd(child);
    }
  };
  trimStart(tpl.content);
  trimEnd(tpl.content);
  return tpl.innerHTML;
}
