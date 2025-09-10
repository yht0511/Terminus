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
  <div class="death-title">You Died!</div>
  <div class="death-reason" id="death-reason"></div>
  <div class="death-sub">按任意键重生</div>
      </div>`;
    return el;
  }

  injectCSS() {
    if (this._cssInjected || document.getElementById("death-overlay-style"))
      return;
    const style = document.createElement("style");
    style.id = "death-overlay-style";
    style.textContent = `
  #death-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(rgba(0,0,0,0.78), rgba(40,0,0,0.85)) , radial-gradient(circle at 50% 50%, rgba(90,0,0,0.65), rgba(0,0,0,0.95)); backdrop-filter: blur(2px) saturate(.6); font-family: 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif; color: #fff; flex-direction: column; letter-spacing: 2px; animation: deathFadeIn .45s ease; user-select: none; }
  #death-overlay .death-content { text-align: center; padding: 40px 60px; background: rgba(0,0,0,0.25); border: 2px solid rgba(255,85,85,0.25); border-radius: 14px; box-shadow: 0 0 25px -4px #ff555540,0 0 90px -15px #ff000020; }
  #death-overlay .death-title { font-size: 68px; font-weight: 900; margin-bottom: 18px; color:#ff5555; text-shadow: 0 0 6px #700, 0 0 18px #ff3d3d, 0 0 42px #a00000; font-family: 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif; animation: deathTitle 3.2s ease-in-out infinite; }
  #death-overlay .death-reason { font-size: 24px; margin-bottom: 32px; min-height: 32px; color: #e6e6e6; text-shadow: 0 0 4px #300; line-height: 1.4; max-width: 780px; }
  #death-overlay .death-sub { font-size: 22px; opacity: .9; animation: deathHint 2.4s ease-in-out infinite; color:#f0f0f0; }
  @keyframes deathTitle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px);} }
  @keyframes deathPulse { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 8px #ff1a1a);} 50% { transform: scale(1.04); filter: drop-shadow(0 0 18px #ff4d4d);} }
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
  activate(reason = "未知原因") {
    if (this.isActive) return;
    this.isActive = true;
    this.respawnPosition = this.normalizePos(
      core.script.reborn.coordinates[core.script.reborn.reborn_id].position
    );
    if (!this.respawnPosition) {
      console.warn("⚠️ 未设置重生点，默认传送到 (0,0,0)");
      this.respawnPosition = [0, 0, 0];
    }
    this.deathReason = reason;
    this.updateReason();
    core.layers.push(this);
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
    if (event.type === "keyup") return false;
    if (event.type === "keydown" || event.type === "click") {
      this.respawn();
      return true; // 阻止继续向下传递
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

    this.deactivate();
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
