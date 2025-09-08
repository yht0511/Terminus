/**
 * 终端管理器 - UI覆盖层模块
 * 在3D场景上叠加一个可交互的、类似Linux风格的终端界面。
 */

export default class TerminalManager {
  constructor(id) {
    this.id = id;
    this.name = "终端管理器";
    this.entity = window.core.getEntity(id);
    // 一次性闩锁: 一旦启用过就不再回退到“未部署”界面
    this._everEnabled = this.entity?.properties?.data?.enabled === true;

    // DOM元素引用
    this.element = null;
    this.inputElement = null;
    this.outputElement = null; // 用于未来显示命令输出

    // 命令历史
    this.commandHistory = [];
    this.historyIndex = -1;
    this.lastCommandValue = "";

    // 顯示
    this.injectCSS(); // 注入模块所需的CSS
    this.element = this.createTerminalElement();

    if (this.entity.properties.activated) this.activate();

    console.log("📟 终端管理器已加载");
  }

  /**
   * 激活终端界面
   * @returns {HTMLElement} 返回创建的DOM元素，由主程序添加到页面中
   */
  activate() {
    // 设置为活跃状态
    this.entity.properties.activated = true;
    if (this.entity?.properties?.data?.enabled === true)
      this._everEnabled = true;

    // 每次激活前根据最新 enabled 状态重新构建 DOM（解决启用后仍显示“未部署”）
    if (this.element && this.element.parentNode) {
      try {
        this.element.parentNode.removeChild(this.element);
      } catch (e) {}
    }
    this.element = this.createTerminalElement();

    // 添加到层级管理器
    core.layers.push(this);

    // 激活后自动聚焦到输入框
    setTimeout(() => this.inputElement && this.inputElement.focus(), 0);
    console.log("📟 终端已激活");
    return this;
  }

  deactivate() {
    if (!this.entity.properties.activated) return;
    this.entity.properties.activated = false;
    core.layers.remove(this);
    console.log("📟 终端已停用");
  }

  /**
   * 创建终端的DOM结构
   * @returns {HTMLElement}
   */
  createTerminalElement() {
    const element = document.createElement("div");
    element.id = "terminal-element";

    // 如果未部署 (data.enabled === false) 显示占位页面
    if (
      this.entity?.properties?.data?.enabled === false &&
      !this._everEnabled
    ) {
      element.innerHTML = `
        <div class="terminal-disabled">
          <div class="td-icon">⚡</div>
          <div class="td-text">电力系统未部署</div>
          <div class="td-exit-hint">按 Q 退出终端</div>
        </div>
      `;
      return element; // 不继续创建交互式终端
    }

    var commands = "";
    this.entity.properties.data.commands.forEach((element) => {
      if (!element.command || !element.description) return;
      commands += `
  <span class="cmd">${element.command}</span> - ${element.description}
      `;
    });

    element.innerHTML = `
      <div class="terminal-header">
        <span>root@terminal:~</span>
        <div class="terminal-buttons">
          <span class="btn-min"></span>
          <span class="btn-max"></span>
          <span class="btn-close"></span>
        </div>
      </div>
      <div class="terminal-body">
        <div class="terminal-help">
          <div class="help-header">TERMINAL HELP SYSTEM</div>
          <pre>
Available commands:

${commands}
          </pre>
        </div>
        <div class="terminal-output"></div>
        <div class="terminal-input-line">
          <span class="prompt">root@terminal:~$</span>
          <input type="text" class="terminal-input" spellcheck="false" autocomplete="off" />
        </div>
      </div>
    `;

    // 保存对关键元素的引用
    this.inputElement = element.querySelector(".terminal-input");
    this.outputElement = element.querySelector(".terminal-output");

    return element;
  }

