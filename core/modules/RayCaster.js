/**
 * 射线投射器模块
 * 基于Rapier.js物理引擎的射线检测功能，用于碰撞检测和场景查询
 */

import * as THREE from "three";

export class RayCaster {
  constructor(scene, world, rapier) {
    if (!scene || !rapier || !world) {
      console.error("RayCaster 初始化失败: 缺少对象");
    }
    this.scene = scene;
    this.world = world;
    this.rapier = rapier;

    // 精灵射线投射器
    this.spriteTexture = this.loadTexture();
    this.lightPoints = [];
    this.spriteMaterial = new THREE.SpriteMaterial({
      color: 0x6a9955,
      //map: this.spriteTexture,
      transparent: true,
      opacity: 1,
    });
    this.lifeTime = 5;
    this.scalex = 0.06;
    this.scaley = 0.06;
    this.fovMultiplier = 1.5; //投射相对于相机视野的倍率

    // 射线配置
    this.config = {
      // 默认射线参数
      defaultMaxDistance: 100.0, // 默认最大检测距离
    };
    console.log("🎯 RayCaster 射线投射器已初始化");
  }

  loadTexture() {
    return null;
  }

  /**
   * 核心射线投射操作
   * @param {THREE.Vector3} origin 射线起点
   * @param {THREE.Vector3} direction 射线方向（单位向量）
   * @param {number} maxDistance 最大检测距离
   * @param {Array} excludeColliders 要过滤掉的碰撞体数组
   * @returns {Object|null} 碰撞结果对象，如果没有碰撞则返回null
   */
  cast(origin, direction, maxDistance = null, excludeCollider = null) {
    // 参数验证
    if (!origin || !direction) {
      console.warn("⚠️ RayCaster: 缺少必要参数 origin 或 direction");
      return null;
    }

    // 使用默认距离如果未指定
    const distance =
      maxDistance !== null ? maxDistance : this.config.defaultMaxDistance;

    // 确保方向向量是归一化的
    const normalizedDirection = direction.clone().normalize();

    // 创建Rapier射线
    const ray = new this.rapier.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      {
        x: normalizedDirection.x,
        y: normalizedDirection.y,
        z: normalizedDirection.z,
      }
    );

    // 执行射线检测
    const hit = this.world.castRayAndGetNormal(
      ray,
      distance,
      true,
      undefined, //filterFlag
      undefined, //filterGroup
      excludeCollider //filterCollider
    );

    if (hit) {
      const distance = hit.timeOfImpact;
      const hitPoint = new THREE.Vector3(
        origin.x + normalizedDirection.x * distance,
        origin.y + normalizedDirection.y * distance,
        origin.z + normalizedDirection.z * distance
      );

      // 获取碰撞体的用户数据
      const userData = hit.collider.userData;
      if (userData == undefined) {
        console.log("碰撞箱未检测到userData!");
        return null;
      }

      const result = {
        distance: distance, // 碰撞距离
        point: hitPoint, // 碰撞点坐标
        colliderHandle: hit.collider.handle, // 碰撞体句柄
        userData: userData || {}, // 用户数据
        entityId: userData ? userData.entityId : null,
      };

      //console.log(`🎯 射线命中: 距离=${result.distance.toFixed(3)}, 实体=${result.entityId || 'unknown'}, 坐标=(${result.point.x.toFixed(2)}, ${result.point.y.toFixed(2)}, ${result.point.z.toFixed(2)})`);
      return result;
    }

