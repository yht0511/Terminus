import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { gameEngine } from "@core/GameEngine";
import { eventBus } from "@core/EventBus";
import { resourceManager } from "@core/ResourceManager";
import type { SceneConfig } from "@core/types";

/**
 * 场景管理器
 * 负责加载、切换和管理游戏场景
 */
export class SceneManager {
  private static instance: SceneManager;
  private currentScene: string | null = null;
  private sceneConfigs = new Map<string, SceneConfig>();
  private loadedScenes = new Map<string, THREE.Group>();
  private gltfLoader = new GLTFLoader();

  // 光照管理
  private ambientLight!: THREE.AmbientLight;
  private directionalLight!: THREE.DirectionalLight;
  private sceneLights: THREE.Light[] = [];

  private isInitialized = false;

  private constructor() {
    // 不在构造函数中初始化，等待手动调用
  }

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  /**
   * 初始化SceneManager
   * 必须在GameEngine初始化之后调用
   */
  public initialize(): void {
    if (this.isInitialized) return;

    this.initializeLighting();
    this.setupEventListeners();
    this.isInitialized = true;
    console.log("SceneManager initialized");
  }

  /**
   * 初始化光照
   */
  private initializeLighting(): void {
    // 环境光
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    gameEngine.scene.add(this.ambientLight);

    // 定向光
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(10, 10, 5);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.setScalar(2048);
    this.directionalLight.shadow.camera.near = 0.1;
    this.directionalLight.shadow.camera.far = 50;
    this.directionalLight.shadow.camera.left = -10;
    this.directionalLight.shadow.camera.right = 10;
    this.directionalLight.shadow.camera.top = 10;
    this.directionalLight.shadow.camera.bottom = -10;
    gameEngine.scene.add(this.directionalLight);
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    eventBus.on("scene:changed", this.onSceneChanged.bind(this));
  }

  /**
   * 注册场景配置
   */
  public registerScene(config: SceneConfig): void {
    this.sceneConfigs.set(config.id, config);
  }

  /**
   * 批量注册场景配置
   */
  public registerScenes(configs: SceneConfig[]): void {
    configs.forEach((config) => this.registerScene(config));
  }

  /**
   * 加载场景
   */
  public async loadScene(sceneId: string): Promise<THREE.Group> {
    const config = this.sceneConfigs.get(sceneId);
    if (!config) {
      throw new Error(`Scene config not found: ${sceneId}`);
    }

    // 检查是否已加载
    if (this.loadedScenes.has(sceneId)) {
      return this.loadedScenes.get(sceneId)!;
    }

    console.log(`Loading scene: ${sceneId}`);

    try {
      // 加载GLTF模型
      const gltf = await this.loadGLTF(config.modelPath);
      const scene = gltf.scene;

      // 处理场景对象
      this.processSceneObjects(scene);

      // 缓存场景
      this.loadedScenes.set(sceneId, scene);

      console.log(`Scene loaded successfully: ${sceneId}`);
      eventBus.emit("scene:loaded", { sceneId });

      return scene;
    } catch (error) {
      console.error(`Failed to load scene: ${sceneId}`, error);

      // 创建一个基本的备用场景
      console.warn(`Creating fallback scene for: ${sceneId}`);
      const fallbackScene = this.createFallbackScene(sceneId);

      // 缓存备用场景
      this.loadedScenes.set(sceneId, fallbackScene);

      eventBus.emit("scene:loaded", { sceneId });
      return fallbackScene;
    }
  }

