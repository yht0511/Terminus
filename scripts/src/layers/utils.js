/**
 * 层级工具模块 - 提供渐变颜色层和确认对话框的实用功能
 */

/**
 * 创建渐变颜色层
 * 该层会从透明逐渐变为指定颜色，并阻止所有输入事件向下传递
 * @param {number} fadeSpeed - 渐变速率（每帧增加的透明度，0-1之间）
 * @returns {Object} 返回层对象，包含 activate、deactivate 等方法
 */
export function createFadeToColorLayer(
  fadeSpeed = 0.02,
  targetColor = "#000000"
) {
  return new FadeToColorLayer(fadeSpeed, targetColor);
}

// 为了向后兼容，保留原来的函数名
export function createFadeToBlackLayer(
  fadeSpeed = 0.02,
  targetColor = "#000000"
) {
  return new FadeToColorLayer(fadeSpeed, targetColor);
}

/**
 * 创建确认对话框层
 * 该层会显示一个模态对话框，替代原生的confirm函数
 * @param {string} message - 确认消息（支持HTML）
 * @param {Function} onConfirm - 确认按钮点击回调
 * @param {Function} onCancel - 取消按钮点击回调（可选）
 * @returns {ConfirmDialogLayer} 返回确认对话框层对象
 */
export function createConfirmDialog(message, onConfirm, onCancel = null) {
  return new ConfirmDialogLayer(message, onConfirm, onCancel);
}

/**
 * 渐变颜色层类
 */
class FadeToColorLayer {
  constructor(fadeSpeed = 0.02, targetColor = "#000000") {
    this.id = null;
    this.name = "渐变颜色层";
    this.activated = false;
    this.element = null;

    // 渐变参数
    this.fadeSpeed = Math.max(0.001, Math.min(1, fadeSpeed)); // 限制在合理范围内
    this.targetColor = this.parseColor(targetColor);
    this.currentOpacity = 0;
    this.isComplete = false;

    // 动画控制
    this.animationId = null;

    console.log(
      `🌈 渐变颜色层已创建 (目标颜色: ${this.targetColor.css}, 速率: ${this.fadeSpeed})`
    );
  }

