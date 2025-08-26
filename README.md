# Terminus

基于 Three.js + TypeScript + Vite 的 LiDAR 可视化与 FPS 场景实验。

## 本地开发

```bash
npm install
npm run dev
```

## 生产构建

```bash
npm run build
```

输出位于 `dist/`。

## GitHub Pages 自动部署

已添加 GitHub Actions 工作流，会在 push 到 main 分支时自动构建并部署到 `gh-pages` 分支，并通过 GitHub Pages 提供静态访问。

访问地址（等待首次 workflow 完成）：

```
https://yht0511.github.io/terminus/
```

若改仓库名，请同步修改 `vite.config.ts` 中的 `repo` 常量或把 base 改为 `'/'`。

## 调整 base 路径

如果你使用自定义域 (CNAME)，可将 `vite.config.ts` 中 `base` 改成 `'/'` 并在 `public/` 下放置 `CNAME` 文件。

## 许可证

MIT
