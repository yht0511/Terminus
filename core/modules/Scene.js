/**
 * 3D场景模块 - Rapier.js版本
 * 基于Three.js和Rapier.js的高性能3D渲染和物理系统
 */

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Player } from "./Player.js";
import { RapierDebugRenderer } from "./RapierDebugRenderer.js"; // 引入调试器

export class Scene {
  constructor(core) {
    this.core = core;
    this.element = null;

    // 【关键修正】恢复所有属性的初始化
    // Three.js组件
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock(); 

    // Rapier物理世界
    this.world = null;
    this.rapier = null;

    // 玩家对象
    this.player = null;

    // 游戏对象
    this.entities = new Map();
    this.interactables = new Map();

    // 射线检测
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3;

    // 渲染状态
    this.isRunning = false;
    this.animationId = null;

    // 物理调试器
    this.debugRenderer = null;

    this.isDebug = false;

    console.log("🎬 3D场景模块已初始化");
  }

  /**
   * 初始化场景
   */
  async init() {
    await this.initRapier();
    this.setupRenderer();
    this.setupScene();
    this.setupCamera();
    this.setupPhysics();
    this.setupLighting();
    this.setupPlayer();
    this.setupControls();
    // this.setupTestObjects();

    // 初始化物理调试渲染器
    this.debugRenderer = new RapierDebugRenderer(this.scene, this.world);

    this.isDebug = this.core.isDebug;
    if (this.isDebug) console.log("调试模式已启动.");

    console.log("✅ 3D场景初始化完成");
  }

  /**
   * 初始化Rapier物理引擎
   */
  async initRapier() {
    await RAPIER.init();
    this.rapier = RAPIER;
    console.log("⚡ Rapier物理引擎已初始化");
  }

