/**
 * 3D场景模块 - Rapier.js版本
 * 基于Three.js和Rapier.js的高性能3D渲染和物理系统
 */

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Player } from "./Player.js";

export class Scene {
  constructor(core) {
    this.core = core;
    this.element = null;

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
    this.interactables = new Map(); // 可交互对象

    // 射线检测
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3; // 交互距离

    // 渲染状态
    this.isRunning = false;
    this.animationId = null;

    console.log("🎬 3D场景模块已初始化 (Rapier版)");
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
    this.setupTestObjects();

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

    // 创建容器
    this.element = document.createElement("div");
    this.element.className = "scene-container";
    this.element.appendChild(this.renderer.domElement);

    // 响应式处理
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
    const gravity = new this.rapier.Vector3(0.0, -9.81, 0.0);
    this.world = new this.rapier.World(gravity);

    // 创建地面
    const groundColliderDesc = this.rapier.ColliderDesc.cuboid(
      50,
      0.1,
      50
    ).setTranslation(0, -0.1, 0);
    this.world.createCollider(groundColliderDesc);

    // 地面视觉
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x4a7c59,
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);
  }

  /**
   * 设置光照
   */
  setupLighting() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    // 主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.setScalar(1024);
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
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
    // 交互控制
    document.addEventListener("keydown", (event) => {
      // E键交互
      if (event.code === "KeyE") {
        this.handleInteraction();
      }
    });

    document.addEventListener("click", () => {
      if (!document.pointerLockElement) {
        this.renderer.domElement.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.renderer.domElement;
      console.log("🔒 指针锁定:", locked);
    });
  }

  /**
   * 设置测试对象
   */
  setupTestObjects() {
    // 简单的参考立方体
    for (let i = 0; i < 5; i++) {
      const size = 1.6;
      const geometry = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(i * 0.2, 0.7, 0.5),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((i - 2) * 3, size / 2, -5);
      mesh.castShadow = true;
      this.scene.add(mesh);

      // 物理体
      const rigidBodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(
        mesh.position.x,
        mesh.position.y,
        mesh.position.z
      );
      const body = this.world.createRigidBody(rigidBodyDesc);

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
    if (!this.world || !this.scene) {
      await this.init();
    }

    const entityConfig = this.core.getEntity(entityId);
    if (!entityConfig || !entityConfig.path) {
      console.warn(`⚠️ 实体配置无效: ${entityId}`);
      return;
    }

    try {
      console.log(`🔄 加载实体: ${entityConfig.name}`);

      const model = await this.core.resources.loadModel(entityConfig.path);
      const coords = entityConfig.properties.coordinates;

      // 直接使用原始尺寸，不进行缩放
      model.position.set(coords[0], coords[1], coords[2]);

      // 计算边界框用于碰撞体
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      console.log(`📏 ${entityConfig.name} 尺寸:`, {
        width: size.x.toFixed(2),
        height: size.y.toFixed(2),
        depth: size.z.toFixed(2),
      });

      // 设置阴影
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.scene.add(model);

      // 暂时禁用设施碰撞体来测试玩家位置
      console.log(`⚠️ 设施碰撞体已禁用用于调试`);

      // 临时设置空的body和collider
      const body = null;
      const collider = null;

      // 存储实体信息
      const entityData = {
        config: entityConfig,
        model,
        body,
        collider,
      };

      this.entities.set(entityId, entityData);

      // 如果有交互回调，添加到可交互对象
      if (entityConfig.touch_callback) {
        this.interactables.set(entityId, entityData);
        console.log(`🤝 ${entityConfig.name} 可交互`);
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
    if (!this.camera || this.interactables.size === 0) return;

    // 从相机位置发射射线
    const origin = this.camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);

    this.raycaster.set(origin, direction);

    // 收集所有可交互对象的模型
    const interactableModels = [];
    for (const [id, entity] of this.interactables) {
      if (entity.model) {
        interactableModels.push({ model: entity.model, id, entity });
      }
    }

    // 检测相交
    const intersects = this.raycaster.intersectObjects(
      interactableModels.map((item) => item.model),
      true
    );

    if (intersects.length > 0) {
      // 找到最近的可交互对象
      const hit = intersects[0];
      let targetEntity = null;

      for (const item of interactableModels) {
        if (
          item.model === hit.object ||
          item.model.children.includes(hit.object)
        ) {
          targetEntity = item;
          break;
        }
      }

      if (targetEntity) {
        console.log(`🤝 与 ${targetEntity.entity.config.name} 交互`);
        this.executeInteraction(targetEntity.id, targetEntity.entity);
      }
    } else {
      console.log("❌ 没有可交互的对象");
    }
  }

  /**
   * 执行交互回调
   */
  async executeInteraction(entityId, entity) {
    const callbacks = entity.config.touch_callback;
    if (!callbacks || !Array.isArray(callbacks)) return;

    for (const callback of callbacks) {
      try {
        // 解析回调字符串，例如 "red_monster.ontouch($name)"
        const match = callback.match(/(\w+)\.(\w+)\(([^)]*)\)/);
        if (match) {
          const [, scriptId, method, params] = match;

          // 获取脚本实例
          const scriptInstance = this.core.scripts.instances.get(scriptId);
          if (scriptInstance && typeof scriptInstance[method] === "function") {
            // 替换参数
            const processedParams = params.replace("$name", entity.config.name);

            console.log(
              `⚡ 执行交互: ${scriptId}.${method}(${processedParams})`
            );
            await scriptInstance[method](processedParams);
          } else {
            console.warn(`⚠️ 找不到交互方法: ${scriptId}.${method}`);
          }
        }
      } catch (error) {
        console.error("❌ 交互执行失败:", error);
      }
    }
  }

  /**
   * 开始游戏
   */
  spawn() {
    if (!this.isRunning) {
      this.start();
    }
    this.showStartHint();
    console.log("🎮 游戏已开始");
  }

  /**
   * 显示开始提示
   */
  showStartHint() {
    const hint = document.createElement("div");
    hint.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      z-index: 1000;
      cursor: pointer;
      font-family: Arial, sans-serif;
    `;
    hint.innerHTML = `
      <h3>🎮 点击开始游戏</h3>
      <p>WASD - 移动 | 鼠标 - 视角 | 空格 - 跳跃 | E - 交互</p>
    `;

    hint.onclick = () => {
      this.renderer.domElement.requestPointerLock();
      hint.remove();
    };

    document.body.appendChild(hint);
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

    const deltaTime = Math.min(this.clock.getDelta(), 1 / 30);

    this.updatePlayer(deltaTime);
    this.updatePhysics(deltaTime);

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 更新玩家
   */
  updatePlayer(deltaTime) {
    if (!this.player) return;
    
    this.player.update(deltaTime);

    // 每3秒打印一次玩家位置用于调试
    if (
      Math.floor(this.clock.elapsedTime) % 3 === 0 &&
      this.clock.elapsedTime - Math.floor(this.clock.elapsedTime) < deltaTime
    ) {
      const pos = this.player.getPosition();
      const vel = this.player.getVelocity();
      console.log(
        `👤 玩家位置: (${pos.x.toFixed(1)}, ${pos.y.toFixed(
          1
        )}, ${pos.z.toFixed(1)}) 速度: (${vel.x.toFixed(1)}, ${vel.y.toFixed(
          1
        )}, ${vel.z.toFixed(1)})`
      );
    }
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
    if (!this.element) {
      this.init();
    }
    return this.element;
  }

  /**
   * 停止渲染
   */
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  /**
   * 销毁场景
   */
  destroy() {
    this.stop();
    if (this.player) {
      this.player.destroy();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.world) {
      this.world.free();
    }
    console.log("🗑️ 场景已销毁");
  }
}
