# 中国象棋 — 项目手册 v1.0

## 基本信息

- **版本**: v3.11
- **类型**: 纯前端静态站点（单文件 HTML + CSS + JS）
- **部署**: GitHub Pages → https://z15314102792-arch.github.io/chinese-chess/
- **仓库**: https://github.com/z15314102792-arch/chinese-chess
- **入口**: `index.html`（单文件应用，~5000+ 行）
- **分支**: `main`（源码+构建） + `gh-pages`（部署）

## 功能概况

- 双人对战、人机对战（4档难度：简单/普通/困难/地狱）
- 局域网联机（WebSocket）
- 云端房间匹配
- 悔棋、计时、音效、残局库
- Service Worker 离线缓存

## 常用操作

```bash
# 部署到 GitHub Pages
cd C:\chinese-chess
git add -A && git commit -m "..."
git push origin main
# gh-pages 自动部署（GitHub Actions 或手动推送）
```

## 已知问题

- 联机功能依赖信令服务器（需确认服务器状态）

## 记忆档案

C:\Users\Administrator\.claude\projects\C--\memory\项目\中国象棋.md
