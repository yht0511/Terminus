/**
 * 射线投射器模块
 * 基于Rapier.js物理引擎的射线检测功能，用于碰撞检测和场景查询
 */

import * as THREE from "three";

export class RayCaster {
  constructor(world, rapier) {
    this.world = world;
    this.rapier = rapier;

    // 射线配置
    this.config = {
      // 默认射线参数
      defaultMaxDistance: 100.0,        // 默认最大检测距离
      rayMargin: 0.001,                 // 射线边距，避免浮点精度问题  
    };    
    console.log("🎯 RayCaster 射线投射器已初始化");
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
    const distance = maxDistance !== null ? maxDistance : this.config.defaultMaxDistance;
    
    // 确保方向向量是归一化的
    const normalizedDirection = direction.clone().normalize();

    // 创建Rapier射线
    const ray = new this.rapier.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: normalizedDirection.x, y: normalizedDirection.y, z: normalizedDirection.z }
    );

    // 执行射线检测
    const hit = this.world.castRayAndGetNormal(
      ray, distance, true,
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
      if(userData == undefined) {
        console.log("碰撞箱未检测到userData!");
        return null;
      }

      const result = {
        hasHit: true,
        distance: distance,                    // 碰撞距离
        point: hitPoint,                      // 碰撞点坐标
        normal: new THREE.Vector3(            // 碰撞面法向量
          hit.normal.x,
          hit.normal.y,
          hit.normal.z
        ),
        collider: hit.collider,               // 碰撞体对象
        colliderHandle: hit.collider.handle,  // 碰撞体句柄
        feature: hit.feature,                 // 碰撞特征
        userData: userData || {},             // 用户数据
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
  castFromCamera(camera, distance = null, excludeCollider = null) {
    const origin = camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);

    const maxDistance = distance !== null ? distance : this.config.defaultMaxDistance;
    return this.cast(origin, direction, maxDistance, excludeCollider);
  }

  /**
   * 销毁射线投射器
   */
  destroy() {
    console.log("🗑️ RayCaster 射线投射器已销毁");
  }
}
