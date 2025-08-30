/**
 * 射线投射器模块
 * 基于Rapier.js物理引擎的射线检测功能，用于碰撞检测和场景查询
 */

import * as THREE from "three";

export class RayCaster {
  constructor(scene, world, rapier) {
    if(!scene|| !rapier|| !world) {
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
    this.lifeTime = 2;
    this.scalex = 0.06;
    this.scaley = 0.06;
    this.fovMultiplier = 1.5; //投射相对于相机视野的倍率

    // 射线配置
    this.config = {
      // 默认射线参数
      defaultMaxDistance: 100.0,        // 默认最大检测距离
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
        distance: distance,                    // 碰撞距离
        point: hitPoint,                      // 碰撞点坐标
        colliderHandle: hit.collider.handle,  // 碰撞体句柄
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
  castFromCamera(camera, distance = 10, excludeCollider = null) {
    const origin = camera.position.clone();
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);

    const maxDistance = distance !== null ? distance : this.config.defaultMaxDistance;
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
      lifeTimeRest: lifeTime
    };
    this.scene.add(sprite);
    this.lightPoints.push(point);
  }

  updateLightPoints(deltaTime) {
    for(let i = this.lightPoints.length - 1; i >= 0; i--) {
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
   * @param {THREE.camera} camera
   * @param {number} distance 
   * @param {collider} exclude_collider 
   */
  castLightPointForward(origin, direction, distance  = 10, exclude_collider = null) {
    const result = this.cast(origin, direction, distance, exclude_collider);
    if(result == null) return;
    this.makeLightPoint(result.point, this.lifeTime);
  }

  /**
   * 模拟手电筒发射大量发光点
   * @param {THREE.camera} camera 相机
   * @param {number} distance 检测距离
   * @param {number} density 发光点生成密度
   * @param {number} fovMultiplier 相机视野倍率，默认1.5倍
   */
  scatterLightPoint(camera, distance = 10, density = 1, exclude_collider = null) {
    // 基于密度计算光点数量（密度为1时约900个光点）
    const fovMultiplier = this.fovMultiplier;
    const numPoints = Math.floor(1200 * density);
    
    // 使用相机FOV的倍率来计算光锥角度
    const coneAngle = (camera.fov * fovMultiplier) * Math.PI / 180 / 2; // 相机FOV * 倍率 / 2（取半角）
    const coneDirection = new THREE.Vector3(0, 0, -1); // 相机的前方向
    coneDirection.applyQuaternion(camera.quaternion);
    
    // 获取相机位置作为发射原点
    const origin = camera.position.clone();
    
    // 批量发射光点
    for (let i = 0; i < numPoints; i++) {
      // 在光锥范围内生成随机方向
      const randomDirection = this.generateRandomDirectionInCone(coneDirection, coneAngle);
      
      // 使用固定的最大距离
      this.castLightPointForward(origin, randomDirection, distance, exclude_collider);
    }
    
    console.log(`🔦 手电筒发射了 ${numPoints} 个光点 (密度: ${density}, 视野倍率: ${fovMultiplier}x, 光锥角度: ${(coneAngle * 180 / Math.PI).toFixed(1)}°)`);
  }
  
  /**
   * 在圆锥范围内生成随机方向向量
   * @param {THREE.Vector3} centerDirection 圆锥中心方向
   * @param {number} coneAngle 圆锥半角（弧度）
   * @returns {THREE.Vector3} 归一化的随机方向向量
   */
  generateRandomDirectionInCone(centerDirection, coneAngle) {
    // 生成球面上的随机点
    const phi = Math.random() * 2 * Math.PI; // 方位角
    const cosTheta = Math.cos(coneAngle * Math.random()); // 极角的余弦
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    
    // 球坐标转笛卡尔坐标
    const x = sinTheta * Math.cos(phi);
    const y = sinTheta * Math.sin(phi);
    const z = cosTheta;
    
    // 创建本地方向向量
    const localDirection = new THREE.Vector3(x, y, z);
    
    // 计算从(0,0,1)到centerDirection的旋转四元数
    const up = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, centerDirection);
    
    // 将本地方向转换到世界坐标系
    localDirection.applyQuaternion(quaternion);
    
    return localDirection.normalize();
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
