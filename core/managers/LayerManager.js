/**
 * 层级管理器 - 管理UI层级显示
 * 支持任何模块的显示并设置显示层级
 */

export class LayerManager {
  constructor(container) {
    this.container = container;
    this.layers = [];
    this.zIndexCounter = 1;
    this.last_shortcut_time = 0;
    // 按层级管理输入事件
    this.forwardFunc = (e) => {
      this.forwardInput(e);
    };
    document.addEventListener("keydown", this.forwardFunc);
    document.addEventListener("keyup", this.forwardFunc);
    document.addEventListener("mousemove", this.forwardFunc);
    document.addEventListener("pointerlockchange", this.forwardFunc);
    document.addEventListener("click", this.forwardFunc);
  }

  destructor() {
    /**
     * 析构函数注意：
     * 递归调用析构子模块
     * 清理DOM元素，事件监听，定时器
     * 释放资源和内存
     * 调用第三方库资源的销毁方法
     * 断开全局引用
     * 销毁顺序：子模块 -> 管理器 -> 核心
     */
    try {
      console.log("销毁层级管理器...");
      this.clear();
      this.layers = null;
      this.container = null;
      this.last_shortcut_time = null;
      this.zIndexCounter = 1;
      document.removeEventListener("keydown", this.forwardFunc);
      document.removeEventListener("keyup", this.forwardFunc);
      document.removeEventListener("mousemove", this.forwardFunc);
      document.removeEventListener("pointerlockchange", this.forwardFunc);
      document.removeEventListener("click", this.forwardFunc);
    } catch (error) {
      console.error("销毁过程中出错:", error);
    }
    console.log("层级管理器已销毁");
  }

  /**
   * 添加一个新层级
   * @param {HTMLElement|Object} module - 要添加的模块或DOM元素
   * @param {number} zIndex - 层级索引（可选）
   */
  push(module, zIndex = null) {
    const element = this.createLayerElement(module);

    if (zIndex === null) {
      zIndex = this.zIndexCounter++;
    }

    element.style.zIndex = zIndex;
    element.classList.add("layer");

    this.container.appendChild(element);

    const layer = {
      id: this.generateLayerId(),
      element,
      module,
      zIndex,
    };

    module.id = layer.id;
    module.zIndex = layer.zIndex;
    this.layers.push(layer);

    console.log(`添加层级: ${layer.id}, z-index: ${zIndex}`);

    return layer;
  }

  /**
   * 移除指定层级
   * @param {string|Object} layerOrId - 层级对象或ID
   */
  remove(layerOrId) {
    var layer = null;
    if (typeof layerOrId === "string") {
      layer = this.layers.find((l) => l.id === layerOrId);
    } else {
      layer = this.layers.find((l) => l.id === layerOrId.id);
    }

    if (!layer) {
      console.warn("尝试移除不存在的层级");
      return;
    }

    // 调用模块的销毁方法（如果存在）
    if (layer.module && typeof layer.module.destroy === "function") {
      layer.module.destroy();
    }

    // 从DOM中移除
    if (layer.element && layer.element.parentNode) {
      layer.element.parentNode.removeChild(layer.element);
    }

    // 从层级列表中移除
    const index = this.layers.indexOf(layer);

    if (index > -1) {
      this.layers.splice(index, 1);
    }

    console.log(`移除层级: ${layer.id}`);
  }

  /**
   * 清空所有层级
   */
  clear() {
    while (this.layers.length > 0) {
      this.remove(this.layers[0]);
    }
  }

  /**
   * 获取指定层级
   * @param {string} id - 层级ID
   */
  get(id) {
    return this.layers.find((l) => l.id === id);
  }

  /**
   * 将层级置于最前
   * @param {string|Object} layerOrId - 层级对象或ID
   */
  bringToFront(layerOrId) {
    const layer =
      typeof layerOrId === "string"
        ? this.layers.find((l) => l.id === layerOrId)
        : layerOrId;

    if (!layer) return;

    layer.zIndex = this.zIndexCounter++;
    layer.element.style.zIndex = layer.zIndex;
  }

