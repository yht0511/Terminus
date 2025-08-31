`P` 表示是一个异步。

# Core

## managers

### LayerManager

### ResourceManager

- `loadedModels` ：Map ，模型
- `loadedTextures`：Map，纹理（不知道做什么的）
- `loadingPromises`：Map，Promise

---

- `cloneModel(model:Object3D)->Object3D`：深拷贝。
- `P`：`loadModel(path:string)->Object3D`：加载。
- `P`：`loadTexture(path:string)->Promise`：加载纹理，给出promise。
- `getOriginalModel(path:string)->Object3D`：不复制得给出 model。
- `P`：`preloadModels(paths:Array<string>)->void`：`loadModel` 得批处理。
- `dispose():void` 清空。
- `getStatus()`：model, texture, promise得数量。

### ScriptManager

终端脚本执行：

- `core`：需要提供一个终端执行核心。
- `loadedScripts`：Map。
- `scriptModels`：Map。

```plain
    // 核心对象
    core: this.core,

    // 管理器快捷访问
    layers: this.core.layers,
    resources: this.core.resources,
    input: this.core.input,
    scene: this.core.scene,

    // 工具函数
    console: console,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,

    // 数学函数
    Math: Math,

    // 加载的脚本模块
    ...Object.fromEntries(this.scriptModules),
```

- `P`：`loadScript(id, path)->module`：导入模块，分为 `default` 和其他类型导入。
- `P`：`execute(script:String)->result`：执行特定脚本，script 是脚本代码，通过下文 `exeContext`：的参数得到输出。
- `createExecutionContext()`：提供上文脚本运行需要的工具及对象。
- `parseMethodCall(script)`：分解脚本返回（例如`core.main.call(true,a,b,c)`）：
  - object：core.main
  - method: call
  - args: [true, a, b, c]
- `resolveObject(path)`：判是否存在合法，不存在是 `null` ，是的话返回最终的执行对象。
- `P`：`executeCall(script)`：执行一个脚本，带各种安全检查，给出返回值。
- `getScript(id),getModule(id)`：查询。
- `dispose()`：清理。

### LayerManager

处理页面渲染的。

- `container`：指定修改DOM的位置。
- `layers`：Array
- `zIndexCounter` 。

---

- `push( module:HTML|Object,zIndex(optional) )`：创建一个 Layer 并指定一个 index。
- `createLayerElement( module )`：创建一个 HTML，如果是 Object 就转化一下。
- `remove( layerOrId:String|Object )`：删除。
- `clear()`：全删了。
- `get( id )`：找一个 layer。
- `bringToFront( layerOrId )`：刷 index 到顶层。
- `generateLayerId()`：生成一个唯一 ID。
- `getLayers()`：返回所有 Layer。

## modules

### Scece

3D 场景模块，使用 `Rapier` 完成全部的物理引擎：

- `initRapier()` ：。
- `setupRenderer()`：初始化渲染和关联 html，有几个问题：
  - shadow 应该可以不开
- `setupScene()`：~~设个雾气干什么~~。
- `setupCamera()`：相机。
- `setupPhysics()`：加了个地面和重力场。
- `setupLight()`：一闪一闪。
- 