  /**
   * 加载GLTF模型
   */
  private loadGLTF(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`开始加载模型: ${path}`);

      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error(`模型加载超时: ${path}`));
      }, 30000); // 30秒超时

      this.gltfLoader.load(
        path,
        (gltf) => {
          clearTimeout(timeout);
          console.log(`模型加载成功: ${path}`);

          // 检查模型大小
          let vertexCount = 0;
          gltf.scene.traverse((child: any) => {
            if (child.geometry) {
              const positions = child.geometry.attributes.position;
              if (positions) {
                vertexCount += positions.count;
              }
            }
          });

          console.log(`模型顶点数: ${vertexCount}`);

          // 如果模型太大，进行简化
          if (vertexCount > 100000) {
            console.warn(`模型顶点数过多 (${vertexCount})，建议优化模型文件`);
          }

          resolve(gltf);
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(
              `加载进度: ${percent.toFixed(1)}% (${(
                progress.loaded /
                1024 /
                1024
              ).toFixed(2)}MB / ${(progress.total / 1024 / 1024).toFixed(2)}MB)`
            );
          } else {
            console.log(
              `已加载: ${(progress.loaded / 1024 / 1024).toFixed(2)}MB`
            );
          }
        },
        (error) => {
          clearTimeout(timeout);
          console.error(`模型加载失败: ${path}`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * 处理场景对象
   */
  private processSceneObjects(scene: THREE.Group): void {
    scene.traverse((object) => {
      // 处理网格
      if (object instanceof THREE.Mesh) {
        // 启用阴影
        object.castShadow = true;
        object.receiveShadow = true;

        // 优化材质
        if (object.material instanceof THREE.Material) {
          // 如果材质没有法线贴图，计算顶点法线
          if (!(object.material as any).normalMap && object.geometry) {
            object.geometry.computeVertexNormals();
          }
        }
      }

      // 处理光源
      if (object instanceof THREE.Light) {
        this.sceneLights.push(object);
      }
    });
  }

  /**
   * 创建备用场景
   */
  private createFallbackScene(sceneId: string): THREE.Group {
    const scene = new THREE.Group();
    scene.name = `fallback_${sceneId}`;

    // 创建一个基本的立方体作为参考点
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 1, -5);
    scene.add(cube);

    // 添加地面平面
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // 添加一些参考物体
    for (let i = 0; i < 5; i++) {
      const refGeometry = new THREE.SphereGeometry(0.5);
      const refMaterial = new THREE.MeshBasicMaterial({
        color: Math.random() * 0xffffff,
      });
      const sphere = new THREE.Mesh(refGeometry, refMaterial);
      sphere.position.set(
        (Math.random() - 0.5) * 10,
        0.5,
        (Math.random() - 0.5) * 10
      );
      scene.add(sphere);
    }

    console.log(`Created fallback scene for: ${sceneId}`);
    return scene;
  }

  /**
   * 切换场景
   */
  public async changeScene(
    sceneId: string,
    spawnPoint?: THREE.Vector3
  ): Promise<void> {
    const config = this.sceneConfigs.get(sceneId);
    if (!config) {
      throw new Error(`Scene config not found: ${sceneId}`);
    }

    // 卸载当前场景
    if (this.currentScene) {
      this.unloadCurrentScene();
    }

    // 加载新场景
    const scene = await this.loadScene(sceneId);

    // 添加到主场景
    gameEngine.scene.add(scene);

    // 更新当前场景
    this.currentScene = sceneId;

    console.log(`Scene changed to: ${sceneId}`);
  }

  /**
   * 卸载当前场景
   */
  private unloadCurrentScene(): void {
    if (!this.currentScene) return;

    const scene = this.loadedScenes.get(this.currentScene);
    if (scene) {
      gameEngine.scene.remove(scene);
    }

    // 清理场景光源
    this.sceneLights.forEach((light) => {
      if (light.parent) {
        light.parent.remove(light);
      }
    });
    this.sceneLights = [];
  }

  /**
   * 获取当前场景ID
   */
  public getCurrentSceneId(): string | null {
    return this.currentScene;
  }

  /**
   * 获取场景配置
   */
  public getSceneConfig(sceneId: string): SceneConfig | undefined {
    return this.sceneConfigs.get(sceneId);
  }

  /**
   * 获取当前场景配置
   */
  public getCurrentSceneConfig(): SceneConfig | undefined {
    return this.currentScene
      ? this.sceneConfigs.get(this.currentScene)
      : undefined;
  }

  /**
   * 获取场景碰撞对象
   */
  public getCollisionObjects(sceneId?: string): THREE.Object3D[] {
    const targetSceneId = sceneId || this.currentScene;
    if (!targetSceneId) return [];

    const scene = this.loadedScenes.get(targetSceneId);
    if (!scene) return [];

    const collisionObjects: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        collisionObjects.push(object);
      }
    });

    return collisionObjects;
  }

  /**
   * 设置光照模式
   */
  public setLightingMode(mode: "normal" | "dark"): void {
    switch (mode) {
      case "normal":
        this.ambientLight.visible = true;
        this.directionalLight.visible = true;
        this.sceneLights.forEach((light) => (light.visible = true));
        break;
      case "dark":
        this.ambientLight.visible = false;
        this.directionalLight.visible = false;
        this.sceneLights.forEach((light) => (light.visible = false));
        break;
    }
  }

  /**
   * 预加载场景
   */
  public async preloadScene(sceneId: string): Promise<void> {
    if (!this.loadedScenes.has(sceneId)) {
      await this.loadScene(sceneId);
    }
  }

  /**
   * 预加载多个场景
   */
  public async preloadScenes(sceneIds: string[]): Promise<void> {
    const promises = sceneIds.map((id) =>
      this.preloadScene(id).catch((error) => {
        console.warn(`Failed to preload scene: ${id}`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * 释放场景
   */
  public unloadScene(sceneId: string): void {
    const scene = this.loadedScenes.get(sceneId);
    if (scene) {
      // 如果是当前场景，先切换到空场景
      if (this.currentScene === sceneId) {
        this.unloadCurrentScene();
        this.currentScene = null;
      }

      // 清理资源
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          } else if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          }
        }
      });

      this.loadedScenes.delete(sceneId);
      console.log(`Scene unloaded: ${sceneId}`);
    }
  }

  /**
   * 场景切换事件处理
   */
  private onSceneChanged(data: { from: string; to: string }): void {
    console.log(`Scene transition: ${data.from} -> ${data.to}`);
  }

  /**
   * 清理所有场景
   */
  public dispose(): void {
    // 卸载当前场景
    this.unloadCurrentScene();

    // 清理所有加载的场景
    Array.from(this.loadedScenes.keys()).forEach((sceneId) => {
      this.unloadScene(sceneId);
    });

    // 清理光照
    gameEngine.scene.remove(this.ambientLight);
    gameEngine.scene.remove(this.directionalLight);

    this.sceneConfigs.clear();
    this.loadedScenes.clear();
    this.sceneLights = [];
  }
}

// 导出全局场景管理器实例
export const sceneManager = SceneManager.getInstance();
