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
    this.PointLimit = 1500000;
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
    this.pointsPerFrame = 30000; // 每帧渲染的点数量
    this.queueProcessingEnabled = true; // 是否启用队列处理

    //updateflag
    this.needPositionUpdate = false;
    this.needColorUpdate = false;

    // LIDAR 扫描相关状态
    this.activeScan = null; // {startTime,duration,rows,rowDirections,totalRays,emittedRows,distance,exclude,origin,camera}
    this.scanDuration = 300; // ms 每次点击 0.5s
    this.currentLaserSamples = []; // 当前帧用于画激光的世界点
    this.laserSampleRatio = 0.15; // 每行采样比例 (0~1)
    this.columnJitterRatio = 0.45; // 列随机抖动比例 (0~1)，0 关闭，0.45 适中

    // 叠加层: 激光与信息显示 (2D)
    this._initOverlay();

    console.log("🎯 RayCaster 射线投射器已初始化");
  }

  _initOverlay() {
    // 全屏 Canvas 画激光
    this.lidarCanvas = document.createElement("canvas");
    this.lidarCanvas.id = "lidar-overlay";
    Object.assign(this.lidarCanvas.style, {
      position: "fixed",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 999,
    });
    document.body.appendChild(this.lidarCanvas);
    this.lidarCtx = this.lidarCanvas.getContext("2d");
    const resize = () => {
      this.lidarCanvas.width = window.innerWidth;
      this.lidarCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // 信息显示
    this.infoDiv = document.createElement("div");
    Object.assign(this.infoDiv.style, {
      position: "fixed",
      bottom: "6px",
      right: "8px",
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#0f0",
      background: "rgba(0,0,0,0.55)",
      padding: "6px 10px",
      borderRadius: "6px",
      lineHeight: "1.3",
      pointerEvents: "none",
      zIndex: 1000,
      whiteSpace: "nowrap",
    });
    document.body.appendChild(this.infoDiv);
    this.lastGeneratedPerClick = 0;
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
    // 先推进扫描进度（会生成新的点进入队列）
    this._updateActiveScan();
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

    // 绘制激光与信息
    this._drawLasers();
    this._updateInfoPanel();
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
    ratio *= ratio;
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
    return result; // 返回用于采样激光
  }

  /**
   * 模拟手电筒发射大量发光点 (角度上均匀分布)
   * @param {THREE.Camera} camera 相机
   * @param {number} distance 检测距离
   * @param {number} density 发光点生成密度
   * @param {object} exclude_collider 要排除的碰撞体
   */
  // 启动一次 LIDAR 式自上而下扫描 (替换原先的散射手电筒)
  scatterLightPoint(
    camera,
    distance = 10,
    density = 1,
    exclude_collider = null
  ) {
    // 使用屏幕(视锥)按“扫描线”方式：从上到下逐行；每行从左到右均匀取样
    const origin = camera.position.clone();
    const rows = Math.max(12, Math.round(40 * Math.sqrt(density))); // 行数
    const colsBase = Math.max(60, Math.round(60 * Math.sqrt(density))); // 基础列数（最宽行使用）
    const rowDirections = this._buildScreenRowDirections(
      camera,
      rows,
      colsBase
    );
    // 统计总射线数
    let totalRays = 0;
    for (const row of rowDirections) totalRays += row.length;

    this.activeScan = {
      startTime: performance.now(),
      duration: this.scanDuration,
      rows,
      rowDirections,
      totalRays,
      emittedRows: 0,
      distance,
      exclude: exclude_collider,
      origin,
      camera,
    };
    this.currentLaserSamples = [];
    this.lastGeneratedPerClick = totalRays; // 记录本次点击理论产生数量
    // 立即清理旧的激光画布
    if (this.lidarCtx)
      this.lidarCtx.clearRect(
        0,
        0,
        this.lidarCanvas.width,
        this.lidarCanvas.height
      );
  }

  // 构建屏幕行扫描: rows 行, 每行自左到右;
  // 列数可按行的“可视宽度”做一点缩放(这里简单用固定列数)
  _buildScreenRowDirections(camera, rows, colsBase) {
    const rowDirections = [];
    const overscan = this.fovMultiplier; // >1 可放大覆盖
    for (let r = 0; r < rows; r++) {
      // NDC y: 1 顶部 -> -1 底部
      const ny = 1 - (r / (rows - 1)) * 2; // 映射到 [1,-1]
      const row = [];
      const cols = colsBase; // 可改为随 ny 调整
      for (let c = 0; c < cols; c++) {
        // 线性基础位置
        const baseX = -1 + (c / (cols - 1)) * 2; // -1(left) -> 1(right)
        let nx = baseX;
        if (this.columnJitterRatio > 0 && c !== 0 && c !== cols - 1) {
          const step = 2 / (cols - 1);
          // 在 +/- step * ratio 范围内抖动
          const jitter =
            (Math.random() * 2 - 1) * step * this.columnJitterRatio;
          nx = Math.min(1, Math.max(-1, baseX + jitter));
        }
        const ndc = new THREE.Vector3(nx * overscan, ny * overscan, 0.5);
        const world = ndc.clone().unproject(camera);
        const dir = world.sub(camera.position).normalize();
        row.push(dir);
      }
      rowDirections.push(row);
    }
    return rowDirections;
  }

  _updateActiveScan() {
    if (!this.activeScan) return;
    const now = performance.now();
    const {
      startTime,
      duration,
      rows,
      rowDirections,
      emittedRows,
      distance,
      exclude,
      origin,
      camera,
    } = this.activeScan;
    let progress = (now - startTime) / duration;
    if (progress > 1) progress = 1;
    // 期望已发出的行数
    const rowsShouldEmit = Math.floor(progress * rows);
    if (rowsShouldEmit > emittedRows) {
      for (let r = emittedRows; r < rowsShouldEmit; r++) {
        const dirs = rowDirections[r];
        const samples = [];
        for (let d = 0; d < dirs.length; d++) {
          const res = this.castLightPointForward(
            origin,
            dirs[d],
            distance,
            exclude
          );
          if (res && res.point) samples.push(res.point.clone());
        }
        // 随机采样部分点用于激光 (当前行)
        if (samples.length) {
          const want = Math.max(
            1,
            Math.round(samples.length * this.laserSampleRatio)
          );
          // 随机洗牌简单实现
          for (let i = samples.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [samples[i], samples[j]] = [samples[j], samples[i]];
          }
          this.currentLaserSamples = samples.slice(0, want);
        }
        this.activeScan.emittedRows++;
      }
    }
    if (progress >= 1) {
      // 扫描结束, 保留最后的点但停止更新激光
      this.activeScan = null;
      // 让激光最后一帧显示后在下一帧被清除
      setTimeout(() => (this.currentLaserSamples = []), 60);
    }
  }

  _drawLasers() {
    if (!this.lidarCtx) return;
    const ctx = this.lidarCtx;
    ctx.clearRect(0, 0, this.lidarCanvas.width, this.lidarCanvas.height);
    if (!this.currentLaserSamples.length) return;
    const cam = this.activeScan ? this.activeScan.camera : this.core.camera;
    if (!cam) return;
    const w = this.lidarCanvas.width;
    const h = this.lidarCanvas.height;
    const origin2D = { x: w - 4, y: h - 4 }; // 右下角
    ctx.lineWidth = 1;
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.currentLaserSamples) {
      const sp = this._worldToScreen(p, cam, w, h);
      if (!sp) continue;
      ctx.beginPath();
      const grad = ctx.createLinearGradient(origin2D.x, origin2D.y, sp.x, sp.y);
      // 红色激光: 起点亮红 -> 终点淡红
      grad.addColorStop(0, "rgba(255,40,40,0.95)");
      grad.addColorStop(0.5, "rgba(255,0,0,0.55)");
      grad.addColorStop(1, "rgba(255,60,60,0.15)");
      ctx.strokeStyle = grad;
      ctx.moveTo(origin2D.x, origin2D.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
    }
  }

  _worldToScreen(vec3, camera, w, h) {
    const p = vec3.clone().project(camera);
    if (p.z > 1) return null; // 背面不画
    return {
      x: (p.x * 0.5 + 0.5) * w,
      y: (-p.y * 0.5 + 0.5) * h,
    };
  }

  _updateInfoPanel() {
    if (!this.infoDiv) return;
    this.infoDiv.textContent = `points: ${this.pointCount} | per-click: ${this.lastGeneratedPerClick}`;
  }

  destroy() {
    this.clearAllPoint();
    if (this.lidarCanvas && this.lidarCanvas.parentNode)
      this.lidarCanvas.parentNode.removeChild(this.lidarCanvas);
    if (this.infoDiv && this.infoDiv.parentNode)
      this.infoDiv.parentNode.removeChild(this.infoDiv);
    console.log("🗑️ RayCaster 射线投射器已销毁");
  }
}
