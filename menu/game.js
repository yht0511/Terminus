import { Core } from "../core/main.js";
import { ResourceManager } from "../core/managers/ResourceManager.js";
import { PauseMenu } from "../scripts/src/layers/PauseMenu.js";
import DeathOverlay from "../scripts/src/layers/death.js";

class Game {
  constructor() {
    this.core = null;
    this.isgaming = false;
    this.main_script = null;
    this.script = null;
    this.resources = new ResourceManager();
    this.pauseMenu = new PauseMenu();
    this.deathOverlay = new DeathOverlay();
  }
  async init() {
    try {
      await this.preloadmain_script();
      // 预加载资源
      await this.preloadResources();
    } catch (error) {
      console.log(`游戏初始化失败: ${error}`);
    }
  }

  async beginNewGame() {
    // 开始新游戏
    console.log("Function: beginNewGame called.");
    document.getElementById("mainmenu").style.display = "none";
    document.getElementById("gameContainer").style.display = "block";
    const core = new Core();
    this.core = core;
    const newscript = JSON.parse(JSON.stringify(this.main_script)); // 深拷贝主脚本
    await core.init(newscript, this.resources);
    await core.executeScripts(core.script);
    // 应用菜单音量设置到 SoundManager，并播放关卡BGM（可按需替换URL）
    try {
      const bgmVol = window.musicsound ?? 0.1;
      const sfxVol = window.soundeffect ?? 0.8;
      // 交互后恢复上下文更稳妥，这里尝试恢复
      await core.sound.resumeContextOnUserGesture();
      // 如脚本里配置了关卡BGM，则使用之；否则可替换为你的关卡BGM

      if (levelBgm) {
        await core.sound.playBGM(levelBgm, { fade: 0.8, loop: true });
        window.core.sound.setCategoryVolume("bgm", Number(bgmVol));
        window.core.sound.setCategoryVolume("sfx", Number(sfxVol));
        window.core.sound.setCategoryVolume("voice", Number(sfxVol));
      }
    } catch (e) {
      console.warn("初始化关卡音频失败", e);
    }
    this.isgaming = true;

    // 初始化移动端横屏控制
    try {
      this.setupMobileControls();
    } catch (e) {
      console.warn("移动端控件初始化失败", e);
    }
  }

  async loadSavedGame(savingname) {
    console.log(`Function: loadSavedGame called with name: ${savingname}`);
    document.getElementById("mainmenu").style.display = "none";
    document.getElementById("gameContainer").style.display = "block";
    const core = new Core();
    this.core = core;
    core.savingname = savingname;
    const loadSavedScript = async () => {
      console.log("加载玩家存档中");
      const savedScript = localStorage.getItem("terminus_saves");
      console.log(savedScript, savingname);

      if (savedScript) {
        const savedGames = JSON.parse(savedScript);
        if (savedGames[savingname]) {
          this.script = savedGames[savingname].savingdata;
          console.log("存档脚本加载完成");
          return;
        } else {
          console.warn("没有找到存档脚本,即将开始新游戏");
          this.script = JSON.parse(JSON.stringify(this.main_script));
        }
      }
    };

    await loadSavedScript();
    await core.init(this.script, this.resources);
    await core.executeScripts(core.script);
    // 同步音量并播放BGM
    try {
      const bgmVol = window.musicsound ?? 0.1;
      const sfxVol = window.soundeffect ?? 0.8;
      core.sound.setCategoryVolume("bgm", Number(bgmVol));
      core.sound.setCategoryVolume("sfx", Number(sfxVol));
      core.sound.setCategoryVolume("voice", Number(sfxVol));
      await core.sound.resumeContextOnUserGesture();
      if (levelBgm) {
        await core.sound.playBGM(levelBgm, { fade: 0.8, loop: true });
      }
    } catch (e) {
      console.warn("加载存档音频失败", e);
    }
    this.isgaming = true;
  }

  async preloadmain_script() {
    console.log("正在加载主脚本文件...");
    const response = await fetch("../scripts/main.json");
    if (!response.ok) {
      throw new Error(`无法加载 main.json: ${response.statusText}`);
    }
    this.main_script = await response.json();
    console.log("主脚本文件加载完成");
  }

