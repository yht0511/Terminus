import { Core } from "../core/main.js";
import { ResourceManager } from "../core/managers/ResourceManager.js";
import { PauseMenu } from "../scripts/src/layers/PauseMenu.js";

class Game {
  constructor() {
    this.core = null;
    this.isgaming = false;
    this.main_script = null;
    this.script = null;
    this.resources = new ResourceManager();
    this.pauseMenu = new PauseMenu();
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
    await core.init(this.main_script, this.resources);
    await core.executeScripts(core.script);
    // 应用菜单音量设置到 SoundManager，并播放关卡BGM（可按需替换URL）
    try {
      const bgmVol = window.musicsound ?? 0.5;
      const sfxVol = window.soundeffect ?? 0.8;
      core.sound.setCategoryVolume("bgm", Number(bgmVol));
      core.sound.setCategoryVolume("sfx", Number(sfxVol));
      // 交互后恢复上下文更稳妥，这里尝试恢复
      await core.sound.resumeContextOnUserGesture();
      // 如脚本里配置了关卡BGM，则使用之；否则可替换为你的关卡BGM
      const levelBgm = core.script?.global?.level_bgm;
      if (levelBgm) {
        await core.sound.playBGM(levelBgm, { fade: 0.8, loop: true });
      }
    } catch (e) {
      console.warn("初始化关卡音频失败", e);
    }
    this.isgaming = true;
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
          // 基于 main_script 创建完整的脚本对象
          this.script = { ...this.main_script };

          // 用存档数据覆盖特定字段（如果存在）
          const savedData = savedGames[savingname].savingdata;
          if (savedData.storyStatus) {
            this.script.storyStatus = savedData.storyStatus;
          }
          if (savedData.entities) {
            this.script.entities = savedData.entities;
          }
          // 可以根据需要添加更多字段的恢复

          console.log("存档脚本加载完成");
          return;
        } else {
          console.warn("没有找到存档脚本,即将开始新游戏");
          this.script = this.main_script;
        }
      }
    };

    await loadSavedScript();
    await core.init(this.script, this.resources);
    await core.executeScripts(core.script);
    // 同步音量并播放BGM
    try {
      const bgmVol = window.musicsound ?? 0.5;
      const sfxVol = window.soundeffect ?? 0.8;
      core.sound.setCategoryVolume("bgm", Number(bgmVol));
      core.sound.setCategoryVolume("sfx", Number(sfxVol));
      await core.sound.resumeContextOnUserGesture();
      const levelBgm = core.script?.global?.level_bgm;
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

  // 退出游戏
  exitGame(callback) {
    if (!this.isgaming) return;
    core.scene.saveState();

    // 解绑自动保存事件
    //window.removeEventListener("beforeunload", this.core.handleBeforeUnload);
    //自动存档
    this.core.autosavingdata();

    this.core.destructor();
    this.core = null;

    window.showNotification("正在自动保存...", 1500);

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

    if (callback) callback();
  }
  //手动存档
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
        });
      } else {
        saves[saveName] = {
          saveTime: now.toISOString(),
          savingdata: this.core.script,
        };
        localStorage.setItem("terminus_saves", JSON.stringify(saves));
      }
    });
  }

  pauseGame() {}

  resumeGame() {}
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

// --- 全局变量 ---
window.currentUser = localStorage.getItem("terminus_currentUser") || null;
