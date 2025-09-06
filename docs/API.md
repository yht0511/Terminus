# Terminus API 文档（更新版）

本文件覆盖当前 `core/` 目录内真实实现。所有类均使用 ES Module 形式导出；示例类型签名为近似 TypeScript 伪代码（未在源码中强制）。

## 总览

核心组成：

1. Core（游戏生命周期 / 配置 / 依赖执行）
2. Managers：LayerManager / ScriptManager / ResourceManager / SoundManager
3. Modules：Scene / Player / RayCaster / DevelopTool
4. Data：`scripts/main.json`（数据驱动 _entities_ / _speeches_ / _dependencies_ / _scripts_ / _shortcut_ / 全局参数）

### 统一析构约定

销毁顺序： 子模块 -> 管理器 -> Core。本项目源码中已在若干类的 `destructor()` / `destroy()` 中注明：

1. 解除事件监听
2. 移除 DOM / Three 对象
3. 释放 WebGL / 物理 / 材质资源
4. 断开全局引用（例如 `window.core = null`）

---

## Core

```typescript
class Core {
  container: HTMLElement | null; // #gameContainer
  loadingScreen: HTMLElement | null; // #loadingScreen
  layers: LayerManager; // UI & 输入转发
  scripts: ScriptManager; // 运行外部脚本字符串或模块
  scene: Scene; // 3D 场景 + 物理 + 玩家
  devtool: DevelopTool; // 开发调试面板
  resources: ResourceManager | null; // 由外部 init 传入
  script: any; // main.json 解析对象（运行时可被脚本修改）
  initialized: boolean; // 是否完成 init
  isloadingsavings: boolean; // 是否正在读档
  savingname: string; // 当前读档名

  constructor();
  async init(scriptObj: any, resources: ResourceManager): Promise<void>;
  async loadDependencies(): Promise<void>; // 遍历 script.dependencies -> scripts.loadScript()
  async executeScripts(): Promise<void>; // 顺序执行 script.scripts 中的字符串
  hideLoadingScreen(): void;
  getEntity(id: string): any | null; // 在 script.entities 中查找
  getSpeech(id: string): any | null; // 在 script.speeches 中查找
  replaceVariables(str: string, ctx?: Record<string, any>): string; // "$var" 占位替换
  autosavingdata(): void; // localStorage 自动存档
  async destructor(): Promise<void>; // 清理（当前实现仅部分管理器/引用）
}
```

注意：Core 不直接创建 ResourceManager —— 资源管理实例在外部构造后传入，便于测试或替换。

---

## LayerManager

职责：

1. 管理 UI / 模块的 DOM 分层（z-index）
2. 统一输入事件监听并按栈顶向下转发（支持 pointer lock 状态同步）
3. 支持快捷键（`script.shortcut`）与 pointer lock 自动处理

```typescript
class LayerManager {
  container: HTMLElement; // 根容器
  layers: Array<{
    id: string;
    element: HTMLElement;
    module: any;
    zIndex: number;
  }>;
  zIndexCounter: number;
  push(
    module: HTMLElement | { render?(): HTMLElement },
    zIndex?: number
  ): { id: string; zIndex: number };
  remove(layerOrId: string | { id: string }): void;
  clear(): void;
  pop(): void; // 移除栈顶
  get(id: string): any; // 返回 layer 描述
  bringToFront(layerOrId: string | { id: string }): void;
  getLayers(): { id: string; zIndex: number; module: string }[];
  forwardInput(domEvent: Event, is2all?: boolean): void; // 内部调用，按倒序传递
  destructor(): void; // 解绑所有监听+清空
}
```

输入传递约定：最顶层拥有“第一拒绝权”，其 `handleInput(event)` 若返回 truthy (非 0 / 非 false) 即中断继续传递。

---

## ResourceManager

功能：GLTF 模型与纹理加载缓存、重复请求合并、材质深拷贝、防止共享状态。

```typescript
class ResourceManager {
  loadedModels: Map<string, THREE.Object3D>; // 原始缓存（不要直接放入场景）
  loadedTextures: Map<string, THREE.Texture>;
  loadingPromises: Map<string, Promise<any>>; // 去重
  async loadModel(path: string): Promise<THREE.Object3D>; // 返回克隆体
  async loadTexture(path: string): Promise<THREE.Texture>; // 返回 clone()
  cloneModel(obj: THREE.Object3D): THREE.Object3D;
  getOriginalModel(path: string): THREE.Object3D | null;
  async preloadModels(paths: string[]): Promise<void>;
  getStats(): {
    modelsLoaded: number;
    texturesLoaded: number;
    loadingInProgress: number;
  };
  dispose(): void; // 释放几何/材质/纹理
  destructor(): void; // dispose + 断引用
}
```