  /**
   * 解析颜色为 RGB 值
   * @param {string|number} color 颜色值
   * @returns {Object} 包含 r, g, b, css 属性的颜色对象
   */
  parseColor(color) {
    let r, g, b;

    if (typeof color === "number") {
      // 十六进制数值，如 0xff0000
      r = (color >> 16) & 255;
      g = (color >> 8) & 255;
      b = color & 255;
    } else if (typeof color === "string") {
      if (color.startsWith("#")) {
        // 十六进制字符串，如 "#ff0000"
        const hex = color.substring(1);
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16);
          g = parseInt(hex[1] + hex[1], 16);
          b = parseInt(hex[2] + hex[2], 16);
        } else {
          r = parseInt(hex.substring(0, 2), 16);
          g = parseInt(hex.substring(2, 4), 16);
          b = parseInt(hex.substring(4, 6), 16);
        }
      } else if (color.startsWith("rgb")) {
        // RGB 字符串，如 "rgb(255, 0, 0)"
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
          r = parseInt(matches[0]);
          g = parseInt(matches[1]);
          b = parseInt(matches[2]);
        }
      } else {
        // 命名颜色，使用默认黑色
        console.warn(`未识别的颜色格式: ${color}，使用默认黑色`);
        r = g = b = 0;
      }
    }

    // 确保值在有效范围内
    r = Math.max(0, Math.min(255, r || 0));
    g = Math.max(0, Math.min(255, g || 0));
    b = Math.max(0, Math.min(255, b || 0));

    return {
      r,
      g,
      b,
      css: `rgb(${r}, ${g}, ${b})`,
    };
  }

  /**
   * 激活渐变层
   * @returns {FadeToColorLayer} 返回自身，支持链式调用
   */
  activate() {
    if (this.activated) return this;

    this.activated = true;
    this.currentOpacity = 0;
    this.isComplete = false;
    this.element = this.createElement();

    // 添加到层级管理器
    window.core.layers.push(this);

    // 开始渐变动画
    this.startFadeAnimation();

    console.log("🌈 渐变颜色层已激活");
    return this;
  }

  /**
   * 停用渐变层
   */
  deactivate() {
    if (!this.activated) return;

    this.activated = false;
    this.stopFadeAnimation();
    window.core.layers.remove(this);

    console.log("🌈 渐变颜色层已停用");
  }

  /**
   * 创建DOM元素
   * @returns {HTMLElement}
   */
  createElement() {
    const element = document.createElement("div");
    element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(${this.targetColor.r}, ${this.targetColor.g}, ${this.targetColor.b}, 0);
      pointer-events: auto;
      transition: none;
      z-index: 1000;
    `;
    return element;
  }

  /**
   * 开始渐变动画
   */
  startFadeAnimation() {
    if (this.animationId) return;

    const animate = () => {
      if (!this.activated || this.isComplete) {
        this.animationId = null;
        return;
      }

      this.currentOpacity += this.fadeSpeed;

      if (this.currentOpacity >= 1) {
        this.currentOpacity = 1;
        this.isComplete = true;
        this.onFadeComplete();
      }

      // 更新元素透明度
      if (this.element) {
        this.element.style.background = `rgba(${this.targetColor.r}, ${
          this.targetColor.g
        }, ${this.targetColor.b}, ${this.currentOpacity.toFixed(3)})`;
      }

      if (!this.isComplete) {
        this.animationId = requestAnimationFrame(animate);
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * 停止渐变动画
   */
  stopFadeAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 渐变完成回调（可被重写）
   */
  onFadeComplete() {
    console.log(`🌈 渐变颜色层渐变完成 (${this.targetColor.css})`);
  }

  /**
   * 处理输入事件 - 阻断所有输入
   * @param {Event} event
   * @returns {boolean} 总是返回true，阻止事件传播
   */
  handleInput(event) {
    // 阻断所有输入事件
    return true;
  }

  /**
   * 重置渐变状态
   */
  reset() {
    this.currentOpacity = 0;
    this.isComplete = false;
    if (this.element) {
      this.element.style.background = `rgba(${this.targetColor.r}, ${this.targetColor.g}, ${this.targetColor.b}, 0)`;
    }
  }

  /**
   * 设置渐变速度
   * @param {number} speed - 新的渐变速度
   */
  setFadeSpeed(speed) {
    this.fadeSpeed = Math.max(0.001, Math.min(1, speed));
  }

  /**
   * 设置目标颜色
   * @param {string|number} color - 新的目标颜色
   */
  setTargetColor(color) {
    this.targetColor = this.parseColor(color);
    console.log(`🎨 目标颜色已更新为: ${this.targetColor.css}`);
  }

  /**
   * 获取当前渐变进度 (0-1)
   * @returns {number}
   */
  getProgress() {
    return this.currentOpacity;
  }

  /**
   * 切换激活状态
   */
  toggle() {
    if (this.activated) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * 销毁层
   */
  destroy() {
    this.deactivate();
    console.log("🗑️ 渐变颜色层已销毁");
  }
}

// 导出类以供直接使用
export { FadeToColorLayer };

/**
 * 确认对话框层类
 */
class ConfirmDialogLayer {
  constructor(message, onConfirm, onCancel = null) {
    this.id = null;
    this.name = "确认对话框层";
    this.activated = false;
    this.element = null;

    // 对话框参数
    this.message = message;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;

    // 记录之前的控制状态
    this.previousControlElement = null;
    this.wasPointerLocked = false;

    // 确保样式只注入一次
    this.injectCSS();

    console.log("🔔 确认对话框层已创建");
  }

  /**
   * 激活确认对话框层
   * @returns {ConfirmDialogLayer} 返回自身，支持链式调用
   */
  activate() {
    if (this.activated) return this;

    this.activated = true;
    window.core.script.innerShowConfirmactivated = true;
    this.element = this.createElement();

    // 记录当前的控制状态
    this.wasPointerLocked = !!document.pointerLockElement;
    this.previousControlElement = document.pointerLockElement;

    // 脱离鼠标控制（释放指针锁定）
    if (document.pointerLockElement) {
      document.exitPointerLock();
      console.log("🔔 已脱离鼠标控制以显示确认对话框");
    }

    // 添加到层级管理器
    window.core.layers.push(this);

    console.log("🔔 确认对话框层已激活");
    return this;
  }

  /**
   * 停用确认对话框层
   */
  deactivate() {
    if (!this.activated) return;

    this.activated = false;
    window.core.layers.remove(this);

    // 恢复之前的鼠标控制状态
    if (this.wasPointerLocked) {
      // 延迟一小段时间再恢复鼠标控制，确保对话框完全关闭
      setTimeout(() => {
        // 尝试恢复到之前的控制元素，如果不存在则使用canvas
        let targetElement = this.previousControlElement;
        if (!targetElement || !document.contains(targetElement)) {
          targetElement = document.querySelector("canvas");
        }

        if (targetElement && !document.pointerLockElement) {
          targetElement.requestPointerLock();
          console.log("🔔 已恢复鼠标控制到:", targetElement.tagName);
        }
        window.core.script.innerShowConfirmactivated = false;
      }, 100);
    }

    console.log("🔔 确认对话框层已停用");
  }

  /**
   * 创建DOM元素
   * @returns {HTMLElement}
   */
  createElement() {
    const element = document.createElement("div");
    element.className = "confirm-dialog-overlay";

    element.innerHTML = `
      <div class="confirm-dialog-backdrop"></div>
      <div class="confirm-dialog-container">
        <div class="confirm-dialog-header">
          <div class="confirm-dialog-icon">⚠️</div>
          <div class="confirm-dialog-title">确认操作</div>
        </div>
        <div class="confirm-dialog-content">
          <div class="confirm-dialog-message">${this.message}</div>
        </div>
        <div class="confirm-dialog-footer">
          <button class="confirm-dialog-btn confirm-dialog-btn-cancel" data-action="cancel">
            <span class="confirm-dialog-btn-icon">🤔</span>
            <span class="confirm-dialog-btn-text">再想想</span>
          </button>
          <button class="confirm-dialog-btn confirm-dialog-btn-confirm" data-action="confirm">
            <span class="confirm-dialog-btn-icon">✅</span>
            <span class="confirm-dialog-btn-text">确认</span>
          </button>
        </div>
      </div>
    `;

    // 绑定点击事件
    this.bindEvents(element);

    return element;
  }

  /**
   * 绑定事件
   * @param {HTMLElement} element
   */
  bindEvents(element) {
    // 点击背景关闭
    const backdrop = element.querySelector(".confirm-dialog-backdrop");
    backdrop.addEventListener("click", () => {
      this.handleCancel();
    });

    // 按钮点击事件
    const buttons = element.querySelectorAll(".confirm-dialog-btn");
    buttons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = button.getAttribute("data-action");

        if (action === "confirm") {
          this.handleConfirm();
        } else if (action === "cancel") {
          this.handleCancel();
        }
      });

      // 按钮悬停效果
      button.addEventListener("mouseenter", () => {
        button.style.transform = "translateY(-2px)";
      });

      button.addEventListener("mouseleave", () => {
        button.style.transform = "translateY(0)";
      });
    });
  }

  /**
   * 处理确认按钮点击
   */
  handleConfirm() {
    console.log("🔔 用户确认操作");
    this.deactivate();

    if (this.onConfirm && typeof this.onConfirm === "function") {
      try {
        this.onConfirm();
      } catch (error) {
        console.error("确认回调执行错误:", error);
      }
    }
  }

  /**
   * 处理取消按钮点击
   */
  handleCancel() {
    console.log("🔔 用户取消操作");
    this.deactivate();

    if (this.onCancel && typeof this.onCancel === "function") {
      try {
        this.onCancel();
      } catch (error) {
        console.error("取消回调执行错误:", error);
      }
    }
  }

  /**
   * 处理输入事件 - 屏蔽所有键盘输入，只接受鼠标点击
   * @param {Event} event
   * @returns {boolean} 总是返回true，阻止事件传播
   */
  handleInput(event) {
    // 屏蔽所有键盘输入
    if (
      event.type === "keydown" ||
      event.type === "keyup" ||
      event.type === "keypress"
    ) {
      return true;
    }

    // 允许鼠标事件传递给对话框内部处理
    return false;
  }

  /**
   * 注入CSS样式
   */
  injectCSS() {
    const styleId = "confirm-dialog-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .confirm-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }

      .confirm-dialog-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        animation: fadeIn 0.3s ease-out;
      }

      .confirm-dialog-container {
        position: relative;
        width: 90%;
        max-width: 480px;
        background: linear-gradient(145deg, #1a1a1a, #2d2d2d);
        border: 2px solid #00ff41;
        border-radius: 12px;
        box-shadow: 
          0 0 20px rgba(0, 255, 65, 0.3),
          0 0 40px rgba(0, 255, 65, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
        animation: slideInScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-family: 'Courier New', monospace;
      }

      .confirm-dialog-header {
        padding: 20px 24px 16px;
        border-bottom: 1px solid rgba(0, 255, 65, 0.2);
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .confirm-dialog-icon {
        font-size: 24px;
        filter: drop-shadow(0 0 8px rgba(255, 193, 7, 0.6));
      }

      .confirm-dialog-title {
        font-size: 18px;
        font-weight: bold;
        color: #00ff41;
        letter-spacing: 1px;
        text-shadow: 0 0 10px rgba(0, 255, 65, 0.5);
      }

      .confirm-dialog-content {
        padding: 24px;
      }

      .confirm-dialog-message {
        color: #ffffff;
        font-size: 16px;
        line-height: 1.6;
        letter-spacing: 0.5px;
        text-align: center;
        margin: 0;
      }

      .confirm-dialog-message span[style*="red"] {
        color: #ff5555 !important;
        text-shadow: 0 0 8px rgba(255, 85, 85, 0.4);
      }

      .confirm-dialog-footer {
        padding: 16px 24px 24px;
        display: flex;
        gap: 16px;
        justify-content: center;
      }

      .confirm-dialog-btn {
        flex: 1;
        padding: 12px 20px;
        border: 2px solid;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.3);
        color: white;
        font-family: inherit;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        position: relative;
        overflow: hidden;
      }

      .confirm-dialog-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transition: left 0.5s ease;
      }

      .confirm-dialog-btn:hover::before {
        left: 100%;
      }

      .confirm-dialog-btn-cancel {
        border-color: #ffc107;
        color: #ffc107;
        box-shadow: 0 0 15px rgba(255, 193, 7, 0.2);
      }

      .confirm-dialog-btn-cancel:hover {
        background: rgba(255, 193, 7, 0.1);
        box-shadow: 0 0 25px rgba(255, 193, 7, 0.4);
        transform: translateY(-2px);
      }

      .confirm-dialog-btn-confirm {
        border-color: #ff5555;
        color: #ff5555;
        box-shadow: 0 0 15px rgba(255, 85, 85, 0.2);
      }

      .confirm-dialog-btn-confirm:hover {
        background: rgba(255, 85, 85, 0.1);
        box-shadow: 0 0 25px rgba(255, 85, 85, 0.4);
        transform: translateY(-2px);
      }

      .confirm-dialog-btn-icon {
        font-size: 16px;
      }

      .confirm-dialog-btn-text {
        font-size: 13px;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideInScale {
        from {
          opacity: 0;
          transform: scale(0.7) translateY(50px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      /* 响应式设计 */
      @media (max-width: 768px) {
        .confirm-dialog-container {
          width: 95%;
          margin: 20px;
        }
        
        .confirm-dialog-footer {
          flex-direction: column;
        }
        
        .confirm-dialog-btn {
          flex: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 切换激活状态
   */
  toggle() {
    if (this.activated) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * 销毁层
   */
  destroy() {
    this.deactivate();
    console.log("🗑️ 确认对话框层已销毁");
  }
}

// 导出确认对话框层类
export { ConfirmDialogLayer };

/**
 * 便利函数：显示确认对话框，返回Promise
 * 可以用来替代原生的confirm函数
 * @param {string} message - 确认消息（支持HTML）
 * @returns {Promise<boolean>} 返回Promise，确认时resolve(true)，取消时resolve(false)
 */
export function innerShowConfirm(message) {
  return new Promise((resolve) => {
    const dialog = createConfirmDialog(
      message,
      () => resolve(true), // 确认回调
      () => resolve(false) // 取消回调
    );
    dialog.activate();
  });
}

window.innerShowConfirm = innerShowConfirm;