  async preloadResources() {
    if (!this.main_script.preload || this.main_script.preload.length === 0) {
      return;
    }

    console.log("预加载资源...");
    const promises = this.main_script.preload.map((path) =>
      this.resources.loadModel(path)
    );

    await Promise.all(promises);
    console.log("资源预加载完成");
  }

  exitGame(callback, destroy = false) {
    if (!this.isgaming) return;
    console.log("Function: exitGame called.222");
    core.scene.saveState();

    // 解绑自动保存事件
    //window.removeEventListener("beforeunload", this.core.handleBeforeUnload);
    //自动存档
    if (!destroy) {
      this.core.autosavingdata();
      window.showNotification("存档已自动保存至autosave", 1500);
    } else {
      window.showNotification("警告：存档数据已销毁", 1500);
    }

    this.core.destructor();
    this.core = null;

    // 切换UI
    document.getElementById("gameContainer").style.display = "none";
    document.getElementById("mainmenu").style.display = "flex";

    if (this.pauseGame.isActive) {
      this.pauseGame.deactivate();
    }
    window.showPage("home");
    // 切回菜单，停止关卡BGM，菜单自己会播菜单BGM
    if (this.core && this.core.sound) {
      this.core.sound.stopBGM({ fade: 0.6 });
    }
    window.playMenuBGM();

    console.log("游戏已退出");
    this.isgaming = false;
    document.exitPointerLock();
    if (callback) callback();
  }

  manualSave() {
    showPrompt("请输入存档名称：", (saveName) => {
      if (!saveName) {
        showNotification("存档名称不能为空！", 2000);
        return;
      }
      this.core.scene.saveState();

      const now = new Date();
      let saves = JSON.parse(localStorage.getItem("terminus_saves")) || {};

      if (saves[saveName]) {
        showConfirm(`存档 "${saveName}" 已存在，是否要覆盖？`, () => {
          saves[saveName] = {
            saveTime: now.toISOString(),
            savingdata: this.core.script,
          };
          localStorage.setItem("terminus_saves", JSON.stringify(saves));
          window.showNotification(`存档 "${saveName}" 已保存！`, 2000);
        });
      } else {
        saves[saveName] = {
          saveTime: now.toISOString(),
          savingdata: this.core.script,
        };
        localStorage.setItem("terminus_saves", JSON.stringify(saves));
        window.showNotification(`存档 "${saveName}" 已保存！`, 2000);
        window.populateSavedGames(true);
      }
    });
  }

  pauseGame() {}

  resumeGame() {}

  Gamehit(current_scene) {
    if (!this.isgaming) {
      window.showNotification("当前未在游戏中", 2000);
      return;
    }
    // 游戏作弊提示
    if (current_scene === "1") {
      window
        .innerShowConfirm(
          `第一幕提示<br>密码为三个数字的一种组合<br>是否查看密码?`
        )
        .then((confirmed) => {
          if (confirmed) {
            window.showNotification("密码为：635");
          }
        });
    } else if (current_scene === "2") {
      window
        .innerShowConfirm(
          `第二幕提示<br>需要打开三个电闸，之后才可以启动终端<br>如果迷路可以按Ctrl + R 快捷键回到本幕重生点<br>是否直接打开三个电闸?`
        )
        .then((confirmed) => {
          if (confirmed) {
            gate_1.down();
            gate_2.down();
            gate_3.down();
            window.showNotification("三个电闸已打开");
          }
        });
    } else if (current_scene === "3") {
      showNotification("第三幕提示\n勇敢地向前探索吧", 2000);
    } else {
      showNotification("当前场景无作弊提示或暂不可用", 2000);
    }
  }

