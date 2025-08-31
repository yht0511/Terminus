/**
 * Terminus 3D Game Core - 主核心类
 * 负责整个游戏的初始化、资源管理、层级管理等
 */

import { LayerManager } from "./managers/LayerManager.js";
import { ResourceManager } from "./managers/ResourceManager.js";
import { ScriptManager } from "./managers/ScriptManager.js";
import { Scene } from "./modules/Scene.js";
import { DevelopTool } from "./modules/DevelopTool.js";

export class Core {
  constructor() {
    this.container = document.getElementById("gameContainer");
    this.loadingScreen = document.getElementById("loadingScreen");

    // 核心管理器
    this.layers = new LayerManager(this.container);
    this.resources = new ResourceManager();
    this.scripts = new ScriptManager(this);

    // 内置模块
    this.scene = new Scene(this);
    this.devtool = new DevelopTool(this.scene);

    // 配置数据
    this.script = null;

    // 加载存档
    this.isloadingsavings = false;
    this.savingname = "";
    this.handleBeforeUnload = this.autosavingdata.bind(this.core);

    // 绑定全局变量
    window.core = this;

    this.initialized = false;
    document.core = this;
  }

  destructor() {
    /**
     * 析构函数注意：
     * 递归调用析构子模块
     * 清理DOM元素，事件监听，定时器
     * 释放资源和内存
     * 调用第三方库资源的销毁方法
     * 断开全局引用
     * 销毁顺序：子模块 -> 管理器 -> 核心
     */
    try {
      console.log("销毁游戏核心...");
      this.layers.destructor();
      this.layers = null;
      //this.scripts.destructor();
      //this.scripts = null;
      this.resources.destructor();
      this.resources = null;
      this.container = null;
      this.loadingScreen = null;
      this.script = null;
      window.core = null;
      document.core = null;
    } catch (error) {
      console.error("销毁过程中出错:", error);
    }
    console.log("游戏核心已销毁");
  }

  async init() {
    try {
      console.log("初始化游戏核心...");

      // 加载主配置文件
      await this.loadMainScript();

      //非正常退出时的自动存档
      window.addEventListener("beforeunload", this.handleBeforeUnload);

      // 预加载资源
      await this.preloadResources();

      // 加载外部依赖
      await this.loadDependencies();

      this.initialized = true;

      this.hideLoadingScreen();

      console.log("游戏核心初始化完成");
    } catch (error) {
      console.error("游戏核心初始化失败:", error);
    }
  }

  async loadMainScript() {
    if (this.isloadingsavings) {
      console.log("加载玩家存档中");
      const savedScript = localStorage.getItem("terminus_saves");
      console.log(savedScript, this.savingname);

      if (savedScript) {
        const savedGames = JSON.parse(savedScript);
        if (savedGames[this.savingname]) {
          this.script = savedGames[this.savingname].savingdata;
          console.log("存档脚本加载完成");
          return;
        } else {
          console.warn("没有找到存档脚本,即将开始新游戏");
          this.isloadingsavings = false;
        }
      }
    }

    console.log("进入新游戏，正在加载主脚本文件...");
    const response = await fetch("/scripts/main.json");
    if (!response.ok) {
      throw new Error(`无法加载 main.json: ${response.statusText}`);
    }
    this.script = await response.json();
    console.log("主脚本文件加载完成");
  }

  async preloadResources() {
    if (!this.script.preload || this.script.preload.length === 0) {
      return;
    }

    console.log("预加载资源...");
    const promises = this.script.preload.map((path) =>
      this.resources.loadModel(path)
    );

    await Promise.all(promises);
    console.log("资源预加载完成");
  }

  async loadDependencies() {
    if (!this.script.dependencies || this.script.dependencies.length === 0) {
      return;
    }

    console.log("加载外部依赖...");
    for (const dep of this.script.dependencies) {
      await this.scripts.loadScript(dep.id, dep.path);
    }
    console.log("外部依赖加载完成");
  }

  async executeScripts() {
    if (!this.script.scripts || this.script.scripts.length === 0) {
      return;
    }

    console.log("执行脚本...");
    for (const script of this.script.scripts) {
      await this.scripts.execute(script);
    }
    console.log("脚本运行完成");
  }

  hideLoadingScreen() {
    this.loadingScreen.style.opacity = "0";
    setTimeout(() => {
      this.loadingScreen.style.display = "none";
    }, 500);
  }

  // 获取实体配置
  getEntity(id) {
    if (!this.script.entities) return null;
    return this.script.entities.find((entity) => entity.id === id);
  }

  // 变量替换功能
  replaceVariables(str, context = {}) {
    return str.replace(/\$(\w+)/g, (match, varName) => {
      if (context.hasOwnProperty(varName)) {
        return context[varName];
      }
      return match;
    });
  }

  //自动存档
  autosavingdata() {
    this.scene.saveState();
    const now = new Date();
    let saves = JSON.parse(localStorage.getItem("terminus_saves")) || {};
    if (saves) console.log(saves);
    saves["autosave"] = {
      saveTime: now.toISOString(),
      savingdata: this.script,
    };
    localStorage.setItem("terminus_saves", JSON.stringify(saves));
  }
}

class Game {
  constructor() {
    this.core = null;
    this.isgaming = false;
    this.data = null;
  }

  async beginNewGame() {
    // 开始新游戏
    console.log("Function: beginNewGame called.");
    document.getElementById("mainmenu").style.display = "none";
    document.getElementById("gameContainer").style.display = "block";
    const core = new Core();
    this.core = core;
    this.data = core.script;
    await core.init();
    await core.executeScripts(core.script);
    this.isgaming = true;
  }

  async loadSavedGame(savingname) {
    console.log(`Function: loadSavedGame called with name: ${savingname}`);
    document.getElementById("mainmenu").style.display = "none";
    document.getElementById("gameContainer").style.display = "block";
    // 加载存档
    const core = new Core();
    this.core = core;
    this.data = core.script;
    core.isloadingsavings = true;
    core.savingname = savingname;
    await core.init();
    await core.executeScripts(core.script);
    this.isgaming = true;
  }

  exitGame() {
    if (!this.isgaming) return;
    core.scene.saveState();
    // 退出游戏
    console.log(`Function: loadSavedGame`);

    // 解绑自动保存事件
    window.removeEventListener("beforeunload", this.core.handleBeforeUnload);
    //自动存档
    this.core.autosavingdata();

    this.core.destructor();
    this.core = null;
    document.getElementById("gameContainer").style.display = "none";
    document.getElementById("mainmenu").style.display = "block";

    console.log("游戏已退出");
    this.isgaming = false;
  }
}
const gameInstance = new Game();

// --- 绑定全局函数 ---
window.gameInstance = gameInstance;
window.beginNewGame = () => gameInstance.beginNewGame();
window.loadSavedGame = (savingname) => gameInstance.loadSavedGame(savingname);
window.exitGame = () => gameInstance.exitGame();

// --- 全局变量 ---
window.currentUser = localStorage.getItem("terminus_currentUser") || null;
if (window.currentUser) {
  console.log(`欢迎回来, ${window.currentUser}`);
} else {
  console.log("当前未登录用户");
}