  /**
   * 设置渲染器
   */
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x87ceeb, 1);

    this.element = document.createElement("div");
    this.element.className = "scene-container";
    this.element.appendChild(this.renderer.domElement);

    window.addEventListener("resize", () => this.handleResize());
  }

  /**
   * 设置场景
   */
  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, 10, 100);
  }

  /**
   * 设置相机
   */
  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 1.8, 5);
  }

  /**
   * 设置物理系统
   */
  setupPhysics() {
    const gravity = new this.rapier.Vector3(0.0, -29.81, 0.0);
    this.world = new this.rapier.World(gravity);
  }

  /**
   * 设置光照
   */
  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.setScalar(1024);
    this.scene.add(directionalLight);
  }

  /**
   * 设置玩家
   */
  setupPlayer() {
    this.player = new Player(this.world, this.rapier, this.scene, this.camera);
  }

  /**
   * 设置控制
   */
  setupControls() {
    document.addEventListener("keydown", (event) => {
      if (event.code === "KeyE") this.handleInteraction();
    });
    document.addEventListener("click", () => {
      if (!document.pointerLockElement)
        this.renderer.domElement.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      console.log(
        "🔒 指针锁定:",
        document.pointerLockElement === this.renderer.domElement
      );
    });
  }

  /**
   * 设置测试对象
   */
  setupTestObjects() {
    for (let i = 0; i < 5; i++) {
      const size = 1.6;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(i * 0.2, 0.7, 0.5),
        })
      );
      mesh.position.set((i - 2) * 3, size / 2, -5);
      mesh.castShadow = true;
      this.scene.add(mesh);

      const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(
        mesh.position.x,
        mesh.position.y,
        mesh.position.z
      );
      const body = this.world.createRigidBody(bodyDesc);
      const colliderDesc = this.rapier.ColliderDesc.cuboid(
        size / 2,
        size / 2,
        size / 2
      );
      this.world.createCollider(colliderDesc, body);
    }
  }

  /**
   * 加载模型实体
   */
  async load(entityId) {
    if (!this.world || !this.scene) await this.init();

    const entityConfig = this.core.getEntity(entityId);
    if (!entityConfig || !entityConfig.path) {
      console.warn(`⚠️ 实体配置无效: ${entityId}`);
      return;
    }

    try {
      console.log(`🔄 加载实体: ${entityConfig.name}`);
      const model = await this.core.resources.loadModel(entityConfig.path);
      const coords = entityConfig.properties.coordinates;

      model.position.set(coords[0], coords[1], coords[2]);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(model);

      // 必须在添加场景并设置位置后，再更新矩阵
      model.updateMatrixWorld(true);

      const isStatic = entityConfig.properties.is_static !== false;

      if (isStatic) {
        console.log(
          `✅ ${entityConfig.name} 是静态物体，使用 World-Space Trimesh`
        );
        const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(
          0,
          0,
          0
        );
        const body = this.world.createRigidBody(bodyDesc);
        let createdCollider = false;

        model.traverse((child) => {
          if (child.isMesh && child.geometry && child.geometry.index) {
            child.updateWorldMatrix(true, false);
            const worldMatrix = child.matrixWorld;
            const vertices = child.geometry.attributes.position.array;
            const indices = child.geometry.index.array;
            const transformedVertices = new Float32Array(vertices.length);
            const tempVec = new THREE.Vector3();

            for (let i = 0; i < vertices.length; i += 3) {
              tempVec.fromArray(vertices, i);
              tempVec.applyMatrix4(worldMatrix);
              tempVec.toArray(transformedVertices, i);
            }

            const colliderDesc = this.rapier.ColliderDesc.trimesh(
              transformedVertices,
              indices
            );
            this.world.createCollider(colliderDesc, body);
            createdCollider = true;
          }
        });

        if (!createdCollider) {
          console.warn(
            `⚠️ 在 ${entityConfig.name} 中未找到任何有效的可索引网格！将不会创建物理体。`
          );
        }
      } else {
        console.log(`🏃 ${entityConfig.name} 是动态物体，使用 Cuboid 碰撞体`);
        const bodyDesc = this.rapier.RigidBodyDesc.dynamic().setTranslation(
          model.position.x,
          model.position.y,
          model.position.z
        );
        const body = this.world.createRigidBody(bodyDesc);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const colliderDesc = this.rapier.ColliderDesc.cuboid(
          size.x / 2,
          size.y / 2,
          size.z / 2
        );
        this.world.createCollider(colliderDesc, body);
      }

      console.log(`✅ 实体已加载: ${entityConfig.name}`);
    } catch (error) {
      console.error(`❌ 实体加载失败: ${entityId}`, error);
    }
  }

  /**
   * 处理交互
   */
  handleInteraction() {
    // ... 您的交互逻辑 ...
  }

  /**
   * 开始游戏
   */
  spawn() {
    if (!this.isRunning) this.start();
    this.showStartHint();
    console.log("🎮 游戏已开始");
  }

  /**
   * 显示开始提示
   */
  showStartHint() {
    // ... 您的提示逻辑 ...
  }

  /**
   * 开始渲染
   */
  start() {
    this.isRunning = true;
    this.animate();
    console.log("▶️ 渲染已开始");
  }

  /**
   * 主渲染循环
   */
  animate() {
    if (!this.isRunning) return;
    this.animationId = requestAnimationFrame(() => this.animate());
    const deltaTime = Math.min(this.clock.getDelta(), 1 / 60);

    this.updatePlayer(deltaTime);
    this.updatePhysics(deltaTime);
    
    if (this.debugRenderer && this.isDebug) {
      this.debugRenderer.update();
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 更新玩家
   */
  updatePlayer(deltaTime) {
    if (this.player) this.player.update(deltaTime);
  }

  /**
   * 更新物理
   */
  updatePhysics(deltaTime) {
    this.world.step();
  }

  /**
   * 窗口大小变化处理
   */
  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * 渲染方法
   */
  render() {
    if (!this.element) this.init();
    return this.element;
  }

  /**
   * 停止渲染
   */
  stop() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  /**
   * 销毁场景
   */
  destroy() {
    this.stop();
    if (this.player) this.player.destroy();
    if (this.debugRenderer) this.debugRenderer.destroy();
    if (this.renderer) this.renderer.dispose();
    if (this.world) this.world.free();
    console.log("🗑️ 场景已销毁");
  }
}
