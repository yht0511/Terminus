import * as THREE from "three";
import { eventBus } from "./EventBus";
import { gameState } from "./GameStateManager";

/**
 * 游戏引擎核心
 * 管理 Three.js 场景、渲染器、更新循环等核心功能
 */
export class GameEngine {
  private static instance: GameEngine;

  // Three.js 核心组件
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;

  // 游戏状态
  private _isRunning = false;
  private _isPaused = false;
  private _lastTime = 0;
  private _deltaTime = 0;

  // 最大帧率设置
  public maxFPS: number = 60;
  private _frameInterval: number = 1000 / this.maxFPS;
  private _accumulatedTime: number = 0;

  // 更新回调
  private _updateCallbacks: Array<(deltaTime: number) => void> = [];
  private _renderCallbacks: Array<() => void> = [];

  private constructor() {}

  public static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  /**
   * 初始化引擎
   */
  public async initialize(container: HTMLElement): Promise<void> {
    this.initializeRenderer(container);
    this.initializeScene();
    this.initializeCamera();
    this.setupEventListeners();

    eventBus.emit("game:init");
  }

  /**
   * 初始化渲染器
   */
  private initializeRenderer(container: HTMLElement): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 1);

    // 启用阴影
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 色调映射
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    container.appendChild(this.renderer.domElement);
  }

  /**
   * 初始化场景
   */
  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // 添加基础环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.1);
    this.scene.add(ambientLight);
  }

  /**
   * 初始化相机
   */
  private initializeCamera(): void {
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.camera.position.set(0, 1.6, 0);
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 窗口大小变化
    window.addEventListener("resize", this.handleResize.bind(this));

    // 游戏状态事件
    eventBus.on("game:pause", this.pause.bind(this));
    eventBus.on("game:resume", this.resume.bind(this));
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * 开始游戏循环
   */
  public start(): void {
    if (this._isRunning) return;

    this._isRunning = true;
    this._isPaused = false;
    this._lastTime = performance.now();

    this.gameLoop();
    eventBus.emit("game:start");
  }

  /**
   * 暂停游戏
   */
  public pause(): void {
    this._isPaused = true;
    eventBus.emit("game:pause");
  }

  /**
   * 恢复游戏
   */
  public resume(): void {
    if (!this._isPaused) return;

    this._isPaused = false;
    this._lastTime = performance.now();
    eventBus.emit("game:resume");
  }

  /**
   * 停止游戏
   */
  public stop(): void {
    this._isRunning = false;
    eventBus.emit("game:end", { type: "quit" });
  }

  /**
   * 游戏主循环
   */
  private gameLoop(): void {
    if (!this._isRunning) return;

    const currentTime = performance.now();
    let elapsed = currentTime - this._lastTime;
    this._lastTime = currentTime;
    this._accumulatedTime += elapsed;

    // 只有达到帧间隔才执行更新和渲染
    if (this._accumulatedTime >= this._frameInterval) {
      this._deltaTime = this._accumulatedTime / 1000;
      this._accumulatedTime = 0;
      // 限制最大物理步长，避免穿模
      this._deltaTime = Math.min(this._deltaTime, 1 / 30);
      if (!this._isPaused) {
        this.update(this._deltaTime);
        this.render();
        gameState.updateTime(this._deltaTime);
      }
    }
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  /**
   * 更新逻辑
   */
  private update(deltaTime: number): void {
    for (const callback of this._updateCallbacks) {
      callback(deltaTime);
    }
  }

  /**
   * 渲染
   */
  private render(): void {
    // 执行渲染前回调
    for (const callback of this._renderCallbacks) {
      callback();
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 添加更新回调
   */
  public addUpdateCallback(callback: (deltaTime: number) => void): void {
    this._updateCallbacks.push(callback);
  }

  /**
   * 移除更新回调
   */
  public removeUpdateCallback(callback: (deltaTime: number) => void): void {
    const index = this._updateCallbacks.indexOf(callback);
    if (index !== -1) {
      this._updateCallbacks.splice(index, 1);
    }
  }

  /**
   * 添加渲染回调
   */
  public addRenderCallback(callback: () => void): void {
    this._renderCallbacks.push(callback);
  }

  /**
   * 移除渲染回调
   */
  public removeRenderCallback(callback: () => void): void {
    const index = this._renderCallbacks.indexOf(callback);
    if (index !== -1) {
      this._renderCallbacks.splice(index, 1);
    }
  }

  /**
   * 获取当前帧率
   */
  public get fps(): number {
    return this._deltaTime > 0 ? 1 / this._deltaTime : 0;
  }

  /**
   * 获取渲染器信息
   */
  public getRenderInfo(): THREE.WebGLInfo {
    return this.renderer.info;
  }

  /**
   * 截图
   */
  public screenshot(): string {
    return this.renderer.domElement.toDataURL("image/png");
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.stop();

    // 清理场景
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        } else if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        }
      }
    });

    // 清理渲染器
    this.renderer.dispose();

    // 清理回调
    this._updateCallbacks.length = 0;
    this._renderCallbacks.length = 0;
  }
}

// 导出全局引擎实例
export const gameEngine = GameEngine.getInstance();
