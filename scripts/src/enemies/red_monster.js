/**
 * 红色怪物脚本
 * 脚本定义了怪物的寻路、行为和交互逻辑。
 * 使用 three-pathfinding 库进行 AI 寻路。
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { Pathfinding } from "three-pathfinding";

export default class RedMonster {
  /**
   * @param {string} id - 怪物的实体ID
   */
  constructor(id) {
    // --- 核心属性 ---
    this.id = id;
    this.self = window.core.getEntity(this.id);
    this.name = this.self.name || "红色怪物";
    this.isActive = false;

    // --- 寻路相关属性 ---
    this.platformId = this.self.properties.platform;
    this.navmesh = null;
    this.pathfinding = null;
    this.ZONE = "level";
    this.isPathfindingInitialized = false;

    this.init();
    console.log(`👾 ${this.name} 脚本已加载`);

    // --- 用于寻路测试的定时器 ---
    setInterval(() => {
      // 假设玩家或怪物在世界坐标 (0, 4.5, 0)
      const worldStart = new THREE.Vector3(0, 0, 0);
      const worldEnd = new THREE.Vector3(0, 0, 0.1); // 世界坐标中的另一个点

      this.getPath(worldStart, worldEnd);
    }, 2000);
  }

  /**
   * 初始化脚本
   */
  init() {
    this.initPathfinding();
  }

  /**
   * 初始化AI寻路系统
   */
  initPathfinding() {
    const platformEntity = window.core.getEntity(this.platformId);
    if (!platformEntity) {
      console.error(
        `❌ 寻路错误: 未找到平台实体 '${this.platformId}' 的配置。`
      );
      return;
    }

    const loader = new GLTFLoader();
    loader.load(
      platformEntity.mesh_path,
      (gltf) => {
        gltf.scene.traverse((node) => {
          if (node.isMesh) {
            this.navmesh = node;
          }
        });

        if (!this.navmesh) {
          console.error("❌ 寻路错误: 导航网格GLTF文件中不包含任何有效网格。");
          return;
        }

        const mainModel = platformEntity.model;
        if (!mainModel) {
          console.error(
            `❌ 寻路错误: 未能获取到平台 '${this.platformId}' 的3D模型对象。`
          );
          return;
        }

        // --- 核心修复流程 ---

        // 1. 建立父子关系，让导航网格在视觉上跟随主模型
        mainModel.add(this.navmesh);

        // 2. (关键!) 强制更新导航网格的世界矩阵
        // 这一步确保 navmesh.matrixWorld 包含了父级模型的所有变换
        this.navmesh.updateMatrixWorld(true);

        // 3. (关键!) 创建一个新的几何体，并将世界矩阵的变换“烘焙”进去
        const worldGeometry = this.navmesh.geometry
          .clone()
          .applyMatrix4(this.navmesh.matrixWorld);

        // --- 修复结束 ---

        // 4. 使用这个包含了世界坐标信息的几何体来初始化寻路区域
        this.pathfinding = new Pathfinding();
        const zone = Pathfinding.createZone(worldGeometry);
        this.pathfinding.setZoneData(this.ZONE, zone);
        this.isPathfindingInitialized = true;

        // 5. (调试) 将导航网格可视化，确认其视觉位置
        this.navmesh.material = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
        });
        this.navmesh.visible = true;

        console.log(
          `✅ ${this.name} 的寻路系统初始化完毕，并已附加到 '${this.platformId}'。`
        );
      },
      undefined,
      (error) => {
        console.error(`❌ 导航网格加载失败:`, error);
      }
    );
  }

  /**
   * 计算并返回从起点到终点的路径
   * @param {THREE.Vector3} worldStart - 起始点的世界坐标
   * @param {THREE.Vector3} worldEnd - 终点的世界坐标
   * @returns {THREE.Vector3[] | null} 路径点数组，如果找不到则返回null
   */
  getPath(worldStart, worldEnd) {
    if (!this.isPathfindingInitialized) {
      return null;
    }

    const groupID = this.pathfinding.getGroup(this.ZONE, worldStart);
    if (groupID === null) {
      console.warn(
        `寻路警告: 起点 [${worldStart.x.toFixed(2)}, ${worldStart.y.toFixed(
          2
        )}, ${worldStart.z.toFixed(2)}] 不在导航网格上。`
      );
      return null;
    }

    const path = this.pathfinding.findPath(
      worldStart,
      worldEnd,
      this.ZONE,
      groupID
    );
    if (path && path.length > 0) {
      console.log("寻路成功: ", path);
      return path;
    } else {
      console.log("寻路失败: 未找到有效路径。");
      return null;
    }
  }
  /**
   * 当玩家与怪物交互时调用
   */
  ontouch() {
    console.log(`👋 ${this.name} 被触摸了！`);
    this.triggerAnimation();
  }

  /**
   * 触发一个简单的晃动动画
   */
  triggerAnimation() {
    const model = this.self.model; // 通过实体配置获取模型
    if (!model) return;

    const originalPosition = model.position.clone();
    let shakeCount = 0;
    const maxShakes = 10;

    const shake = () => {
      if (shakeCount >= maxShakes) {
        model.position.copy(originalPosition);
        return;
      }
      model.position.x = originalPosition.x + (Math.random() - 0.5) * 0.2;
      model.position.z = originalPosition.z + (Math.random() - 0.5) * 0.2;
      shakeCount++;
      setTimeout(shake, 50);
    };
    shake();
  }

  /**
   * 怪物AI的循环更新（由外部调用）
   * @param {number} deltaTime - 帧间隔时间
   */
  update(deltaTime) {
    if (this.isActive) {
      // 在这里实现巡逻、追击等AI逻辑
    }
  }

  /**
   * 激活怪物
   */
  activate() {
    this.isActive = true;
    console.log(`⚡ ${this.name} 已激活`);
  }

  /**
   * 停用怪物
   */
  deactivate() {
    this.isActive = false;
    console.log(`💤 ${this.name} 已停用`);
  }
}
