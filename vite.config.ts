import { defineConfig } from "vite";
import path from "path";

// GitHub Pages 部署需要设置 base 为仓库名，例如 https://yht0511.github.io/terminus/
// 若使用自定义域或根仓库，可改为 '/'
const repo = "terminus";

export default defineConfig({
  base: `/${repo}/`,
  build: {
    outDir: "dist",
    sourcemap: false,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