  handleInput(event) {
    // 未部署状态: 仅支持按 Q 退出
    if (this.entity?.properties?.data?.enabled === false) {
      if (
        event.type === "keydown" &&
        (event.key === "q" || event.key === "Q")
      ) {
        this.deactivate();
      }
      return 1;
    }
    if (event.type === "keydown") {
      this.handleKeyDown(event);
      this.monitorCommand();
    }
    if (this.inputElement && typeof this.inputElement.focus === "function") {
      this.inputElement.focus();
    }
    return 1;
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
    this.logToOutput(`<span class="prompt">root@terminal:~$</span> ${command}`);

    const args = command.split(" ");
    const baseCmd = args[0].toLowerCase();

    var found = false;
    this.entity.properties.data.commands.forEach((element) => {
      if (
        baseCmd == element.command ||
        command == element.command.toLowerCase()
      ) {
        this.logToOutput(
          element.output.replaceAll("$args", args.slice(1).join(" "))
        );
        if (element.callback) {
          element.callback.forEach((cb) =>
            eval(cb.replaceAll("$args", args.slice(1).join(" ")))
          );
        }
        found = true;
        return;
      }
    });
    if (!found) {
      this.logToOutput(`bash: ${baseCmd}: command not found`);
    }
  }

  /**
   * 在输入某些字符时触发
   */
  monitorCommand() {
    if (this.inputElement.value != this.lastCommandValue) {
      var larger = false;
      if (this.inputElement.value.length > this.lastCommandValue.length)
        larger = true;
      this.entity.properties.data.monitors.forEach((element) => {
        if (
          larger &&
          element.type == "type" &&
          this.inputElement.value == element.command
        ) {
          element.callback.forEach((cb) => eval(cb));
        }
        if (
          !larger &&
          element.type == "del" &&
          this.inputElement.value == element.command
        ) {
          element.callback.forEach((cb) => eval(cb));
        }
      });
      this.lastCommandValue = this.inputElement.value;
    }
  }

  /**
   * 在输出区域打印日志
   * @param {string} message
   */
  logToOutput(message) {
    if (!this.outputElement) return;
    const line = document.createElement("div");
    line.innerHTML = message;
    this.outputElement.appendChild(line);
    // 任何直接输出打断当前流式行
    this._streamCurrentLine = null;
    this._streamCurrentBuffer = "";
    this.scrollToBottom();
  }

