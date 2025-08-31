/**
 * 3D场景模块 - Rapier.js版本
 * 基于Three.js和Rapier.js的高性能3D渲染和物理系统
 */

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Player } from "./Player.js";
import { RayCaster } from "./RayCaster.js";

export class Scene {
  constructor(core) {
    this.core = core;
    this.element = null;

    //射线冷却
    this.cooldown = 0.1;
    this.coolrest = 0.1;
    this.flashlight = false; //是否射出一次粒子

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
    this.RayCaster = null;

    // 【新增】用于管理场景中的模型和光照
    this.worldModels = null; // 存放所有非玩家模型的容器
    this.ambientLight = null;
    this.directionalLight = null;

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
    this.setUpRayCaster();
    this.setupPlayer();

    // 检查Lidar模式
    this.check_lidar();

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
    this.renderer.setClearColor(0x000000, 1); // 默认背景设为黑色

    this.element = document.createElement("div");
    this.element.className = "scene-container";
    this.element.appendChild(this.renderer.domElement);

    window.addEventListener("resize", () => this.handleResize());
  }
  /**
   * 设置RayCaster
   */
  setUpRayCaster() {
    this.RayCaster = new RayCaster(
      this.scene,
      this.world,
      this.rapier,
      this.core
    );
  }

  handleInput(event) {
    if (event.type === "pointerlockchange") {
      console.log("🔒 指针锁定:", document.mouse_locked ? "已锁定" : "已解锁");
    }
    // 传递给player
    this.player.handleInput(event);
    return 1;
  }

  /**
   * [核心] 切换Lidar模式
   */
  toggleLidar() {
    if (!this.core.script.lidar) {
      this.activate_lidar();
    } else {
      this.deactivate_lidar();
    }
  }

  check_lidar() {
    if (this.core.script.lidar) {
      this.activate_lidar();
    } else {
      this.deactivate_lidar();
    }
  }

  /**
   * [核心] 激活Lidar模式
   */
  activate_lidar() {
    console.log("🛰️ 激活 Lidar 模式");
    this.core.script.lidar = true;

    // 1. 移除光照
    this.removeLighting();

    // 2. 隐藏所有3D模型
    if (this.worldModels) {
      this.worldModels.visible = false;
    }

    // 3. 确保背景为纯黑
    this.renderer.setClearColor(0x000000, 1);

    // 4. 清除现有的粒子效果，重新开始
    this.RayCaster.clearAllPoint();
  }

  /**
   * [核心] 关闭Lidar模式 (恢复正常模式)
   */
  deactivate_lidar() {
    console.log("🌞 恢复正常渲染模式");
    this.core.script.lidar = false;

    // 1. 添加光照
    this.setupLighting();

    // 2. 显示所有3D模型
    if (this.worldModels) {
      this.worldModels.visible = true;
    }

    // 3. 清除Lidar粒子效果，避免残留
    this.RayCaster.clearAllPoint();
  }