  // ========== 移动端横屏控制 ==========
  setupMobileControls() {
    const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(
      navigator.userAgent
    );
    const isLandscape = () =>
      window.matchMedia("(orientation: landscape)").matches;

    const mobileControls = document.getElementById("mobileControls");
    if (!mobileControls) return;

    const refreshVisibility = () => {
      const body = document.body;
      if (isMobile) body.classList.add("is-mobile");
      else body.classList.remove("is-mobile");
      const show = isMobile && isLandscape();
      body.classList.toggle("is-mobile-landscape", show);
      // 强制同步一次遮罩态，避免 ui-blocking 残留
      try {
        window.core?.layers?.updateMobileOverlayPointer?.();
      } catch (_) {}
      // 手机端不要触发 pointerlock：直接退出并标记
      if (show) {
        try {
          document.exitPointerLock();
        } catch (_) {}
        document.mouse_locked = false;
        document.isMobileTouch = true;
      }
    };
    refreshVisibility();
    window.addEventListener("resize", refreshVisibility);

    if (!isMobile) return; // 桌面不绑定

    // 防止触摸滚动/回弹
    const prevent = (e) => {
      e.preventDefault();
    };
    mobileControls.addEventListener("touchstart", prevent, { passive: false });
    mobileControls.addEventListener("touchmove", prevent, { passive: false });
    mobileControls.addEventListener("touchend", prevent, { passive: false });

    // 映射按钮到键盘：ESC、Q、Space、E
    const btnEsc = document.getElementById("mc-btn-esc");
    const btnQ = document.getElementById("mc-btn-q");
    const btnJump = document.getElementById("mc-btn-jump");
    const btnInteract = document.getElementById("mc-btn-interact");
    // 遮罩时置顶快捷按钮（同级叠加）
    const mobOverEsc = document.getElementById("mob-over-esc");
    const mobOverQ = document.getElementById("mob-over-q");

    const codeToKey = (code) => {
      switch (code) {
        case "Escape":
          return "Escape";
        case "KeyQ":
          return "q";
        case "Space":
          return " ";
        case "KeyE":
          return "e";
        case "KeyW":
          return "w";
        case "KeyA":
          return "a";
        case "KeyS":
          return "s";
        case "KeyD":
          return "d";
        default:
          return "";
      }
    };
    const tapKey = (code) => {
      const key = codeToKey(code);
      const down = new KeyboardEvent("keydown", { code, key, bubbles: true });
      const up = new KeyboardEvent("keyup", { code, key, bubbles: true });
      // 直接交给 LayerManager 的分发逻辑
      document.dispatchEvent(down);
      document.dispatchEvent(up);
    };
    btnEsc?.addEventListener("touchstart", (e) => {
      e.preventDefault();
      try {
        window.gameInstance?.pauseMenu?.activate?.();
      } catch (_) {}
    });
    mobOverEsc?.addEventListener("touchstart", (e) => {
      e.preventDefault();
      try {
        window.gameInstance?.pauseMenu?.activate?.();
      } catch (_) {}
    });
    btnQ?.addEventListener("touchstart", (e) => {
      e.preventDefault();
      tapKey("KeyQ");
    });
    mobOverQ?.addEventListener("touchstart", (e) => {
      e.preventDefault();
      tapKey("KeyQ");
    });
    btnJump?.addEventListener("touchstart", (e) => {
      e.preventDefault();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true })
      );
    });
    btnJump?.addEventListener("touchend", (e) => {
      e.preventDefault();
      document.dispatchEvent(
        new KeyboardEvent("keyup", { code: "Space", key: " ", bubbles: true })
      );
    });
    btnInteract?.addEventListener("touchstart", (e) => {
      e.preventDefault();
      tapKey("KeyE");
    });

    // 视角滑动 -> 合成 mousemove（不要和 pointerlock 绑定冲突）
    const lookArea = document.getElementById("mc-look-area");
    let lastX = null,
      lastY = null;
    const lookStart = (e) => {
      const t = e.touches[0];
      lastX = t.clientX;
      lastY = t.clientY;
    };
    const lookMove = (e) => {
      const t = e.touches[0];
      if (lastX == null) {
        lastX = t.clientX;
        lastY = t.clientY;
        return;
      }
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      lastX = t.clientX;
      lastY = t.clientY;
      // 派发一个简化的 mousemove，携带 movementX/Y
      const evt = new MouseEvent("mousemove", { bubbles: true });
      Object.defineProperty(evt, "movementX", {
        value: dx,
        configurable: true,
      });
      Object.defineProperty(evt, "movementY", {
        value: dy,
        configurable: true,
      });
      document.dispatchEvent(evt);
    };
    const lookEnd = () => {
      lastX = null;
      lastY = null;
    };
    lookArea?.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        lookStart(e);
      },
      { passive: false }
    );
    lookArea?.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        lookMove(e);
      },
      { passive: false }
    );
    lookArea?.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        lookEnd(e);
      },
      { passive: false }
    );

    // 点击屏幕 -> click（不要与 mousemove 冲突），用 tap 判定
    let tapTimer = null;
    let moved = false;
    let startXY = null;
    const tapStart = (e) => {
      moved = false;
      startXY = [e.touches[0].clientX, e.touches[0].clientY];
      tapTimer = setTimeout(() => {}, 0);
    };
    const tapMove = (e) => {
      const dx = Math.abs(e.touches[0].clientX - startXY[0]);
      const dy = Math.abs(e.touches[0].clientY - startXY[1]);
      if (dx > 10 || dy > 10) moved = true;
    };
    const isNoClick = (target) => {
      let el = target;
      while (el) {
        if (el.dataset && el.dataset.noclick) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    };
    const tapEnd = (e) => {
      if (!moved && !isNoClick(e.target)) {
        const evt = new MouseEvent("click", { bubbles: true });
        document.dispatchEvent(evt);
      }
      clearTimeout(tapTimer);
    };
    // 只在空白区域触发点击（避开按钮/摇杆）
    mobileControls.addEventListener("touchstart", tapStart, { passive: false });
    mobileControls.addEventListener("touchmove", tapMove, { passive: false });
    mobileControls.addEventListener("touchend", tapEnd, { passive: false });

    // 左下摇杆 -> 映射 WASD 按键
    const joystick = document.getElementById("mc-joystick");
    const stick = joystick?.querySelector(".mc-stick");
    const center = () => {
      const r = joystick.clientWidth / 2;
      return { x: joystick.offsetLeft + r, y: joystick.offsetTop + r, r };
    };
    let jActive = false;
    let jCenter = null;
    const keyState = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
    const setKey = (code, on) => {
      if (keyState[code] === on) return;
      keyState[code] = on;
      const evt = new KeyboardEvent(on ? "keydown" : "keyup", {
        code,
        key: codeToKey(code),
        bubbles: true,
      });
      document.dispatchEvent(evt);
    };
    const updateKeysFromVector = (vx, vy) => {
      const dead = 0.2;
      const len = Math.hypot(vx, vy);
      const nx = len > 0 ? vx / len : 0;
      const ny = len > 0 ? vy / len : 0;
      setKey("KeyW", len > dead && ny < -dead);
      setKey("KeyS", len > dead && ny > dead);
      setKey("KeyA", len > dead && nx < -dead);
      setKey("KeyD", len > dead && nx > dead);
    };
    const placeStick = (vx, vy) => {
      if (!stick || !jCenter) return;
      const max = (joystick.clientWidth - stick.clientWidth) / 2;
      stick.style.transform = `translate(calc(-50% + ${
        vx * max
      }px), calc(-50% + ${vy * max}px))`;
    };
    const jStart = (e) => {
      e.preventDefault();
      jActive = true;
      jCenter = center();
    };
    const jMove = (e) => {
      if (!jActive || !jCenter) return;
      const t = e.touches[0];
      const vx =
        (t.clientX -
          (joystick.getBoundingClientRect().left + joystick.clientWidth / 2)) /
        (joystick.clientWidth / 2);
      const vy =
        (t.clientY -
          (joystick.getBoundingClientRect().top + joystick.clientHeight / 2)) /
        (joystick.clientHeight / 2);
      const len = Math.hypot(vx, vy);
      const scale = len > 1 ? 1 / len : 1;
      const sx = vx * scale;
      const sy = vy * scale;
      placeStick(sx, sy);
      updateKeysFromVector(sx, sy);
    };
    const jEnd = (e) => {
      jActive = false;
      placeStick(0, 0);
      updateKeysFromVector(0, 0);
    };
    joystick?.addEventListener("touchstart", jStart, { passive: false });
    joystick?.addEventListener("touchmove", jMove, { passive: false });
    joystick?.addEventListener("touchend", jEnd, { passive: false });
  }
}
const gameInstance = new Game();
gameInstance.init();

// --- 绑定全局函数 ---
window.gameInstance = gameInstance;
window.beginNewGame = () => gameInstance.beginNewGame();
window.loadSavedGame = (savingname) => gameInstance.loadSavedGame(savingname);
window.exitGame = (callback) => gameInstance.exitGame(callback);
window.pauseGame = () => gameInstance.pauseGame();
window.resumeGame = () => gameInstance.resumeGame();
window.manualSave = () => gameInstance.manualSave();
window.Gamehit = (current_scene) => gameInstance.Gamehit(current_scene);

// --- 全局变量 ---
window.currentUser = localStorage.getItem("terminus_currentUser") || null;
