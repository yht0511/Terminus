/**
 * 射线投射器模块
 * 基于Rapier.js物理引擎的射线检测功能，用于碰撞检测和场景查询
 */

import * as THREE from "three";

export class RayCaster {
  constructor(scene, world, rapier, core) {
    if (!scene || !rapier || !world || !core) {
      console.error("RayCaster 初始化失败: 缺少对象");
    }
    this.scene = scene;
    this.world = world;
    this.rapier = rapier;
    this.core = core;

    // 精灵射线投射器
    this.spriteTexture = this.loadTexture();
    this.lightPoints = [];
    this.spriteMaterial = new THREE.SpriteMaterial({
      // 删除了 color 属性，因为每个粒子都会有自己的颜色
      // map: this.spriteTexture,
      transparent: true,
      opacity: 1,
    });
    this.lifeTime = 15;
    this.scalex = 0.03;
    this.scaley = 0.03;
    this.fovMultiplier = 1.5; //投射相对于相机视野的倍率

    // 射线配置
    this.config = {
      defaultMaxDistance: 100.0,
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
   * @param {object} excludeCollider 要过滤掉的碰撞体
   * @returns {Object|null} 碰撞结果对象，如果没有碰撞则返回null
   */
  cast(origin, direction, maxDistance = null, excludeCollider = null) {
    if (!origin || !direction) {
      console.warn("⚠️ RayCaster: 缺少必要参数 origin 或 direction");
      return null;
    }

    const distance =
      maxDistance !== null ? maxDistance : this.config.defaultMaxDistance;
    const normalizedDirection = direction.clone().normalize();

    const ray = new this.rapier.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      {
        x: normalizedDirection.x,
        y: normalizedDirection.y,
        z: normalizedDirection.z,
      }
    );

    const hit = this.world.castRayAndGetNormal(
      ray,
      distance,
      true,
      undefined,
      undefined,
      excludeCollider
    );

    if (hit) {
      const entityId = hit.collider.userData.entityId;
      const entity = window.core.getEntity(entityId);
      const color =
        entity && entity.properties
          ? entity.properties.lidar_color || 0xffffff
          : 0xffffff;

      const hitDistance = hit.timeOfImpact;
      const hitPoint = new THREE.Vector3(
        origin.x + normalizedDirection.x * hitDistance,
        origin.y + normalizedDirection.y * hitDistance,
        origin.z + normalizedDirection.z * hitDistance
      );

      const userData = hit.collider.userData;
      if (userData == undefined) {
        console.log("碰撞箱未检测到userData!");
        return null;
      }

      const result = {
        distance: hitDistance,
        point: hitPoint,
        colliderHandle: hit.collider.handle,
        userData: userData || {},
        entityId: userData.entityId || null,
        color: color,
      };

      // console.log(`🎯 射线命中: 实体=${result.entityId}, 颜色=${result.color.toString(16)}`);
      return result;
    }

    return null;
  }

  /**
   * 从位置沿指定方向检测
   * @param {THREE.Vector3} position 起始位置
   * @param {THREE.Vector3} directionVector 方向向量（可以不是单位向量）
   * @param {object} excludeCollider 要排除的碰撞体
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
   * @param {object} excludeCollider 要排除的碰撞体
   * @returns {Object|null} 碰撞结果
   */
  castFromCamera(camera, distance = 10, excludeCollider = null) {
    const origin = camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    );
    const maxDistance =
      distance !== null ? distance : this.config.defaultMaxDistance;
    return this.cast(origin, direction, maxDistance, excludeCollider);
  }

  generateDirection(camera) {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    );
    return direction;
  }

  /**
   * 创建一个带有指定颜色的光点
   * @param {THREE.Vector3} position
   * @param {number} color
   * @param {number} lifeTime
   */
  makeLightPoint(position, color, lifeTime = this.lifeTime) {
    // 复制基础材质并设置本次的颜色
    const material = this.spriteMaterial.clone();
    material.color.set(color);

    const sprite = new THREE.Sprite(material);
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
    deltaTime *= Math.min(2, Math.max(1, this.lightPoints.length / 1000));
    for (let i = this.lightPoints.length - 1; i >= 0; i--) {
      const point = this.lightPoints[i];
      point.lifeTimeRest -= deltaTime;
      point.sprite.material.opacity = point.lifeTimeRest / point.lifeTimeTotal;
      if (point.lifeTimeRest <= 0) {
        this.scene.remove(point.sprite);
        point.sprite.material.dispose(); // 释放材质资源
        this.lightPoints.splice(i, 1);
      }
    }
  }

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

    // 使用从 result 中获取的颜色和位置来创建光点
    this.makeLightPoint(result.point, result.color, this.lifeTime);
  }

  /**
   * 模拟手电筒发射大量发光点 (角度上均匀分布)
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
    const origin = camera.position.clone();
    const coneAngle = (camera.fov * this.fovMultiplier * Math.PI) / 180 / 2;
    const coneDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    );
    const numRings = Math.max(2, Math.round(10 * Math.sqrt(density)));
    const maxSegments = Math.max(3, Math.round(25 * Math.sqrt(density)));
    let castedPoints = 0;
    const tempUp = new THREE.Vector3(0, 1, 0);
    if (Math.abs(coneDirection.dot(tempUp)) > 0.999) {
      tempUp.set(1, 0, 0);
    }
    const localX = new THREE.Vector3()
      .crossVectors(tempUp, coneDirection)
      .normalize();
    const localY = new THREE.Vector3()
      .crossVectors(coneDirection, localX)
      .normalize();
    this.castLightPointForward(
      origin,
      coneDirection,
      distance,
      exclude_collider
    );
    castedPoints++;
    for (let i = 1; i <= numRings; i++) {
      const theta = (i / numRings) * coneAngle;
      const numSegments = Math.max(
        1,
        Math.round((maxSegments * Math.sin(theta)) / Math.sin(coneAngle))
      );
      for (let j = 0; j < numSegments; j++) {
        const phi = (j / numSegments) * 2 * Math.PI;
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

  destroy() {
    this.clearAllPoint();
    this.spriteMaterial.dispose();
    this.lightPoints = [];
    console.log("🗑️ RayCaster 射线投射器已销毁");
  }
}
