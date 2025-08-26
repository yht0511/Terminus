# Low Poly Forest LiDAR (Vite + TypeScript 重构)

功能：

- 第一人称行走 (W/A/S/D) + 跳跃 (Space) + 鼠标视角
- 交互触发盒 (靠近按 E)
- 高性能环形增量 LiDAR：方位角环扫 + 多层俯仰，BVH 加速，循环点缓冲，左键突发

## 新目录结构

```
scene.gltf / scene.bin / textures/
package.json
index.html          # 入口 (Vite)
src/
  main.ts           # 初始化 / 循环
  player/PlayerController.ts
  interaction/InteractionManager.ts
  scanner/LiDARSystem.ts
web/js/...          # 旧版本 (可逐步移除)
```

## 开发

```bash
npm install
npm run dev
```

访问控制台输出地址 (默认 http://localhost:5173)。

旧方式 (http-server) 已不再需要。

## 构建

```bash
npm run build
npm run preview
```

## LiDAR 快速调参 (F12 控制台)

```js
lidar.raysPerFrame = 800; // 每帧扫描数
lidar.burstRays = 4000; // 左键突发数量
lidar.maxDistance = 180; // 最大距离
```

## 自定义交互点

在 `src/main.ts` 中调用 interactions.addTrigger，示例参见现有营火触发。

## 后续可做

- GPU Depth Pass 批量点采样
- 按距离/强度/法线着色
- 点云导出 (PLY / LAS)
- 多 LiDAR 设备叠加

## 迁移提示

旧 `web/js` 代码仍在，确认新版本稳定后删除，避免混淆。