  /**
   * 流式写入（支持 \n 换行, \r 回车覆写当前行）
   * 用于新的脚本式 denyScript
   */
  streamWrite(text) {
    if (!this._streamCurrentLine) {
      this._streamCurrentLine = document.createElement("div");
      this.outputElement.appendChild(this._streamCurrentLine);
    }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "\r") {
        // 覆写当前行
        this._streamCurrentBuffer = "";
        this._streamCurrentLine.textContent = "";
      } else if (ch === "\n") {
        // 换行 -> 固化当前行，开启新行
        this._streamCurrentLine.textContent = this._streamCurrentBuffer || "";
        this._streamCurrentLine = document.createElement("div");
        this.outputElement.appendChild(this._streamCurrentLine);
        this._streamCurrentBuffer = "";
      } else {
        this._streamCurrentBuffer = (this._streamCurrentBuffer || "") + ch;
        this._streamCurrentLine.textContent = this._streamCurrentBuffer;
      }
    }
    this.scrollToBottom();
  }

  /**
   * 解析 denyScript 字符串 -> token 序列
   * 支持标记：
   *   [[delay:1000]]  延时
   *   [[cb:js代码]]    回调
   *   [[type:30]]      打字机速度(毫秒/字符), <=0 取消打字机
   *   [[color:red]]    颜色开始（支持 red yellow green cyan magenta white 或自定义CSS颜色）
   *   [[/color]]       颜色结束
   *   [[bar:75]]       进度条 (0-100)
   * 普通文本支持 \n 换行, \r 覆盖当前行。
   */
  parseDenyScript(script) {
    const tokens = [];
    if (!script) return tokens;
    script = script.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    const re = /\[\[(.+?)\]\]/g; // 非贪婪
    let last = 0,
      m;
    while ((m = re.exec(script)) !== null) {
      if (m.index > last)
        tokens.push({ type: "text", value: script.slice(last, m.index) });
      const body = m[1].trim();
      if (body.startsWith("delay:"))
        tokens.push({
          type: "delay",
          value: parseInt(body.slice(6).trim(), 10) || 0,
        });
      else if (body.startsWith("cb:"))
        tokens.push({ type: "callback", value: body.slice(3) });
      else if (body.startsWith("type:"))
        tokens.push({
          type: "type",
          value: parseInt(body.slice(5).trim(), 10) || 0,
        });
      else if (body.startsWith("color:"))
        tokens.push({ type: "colorStart", value: body.slice(6).trim() });
      else if (body === "/color") tokens.push({ type: "colorEnd" });
      else if (body.startsWith("bar:"))
        tokens.push({
          type: "bar",
          value: parseInt(body.slice(4).trim(), 10) || 0,
        });
      else tokens.push({ type: "text", value: m[0] });
      last = re.lastIndex;
    }
    if (last < script.length)
      tokens.push({ type: "text", value: script.slice(last) });
    return tokens;
  }

  /**
   * 执行 denyScript（带打字机/颜色/进度条）
   */
  runDenyScript(scriptStr = null) {
    const script = scriptStr || this.entity.properties.data.denyScript;
    const tokens = this.parseDenyScript(script);
    if (!tokens.length) return;
    this._typingSpeed = 0; // ms/char
    this._currentColor = null;
    this._streamCurrentLine = null;
    this._streamCurrentBuffer = "";
    let chain = Promise.resolve();

    const writeText = (text) => {
      if (this._typingSpeed > 0) {
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          chain = chain
            .then(() => new Promise((r) => setTimeout(r, this._typingSpeed)))
            .then(() => this._writeChar(ch))
            .then(() => {
              this.outputElement.scrollTop = this.outputElement.scrollHeight;
            });
        }
      } else {
        for (let i = 0; i < text.length; i++) this._writeChar(text[i]);
      }
    };

    tokens.forEach((tok) => {
      if (tok.type === "text") {
        chain = chain.then(() => writeText(tok.value));
      } else if (tok.type === "delay") {
        chain = chain.then(() => new Promise((r) => setTimeout(r, tok.value)));
      } else if (tok.type === "callback") {
        chain = chain.then(() => {
          try {
            eval(tok.value);
          } catch (e) {
            console.warn("denyScript 回调执行失败", e);
          }
        });
      } else if (tok.type === "type") {
        chain = chain.then(() => {
          this._typingSpeed = tok.value <= 0 ? 0 : tok.value;
        });
      } else if (tok.type === "colorStart") {
        chain = chain.then(() => {
          this._currentColor = tok.value;
        });
      } else if (tok.type === "colorEnd") {
        chain = chain.then(() => {
          this._currentColor = null;
        });
      } else if (tok.type === "bar") {
        chain = chain.then(() => {
          const p = Math.min(100, Math.max(0, tok.value));
          const width = 30;
          const fill = Math.round((p / 100) * width);
          const barStr =
            "[" + "#".repeat(fill) + ".".repeat(width - fill) + `] ${p}%`;
          this._updateProgressBar(barStr, p === 100);
        });
      }
    });
  }

  _updateProgressBar(text, done) {
    if (!this._progressBarLine) {
      this._progressBarLine = document.createElement("div");
      this._progressBarLine.className = "term-progress";
      this.outputElement.appendChild(this._progressBarLine);
    }
    this._progressBarLine.textContent = text;
    if (done) {
      // 完成：释放行，并创建一个新行作为后续输出起点
      this._streamCurrentLine = null;
      this._progressBarLine = null;
      const spacer = document.createElement("div");
      spacer.innerHTML = "";
      this.outputElement.appendChild(spacer);
    }
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }

  _writeChar(ch) {
    if (!this._streamCurrentLine) {
      this._streamCurrentLine = document.createElement("div");
      this._streamCurrentBuffer = "";
      this.outputElement.appendChild(this._streamCurrentLine);
    }
    if (ch === "\n") {
      this._streamCurrentLine = null;
      this._streamCurrentBuffer = "";
      this.outputElement.scrollTop = this.outputElement.scrollHeight;
      return;
    }
    if (ch === "\r") {
      this._streamCurrentBuffer = "";
      if (this._streamCurrentLine) this._streamCurrentLine.innerHTML = "";
      return;
    }
    if (this._currentColor) {
      let last = this._streamCurrentLine.lastElementChild;
      if (
        !last ||
        !last.classList.contains("term-colored") ||
        last.getAttribute("data-color") !== this._currentColor
      ) {
        last = document.createElement("span");
        last.className = "term-colored";
        last.setAttribute("data-color", this._currentColor);
        last.style.color = this._mapColor(this._currentColor);
        this._streamCurrentLine.appendChild(last);
      }
      last.textContent += ch;
    } else {
      this._streamCurrentLine.textContent += ch;
    }
    this.scrollToBottom();
  }

  scrollToBottom() {
    if (!this.outputElement) return;
    // 使用 rAF 确保布局完成
    requestAnimationFrame(() => {
      this.outputElement.scrollTop = this.outputElement.scrollHeight;
      this.inputElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  _mapColor(c) {
    const map = {
      red: "#ff5555",
      yellow: "#f5f57a",
      green: "#55ff55",
      cyan: "#55ffff",
      magenta: "#ff55ff",
      white: "#ffffff",
    };
    return map[c] || c || "#ffffff";
  }

  /**
   * DenyCommand
   */
  denyCommand() {
    // 新格式：单字符串 denyScript
    if (this.entity.properties.data.denyScript) {
      this.runDenyScript(this.entity.properties.data.denyScript);
      return;
    }
    // 旧格式回退
    if (Array.isArray(this.entity.properties.data.denyCommand)) {
      this.executeCommand("clear");
      let sum = 0;
      this.entity.properties.data.denyCommand.forEach((script) => {
        setTimeout(() => {
          this.logToOutput(
            `<span class="prompt">#&&#^$%@system:~$</span> ${script.text}`
          );
          script.callback?.forEach((cb) => cb && eval(cb));
        }, sum);
        sum += script.duration;
      });
    }
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
      #terminal-element .terminal-disabled {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        color: #ddd;
        letter-spacing: 2px;
        text-shadow: 0 0 6px #ffef9a55;
        position: relative;
      }
      #terminal-element .terminal-disabled .td-icon {
        font-size: 92px;
        line-height: 1;
        background: linear-gradient(145deg,#ffe06b,#ffaf2e,#ff7b00);
        -webkit-background-clip: text;
        color: transparent;
        filter: drop-shadow(0 0 12px #ffb34788);
        animation: tdPulse 2.2s ease-in-out infinite;
        user-select: none;
      }
      #terminal-element .terminal-disabled .td-text {
        font-size: 26px;
        font-weight: 600;
        color: #ffc44d;
        text-align: center;
      }
      #terminal-element .terminal-disabled .td-exit-hint {
        font-size: 16px;
        color: #bbb;
        letter-spacing: 1px;
        opacity: .85;
        animation: tdHintBlink 2.6s ease-in-out infinite;
      }
      @keyframes tdPulse {
        0%,100% { transform: scale(1); filter: drop-shadow(0 0 6px #ffb34788); }
        50% { transform: scale(1.08); filter: drop-shadow(0 0 18px #ff9a0088); }
      }
      @keyframes tdHintBlink {
        0%,100% { opacity: .9; }
        50% { opacity: .4; }
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

  toggle() {
    if (this.entity.properties.activated) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * 销毁模块
   */
  destroy() {
    this.deactivate();
    console.log("🗑️ 终端管理器已销毁");
  }
}
