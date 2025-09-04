/**
 * 密码锁管理器 - UI覆盖层模块
 * 在3D场景上叠加一个可交互的9键密码锁界面。
 */

export default class KeypadManager {
  constructor(id) {
    this.id = id;
    this.name = "密码锁管理器";
    this.entity = window.core.getEntity(id);

    // DOM元素引用
    this.element = null;
    this.keypadElement = null;
    this.displayElement = null;
    this.submitButton = null;
    this.cancelButton = null;

    // 密码状态
    this.currentInput = "";
    this.maxLength = 6; // 最大密码长度
    this.correctPassword = "123456"; // 正确密码（可配置）
    this.isLocked = true;

    // 音效反馈
    this.lastClickTime = 0;
    this.clickCooldown = 100; // 防止重复点击的冷却时间

    // 显示
    this.injectCSS(); // 注入模块所需的CSS
    this.element = this.createKeypadElement();

    if (this.entity.properties.activated) this.activate();

    console.log("🔐 密码锁管理器已加载");
  }

  /**
   * 激活密码锁界面
   * @returns {HTMLElement} 返回创建的DOM元素，由主程序添加到页面中
   */
  activate() {
    // 设置为活跃状态
    this.entity.properties.activated = true;

    // 添加到层级管理器
    core.layers.push(this);

    // 重置状态
    this.reset();

    console.log("🔐 密码锁已激活");
    return this;
  }

  deactivate() {
    if (!this.entity.properties.activated) return;
    this.entity.properties.activated = false;
    core.layers.remove(this);
    console.log("🔐 密码锁已停用");
  }

  /**
   * 创建密码锁的DOM结构
   * @returns {HTMLElement}
   */
  createKeypadElement() {
    const element = document.createElement("div");
    element.id = "keypad-element";

    element.innerHTML = `
      <div class="keypad-container">
        <div class="keypad-header">
          <span class="keypad-title">SECURITY KEYPAD</span>
          <div class="keypad-status ${this.isLocked ? "locked" : "unlocked"}">
            ${this.isLocked ? "LOCKED" : "UNLOCKED"}
          </div>
        </div>
        
        <div class="keypad-display">
          <div class="display-screen">
            <span class="display-text"></span>
            <span class="display-cursor">_</span>
          </div>
        </div>

        <div class="keypad-grid">
          <button class="keypad-btn number-btn" data-value="1">1</button>
          <button class="keypad-btn number-btn" data-value="2">2</button>
          <button class="keypad-btn number-btn" data-value="3">3</button>
          <button class="keypad-btn number-btn" data-value="4">4</button>
          <button class="keypad-btn number-btn" data-value="5">5</button>
          <button class="keypad-btn number-btn" data-value="6">6</button>
          <button class="keypad-btn number-btn" data-value="7">7</button>
          <button class="keypad-btn number-btn" data-value="8">8</button>
          <button class="keypad-btn number-btn" data-value="9">9</button>
        </div>

        <div class="keypad-controls">
          <button class="keypad-btn control-btn cancel-btn">CANCEL</button>
          <button class="keypad-btn number-btn" data-value="0">0</button>
          <button class="keypad-btn control-btn submit-btn">SUBMIT</button>
        </div>

        <div class="keypad-message">
          <span class="message-text">Enter Password</span>
        </div>
      </div>
    `;

    // 保存对关键元素的引用
    this.keypadElement = element.querySelector(".keypad-grid");
    this.displayElement = element.querySelector(".display-text");
    this.submitButton = element.querySelector(".submit-btn");
    this.cancelButton = element.querySelector(".cancel-btn");
    this.messageElement = element.querySelector(".message-text");
    this.statusElement = element.querySelector(".keypad-status");

    return element;
  }

  handleInput(event) {
    if (event.type === "keydown") {
      this.handleKeyDown(event);
      return 1; // 消费事件
    } else if (event.type === "click") {
      this.handleClick(event);
      return 1; // 消费事件
    } else if (event.type === "mousemove") {
      this.handleMouseMove(event);
      return 0; // 允许鼠标移动事件继续传播
    }
    return 0;
  }

  /**
   * 处理点击事件
   * @param {MouseEvent} event
   */
  handleClick(event) {
    const target = event.target;

    // 检查是否点击了数字按钮
    if (target.classList.contains("number-btn")) {
      const value = target.getAttribute("data-value");
      if (value !== null) {
        this.addDigit(value);
      }
      return;
    }

    // 检查是否点击了提交按钮
    if (target.classList.contains("submit-btn")) {
      this.submitPassword();
      return;
    }

    // 检查是否点击了取消按钮
    if (target.classList.contains("cancel-btn")) {
      this.cancel();
      return;
    }
  }

  /**
   * 处理鼠标移动事件
   * @param {MouseEvent} event
   */
  handleMouseMove(event) {
    const target = event.target;

    // 移除所有按钮的hover状态
    const allButtons = this.element.querySelectorAll(".keypad-btn");
    allButtons.forEach((btn) => btn.classList.remove("hover"));

    // 为当前悬停的按钮添加hover状态
    if (target.classList.contains("keypad-btn")) {
      target.classList.add("hover");
    }
  }