  /**
   * 设置场景
   */
  setupScene() {
    this.scene = new THREE.Scene();
    // 【修改】创建一个Group来容纳所有模型
    this.worldModels = new THREE.Group();
    this.scene.add(this.worldModels);
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
   * [修改] 设置光照
   */
  setupLighting() {
    // 如果光照已存在，则不再重复创建
    if (this.ambientLight || this.directionalLight) return;

    this.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.ambientLight.name = "ambientLight"; // 命名方便调试
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.name = "directionalLight";
    this.directionalLight.position.set(10, 10, 5);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.setScalar(1024);
    this.scene.add(this.directionalLight);
  }

  /**
   * [修改] 移除光照
   */
  removeLighting() {
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
    if (this.directionalLight) {
      this.scene.remove(this.directionalLight);
      this.directionalLight = null;
    }
  }

  /**
   * 设置玩家
   */
  setupPlayer() {
    this.player = new Player(
      this.world,
      this.rapier,
      this.RayCaster,
      this.camera,
      this.core
    );
    this.element.appendChild(this.player.element);
  }

  /**
   * 加载模型实体
   */
  async load(entityId) {
    if (!this.world || !this.scene) await this.init();

    const entityConfig = window.core.getEntity(entityId);
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

      this.worldModels.add(model);
      entityConfig.model = model;

      model.updateMatrixWorld(true);

      const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(
        0,
        0,
        0
      );
      const body = this.world.createRigidBody(bodyDesc);

      entityConfig.body = body;
      entityConfig.colliders = []; // 新增：用于跟踪所有碰撞体

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
          const collider = this.world.createCollider(colliderDesc, body);

          // 将创建的碰撞体句柄存起来
          entityConfig.colliders.push(collider);

          createdCollider = true;
          collider.userData = { entityId: entityId, entityType: "static" };
        }
      });
      if (!createdCollider) {
        console.warn(
          `⚠️ 在 ${entityConfig.name} 中未找到任何有效的可索引网格！将不会创建物理体。`
        );
      }
      console.log(`✅ 实体已加载: ${entityConfig.name}`);
    } catch (error) {
      console.error(`❌ 实体加载失败: ${entityId}`, error);
    }
  }

  /**
   * 刷新实体碰撞箱
   * 此方法通过销毁旧的碰撞体并根据模型新位置重新创建它们来工作。
   * @param {string} entityId - 要刷新的实体的ID
   */
  refreshEntityCollider(entityId) {
    const entityConfig = window.core.getEntity(entityId);
    if (
      !entityConfig ||
      !entityConfig.body ||
      !entityConfig.model ||
      !entityConfig.colliders
    ) {
      console.warn(`⚠️ 无法刷新实体，缺少必要组件: ${entityId}`);
      return;
    }

    const model = entityConfig.model;
    const body = entityConfig.body; // 这是那个在(0,0,0)的RigidBody

    // 销毁并移除所有旧的碰撞体
    for (const collider of entityConfig.colliders) {
      // Rapier的世界需要一个有效的句柄来移除，我们直接用存储的对象
      this.world.removeCollider(collider, false);
    }
    entityConfig.colliders = []; // 清空存储列表

    // 使用模型的“新”世界矩阵，重新创建所有碰撞体
    model.updateMatrixWorld(true);

    model.traverse((child) => {
      if (child.isMesh && child.geometry && child.geometry.index) {
        child.updateWorldMatrix(true, false);
        const worldMatrix = child.matrixWorld; // 获取最新的世界矩阵
        const vertices = child.geometry.attributes.position.array;
        const indices = child.geometry.index.array;
        const transformedVertices = new Float32Array(vertices.length);
        const tempVec = new THREE.Vector3();

        // 重新“烘焙”顶点
        for (let i = 0; i < vertices.length; i += 3) {
          tempVec.fromArray(vertices, i);
          tempVec.applyMatrix4(worldMatrix);
          tempVec.toArray(transformedVertices, i);
        }

        const colliderDesc = this.rapier.ColliderDesc.trimesh(
          transformedVertices,
          indices
        );

        // 将新创建的碰撞体附加到同一个位于原点的 body 上
        const newCollider = this.world.createCollider(colliderDesc, body);
        entityConfig.colliders.push(newCollider); // 存储新的碰撞体句柄
        newCollider.userData = { entityId: entityId, entityType: "static" };
      }
    });

    if (this.isDebug) {
      console.log(`🔄 已通过销毁重建的方式刷新实体 ${entityId} 的碰撞箱`);
    }
  }

  /**
   * 开始游戏
   */
  spawn() {
    if (!this.isRunning) this.start();
    console.log("🎮 游戏已开始");
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
    const deltaTime = Math.min(this.clock.getDelta(), 1 / 60);

    this.RayCaster.updateLightPoints(deltaTime);
    this.coolrest -= deltaTime;
    //开启手电筒
    if (this.coolrest <= 0 && this.flashlight) {
      this.coolrest = this.cooldown;
      this.RayCaster.scatterLightPoint(
        this.camera,
        10,
        20,
        this.player.collider
      );
      this.flashlight = false;
    }

    this.animationId = requestAnimationFrame(() => this.animate());

    this.updatePlayer(deltaTime);
    this.updatePhysics(deltaTime);

    if (this.debugRenderer && this.isDebug) {
      this.debugRenderer.update();
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 更新debug
   */
  updateDebug() {
    if (this.debugRenderer && this.core.script.debug) {
      this.debugRenderer.update();
    }
  }

  /**
   * 删除调试信息
   */
  clearDebug() {
    if (this.debugRenderer) {
      this.debugRenderer.clear();
    }
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
    if (this.RayCaster) this.RayCaster.destroy();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
    console.log("🗑️ 场景已销毁");
  }
}

class RapierDebugRenderer {
  // ... RapierDebugRenderer 类代码保持不变 ...
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mesh = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true })
    );
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    console.log("🐛 物理调试渲染器已初始化");
  }
  update() {
    const { vertices, colors } = this.world.debugRender();
    this.mesh.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );
    this.mesh.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 4)
    );
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();
  }
  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    console.log("🐛 物理调试渲染器已销毁");
  }
  clear() {
    this.mesh.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(0), 3)
    );
    this.mesh.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(0), 4)
    );
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();
  }
}
