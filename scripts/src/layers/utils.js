/**
 * 层级工具模块 - 提供渐变颜色层的实用功能
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
