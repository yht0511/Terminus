/**
 * Terminus 3D Game Core - 主核心类
 * 负责整个游戏的初始化、资源管理、层级管理等
 */

import { LayerManager } from "./managers/LayerManager.js";
import { ResourceManager } from "./managers/ResourceManager.js";
import { ScriptManager } from "./managers/ScriptManager.js";
import { Scene } from "./modules/Scene.js";

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

    // 配置数据
    this.script = null;

    // 绑定全局变量
    window.core = this;

    this.initialized = false;
    
    
  }

  async init() {
    try {
      console.log("初始化游戏核心...");

      // 加载主配置文件
      await this.loadMainScript();

      // 预加载资源
      await this.preloadResources();

      // 加载外部依赖
      await this.loadDependencies();

      this.initialized = true;
      
      this.isDebug = this.script.debug || false;
      this.hideLoadingScreen();

      console.log("游戏核心初始化完成");
    } catch (error) {
      console.error("游戏核心初始化失败:", error);
    }
  }

  async loadMainScript() {
    console.log("加载主脚本文件...");
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
}

// 初始化
document.addEventListener("DOMContentLoaded", async () => {
  const core = new Core();
  await core.init();
  await core.executeScripts(core.script);
});
