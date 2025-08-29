/**
 * 终端管理器 - UI覆盖层模块
 * 在3D场景上叠加一个可交互的、类似Linux风格的终端界面。
 */
export default class TerminalManager {
  constructor() {
    this.name = "终端管理器";
    this.isActive = false;

    // DOM元素引用
    this.element = null;
    this.inputElement = null;
    this.outputElement = null; // 用于未来显示命令输出

    // 命令历史
    this.commandHistory = [];
    this.historyIndex = -1;

    console.log("📟 终端管理器已加载");
  }

  /**
   * 激活终端界面
   * @returns {HTMLElement} 返回创建的DOM元素，由主程序添加到页面中
   */
  activate() {
    if (this.isActive) return this.element;

    this.isActive = true;
    this.injectCSS(); // 注入模块所需的CSS
    this.element = this.createTerminalElement();
    this.setupEventListeners();

    // 激活后自动聚焦到输入框
    setTimeout(() => this.inputElement.focus(), 0);

    console.log("📟 终端已激活");
    return this;
  }

  /**
   * 停用终端界面
   */
  deactivate() {
    if (!this.isActive || !this.element) return;

    this.isActive = false;

    // 从DOM中移除元素
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.removeEventListeners();
    this.element = null;

    console.log("📟 终端已停用");
  }

  /**
   * 创建终端的DOM结构
   * @returns {HTMLElement}
   */
  createTerminalElement() {
    const element = document.createElement("div");
    element.id = "terminal-element";

    element.innerHTML = `
      <div class="terminal-header">
        <span>root@gemini:~</span>
        <div class="terminal-buttons">
          <span class="btn-min"></span>
          <span class="btn-max"></span>
          <span class="btn-close"></span>
        </div>
      </div>
      <div class="terminal-body">
        <div class="terminal-help">
          <div class="help-header">GEMINI HELP SYSTEM</div>
          <pre>
Available commands:

  <span class="cmd">help</span>      - Displays this help message.
  <span class="cmd">sounds</span>    - Manage game sounds. (e.g., sounds on/off)
  <span class="cmd">ui</span>        - Control UI elements. (e.g., ui hide/show)
  <span class="cmd">clear</span>     - Clears the terminal screen.
  <span class="cmd">exit</span>      - Closes the terminal.
          </pre>
        </div>
        <div class="terminal-output"></div>
        <div class="terminal-input-line">
          <span class="prompt">root@gemini:~$</span>
          <input type="text" class="terminal-input" spellcheck="false" autocomplete="off" />
        </div>
      </div>
    `;

    // 保存对关键元素的引用
    this.inputElement = element.querySelector(".terminal-input");
    this.outputElement = element.querySelector(".terminal-output");

    return element;
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // this.inputElement.addEventListener(
    //   "keydown",
    //   this.handleKeyDown.bind(this)
    // );
    // 点击终端任意位置时，聚焦到输入框
    this.element.addEventListener("click", () => this.inputElement.focus());
  }

  handleInput(event) {
    if (event.type === "keydown") {
      this.handleKeyDown(event);
    }
  }

  /**
   * 处理键盘输入事件
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      const command = this.inputElement.value.trim();
      if (command) {
        this.commandHistory.push(command);
        this.historyIndex = this.commandHistory.length;
        this.executeCommand(command);
      }
      this.inputElement.value = "";
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.inputElement.value = this.commandHistory[this.historyIndex];
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.inputElement.value = this.commandHistory[this.historyIndex];
      } else {
        this.historyIndex = this.commandHistory.length;
        this.inputElement.value = "";
      }
    }
  }

  /**
   * 执行命令
   * @param {string} command
   */
  executeCommand(command) {
    // 将输入的命令显示在输出区
    this.logToOutput(`<span class="prompt">root@gemini:~$</span> ${command}`);

    const args = command.split(" ");
    const baseCmd = args[0].toLowerCase();

    switch (baseCmd) {
      case "help":
        this.logToOutput(
          "Displaying available commands... See the help box above."
        );
        break;
      case "clear":
        this.outputElement.innerHTML = "";
        break;
      case "exit":
        this.logToOutput("Closing terminal...");
        window.dispatchEvent(new CustomEvent("close-terminal"));
        core.layers.pop();
        break;
      case "sounds":
        this.logToOutput(
          `Sound command received: ${args
            .slice(1)
            .join(" ")}. (Not implemented)`
        );
        break;
      case "ui":
        this.logToOutput(
          `UI command received: ${args.slice(1).join(" ")}. (Not implemented)`
        );
        break;
      case "whoami":
        this.logToOutput("user: root");
        break;
      default:
        this.logToOutput(`bash: command not found: ${command}`);
        break;
    }
  }

  /**
   * 在输出区域打印日志
   * @param {string} message
   */
  logToOutput(message) {
    this.outputElement.innerHTML += `<div>${message}</div>`;
    // 自动滚动到底部
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }

  /**
   * 动态注入CSS样式到<head>
   */
  injectCSS() {
    if (document.getElementById("terminal-styles")) return;

    const style = document.createElement("style");
    style.id = "terminal-styles";
    style.textContent = `
      #terminal-element {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 800px;
        height: 500px;
        background: rgba(21, 21, 21, 0.85);
        backdrop-filter: blur(10px);
        border: 1px solid #444;
        border-radius: 8px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        color: #00ff41;
        font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 1000;
      }
      .terminal-header {
        background: #333;
        padding: 4px 10px;
        font-size: 12px;
        color: #ccc;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
      }
      .terminal-buttons { display: flex; }
      .terminal-buttons span { 
        display: block; width: 12px; height: 12px; border-radius: 50%; margin-left: 6px; 
      }
      .btn-close { background: #ff5f56; }
      .btn-min { background: #ffbd2e; }
      .btn-max { background: #27c93f; }

      .terminal-body {
        padding: 10px;
        flex-grow: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .terminal-help {
        border: 1px solid #00ff41;
        padding: 5px 10px;
        margin-bottom: 15px;
        background: rgba(0, 255, 65, 0.05);
      }
      .help-header {
        text-align: center;
        margin-bottom: 5px;
        letter-spacing: 2px;
      }
      .terminal-help pre {
        margin: 0;
        white-space: pre-wrap;
      }
      .terminal-help .cmd {
        color: #fdfd54;
        font-weight: bold;
      }

      .terminal-output {
        flex-grow: 1;
        word-break: break-all;
      }
      .terminal-input-line {
        display: flex;
        align-items: center;
      }
      .terminal-input-line .prompt {
        color: #55c8f2;
        margin-right: 8px;
        white-space: nowrap;
      }
      .terminal-input {
        background: transparent;
        border: none;
        outline: none;
        color: #00ff41;
        font-family: inherit;
        font-size: inherit;
        width: 100%;
        caret-shape: block;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 销毁模块
   */
  destroy() {
    this.deactivate();
    console.log("🗑️ 终端管理器已销毁");
  }
}
