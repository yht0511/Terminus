# Terminus API 文档

## Core API

### Core 类

游戏核心类，负责初始化和管理整个游戏系统。

```typescript
class Core {
  constructor();

  // 属性
  container: HTMLElement; // 游戏容器
  loadingScreen: HTMLElement; // 加载界面
  layers: LayerManager; // 层级管理器
  resources: ResourceManager; // 资源管理器
  scripts: ScriptManager; // 脚本管理器
  scene: Scene; // 场景管理器
  devtool: DevelopTool; // 开发工具
  script: object; // 当前脚本配置
  initialized: boolean; // 初始化状态

  // 方法
  async init(): Promise<void>; // 初始化游戏核心
  async loadMainScript(): Promise<void>; // 加载主脚本
  async preloadResources(): Promise<void>; // 预加载资源
  async loadDependencies(): Promise<void>; // 加载依赖
  async executeScripts(): Promise<void>; // 执行脚本
  hideLoadingScreen(): void; // 隐藏加载界面
  getEntity(id: string): object; // 获取实体配置
  replaceVariables(str: string, context: object): string; // 变量替换
  destructor(): void; // 销毁实例
}
```

## Managers API

### LayerManager

```typescript
class LayerManager {
  constructor(container: HTMLElement);

  // 方法
  add(layer: Layer): void; // 添加层
  remove(id: string): void; // 移除层
  get(id: string): Layer; // 获取层
  clear(): void; // 清空所有层
  destructor(): void; // 销毁管理器
}
```

### ResourceManager

```typescript
class ResourceManager {
  constructor();

  // 方法
  async loadModel(path: string): Promise<any>; // 加载模型
  async loadTexture(path: string): Promise<any>; // 加载贴图
  async loadSound(path: string): Promise<any>; // 加载音频
  unload(path: string): void; // 卸载资源
  destructor(): void; // 销毁管理器
}
```

### ScriptManager

```typescript
class ScriptManager {
  constructor(core: Core);

  // 方法
  async loadScript(id: string, path: string): Promise<void>; // 加载脚本
  async execute(script: object): Promise<void>; // 执行脚本
  unload(id: string): void; // 卸载脚本
  destructor(): void; // 销毁管理器
}
```

## Modules API

### Scene

```typescript
class Scene {
  constructor(core: Core);

  // 方法
  init(): void; // 初始化场景
  load(name: string): Promise<void>; // 加载场景
  unload(): void; // 卸载场景
  update(): void; // 更新场景
}
```

### DevelopTool

```typescript
class DevelopTool {
  constructor(scene: Scene);

  // 方法
  init(): void; // 初始化开发工具
  toggle(): void; // 切换工具显示
  log(...args: any[]): void; // 日志输出
}
```

## Game 类

游戏实例管理类，处理游戏启动、存档等高级功能。

```typescript
class Game {
  constructor();

  // 属性
  core: Core; // 游戏核心实例
  isgaming: boolean; // 游戏状态

  // 方法
  async beginNewGame(): Promise<void>; // 开始新游戏
  async loadSavedGame(savingname: string): Promise<void>; // 加载存档
  exitGame(): void; // 退出游戏
}
```

## 事件系统

### Core 事件

- `initialized`: 核心初始化完成
- `resourceLoaded`: 资源加载完成
- `scriptLoaded`: 脚本加载完成
- `beforeUnload`: 游戏退出前

### Scene 事件

- `sceneLoaded`: 场景加载完成
- `sceneUnloaded`: 场景卸载完成

## 配置文件格式

### main.json

```json
{
  "preload": ["路径列表"],
  "dependencies": [
    {
      "id": "脚本ID",
      "path": "脚本路径"
    }
  ],
  "scripts": ["执行脚本列表"],
  "entities": [
    {
      "id": "实体ID",
      "配置": "值"
    }
  ]
}
```

## 存档数据格式

```json
{
  "存档ID": {
    "saveTime": "ISO时间字符串",
    "savingdata": {
      // 与main.json结构相同
    }
  }
}
```