---

## ScriptManager

支持两种脚本：

1. 外部模块（`import()`）按 id 绑定到 `window[id]`
2. 纯字符串命令（自动重写隐式全局赋值 -> `window.xxx = ...`）

```typescript
class ScriptManager {
  core: Core;
  loadedScripts: Map<string, any>; // ES Module 对象
  scriptModules: Map<string, any>; // default 或完整模块引用
  async loadScript(id: string, path: string): Promise<any>;
  async execute(code: string): Promise<any>; // 直接 eval（含重写）
  async executeCall(expr: string): Promise<any>; // 解析 a.b.c(arg1,"x",3) 失败降级 execute
  parseMethodCall(expr: string): {
    object: string;
    method: string;
    args: any[];
  };
  resolveObject(path: string): any | null; // 以 window 为根
  createExecutionContext(): Record<string, any>; // （当前实现未强制使用）
  getScript(id: string): any;
  getModule(id: string): any;
  dispose(): void; // 清空两张 Map
}
```

安全提示：当前实现未隔离全局命名空间，生产环境需引入沙箱（`iframe` / Realms / Proxy）或白名单包装。

---

## SoundManager

```typescript
class SoundManager {
  bgm: HTMLAudioElement; // id="bgm"
  soundEffect: HTMLAudioElement; // id="soundEffect"
  setBGM(src: string): void;
  setSoundEffect(src: string): void;
  setBGMVolume(v: number): void;
  setSoundEffectVolume(v: number): void;
  playBGM(): Promise<void> | void;
  pauseBGM(): void;
  playSoundEffect(): Promise<void> | void;
  pauseSoundEffect(): void;
}
```

---

## Scene

职责：Three.js 渲染 + Rapier 物理 + Lidar 点云 + 玩家装载 + 模型实体管理。

```typescript
class Scene {
  core: Core;
  scene: THREE.Scene; // 内含 worldModels Group
  world: RAPIER.World; // 物理世界
  rapier: typeof RAPIER;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  player: Player;
  RayCaster: RayCaster;
  models: Record<
    string,
    { model: THREE.Object3D; body: any; colliders?: any[] }
  >;
  worldModels: THREE.Group; // 所有静态模型父组
  ambientLight?: THREE.AmbientLight;
  directionalLight?: THREE.DirectionalLight;
  isRunning: boolean;
  isDebug: boolean;
  flashlight: boolean; // 点击后单次发射扫描

  async init(): Promise<void>; // initRapier + renderer + scene + camera + physics + player
  async load(entityId: string): Promise<void>; // 按 script.entities 加载 glTF -> 创建 trimesh collider
  remove(entityId: string): boolean; // 卸载 & 释放
  refreshEntityCollider(entityId: string): void; // 重建碰撞体
  start(): void;
  stop(): void;
  spawn(): void; // 渲染循环控制
  animate(): void; // requestAnimationFrame 回调
  toggleLidar(): void;
  activate_lidar(): void;
  deactivate_lidar(): void;
  saveState(): void; // 回写实体坐标到 script
  handleResize(): void;
  render(): HTMLElement; // 懒加载容器
  destroy(): void; // 停止&释放 Three/Rapier
}
```

Lidar 模式：关闭光照 + 隐藏模型 + 保持点云可视（RayCaster 自行绘制）。

---

## Player

封装 Rapier CharacterController；负责输入、相机、交互（E / 距离触发）、保存位置。

```typescript
class Player {
  config: {
    height: number;
    radius: number;
    normal_speed: number;
    fast_speed: number;
    fast_speed_creative: number;
    jumpSpeed: number;
    acceleration: number;
    deceleration: number;
    airControl: number;
    gravityScale: number;
    controllerOffset: number;
    maxSlopeAngle: number;
    minSlopeSlideAngle: number;
    stepHeight: number;
    stepMinWidth: number;
    snapDistance: number;
    mouseSensitivity: number;
    cameraHeightRatio: number;
    yvel_epsL: number;
    yvel_epsR: number;
    stair_speed: number;
  };
  velocity: THREE.Vector3;
  targetVelocity: THREE.Vector3;
  isGrounded: boolean;
  jumpRequested: boolean;
  characterController: any;
  rigidBody: any;
  collider: any;
  getPosition(): { x: number; y: number; z: number };
  teleport(
    pos: { x: number; y: number; z: number } | [number, number, number]
  ): boolean;
  getVelocity(): THREE.Vector3;
  isOnGround(): boolean;
  getRotation(): THREE.Euler;
  update(dt: number): void; // 由 Scene.animate 调度
  destroy(): void; // 移除物理组件 + interval
}
```

