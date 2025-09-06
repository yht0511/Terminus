/**
 * ！！！该模块工具添加在核心中（main.js）运行！！！
 *
 * 开发者工具模块
 * 用于调试和测试游戏功能。
 * 现有功能：
 * - 显示玩家位置、速度和FPS
 * - 可通过快捷键（Ctrl + D）打开/关闭开发者工具面板
 *
 * 待实现功能：
 * - 视角射线参数显示
 * - 碰撞体信息显示
 * - 物理调试视图
 * - 物体生成、删除和参数修改，json数据导入导出
 */

export class DevelopTool {
  constructor(scene) {
    this.scene = scene;

    //elements
    this.element = null;
    this.infoElement = null;
    this.intervalId = null;

    // State
    this.isActive = false;
    this.fpsArray = [];

    this.init();

    console.log("🛠️ 开发者工具已加载");
  }

  /**
   * 初始化DOM元素和属性。只运行一次。
   */
  init() {
    this.element = this.createPanelElement();
    this.infoElement = this.element.querySelector("#debug-info");
  }

  /**
   * 创建面板的DOM结构。
   * @returns {HTMLElement}
   */
  createPanelElement() {
    const panel = document.createElement("div");
    panel.id = "develop-tool-panel";
    panel.style.position = "absolute";
    panel.style.top = "10px";
    panel.style.left = "10px";
    panel.style.padding = "10px";
    // panel.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    panel.style.color = "#fff";
    panel.style.fontFamily = "Arial, sans-serif";
    panel.style.zIndex = "1000";
    // panel.style.display = "none"; // Initially hidden

    // 添加标题和信息区域
    panel.innerHTML = `
      <h3>Develop Tool</h3>
      <div id="debug-info"></div>
    <p><strong>FPS:</strong> <span id="debug-fps">0</span></p>
    <p><strong>玩家位置:</strong> <span id="debug-pos">0, 0, 0</span></p>
    <p><strong>玩家速度:</strong> <span id="debug-vel">0, 0, 0</span></p>
    <p><strong>玩家视角:</strong> <span id="debug-rot">0, 0, 0</span></p>
    <p><strong>碰撞体:</strong> <span id="debug-col">无</span> <span id="debug-point">(0,0,0)</span></p>
    `;

    return panel;
  }

  /**
   * 激活开发者工具界面。
   */
  activate() {
    if (this.isActive) return;

    this.isActive = true;
    core.layers.push(this);

    console.log("🛠️ 开发者工具已激活");

    this.run();
  }

  run() {
    this.intervalId = setInterval(() => {
      this.update(1 / 60);
    }, 1000 / 60);
  }

  handleInput(event) {
    return 0;
  }

  /**
   * 停用开发者工具界面。
   */
  deactivate() {
    if (!this.isActive) return;

    this.isActive = false;
    // Hide the panel instead of removing it, for faster toggling.
    core.layers.pop();

    console.log("🛠️ 开发者工具已停用");
  }

  /**
   * 切换开发者工具的启用/禁用状态。
   */
  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * 更新调试信息。在主渲染循环中调用。
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this.isActive) return;

    const playerPos = this.scene.player.getPosition();
    const playerVel = this.scene.player.velocity;
    const playerRot = this.scene.player.getRotation();
    const playercast = this.scene.RayCaster.castFromCamera(
      this.scene.camera,
      10,
      this.scene.player.collider
    );
    if (1000 / this.scene.animationDeltatime) {
      this.fpsArray.push(1000 / this.scene.animationDeltatime);
    }
    this.fpsArray = this.fpsArray.slice(-30); // 保持最近30帧的FPS数据
    document.getElementById("debug-fps").innerText = (
      this.fpsArray.reduce((a, b) => a + b, 0) / this.fpsArray.length || 0
    ).toFixed(0);
    document.getElementById("debug-pos").innerText = `${playerPos.x.toFixed(
      2
    )}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)}`;
    document.getElementById("debug-vel").innerText = `${playerVel.x.toFixed(
      2
    )}, ${playerVel.y.toFixed(2)}, ${playerVel.z.toFixed(2)}`;
    document.getElementById("debug-rot").innerText = `${playerRot.x.toFixed(
      2
    )}, ${playerRot.y.toFixed(2)}, ${playerRot.z.toFixed(2)}`;
    document.getElementById("debug-col").innerText = playercast
      ? `实体ID: ${
          playercast.entityId || "无"
        }, 距离: ${playercast.distance.toFixed(2)}`
      : "无";
    document.getElementById("debug-point").innerText = playercast
      ? `(${playercast.point.x.toFixed(2)}, ${playercast.point.y.toFixed(
          2
        )}, ${playercast.point.z.toFixed(2)})`
      : "(0,0,0)";
  }

  /**
   * 销毁模块，从DOM中移除元素。
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
    console.log("🗑️ 开发者工具已销毁");
  }
}
