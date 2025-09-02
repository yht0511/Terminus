/**
 * ！！！该模块应在游戏核心逻辑中（如 main.js）实例化！！！
 *
 * 暂停菜单模块
 * 用于在游戏中提供暂停、设置、存读档等功能。
 * - 响应 ESC 键来激活/停用
 * - 激活时，会请求释放鼠标锁定并暂停游戏
 * - 阻断所有游戏输入事件，只响应菜单UI事件
 */

export class PauseMenu {
  constructor() {
    // elements
    this.element = document.getElementById("pause-menu-overlay"); // 模块的根DOM元素

    // State
    this.isActive = false; // 模块是否激活
    this.menuContext = "main"; // 上下文，追踪UI状态
    this.activeSubPage = null; // 当前打开的子页面ID

    console.log("⏸️ 暂停菜单模块已加载");
  }

  /**
   * 初始化所有按钮的事件监听器。只运行一次。
   */
  initEventListeners() {
    // --- 主暂停菜单按钮 ---
    document.getElementById("pause-resume-btn").onclick = () =>
      this.deactivate();
    document.getElementById("pause-save-btn").onclick = () =>
      window.manualSave(); // 复用全局手动存档函数
    document.getElementById("pause-exit-btn").onclick = () => window.exitGame();

    // --- 打开子页面的按钮 (现在指向新的带前缀的ID) ---
    document.getElementById("pause-load-btn").onclick = () =>
      this.showSubPage("pause-load-game");
    document.getElementById("pause-settings-btn").onclick = () =>
      this.showSubPage("pause-settings");
    document.getElementById("pause-achievements-btn").onclick = () =>
      this.showSubPage("pause-achievements");

    // --- 所有【暂停菜单专属】子页面的“返回”按钮 ---
    document.getElementById("pause-load-back-btn").onclick = () =>
      this.goBack();
    document.getElementById("pause-settings-back-btn").onclick = () =>
      this.goBack();
    document.getElementById("pause-achievements-back-btn").onclick = () =>
      this.goBack();

    // --- 暂停菜单的设置页保存按钮 ---
    document.getElementById("pause-settings-save-btn").onclick = () => {
      // 读取暂停菜单专属滑块的值
      const bgmVolume = document.getElementById("pause-bgm-volume").value;
      const sfxVolume = document.getElementById("pause-sfx-volume").value;

      // 调用全局的 saveSettings 函数，但需要改造它以接受参数
      if (typeof window.saveSettings === "function") {
        window.saveSettings(bgmVolume, sfxVolume);
      }

      // 保存后返回到暂停主菜单
      this.goBack();
    };
  }
  /**
   * 激活暂停菜单。
   */
  activate() {
    if (this.isActive) return;
    this.isActive = true;

    // 2. 调用全局暂停函数
    if (typeof window.pauseGame === "function") {
      window.pauseGame();
      console.log("游戏暂停");
    }

    core.layers.push(this);

    // 4. 更新UI和内部状态
    this.menuContext = "pause";
    this.element.classList.add("visible");
    document.getElementById("pause-home").classList.add("active");

    console.log("⏸️ 暂停菜单已激活");
  }

  /**
   * 停用暂停菜单。
   */
  deactivate() {
    if (!this.isActive) return;
    this.isActive = false;

    // 2. 调用全局恢复函数
    if (typeof window.resumeGame === "function") {
      window.resumeGame();
    }

    // 3. 隐藏UI并重置状态
    this.hideAllSubPages(); // 确保所有子页面都关闭
    document.getElementById("pause-home").classList.remove("active");
    this.element.classList.remove("visible");
    this.menuContext = "main";
    console.log("▶️ 暂停菜单已停用");
    core.layers.remove(this);
  }

  /**
   * 切换暂停菜单的启用/禁用状态。
   * 这是外部调用此模块的主要入口点。
   */
  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * 核心输入处理函数。由 LayerManager 调用。
   * @param {Event} event - 浏览器事件对象
   * @returns {boolean} - 返回 true 以阻止事件继续传播
   */
  handleInput(event) {
    // 只有当模块是激活状态时，才处理输入
    if (!this.isActive) return false;

    if (event.type === "keydown" && event.key === "Escape") {
      if (this.activeSubPage) {
        this.goBack();
      } else {
        this.deactivate();
      }
    }
    return true;
  }

  /**
   * 打开一个子页面（如设置、加载存档）。
   * @param {string} pageId - 要显示的页面的ID
   */
  showSubPage(pageId) {
    window.playSoundEffect(); // 调用全局音效函数
    this.activeSubPage = pageId;

    document.getElementById("pause-home").classList.remove("active");
    document.getElementById(pageId).classList.add("active");

    // 加载子页面所需数据
    if (pageId === "pause-load-game") window.populateSavedGames(true);
    if (pageId === "pause-settings") window.loadSettings();
  }

  /**
   * 通用的“返回”功能，从子页面返回到暂停主屏幕。
   */
  goBack() {
    window.playSoundEffect();

    if (this.activeSubPage) {
      document.getElementById(this.activeSubPage).classList.remove("active");
      this.activeSubPage = null;
    }
    document.getElementById("pause-home").classList.add("active");
  }

  /**
   * 隐藏所有可能打开的子页面。
   */
  hideAllSubPages() {
    if (this.activeSubPage) {
      document.getElementById(this.activeSubPage).classList.remove("active");
      this.activeSubPage = null;
    }
  }

  /**
   * 销毁模块（如果需要）。
   * 在这个场景下，暂停菜单通常与游戏共存亡，不一定需要销毁。
   * 但为了格式完整，我们提供一个。
   */
  destroy() {
    // 移除所有通过 .onclick 添加的监听器（虽然在这个例子中它们会随DOM消失）
    this.isActive = false;
    // 3. 隐藏UI并重置状态
    this.hideAllSubPages(); // 确保所有子页面都关闭
    document.getElementById("pause-home").classList.remove("active");
    this.element.classList.remove("visible");
    this.menuContext = "main";
    console.log("▶️ 暂停菜单已停用");
    console.log("🗑️ 暂停菜单模块已销毁");
    // 通常这里不需要做什么，因为它的DOM元素是HTML的一部分，而不是动态创建的
  }
}
