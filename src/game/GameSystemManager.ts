import { gameEngine } from "@core/GameEngine";
import { eventBus } from "@core/EventBus";
import { PlayerController } from "./PlayerController";
import { LiDARSystem } from "./LiDARSystem";
import { SceneManager } from "./SceneManager";
import { InteractionManager } from "./InteractionManager";
import type { GameConfig } from "@core/types";

/**
 * 游戏系统管理器
 * 统一管理所有游戏子系统的初始化、更新和销毁
 */
export class GameSystemManager {
  private static instance: GameSystemManager;

  private playerController?: PlayerController;
  private lidarSystem?: LiDARSystem;
  private sceneManager?: SceneManager;
  private interactionManager?: InteractionManager;

  private isInitialized = false;

  private constructor() {}

  public static getInstance(): GameSystemManager {
    if (!GameSystemManager.instance) {
      GameSystemManager.instance = new GameSystemManager();
    }
    return GameSystemManager.instance;
  }

  /**
   * 初始化所有游戏系统
   */
  public async initialize(config: GameConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn("游戏系统已经初始化");
      return;
    }

    console.log("初始化游戏系统...");

    // 初始化玩家控制器
    this.playerController = new PlayerController(config.player);

    // 初始化场景管理器
    this.sceneManager = SceneManager.getInstance();
    this.sceneManager.initialize();
    this.sceneManager.registerScenes(config.scenes);

    // 初始化交互管理器
    this.interactionManager = InteractionManager.getInstance();

    // 初始化LiDAR系统
    this.lidarSystem = new LiDARSystem({
      scene: gameEngine.scene,
      camera: gameEngine.camera,
      playerProvider: this.playerController,
      worldRoots: [gameEngine.scene],
      config: config.lidar,
    });

    this.setupEventListeners();
    this.isInitialized = true;

    eventBus.emit("systems:initialized");
    console.log("游戏系统初始化完成");
  }

  /**
   * 设置系统间事件监听
   */
  private setupEventListeners(): void {
    // 场景变化时重建LiDAR
    eventBus.on("scene:changed", (data: { from: string; to: string }) => {
      if (this.lidarSystem && this.sceneManager) {
        this.lidarSystem.rebuild();
      }
    });

    // 玩家移动时更新交互检测
    eventBus.on("player:moved", (data: { position: THREE.Vector3 }) => {
      if (this.interactionManager) {
        this.interactionManager.checkInteractions(data.position);
      }
    });
  }

  /**
   * 获取系统实例
   */
  public getPlayerController(): PlayerController | undefined {
    return this.playerController;
  }

  public getLiDARSystem(): LiDARSystem | undefined {
    return this.lidarSystem;
  }

  public getSceneManager(): SceneManager | undefined {
    return this.sceneManager;
  }

  public getInteractionManager(): InteractionManager | undefined {
    return this.interactionManager;
  }

  /**
   * 销毁所有系统
   */
  public dispose(): void {
    this.playerController?.dispose();
    this.lidarSystem = undefined;
    this.sceneManager = undefined;
    this.interactionManager = undefined;
    this.isInitialized = false;

    eventBus.emit("systems:disposed");
    console.log("游戏系统已销毁");
  }
}

// 导出单例实例
export const gameSystemManager = GameSystemManager.getInstance();
