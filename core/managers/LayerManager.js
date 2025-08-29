/**
 * 层级管理器 - 管理UI层级显示
 * 支持任何模块的显示并设置显示层级
 */

export class LayerManager {
  constructor(container) {
    this.container = container;
    this.layers = [];
    this.zIndexCounter = 1;
    document.addEventListener("keydown", (e) => this.forwardInput(e));
    document.addEventListener("keyup", (e) => this.forwardInput(e));
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

    this.layers.push(layer);

    console.log(`添加层级: ${layer.id}, z-index: ${zIndex}`);

    return layer;
  }

  /**
   * 移除指定层级
   * @param {string|Object} layerOrId - 层级对象或ID
   */
  remove(layerOrId) {
    const layer =
      typeof layerOrId === "string"
        ? this.layers.find((l) => l.id === layerOrId)
        : layerOrId;

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
  forwardInput(event) {
    // 从后往前遍历层级, 直到找到能接收输入的层级
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      if (layer && layer.module && typeof layer.module.handleInput === "function") {
        layer.module.handleInput(event);
        break;
      }
    }
  }
}