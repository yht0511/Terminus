/**
 * 红色怪物脚本 - 示例外部脚本模块
 * 这个脚本定义了红色怪物的行为和交互逻辑
 */

export default class RedMonster {
  constructor(id) {
    this.id = id;
    this.name = "红色怪物";
    this.isActive = false;

    console.log("👾 红色怪物脚本已加载");
  }

  /**
   * 触摸回调 - 当玩家按E与怪物交互时调用
   * @param {string} entityName - 触发交互的实体名称
   */
  ontouch() {
    console.log(`🔥 ${this.name} 被触摸了！`);

    // 显示对话或交互界面
    this.showInteractionDialog("fuck");
  }

  /**
   * 显示交互对话框
   */
  showInteractionDialog(playerName) {
    const core = window.core;

    // 创建简单的对话界面
    const dialogElement = this.createDialogElement();

    // 添加到层级管理器
    const dialogLayer = core.layers.push(dialogElement);

    // 3秒后自动关闭
    setTimeout(() => {
      core.layers.remove(dialogLayer);
    }, 3000);
  }

  /**
   * 创建对话框元素
   */
  createDialogElement() {
    const dialog = document.createElement("div");
    dialog.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            border: 2px solid #ff4444;
            text-align: center;
            font-family: Arial, sans-serif;
            max-width: 400px;
            z-index: 1000;
        `;

    dialog.innerHTML = `
            <h3 style="color: #ff4444; margin: 0 0 10px 0;">🔥 ${this.name}</h3>
            <p style="margin: 0;">你触摸了红色怪物！它看起来很愤怒...</p>
            <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.7;">对话将在3秒后关闭</p>
        `;

    return dialog;
  }

  /**
   * 播放交互音效
   */
  playInteractionSound() {
    // 这里可以添加音效播放逻辑
    console.log("🔊 播放怪物咆哮音效");
  }

  /**
   * 触发动画
   */
  triggerAnimation() {
    const core = window.core;
    const entity = core.scene.entities.get("red_monster");

    if (entity && entity.model) {
      // 简单的晃动动画
      const originalPosition = entity.model.position.clone();
      let shakeCount = 0;
      const maxShakes = 10;

      const shake = () => {
        if (shakeCount >= maxShakes) {
          entity.model.position.copy(originalPosition);
          return;
        }

        entity.model.position.x =
          originalPosition.x + (Math.random() - 0.5) * 0.2;
        entity.model.position.z =
          originalPosition.z + (Math.random() - 0.5) * 0.2;

        shakeCount++;
        setTimeout(shake, 50);
      };

      shake();
    }
  }

  /**
   * 怪物AI逻辑（可以定期调用）
   */
  update(deltaTime) {
    // 可以在这里添加AI逻辑，比如巡逻、追踪玩家等
    if (this.isActive) {
      this.patrol(deltaTime);
    }
  }

  /**
   * 巡逻逻辑
   */
  patrol(deltaTime) {
    // 简单的巡逻AI
    console.log("🚶 怪物正在巡逻...");
  }

  /**
   * 激活怪物
   */
  activate() {
    this.isActive = true;
    console.log("⚡ 红色怪物已激活");
  }

  /**
   * 停用怪物
   */
  deactivate() {
    this.isActive = false;
    console.log("💤 红色怪物已停用");
  }
}
