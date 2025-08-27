import { gameEngine } from "@core/GameEngine";
import { gameState } from "@core/GameStateManager";
import { resourceManager } from "@core/ResourceManager";
import { eventBus } from "@core/EventBus";
import { uiManager } from "@ui/UIManager";
import { sceneManager } from "@game/SceneManager";
import { interactionManager } from "@game/InteractionManager";
import { PlayerController } from "@game/PlayerController";
import { LiDARSystem } from "@game/LiDARSystem";
import type { GameConfig } from "@core/types";
import * as THREE from "three";

/**
 * 主游戏类
 */
class Game {
  private gameConfig!: GameConfig;
  private playerController!: PlayerController;
  private lidarSystem!: LiDARSystem;
  private isInitialized = false;
  private isLiDARMode = true;

  public async initialize(): Promise<void> {
    try {
      console.log("正在初始化游戏...");

      // 隐藏初始loading界面
      const loadingElement = document.querySelector(".loading") as HTMLElement;
      if (loadingElement) {
        loadingElement.style.display = "none";
      }

      const appElement = document.getElementById("app");
      if (!appElement) {
        throw new Error("找不到应用容器元素");
      }

      // 显示临时消息表示游戏正在加载
      const statusDiv = document.createElement("div");
      statusDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #00ff88;
        font-family: 'Courier New', monospace;
        text-align: center;
        z-index: 1000;
      `;
      statusDiv.textContent = "初始化游戏引擎...";
      appElement.appendChild(statusDiv);

      await gameEngine.initialize(appElement);
      statusDiv.textContent = "加载游戏配置...";

      // 创建基本的游戏配置（如果配置文件不存在）
      try {
        this.gameConfig = await resourceManager.load<GameConfig>(
          "/src/config/game.json"
        );
      } catch (error) {
        console.warn("未找到配置文件，使用默认配置");
        this.gameConfig = {
          title: "Terminus",
          version: "1.0.0",
          scenes: [],
          dialogs: [],
          terminals: [],
          endings: [],
          defaultFlags: {
            game_started: false,
            tutorial_completed: false,
          },
        };
      }

      statusDiv.textContent = "初始化游戏状态...";

      gameState.reset();
      Object.entries(this.gameConfig.defaultFlags).forEach(([key, value]) => {
        gameState.setFlag(key, value);
      });

      statusDiv.textContent = "初始化场景管理器...";

      // 初始化SceneManager（必须在GameEngine初始化之后）
      sceneManager.initialize();
      sceneManager.registerScenes(this.gameConfig.scenes);

      statusDiv.textContent = "初始化控制系统...";

      this.playerController = new PlayerController();
      this.lidarSystem = new LiDARSystem({
        scene: gameEngine.scene,
        camera: gameEngine.camera,
        playerProvider: this.playerController,
        worldRoots: [gameEngine.scene],
        config: {
          maxDistance: 200,
          pointSize: 0.05,
          fade: true,
          pointLifetime: 10,
          baseColor: 0x00ff88,
          minIntensity: 0.15,
        },
      });

      this.setLiDARMode(true);
      this.setupEventListeners();

      statusDiv.textContent = "加载场景...";

      // 如果有场景配置则加载，否则创建一个基本场景
      if (this.gameConfig.scenes.length > 0) {
        try {
          await this.loadInitialScene();
        } catch (error) {
          console.warn("场景加载失败，使用基本场景:", error);
          this.createBasicScene();
        }
      } else {
        console.warn("未找到场景配置，创建基本场景");
        this.createBasicScene();
      }

      gameEngine.addUpdateCallback(this.update.bind(this));

      this.isInitialized = true;

      // 移除状态消息
      statusDiv.remove();

      // 显示游戏菜单
      uiManager.showComponent("menu");

      console.log("游戏初始化完成");
    } catch (error: any) {
      console.error("游戏初始化失败:", error);
      this.showError("游戏初始化失败：" + (error?.message || "未知错误"));
    }
  }

  private createBasicScene(): void {
    // 创建一个基本的测试场景
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 0, -5);

    gameEngine.scene.add(cube);

    // 添加地面平面
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0; // 确保地面在y=0位置
    gameEngine.scene.add(plane);

    // 添加基本光照
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    gameEngine.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    gameEngine.scene.add(directionalLight);

    // 创建碰撞对象数组并设置给PlayerController
    const collisionObjects = [cube, plane];
    this.playerController.setCollisionObjects(collisionObjects);
    this.lidarSystem.rebuild();

    console.log("创建了基本测试场景，包含地面和碰撞检测");
  }

  private setupEventListeners(): void {
    eventBus.on("game:start", this.startGame.bind(this));
    eventBus.on("scene:changed", this.onSceneChanged.bind(this));
    eventBus.on("player:moved", this.onPlayerMoved.bind(this));

    // LiDAR扫描事件监听
    eventBus.on("lidar:startScan", () => {
      if (this.isLiDARMode) {
        this.lidarSystem.startScan();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.code === "KeyL") this.toggleLiDARMode();
      if (event.code === "KeyC" && this.isLiDARMode) this.lidarSystem.clear();
      // 保留一些旧的键盘快捷键作为备用
      if (event.code === "KeyV" && this.isLiDARMode)
        this.lidarSystem.startScan();
    });
  }

  private async loadInitialScene(): Promise<void> {
    const initialSceneId = this.gameConfig.scenes[0]?.id;
    if (!initialSceneId) {
      console.warn("没有初始场景配置");
      return;
    }

    console.log(`开始加载初始场景: ${initialSceneId}`);
    await sceneManager.loadScene(initialSceneId);

    // 获取碰撞对象并验证
    const collisionObjects = sceneManager.getCollisionObjects(initialSceneId);
    console.log(
      `场景 ${initialSceneId} 中找到 ${collisionObjects.length} 个碰撞对象`
    );

    if (collisionObjects.length === 0) {
      console.warn("场景中没有碰撞对象，这可能导致玩家掉落");
    }

    this.playerController.setCollisionObjects(collisionObjects);
    this.lidarSystem.rebuild();

    // 设置玩家初始位置
    const sceneConfig = sceneManager.getSceneConfig(initialSceneId);
    if (sceneConfig && sceneConfig.spawnPoint) {
      const spawnPoint = sceneConfig.spawnPoint;
      const spawnPos = new THREE.Vector3(
        spawnPoint.x,
        spawnPoint.y,
        spawnPoint.z
      );
      console.log(`设置玩家生成点:`, spawnPos);
      this.playerController.teleport(spawnPos, sceneConfig.spawnRotation);
    }

    // 处理交互对象
    if (sceneConfig) {
      sceneConfig.interactions.forEach((interaction) => {
        // 确保position是THREE.Vector3对象
        if (interaction.position && typeof interaction.position === "object") {
          const pos = interaction.position as any;
          if (
            typeof pos.x === "number" &&
            typeof pos.y === "number" &&
            typeof pos.z === "number"
          ) {
            // 创建新的Vector3对象
            const vector3Pos = new THREE.Vector3(pos.x, pos.y, pos.z);
            interaction.position = vector3Pos;
          }
        }

        // 确保size是THREE.Vector3对象
        if (interaction.size && typeof interaction.size === "object") {
          const size = interaction.size as any;
          if (
            typeof size.x === "number" &&
            typeof size.y === "number" &&
            typeof size.z === "number"
          ) {
            // 创建新的Vector3对象
            const vector3Size = new THREE.Vector3(size.x, size.y, size.z);
            interaction.size = vector3Size;
          }
        }

        interactionManager.registerInteraction(interaction);
      });
    }
  }

  private async startGame(): Promise<void> {
    if (!this.isInitialized) return;

    const initialSceneId = this.gameConfig.scenes[0]?.id;
    if (initialSceneId) {
      await sceneManager.changeScene(initialSceneId);
      gameState.changeScene(initialSceneId);
    }

    gameEngine.start();
    uiManager.showComponent("hud");
    gameState.setFlag("game_started", true);
  }

  private async onSceneChanged(data: {
    from: string;
    to: string;
  }): Promise<void> {
    await sceneManager.changeScene(data.to);

    const collisionObjects = sceneManager.getCollisionObjects(data.to);
    this.playerController.setCollisionObjects(collisionObjects);
    this.lidarSystem.rebuild();

    const sceneConfig = sceneManager.getSceneConfig(data.to);
    if (sceneConfig) {
      sceneConfig.interactions.forEach((interaction) => {
        interactionManager.registerInteraction(interaction);
      });
      this.playerController.teleport(
        sceneConfig.spawnPoint,
        sceneConfig.spawnRotation
      );
    }
  }

  private onPlayerMoved(data: { position: any }): void {
    const hudComponent = uiManager.getComponent("hud") as any;
    if (hudComponent && hudComponent.updateCoordinates) {
      const pos = data.position;
      hudComponent.updateCoordinates(pos.x, pos.y, pos.z);
    }
  }

  private toggleLiDARMode(): void {
    this.setLiDARMode(!this.isLiDARMode);
  }

  private setLiDARMode(enabled: boolean): void {
    this.isLiDARMode = enabled;
    this.lidarSystem.setEnabled(enabled);
    sceneManager.setLightingMode(enabled ? "dark" : "normal");

    const hudComponent = uiManager.getComponent("hud") as any;
    if (hudComponent && hudComponent.updateMode) {
      hudComponent.updateMode(enabled ? "LiDAR" : "Normal");
    }
  }

  private update(deltaTime: number): void {
    uiManager.update(deltaTime);
  }

  private showError(message: string): void {
    const errorElement = document.createElement("div");
    errorElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      z-index: 9999;
      text-align: center;
      max-width: 80%;
    `;
    errorElement.textContent = message;
    document.body.appendChild(errorElement);
  }
}

// 创建并启动游戏
const game = new Game();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    game.initialize();
  });
} else {
  game.initialize();
}

(window as any).game = game;