  /**
   * 处理键盘输入事件
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event) {
    // 数字键输入
    if (event.key >= "0" && event.key <= "9") {
      event.preventDefault();
      this.addDigit(event.key);
    }
    // 回车键提交
    else if (event.key === "Enter") {
      event.preventDefault();
      this.submitPassword();
    }
    // ESC键取消
    else if (event.key === "Escape" || event.key === "q" || event.key === "Q") {
      event.preventDefault();
      this.cancel();
    }
    // 退格键删除
    else if (event.key === "Backspace") {
      event.preventDefault();
      this.removeDigit();
    }
  }

  /**
   * 添加数字到当前输入
   * @param {string} digit
   */
  addDigit(digit) {
    const currentTime = Date.now();
    if (currentTime - this.lastClickTime < this.clickCooldown) {
      return; // 防止重复点击
    }
    this.lastClickTime = currentTime;

    if (this.currentInput.length < this.maxLength) {
      this.currentInput += digit;
      this.updateDisplay();
      this.playClickSound();
    } else {
      this.showMessage("Maximum length reached", "warning");
    }
  }

  /**
   * 删除最后一个数字
   */
  removeDigit() {
    if (this.currentInput.length > 0) {
      this.currentInput = this.currentInput.slice(0, -1);
      this.updateDisplay();
      this.playClickSound();
    }
  }

  /**
   * 提交密码
   */
  submitPassword() {
    if (this.currentInput.length === 0) {
      this.showMessage("Please enter a password", "warning");
      return;
    }

    if (this.currentInput === this.correctPassword) {
      this.isLocked = false;
      this.showMessage("Access Granted", "success");
      this.updateStatus();
      this.playSuccessSound();
      this.successfulTask(); //密码输对了，进入下一个章节

      // 延迟关闭密码锁
      setTimeout(() => {
        this.onPasswordCorrect();
      }, 1500);
    } else {
      this.showMessage("Access Denied", "error");
      this.playErrorSound();
      this.shakeKeypad();

      // 清空输入并重置
      setTimeout(() => {
        this.reset();
      }, 1000);
    }
  }

  /**
   * 取消操作
   */
  cancel() {
    this.reset();
    this.deactivate();
  }

  /**
   * 重置密码锁状态
   */
  reset() {
    this.currentInput = "";
    this.updateDisplay();
    this.showMessage("Enter Password", "normal");
  }

  /**
   * 更新显示屏
   */
  updateDisplay() {
    const maskedInput = "*".repeat(this.currentInput.length);
    this.displayElement.textContent = maskedInput;
  }

  /**
   * 更新状态显示
   */
  updateStatus() {
    this.statusElement.textContent = this.isLocked ? "LOCKED" : "UNLOCKED";
    this.statusElement.className = `keypad-status ${
      this.isLocked ? "locked" : "unlocked"
    }`;
  }
  /**
   * 密码输入正确后的故事处理
   */
  successfulTask() {
    console.log("一阶段完成，准备传送");
    window.speaker.speak("一阶段完成，准备传送（测试用，未来不会加入）", 3000);
    //传送玩家到一个位置
    //window.core.player.teleport(); 
  }

  /**
   * 显示消息
   * @param {string} message
   * @param {string} type - normal, warning, error, success
   */
  showMessage(message, type = "normal") {
    this.messageElement.textContent = message;
    this.messageElement.className = `message-text ${type}`;
  }

  /**
   * 震动效果
   */
  shakeKeypad() {
    this.element.classList.add("shake");
    setTimeout(() => {
      this.element.classList.remove("shake");
    }, 500);
  }

  /**
   * 密码正确时的回调
   */
  onPasswordCorrect() {
    console.log("🔓 密码锁已解锁");
    // 这里可以触发游戏中的相应事件
    // 例如：开门、启动设备等
    this.deactivate();
  }

  /**
   * 播放点击音效
   */
  playClickSound() {
    // 可以集成到游戏的音频系统
    if (window.sounds) {
      // window.sounds.play("keypad_click");
    }
  }

  /**
   * 播放成功音效
   */
  playSuccessSound() {
    if (window.sounds) {
      // window.sounds.play("keypad_success");
    }
  }

  /**
   * 播放错误音效
   */
  playErrorSound() {
    if (window.sounds) {
      // window.sounds.play("keypad_error");
    }
  }