交互：

1. `RayCaster.castFromCamera` 取得最近实体，若实体含 `interact_callback`（数组）按顺序拼接 `;` 后通过脚本系统执行。
2. 距离交互（`distance_callback`）按玩家位置与 `properties.distance` 或全局 `global.interact_distance` 比较。

---

## RayCaster

核心：基于 Rapier Ray cast + 自制点云系统（批量写入 Float32Array + 帧内增量处理 + 衰减/寿命 + 逐行扫描模拟 LIDAR）。

```typescript
class RayCaster {
  pointCount: number; // (getter)
  cast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist?: number,
    exclude?: any
  ): Hit | null;
  castFromPosition(
    pos: THREE.Vector3,
    dirVec: THREE.Vector3,
    exclude?: any
  ): Hit | null;
  castFromCamera(
    camera: THREE.Camera,
    distance?: number,
    exclude?: any
  ): Hit | null;
  makeLightPoint(
    pos: THREE.Vector3,
    color: number,
    lifeTime?: number,
    intensity_drop?: number,
    live_long?: boolean
  ): void;
  scatterLightPoint(
    camera: THREE.Camera,
    distance: number,
    density: number,
    exclude?: any
  ): void; // 启动一次扫描动画
  updateLightPoints(dt: number): void; // 点寿命衰减 + 队列处理 + 激光绘制
  clearAllPoint(): void;
  setPointsPerFrame(n: number): void;
  getQueueStatus(): {
    queueLength: number;
    pointsPerFrame: number;
    enabled: boolean;
  };
  destroy(): void; // 释放 DOM/canvas
}
```

Hit 结构： `{ distance:number, point:THREE.Vector3, entityId?:string, color:number, intensity_drop:number, live_long:boolean }`。

点系统性能策略：

1. 预分配大缓冲 (`PointLimit * 3`)
2. 循环写指针 `nextWrite` 覆盖旧点
3. 每帧限额 `pointsPerFrame` 处理队列 -> 平滑展示
4. 生命周期映射到颜色强度（最小亮度保留长生点）

---

## DevelopTool

调试面板（FPS 平滑 / 玩家位置 & 速度 / 射线命中信息）。

```typescript
class DevelopTool {
  isActive: boolean;
  activate(): void;
  deactivate(): void;
  toggle(): void;
  update(dt: number): void; // 内部 setInterval 60Hz 调用
  handleInput(event: Event): 0; // 不截获输入
  destroy(): void;
}
```

---

## 数据配置 main.json（关键字段）

```jsonc
{
  "dependencies": [
    { "id": "moduleId", "path": "./scripts/src/layers/terminal.js" }
  ],
  "scripts": ["rdm1 = new SomeRenderer()", "core.scene.load('main_facility')"],
  "entities": [
    {
      "id": "self",
      "name": "player",
      "properties": {
        "coordinates": [0, 1.8, 0],
        "rotation": [0, 0, 0],
        "lidar_color": 16777215,
        "intensity_drop": 1
      }
    }
  ],
  "speeches": [],
  "shortcut": { "KeyD": "core.devtool.toggle()" },
  "global": { "interact_distance": 3 }
}
```

运行时脚本可向实体追加：`interact_callback: string[]`, `distance_callback: string[]`, `live_long`, `lidar_color` 等。

---

## 存档结构 (localStorage key: terminus_saves)

```jsonc
{
  "autosave": {
    "saveTime": "2025-09-05T12:34:56.000Z",
    "savingdata": {
      /* 完整 script 对象（含实体当前位置回写） */
    }
  }
}
```

---

## 设计补充

详见 `ARCHITECTURE.md` “设计说明” 章节：

1. 输入路由与 pointer lock 同步
2. 脚本自动重写策略（显式挂载到 window）
3. Rapier 角色控制缓存（位置 / 速度）避免物理读写竞争
4. Lidar 点云性能与渐进式扫描
5. 资源复用与材质深拷贝原则

---

## 未来扩展建议（简列）

| 模块          | 建议                                                | 价值            |
| ------------- | --------------------------------------------------- | --------------- |
| ScriptManager | 引入沙箱上下文 (Proxy / iframe)                     | 安全性          |
| Scene         | 增加背景任务卸载/热重载实体 diff                    | 性能 / 关卡流转 |
| RayCaster     | WebWorker 分帧计算 + GPU 点云 (Points + Instancing) | 帧率稳定性      |
| Player        | 配置热更新 & 可插拔移动模式                         | 可调手感        |
| Core          | 生命周期事件 bus                                    | 解耦            |

---

（完）
