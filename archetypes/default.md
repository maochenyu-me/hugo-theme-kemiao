---
# ── 标识 ──────────────────────────────────────────────────────────────
# slug：永久链接末段，决定 /posts/<slug>/（hugo.toml 的 [permalinks] posts = '/posts/:slug/'）
#       默认由文件名 urlize 而来（中文会保留），想用别的 URL 就改这里
slug: "{{ .Name | urlize }}"
title: "{{ replace .Name "-" " " | title }}"

# ── 时间 ──────────────────────────────────────────────────────────────
# 必须带时区（+08:00）。不带时区会被当 UTC，可能被「未来时间过滤」静默跳过，页面不生成。
# 同理 date 不能晚于当前时间（除非构建加 --buildFuture）。
date: {{ .Date }}
# lastmod 大于 date 时，文章页会多显示一个「更新于」
lastmod: {{ .Date }}
# draft: true 时仅 `hugo -D` / `hugo server -D` 可见
draft: true

# ── 摘要与 SEO ────────────────────────────────────────────────────────
# description：SEO meta description / og:description，也是 AI 摘要卡的回退文案
description: ""

# ── 分类与标签 ────────────────────────────────────────────────────────
# 生成 /categories/<term>/ 与 /tags/<term>/，并渲染成文章页的徽章
categories: []
tags: []

# ── 可选字段（需要时取消注释）────────────────────────────────────────
# aiSummary：文章页顶部「AI 摘要」卡片正文（打字机逐字输出）；不填则回退 description
# aiSummary: ""
#
# cover：正文顶部封面图。站内路径放 static/imgs/posts/ 下写 /imgs/posts/xxx.webp，
#        也可直接写远程 URL。模板会校验站内文件是否存在，找不到就整块跳过（不产生破图）。
# cover: "/imgs/posts/xxx.webp"
---

