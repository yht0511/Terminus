/**
 * 红色怪物脚本
 * 脚本定义了怪物的寻路、行为和交互逻辑。
 * 使用 three-pathfinding 库进行 AI 寻路。
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { Pathfinding } from "three-pathfinding";

export default class RedMonster {
  constructor(id) {
    this.id = id;
    this.self = window.core.getEntity(this.id);

    this.name = this.self.name || "红色怪物";
    this.isActive = false;
    this.moving = false;

    this.platformId = this.self.properties.platform;
    this.navmesh = null;
    this.pathfinding = null;
    this.ZONE = "level";
    this.isPathfindingInitialized = false;

    this.init();
    console.log(`👾 ${this.name} 脚本已加载`);

    setInterval(() => {
      if (!this.moving) {
        this.gotoPlayer();
      }
    }, 1000);
  }

  init() {
    this.initPathfinding();
  }

  initPathfinding() {
    const platformEntity = window.core.getEntity(this.platformId);
    if (!platformEntity) {
      console.error(`❌ 寻路错误: 未找到平台实体 '${this.platformId}'。`);
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
          return;
        }

        const mainModel = window.core.scene.models[platformEntity.id]?.model;
        if (!mainModel) {
          return;
        }

        mainModel.add(this.navmesh);
        this.navmesh.updateMatrixWorld(true);

        const worldGeometry = this.navmesh.geometry
          .clone()
          .applyMatrix4(this.navmesh.matrixWorld);
        const nonIndexedGeometry = worldGeometry.toNonIndexed();

        this.pathfinding = new Pathfinding();
        const zone = Pathfinding.createZone(nonIndexedGeometry);
        this.pathfinding.setZoneData(this.ZONE, zone);
        this.isPathfindingInitialized = true;

        this.navmesh.material = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
        });
        this.navmesh.visible = true;

        console.log(`✅ ${this.name} 的寻路系统初始化完毕。`);
      },
      undefined,
      (error) => {
        console.error(`❌ 导航网格加载失败:`, error);
      }
    );
  }

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

    const closestNodeToStart = this.pathfinding.getClosestNode(
      worldStart,
      this.ZONE,
      groupID
    );
    const closestNodeToEnd = this.pathfinding.getClosestNode(
      worldEnd,
      this.ZONE,
      groupID
    );

    if (!closestNodeToStart || !closestNodeToEnd) {
      console.log("❌ 寻路失败: 无法找到有效的起始或结束导航多边形。");
      return null;
    }
    const clampedStart = new THREE.Vector3().copy(closestNodeToStart.centroid);
    const clampedEnd = new THREE.Vector3().copy(closestNodeToEnd.centroid);

    const path = this.pathfinding.findPath(
      clampedStart,
      clampedEnd,
      this.ZONE,
      groupID
    );
    if (path && path.length > 0) {
      console.log("✅ 寻路成功: ", path);
      return path;
    } else {
      console.log("❌ 寻路失败");
      return null;
    }
  }

  move(start, end, callback, max_step = 0) {
    const path = this.getPath(start, end);
    this.moving = true;

    if (path) {
      // 执行移动
      const model = window.core.scene.models[this.id]?.model;
      let i = 0;
      const moveStep = () => {
        if (i >= path.length || (i >= max_step && max_step > 0)) {
          this.moving = false;
          if (callback) callback(0);
          return;
        }
        // 目标点
        const target = path[i];
        // 当前距离
        const distance = model.position.distanceTo(target);
        // 步长（可调整速度）
        const step = Math.min(0.05, distance);

        if (distance > 0.01) {
          // 按比例移动到目标点
          model.position.lerp(target, step / distance);
          setTimeout(moveStep, 16); // 约60FPS
        } else {
          // 到达当前目标点，进入下一个
          model.position.copy(target);
          i++;
          setTimeout(moveStep, 16);
        }
        window.core.scene.refreshEntityCollider(this.id);
      };
      moveStep();
    } else {
      this.moving = false;
      if (callback) callback(1);
    }
  }

  gotoPlayer(callback) {
    const model = window.core.scene.models[this.id]?.model;
    const worldStart = model.position.clone();
    const target = window.core.getEntity("self").properties.coordinates;
    const worldEnd = new THREE.Vector3(target[0], target[1], target[2]);
    this.move(worldStart, worldEnd, callback, 2);
  }

  /**
   * 当玩家与怪物交互时调用
   */
  ontouch() {
    console.log(`👋 ${this.name} 被触摸了！`);
    this.triggerAnimation();
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
