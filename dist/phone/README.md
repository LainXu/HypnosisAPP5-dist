# 移动端酒馆前端

这是一个独立的手机端响应式前端原型，目录与现有 `hypnosis-app` 前端完全隔离。

## 文件

- `index.html`：独立预览入口。
- `mobile-tavern.css`：手机端响应式布局样式。
- `mobile-tavern.js`：轻量交互脚本，不依赖现有前端。

## 设计约束

- 不修改现有 `public/frontends/hypnosis-app/`。
- 根容器限制在 `100dvw / 100dvh / 100svh` 内。
- 所有网格使用 `minmax(0, 1fr)`，防止按钮和文本撑破屏幕。
- 内容区只允许纵向滚动，不允许横向滚动。
- 小于 `340px` 时按钮网格降为两列，主按钮独占一行。
- JS 避免使用可选链等新语法，减少酒馆注入环境兼容风险。

## 本地打开

直接打开：

```text
public/frontends/mobile-tavern/index.html
```

或用任意静态服务器指向本仓库根目录后访问：

```text
/public/frontends/mobile-tavern/index.html
```