    return null;
  }

  /**
   * 从位置沿指定方向检测
   * @param {THREE.Vector3} position 起始位置
   * @param {THREE.Vector3} directionVector 方向向量（可以不是单位向量）
   * @param {Array} excludeColliders 要排除的碰撞体数组
   * @returns {Object|null} 碰撞结果
   */
  castFromPosition(position, directionVector, excludeCollider = null) {
    const distance = directionVector.length();
    const direction = directionVector.clone().normalize();

    return this.cast(position, direction, distance, excludeCollider);
  }

  /**
   * 相机前方射线检测
   * @param {THREE.Camera} camera Three.js相机对象
   * @param {number} distance 检测距离
   * @param {Array} excludeColliders 要排除的碰撞体数组
   * @returns {Object|null} 碰撞结果
   */
  castFromCamera(camera, distance = 10, excludeCollider = null) {
    const origin = camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    const maxDistance =
      distance !== null ? distance : this.config.defaultMaxDistance;
    return this.cast(origin, direction, maxDistance, excludeCollider);
  }

  /**
   * 从相机视角获取一个方向
   * @param {THREE.camera} camera
   * @returns
   */
  generateDirection(camera) {
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    return direction;
  }

  makeLightPoint(position, lifeTime = this.lifeTime) {
    const sprite = new THREE.Sprite(this.spriteMaterial.clone());
    sprite.position.set(position.x, position.y, position.z);
    sprite.scale.set(this.scalex, this.scaley, 1);
    const point = {
      sprite: sprite,
      lifeTimeTotal: lifeTime,
      lifeTimeRest: lifeTime,
    };
    this.scene.add(sprite);
    this.lightPoints.push(point);
  }

  updateLightPoints(deltaTime) {
    //若节点过多，生命流逝更快
    deltaTime = deltaTime * Math.max(1, this.lightPoints.length / 1000);

    for (let i = this.lightPoints.length - 1; i >= 0; i--) {
      const point = this.lightPoints[i];
      point.lifeTimeRest -= deltaTime;
      point.sprite.material.opacity = point.lifeTimeRest / point.lifeTimeTotal;
      if (point.lifeTimeRest <= 0) {
        this.scene.remove(point.sprite);
        this.lightPoints.splice(i, 1);
        point.sprite.material.dispose();
      }
    }
  }

  /**
   * 清除所有发光点
   */
  clearAllPoint() {
    for (const point of this.lightPoints) {
      this.scene.remove(point.sprite);
      point.sprite.material.dispose();
    }
    this.lightPoints = [];
  }

  /**
   * 从指定位置沿指定方向发射一个光点
   * @param {THREE.Vector3} origin
   * @param {THREE.Vector3} direction
   * @param {number} distance
   * @param {object} exclude_collider
   */
  castLightPointForward(
    origin,
    direction,
    distance = 10,
    exclude_collider = null
  ) {
    const result = this.cast(origin, direction, distance, exclude_collider);
    if (result == null) return;
    this.makeLightPoint(result.point, this.lifeTime);
  }

  /**
   * [已修改] 模拟手电筒发射大量发光点 (角度上均匀分布)
   * @param {THREE.Camera} camera 相机
   * @param {number} distance 检测距离
   * @param {number} density 发光点生成密度
   * @param {object} exclude_collider 要排除的碰撞体
   */
  scatterLightPoint(
    camera,
    distance = 10,
    density = 0.8,
    exclude_collider = null
  ) {
    // 1. 计算光锥参数
    const origin = camera.position.clone();
    const coneAngle = (camera.fov * this.fovMultiplier * Math.PI) / 180 / 2; // 圆锥半角（弧度）
    const coneDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    );

    // 2. 根据密度确定环数和最大分段数
    const numRings = Math.max(2, Math.round(10 * Math.sqrt(density))); // 径向环数
    const maxSegments = Math.max(3, Math.round(25 * Math.sqrt(density))); // 最外层环的分段数
    let castedPoints = 0;

    // 3. 建立一个与相机方向对齐的局部坐标系 (右、上向量)
    const tempUp = new THREE.Vector3(0, 1, 0);
    // 防止光锥中心方向与临时up向量平行或反向平行
    if (Math.abs(coneDirection.dot(tempUp)) > 0.999) {
      tempUp.set(1, 0, 0); // 如果平行，则换一个正交的向量
    }
    const localX = new THREE.Vector3()
      .crossVectors(tempUp, coneDirection)
      .normalize();
    const localY = new THREE.Vector3()
      .crossVectors(coneDirection, localX)
      .normalize();

    // 4. 循环生成每个环上的点
    // 先发射中心点
    this.castLightPointForward(
      origin,
      coneDirection,
      distance,
      exclude_collider
    );
    castedPoints++;

    for (let i = 1; i <= numRings; i++) {
      const theta = (i / numRings) * coneAngle; // 当前环的极角

      // 当前环的分段数应与周长成正比，以保持点间距大致相等
      const numSegments = Math.max(
        1,
        Math.round((maxSegments * Math.sin(theta)) / Math.sin(coneAngle))
      );

      for (let j = 0; j < numSegments; j++) {
        const phi = (j / numSegments) * 2 * Math.PI; // 当前点的方位角

        // 5. 使用球坐标和局部坐标系计算最终的世界坐标方向
        const direction = localX
          .clone()
          .multiplyScalar(Math.sin(theta) * Math.cos(phi))
          .add(localY.clone().multiplyScalar(Math.sin(theta) * Math.sin(phi)))
          .add(coneDirection.clone().multiplyScalar(Math.cos(theta)));

        this.castLightPointForward(
          origin,
          direction.normalize(),
          distance,
          exclude_collider
        );
        castedPoints++;
      }
    }

    console.log(
      `🔦 手电筒以角度均匀模式发射了 ${castedPoints} 个光点 (密度: ${density}, 环数: ${numRings}, 最大分段: ${maxSegments})`
    );
  }

  /**
   * 销毁射线投射器
   */
  destroy() {
    this.clearAllPoint();
    this.spriteMaterial.dispose();
    this.lightPoints = [];
    console.log("🗑️ RayCaster 射线投射器已销毁");
  }
}