  /**
   * 动态注入CSS样式到<head>
   */
  injectCSS() {
    if (document.getElementById("keypad-styles")) return;

    const style = document.createElement("style");
    style.id = "keypad-styles";
    style.textContent = `
      #keypad-element {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 380px;
        height: 520px;
        background: rgba(21, 21, 21, 0.85);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        color: #00ff41;
        font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
        font-size: 14px;
        z-index: 1000;
        user-select: none;
        overflow: hidden;
      }

      .keypad-container {
        padding: 20px;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .keypad-header {
        background: rgba(51, 51, 51, 0.6);
        backdrop-filter: blur(10px);
        padding: 8px 15px;
        margin: -20px -20px 15px -20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .keypad-title {
        font-size: 16px;
        font-weight: bold;
        color: #00ff41;
        letter-spacing: 1px;
      }

      .keypad-status {
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: bold;
        backdrop-filter: blur(5px);
      }

      .keypad-status.locked {
        background: rgba(255, 68, 68, 0.8);
        border: 1px solid rgba(255, 68, 68, 0.3);
        color: #fff;
      }

      .keypad-status.unlocked {
        background: rgba(68, 255, 68, 0.8);
        border: 1px solid rgba(68, 255, 68, 0.3);
        color: #000;
      }

      .keypad-display {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
        min-height: 40px;
        display: flex;
        align-items: center;
      }

      .display-screen {
        width: 100%;
        text-align: center;
        font-size: 24px;
        font-family: 'Courier New', monospace;
        color: #00ff41;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .display-text {
        margin-right: 5px;
      }

      .display-cursor {
        animation: blink 1s infinite;
      }

      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }

      .keypad-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 15px;
      }

      .keypad-controls {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
        margin-bottom: 15px;
      }

      .keypad-btn {
        background: rgba(58, 58, 58, 0.7);
        backdrop-filter: blur(5px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #00ff41;
        font-family: inherit;
        font-size: 18px;
        font-weight: bold;
        height: 50px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }

      .keypad-btn:hover,
      .keypad-btn.hover {
        background: rgba(74, 74, 74, 0.8);
        border-color: rgba(0, 255, 65, 0.3);
        box-shadow: 0 0 15px rgba(0, 255, 65, 0.2);
        transform: translateY(-1px);
      }

      .keypad-btn:active {
        transform: translateY(1px);
        background: rgba(42, 42, 42, 0.9);
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      .control-btn {
        font-size: 14px;
        color: #ffd700;
      }

      .cancel-btn {
        color: #ff5f56;
        border-color: rgba(255, 95, 86, 0.2);
      }

      .cancel-btn:hover,
      .cancel-btn.hover {
        border-color: rgba(255, 95, 86, 0.4);
        box-shadow: 0 0 15px rgba(255, 95, 86, 0.2);
      }

      .submit-btn {
        color: #27c93f;
        border-color: rgba(39, 201, 63, 0.2);
      }

      .submit-btn:hover,
      .submit-btn.hover {
        border-color: rgba(39, 201, 63, 0.4);
        box-shadow: 0 0 15px rgba(39, 201, 63, 0.2);
      }

      .keypad-message {
        text-align: center;
        font-size: 14px;
        margin-top: auto;
      }

      .message-text {
        padding: 8px 16px;
        border-radius: 6px;
        display: inline-block;
        transition: all 0.3s ease;
        backdrop-filter: blur(5px);
      }

      .message-text.normal {
        color: #00ff41;
        background: rgba(0, 255, 65, 0.1);
        border: 1px solid rgba(0, 255, 65, 0.2);
      }

      .message-text.warning {
        color: #ffbd2e;
        background: rgba(255, 189, 46, 0.1);
        border: 1px solid rgba(255, 189, 46, 0.2);
      }

      .message-text.error {
        color: #ff5f56;
        background: rgba(255, 95, 86, 0.1);
        border: 1px solid rgba(255, 95, 86, 0.2);
      }

      .message-text.success {
        color: #27c93f;
        background: rgba(39, 201, 63, 0.1);
        border: 1px solid rgba(39, 201, 63, 0.2);
      }

      /* 震动动画 */
      .shake {
        animation: shake 0.5s ease-in-out;
      }

      @keyframes shake {
        0%, 100% { transform: translate(-50%, -50%); }
        10%, 30%, 50%, 70%, 90% { transform: translate(-52%, -50%); }
        20%, 40%, 60%, 80% { transform: translate(-48%, -50%); }
      }

      /* 按钮点击涟漪效果 */
      .keypad-btn::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(0, 255, 65, 0.3);
        transform: translate(-50%, -50%);
        transition: width 0.4s ease, height 0.4s ease;
        pointer-events: none;
      }

      .keypad-btn:active::before {
        width: 120px;
        height: 120px;
      }

      /* macOS风格的窗口控制按钮 */
      .keypad-header::after {
        content: '';
        position: absolute;
        top: 8px;
        right: 15px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        opacity: 0.6;
      }
    `;
    document.head.appendChild(style);
  }

  toggle() {
    if (this.entity.properties.activated) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * 设置正确密码
   * @param {string} password
   */
  setPassword(password) {
    this.correctPassword = password;
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isLocked: this.isLocked,
      isActive: this.entity.properties.activated,
      currentInputLength: this.currentInput.length,
    };
  }

  /**
   * 销毁模块
   */
  destroy() {
    this.deactivate();
    console.log("🗑️ 密码锁管理器已销毁");
  }
}
