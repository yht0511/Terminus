/**
 * 玩家死亡层 (DeathOverlay)
 * 使用方式：
 *   const deathLayer = new DeathOverlay(); // 在游戏初始化阶段创建一次
 *   // 当玩家死亡时： deathLayer.activate([x,y,z]); // 传入重生坐标
 *
 * 功能：
 *  - 激活后显示红色泛光覆盖层与 "你死了" 文本
 *  - 按任意键 / 点击 鼠标 触发重生
 *  - 重生调用 core.scene.player.teleport(respawnPosition)
 *  - 成功重生后自动 deactivate 并移除自身层级
 */
export default class DeathOverlay {
  constructor() {
    this.isActive = false;
    this.respawnPosition = null; // [x,y,z]
    this.element = this.createElement();
    this.deathReason = ""; // 死亡原因
    this._cssInjected = false;
    this.injectCSS();
  }

  /**
   * 创建 DOM
   */
  createElement() {
    const el = document.createElement("div");
    el.id = "death-overlay";
    el.innerHTML = `
      <div class="death-content">
        <div class="death-title">You Died</div>
        <div class="death-reason" id="death-reason"></div>
        <div class="death-buttons" id="death-buttons">
          <button id="death-respawn-btn" class="death-btn primary">重生</button>
          <button id="death-exit-btn" class="death-btn">返回主菜单</button>
        </div>
        <div class="death-hint" id="death-hint">( 按任意键也可立即重生 )</div>
      </div>`;
    return el;
  }

  injectCSS() {
    if (this._cssInjected || document.getElementById("death-overlay-style"))
      return;
    const style = document.createElement("style");
    style.id = "death-overlay-style";
    style.textContent = `
      #death-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.72); backdrop-filter: blur(2px); font-family: 'Microsoft YaHei','Helvetica Neue',Arial,sans-serif; color:#fff; flex-direction: column; letter-spacing:1px; animation: deathFadeIn .35s ease; user-select:none; }
      #death-overlay:before { content:''; position:absolute; inset:0; background:radial-gradient(circle at 50% 40%, rgba(90,0,0,0.55), rgba(0,0,0,0.9)); pointer-events:none; }
      #death-overlay .death-content { position:relative; text-align:center; padding:20px 30px 34px; }
      #death-overlay .death-title { font-size:72px; font-weight:900; margin:0 0 12px; color:#aa0000; text-shadow: 2px 2px 0 #000, 0 0 6px #300, 0 0 12px #600; animation: deathPop .55s cubic-bezier(.25,1.4,.35,1); }
      #death-overlay .death-reason { font-size:22px; margin:6px 0 26px; min-height:28px; color:#ffffff; text-shadow:2px 2px 0 #000; }
      #death-overlay .death-buttons { display:flex; gap:26px; justify-content:center; margin-bottom:18px; }
      #death-overlay .death-btn { cursor:pointer; font-size:18px; padding:10px 34px; background:#6b6b6b; border:2px solid #000; color:#fff; text-shadow:1px 1px 0 #000; box-shadow: inset 0 0 0 2px #c6c6c6, 0 0 0 2px #000; transition:.12s; }
      #death-overlay .death-btn.primary { background:#b30000; box-shadow: inset 0 0 0 2px #ff8c8c, 0 0 0 2px #000; }
      #death-overlay .death-btn:hover { filter:brightness(1.15); transform:translateY(-2px); }
      #death-overlay .death-btn:active { filter:brightness(.9); transform:translateY(1px); }
      #death-overlay .death-hint { font-size:14px; opacity:.65; animation: deathHint 2.4s ease-in-out infinite; }
      @keyframes deathPop { 0% { transform:scale(.4) translateY(-40px); opacity:0 } 60% { transform:scale(1.05) translateY(4px); opacity:1 } 100% { transform:scale(1) translateY(0); opacity:1 } }
      @keyframes deathHint { 0%,100% { opacity: .85 } 50% { opacity: .35 } }
      @keyframes deathFadeIn { from { opacity: 0 } to { opacity: 1 } }
    `;
    document.head.appendChild(style);
    this._cssInjected = true;
  }

  /**
   * 激活死亡层
   * @param {Array|Object} respawnPos - 重生坐标 [x,y,z] 或 {x,y,z}
   */
  activate(respawnPos, reason) {
    if (this.isActive) return;
    // 支持 object 形式 {position:..., reason:...}
    if (
      reason === undefined &&
      respawnPos &&
      !Array.isArray(respawnPos) &&
      typeof respawnPos === "object" &&
      (respawnPos.reason || respawnPos.position)
    ) {
      reason = respawnPos.reason;
      respawnPos =
        respawnPos.position ||
        respawnPos.pos ||
        respawnPos.coordinates ||
        respawnPos.coord ||
        respawnPos;
    }
    this.isActive = true;
    // 如果不传 respawnPos，尝试从脚本 reborn 中读取
    if (!respawnPos && core?.script?.reborn?.coordinates) {
      try {
        respawnPos =
          core.script.reborn.coordinates[core.script.reborn.reborn_id].position;
      } catch (e) {}
    }
    this.respawnPosition = this.normalizePos(respawnPos);
    this.deathReason = this.escapeHtml(reason || "");
    this.updateReason();
    core.layers.push(this);
    this.bindButtons();
  }

  /**
   * 统一坐标格式
   */
  normalizePos(p) {
    if (!p) return [0, 2, 0];
    if (Array.isArray(p) && p.length >= 3) return [p[0], p[1], p[2]];
    if (typeof p === "object") return [p.x || 0, p.y || 0, p.z || 0];
    return [0, 2, 0];
  }

  /**
   * 停用层
   */
  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;
    core.layers.remove(this);
  }

  /** 更新死亡原因显示 */
  updateReason() {
    if (!this.element) return;
    const reasonEl = this.element.querySelector("#death-reason");
    if (reasonEl) {
      reasonEl.innerHTML = this.deathReason; // 已转义
    }
  }

  /** 简单转义，防止脚本注入 */
  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * 输入处理：任意键 / 点击 触发重生
   */
  handleInput(event) {
    if (!this.isActive) return false;
    if (event.type === "keydown") {
      if (event.key === "Escape") {
        if (window.exitGame) {
          this.deactivate();
          window.exitGame();
        }
      } else {
        this.respawn();
      }
      return true;
    }
    if (event.type === "click") {
      const target = event.target;
      if (!target.classList.contains("death-btn")) this.respawn();
      return true;
    }
    return true; // 阻断所有输入
  }

  /**
   * 重生逻辑
   */
  respawn() {
    if (!this.isActive) return;
    const player = core?.scene?.player;
    if (player && typeof player.teleport === "function") {
      player.teleport(this.respawnPosition);
    } else {
      console.warn("⚠️ 未找到玩家实例，无法传送");
    }
    // 延迟一点点让 UI 有反馈
    setTimeout(() => this.deactivate(), 30);
  }

  bindButtons() {
    if (this._buttonsBound) return;
    const respawnBtn = this.element.querySelector("#death-respawn-btn");
    const exitBtn = this.element.querySelector("#death-exit-btn");
    if (respawnBtn) respawnBtn.onclick = () => this.respawn();
    if (exitBtn)
      exitBtn.onclick = () => {
        if (window.exitGame) {
          this.deactivate();
          window.exitGame();
        }
      };
    this._buttonsBound = true;
  }

  /**
   * 被 LayerManager 调用以获取 DOM 元素
   */
  render() {
    return this.element;
  }

  /**
   * 销毁
   */
  destroy() {
    this.deactivate();
    this.element?.remove();
  }
}
