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

    // 点云系统
    this.PointLimit = 150000;
    this.nextWrite = 0;
    this.positions = new Float32Array(this.PointLimit * 3);
    this.colors = new Float32Array(this.PointLimit * 3);
    this.goem = new THREE.BufferGeometry();
    this.goem.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3)
    );
    this.goem.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));

    this.scaleSiz = 6; // 增大点的大小使其可见
    this.fovMultiplier = 1.5; //投射相对于相机视野的倍率

    // 创建圆形点的纹理
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");

    // 绘制圆形
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 2;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    context.fillStyle = "white";
    context.fill();
    const texture = new THREE.CanvasTexture(canvas);

    const mat = new THREE.PointsMaterial({
      size: this.scaleSiz,
      vertexColors: true,
      sizeAttenuation: false, // 禁用距离衰减，保持固定大小
      map: texture,
      transparent: true,
      alphaTest: 0.1,
    });
    this.points = new THREE.Points(this.goem, mat);
    this.points.visible = true;
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    //truetrue
    this.baseIntensity = new Float32Array(this.PointLimit);
    this.lifeTime = new Float32Array(this.PointLimit);
    this.lifeRes = new Float32Array(this.PointLimit);
    this.Intensity = new Float32Array(this.PointLimit);
    this.lastIntensity = new Float32Array(this.PointLimit);
    this.baseColors = new Float32Array(this.PointLimit * 3);
    this.Intensity_multi = new Float32Array(this.PointLimit);
    this.liveLong = new Uint8Array(this.PointLimit);

    //distance
    this.rayMaxDistance = 10;

    // 重用Ray对象以避免内存泄漏和递归引用问题
    this.reusableRay = new this.rapier.Ray(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 }
    );

    // 点渲染队列系统
    this.pointQueue = []; // 待渲染的点队列
    this.pointsPerFrame = 300; // 每帧渲染的点数量
    this.queueProcessingEnabled = true; // 是否启用队列处理

    //updateflag
    this.needPositionUpdate = false;
    this.needColorUpdate = false;

    console.log("🎯 RayCaster 射线投射器已初始化");
  }

  // 添加点到队列而不是立即渲染
  addPointToQueue(point) {
    if (this.pointQueue.length < this.PointLimit) {
      this.pointQueue.push(point);
    }
  }

  // 批量添加点到队列
  addPointsToQueue(points) {
    this.pointQueue.push(...points);
  }

  // 处理队列中的点（在update中调用）
  processPointQueue() {
    if (!this.queueProcessingEnabled || this.pointQueue.length === 0) {
      return;
    }

    const pointsToProcess = Math.min(
      this.pointsPerFrame,
      this.pointQueue.length
    );

    for (let i = 0; i < pointsToProcess; i++) {
      const point = this.pointQueue.shift();
      this.writePoint(point);
    }
  }

  // 设置每帧渲染点数
  setPointsPerFrame(count) {
    this.pointsPerFrame = Math.max(1, count);
  }

  // 清空队列
  clearQueue() {
    this.pointQueue = [];
    console.log("🧹 点队列已清空");
  }

  // 获取队列状态
  getQueueStatus() {
    return {
      queueLength: this.pointQueue.length,
      pointsPerFrame: this.pointsPerFrame,
      enabled: this.queueProcessingEnabled,
    };
  }

  get pointCount() {
    return Math.min(this.nextWrite, this.PointLimit);
  }

  writePoint(point) {
    const index = this.nextWrite % this.PointLimit;
    const base = index * 3;
    this.positions[base] = point.x;
    this.positions[base + 1] = point.y;
    this.positions[base + 2] = point.z;

    this.lifeTime[index] = point.lifeTime;
    this.baseIntensity[index] = point.baseIntensity;
    this.lastIntensity[index] = point.baseIntensity;
    this.lifeRes[index] = point.lifeTime;
    this.Intensity[index] = point.baseIntensity;

    // 保存基础颜色
    this.baseColors[base] = point.colors.r;
    this.baseColors[base + 1] = point.colors.g;
    this.baseColors[base + 2] = point.colors.b;

    // 设置当前颜色
    this.colors[base] = point.colors.r;
    this.colors[base + 1] = point.colors.g;
    this.colors[base + 2] = point.colors.b;

    this.Intensity_multi[index] = point.Intensity_multi || 1;
    this.liveLong[index] = point.live_long || false;

    this.nextWrite++;
    this.needPositionUpdate = true;
    this.needColorUpdate = true;
  }

  updatePoint(deltaTime) {
    // 首先处理点队列
    this.processPointQueue();

    const count = this.pointCount;
    let colorNeedsUpdate = false;
    const minIntensityRatio = 0.2; // 最低亮度比例

    for (let i = 0; i < count; i++) {
      this.lifeRes[i] -= deltaTime * this.Intensity_multi[i];

      // 确保生命时间不为负
      if (this.lifeRes[i] < 0) this.lifeRes[i] = 0;

      let currentIntensityRatio =
        this.lifeTime[i] > 0 ? this.lifeRes[i] / this.lifeTime[i] : 0;

      // 如果是 live_long 点，则应用最低亮度
      if (this.liveLong[i]) {
        currentIntensityRatio = Math.max(
          currentIntensityRatio,
          minIntensityRatio
        );
      }

      this.Intensity[i] = this.baseIntensity[i] * currentIntensityRatio;

      // 如果强度有显著变化，更新颜色
      if (Math.abs(this.lastIntensity[i] - this.Intensity[i]) > 0.01) {
        this.lastIntensity[i] = this.Intensity[i];
        const base = i * 3;

        // 使用最终计算出的亮度比例来更新颜色
        this.colors[base] = this.baseColors[base] * currentIntensityRatio; // R
        this.colors[base + 1] =
          this.baseColors[base + 1] * currentIntensityRatio; // G
        this.colors[base + 2] =
          this.baseColors[base + 2] * currentIntensityRatio; // B

        colorNeedsUpdate = true;
      }
    }

    // 更新相关attributes
    if (colorNeedsUpdate || this.needColorUpdate) {
      this.goem.attributes.color.needsUpdate = true;
      this.needColorUpdate = false;
    }

    if (this.needPositionUpdate) {
      // 更新drawRange以确保渲染正确数量的点
      this.goem.setDrawRange(0, this.pointCount);
      this.goem.attributes.position.needsUpdate = true;
      this.goem.computeBoundingSphere();
      this.needPositionUpdate = false;
    }
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

    // 重用Ray对象而不是每次创建新的，避免内存泄漏
    this.reusableRay.origin.x = origin.x;
    this.reusableRay.origin.y = origin.y;
    this.reusableRay.origin.z = origin.z;
    this.reusableRay.dir.x = normalizedDirection.x;
    this.reusableRay.dir.y = normalizedDirection.y;
    this.reusableRay.dir.z = normalizedDirection.z;

    //换一个case，不需要求出法向量
    const hit = this.world.castRay(
      this.reusableRay,
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

      const intensity_drop =
        entity && entity.properties ? entity.properties.intensity_drop || 1 : 1;

      const live_long =
        entity && entity.properties
          ? entity.properties.live_long || false
          : false;

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
        intensity_drop: intensity_drop,
        live_long: live_long,
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
   * @param {number} lifeTimeValue
   * @param {number} intensity_drop
   * @param {boolean} live_long
   */
  makeLightPoint(
    position,
    color,
    lifeTimeValue = 15,
    intensity_drop = 1,
    live_long = false
  ) {
    const colorObj = new THREE.Color(color);
    const point = {
      x: position.x,
      y: position.y,
      z: position.z,
      colors: {
        r: colorObj.r,
        g: colorObj.g,
        b: colorObj.b,
      },
      lifeTime: lifeTimeValue,
      baseIntensity: 1,
      Intensity_multi: intensity_drop,
      live_long: live_long,
    };

    // 使用队列系统以实现平滑的点渲染效果
    this.addPointsToQueue([point]);
  }

  updateLightPoints(deltaTime) {
    this.updatePoint(deltaTime);
  }

  clearAllPoint() {
    // 清空所有位置和颜色数据
    this.positions.fill(0);
    this.colors.fill(0);

    // 清空生命周期和强度数据
    this.baseIntensity.fill(0);
    this.lifeTime.fill(0);
    this.lifeRes.fill(0);
    this.Intensity.fill(0);

    // 重置写入指针
    this.nextWrite = 0;

    // 标记几何体需要更新
    this.goem.attributes.position.needsUpdate = true;
    this.goem.attributes.color.needsUpdate = true;

    console.log("🗑️ 所有射线点已清除");
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
    const colorObj = new THREE.Color(result.color);
    let ratio = 1.0 - result.distance / distance;
    ratio = Math.min(1.0, ratio * 1.3);
    colorObj.r *= ratio;
    colorObj.g *= ratio;
    colorObj.b *= ratio;
    this.makeLightPoint(
      result.point,
      colorObj.getHex(),
      15,
      result.intensity_drop,
      result.live_long
    );
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
    density = 1,
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
    console.log("🗑️ RayCaster 射线投射器已销毁");
  }
}