  /**
   * 创建层级DOM元素
   * @param {HTMLElement|Object} module - 模块
   */
  createLayerElement(module) {
    if (module instanceof HTMLElement) {
      return module;
    }

    // 如果模块有render方法，调用它
    if (module && typeof module.render === "function") {
      const rendered = module.render();
      if (rendered instanceof HTMLElement) {
        return rendered;
      }
    }

    // 如果模块有element属性
    if (module && module.element instanceof HTMLElement) {
      return module.element;
    }

    // 创建默认容器
    const element = document.createElement("div");
    element.className = "layer-container";

    return element;
  }

  /**
   * 生成唯一层级ID
   */
  generateLayerId() {
    return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取所有层级信息
   */
  getLayers() {
    return this.layers.map((layer) => ({
      id: layer.id,
      zIndex: layer.zIndex,
      module: layer.module?.constructor?.name || "Unknown",
    }));
  }

  /**
   * pop
   */
  pop() {
    const layer = this.layers.pop();
    if (layer) {
      layer.element.parentNode.removeChild(layer.element);
      console.log(`移除层级: ${layer.id}`);
    }
  }

  /**
   * 转发所有键盘输入，传递给最上层
   * @param {Event} event
   */
  forwardInput(event, is2all = false) {
    // --- 状态同步逻辑 ---
    if (event.type === "pointerlockchange") {
      const isLocked = document.pointerLockElement !== null;
      document.mouse_locked = isLocked;
      console.log(`鼠标锁定状态变为: ${isLocked}`);

      // 如果是浏览器通过 ESC 强制解锁，并且游戏内的暂停菜单【还未】激活
      if (
        !isLocked &&
        window.gameInstance &&
        !window.gameInstance.pauseMenu.isActive
      ) {
        console.log("检测到 ESC 键解锁，同步打开暂停菜单");
        // 直接调用模块的 activate 方法，并把它推入层级
        window.gameInstance.pauseMenu.activate();
      }
      // pointerlockchange 是一个特殊事件，我们不希望它被当作普通输入处理
      return;
    }

    if (this.handleShortcuts(event)) return;
    if (this.handleClick(event)) return;
    is2all = is2all || this.getIs2All(is2all);
    // 从后往前遍历层级, 直到找到能接收输入的层级
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (
        layer &&
        layer.module &&
        typeof layer.module.handleInput === "function"
      ) {
        if (!is2all && layer.module.handleInput(event)) break;
      }
    }
  }

  /**
   *  快捷键处理
   * @param {Object} shortcuts - 快捷键映射对象
   */
  handleShortcuts(event) {
    if (!document.core.script) return;
    const shortcuts = document.core.script.shortcut;
    if (!shortcuts || event.type !== "keydown" || !core.script.debug) return;
    if (!event.ctrlKey) return 0;
    const action = shortcuts[event.code];
    if (action) {
      const currentTime = Date.now();

      if (currentTime - this.last_shortcut_time < 200) {
        return 1;
      }
      this.last_shortcut_time = currentTime;
      eval(action);
      window.achievementSystem.trigger("adminstrator");
      event.preventDefault();
      return 1;
    }
    return 0;
  }
  handleClick0(event) {
    if (event.type == "pointerlockchange") {
      document.mouse_locked = document.pointerLockElement !== null;
      return false;
    }
    if (event.type == "click") {
      if (!document.pointerLockElement) {
        document.body.requestPointerLock();
      }
    }
    return false;
  }

  handleClick(event) {
    // handleClick 现在只负责点击请求锁定
    if (event.type == "click") {
      if (
        window.gameInstance &&
        !window.gameInstance.pauseMenu.isActive &&
        !document.pointerLockElement
      ) {
        document.body.requestPointerLock();
      }
    }
    return false; // click 事件不应该阻止其他逻辑
  }
  getIs2All(event) {
    if (event.type == "pointerlockchange") {
      return true;
    }
    return false;
  }
}
