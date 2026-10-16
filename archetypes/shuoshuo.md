---
# 说说（日常动态）——字段集与文章完全不同，不要混用
# 用法：hugo new shuoshuo/xxx.md  或  hugo new -k shuoshuo shuoshuo/xxx.md

title: "{{ replace .Name "-" " " | title }}"
# 必须带时区；说说按 date 倒序排列，首页跑马灯取最新 tickerCount 条
date: {{ .Date }}
draft: true

# ── 可选字段（按需取消注释）──────────────────────────────────────────
# 图片：单值或数组皆可。1 张 single / 2 张 pair / 3 张 triple / 4 张 quad / >4 张 lead-grid
# images:
#   - /images/shuoshuo/demo-1.webp
#   - https://example.com/pic.webp
#
# 视频：单值或数组，渲染为原生 <video controls>
# video: https://example.com/clip.mp4
#
# 站外链接卡：支持两种写法（推荐带 title）
# website:
#   url: https://developer.mozilla.org/
#   title: MDN Web Docs
# website: https://developer.mozilla.org/
#
# GitHub 仓库卡：自动解析成 owner/repo
# github: https://github.com/willow-god/hubProxy
#
# 位置：渲染成带定位图标的 pill
# location: 西安·城墙
#
# 置顶：置顶 pill + 列表顶部浮动
# pinned: true
#
# 标签：渲染成 # 标签 pill
# tags: [摄影, 生活]

# ── 正文 ──────────────────────────────────────────────────────────────
# 支持 Markdown + HTML 混写（hugo.toml 已开 goldmark unsafe）
# 超过 summaryLength（120 字）时列表卡截断并给「展开全文」链接
---

