/**
 * Terminus 3D Game Core - 主核心类
 * 负责整个游戏的初始化、资源管理、层级管理等
 */
import { LayerManager } from "./managers/LayerManager.js";
import { ScriptManager } from "./managers/ScriptManager.js";
import { Scene } from "./modules/Scene.js";
import { DevelopTool } from "./modules/DevelopTool.js";
import { SoundManager } from "./managers/SoundManager.js";

// 导入并暴露全局依赖供动态脚本使用
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Pathfinding } from "three-pathfinding";

// 暴露为全局变量
window.THREE = THREE;
window.GLTFLoader = GLTFLoader;
window.Pathfinding = Pathfinding;

export class Core {
  constructor() {
    this.container = document.getElementById("gameContainer");
    this.loadingScreen = document.getElementById("loadingScreen");

    // 核心管理器
    this.layers = new LayerManager(this.container);
    this.scripts = new ScriptManager(this);

    // 内置模块
    this.scene = new Scene(this);
    this.devtool = new DevelopTool(this.scene);
    // 声音管理器
    this.sound = new SoundManager(this);

    // 配置数据
    this.script = null;

    this.resources = null;

    // 加载存档
    this.isloadingsavings = false;
    this.savingname = "";
    this.handleBeforeUnload = this.autosavingdata.bind(this.core);

    // 绑定全局变量
    window.core = this;
    window.sound = this.sound;

    this.initialized = false;
    document.core = this;
  }

  async destructor() {
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
      // 先停止音频
      if (this.sound) {
        try {
          this.sound.dispose();
        } catch (e) {}
      }
      this.layers.destructor();
      this.layers = null;
      //this.scripts.destructor();
      //this.scripts = null;
      //this.resources.destructor();
      //this.resources = null;
      this.container = null;
      this.loadingScreen = null;
      this.script = null;
      this.sound = null;
      window.core = null;
      document.core = null;
    } catch (error) {
      console.error("销毁过程中出错:", error);
    }
    console.log("游戏核心已销毁");
  }

  async init(gamescript, gameresources) {
    try {
      console.log("初始化游戏核心...");

      // 加载主配置文件
      this.script = gamescript;

      //加载资源管理器
      this.resources = gameresources;
      console.log(`resources : ${this.resources}`);

      //非正常退出时的自动存档
      window.addEventListener("beforeunload", this.handleBeforeUnload);

      // 加载外部依赖
      await this.loadDependencies();

      this.initialized = true;

      this.hideLoadingScreen();

      console.log("游戏核心初始化完成");
    } catch (error) {
      console.error("游戏核心初始化失败:", error);
    }
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

  // 获取台词设置
  getSpeech(id) {
    if (!this.script.speeches) return null;
    return this.script.speeches.find((speech) => speech.id === id);
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
