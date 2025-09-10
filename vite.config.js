import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  cors: true,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    rollupOptions: {
      // 只保留main作为入口点
      input: {
        main: "index.html",
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  // 包含静态资源类型（移除CSS，让Vite正常处理CSS）
  assetsInclude: ["**/*.glb", "**/*.mp3", "**/*.wav", "**/*.ogg", "**/*.json"],
  plugins: [
    // 自定义插件来复制assets和scripts文件夹
    {
      name: "copy-static-assets",
      closeBundle() {
        function copyFolderSync(from, to) {
          if (!fs.existsSync(to)) {
            fs.mkdirSync(to, { recursive: true });
          }
          fs.readdirSync(from).forEach((element) => {
            const fromPath = path.join(from, element);
            const toPath = path.join(to, element);
            if (fs.lstatSync(fromPath).isFile()) {
              fs.copyFileSync(fromPath, toPath);
            } else {
              copyFolderSync(fromPath, toPath);
            }
          });
        }

        // 复制assets文件夹到dist
        if (fs.existsSync("assets")) {
          copyFolderSync("assets", "dist/assets");
          console.log("📁 Assets文件夹已复制到dist/assets");
        }

        // 复制scripts文件夹到dist
        if (fs.existsSync("scripts")) {
          copyFolderSync("scripts", "dist/scripts");
          console.log("📁 Scripts文件夹已复制到dist/scripts");
        }

        // 复制menu文件夹到dist (用于非模块化的菜单脚本与资源)
        if (fs.existsSync("menu")) {
          copyFolderSync("menu", "dist/menu");
          console.log("📁 Menu文件夹已复制到dist/menu");
        }
      },
    },
  ],
});
