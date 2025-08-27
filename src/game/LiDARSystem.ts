import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { gameEngine } from "@core/GameEngine";
import { eventBus } from "@core/EventBus";

// 更优雅的接口设计
export interface IPlayerProvider {
  getPosition(): THREE.Vector3;
  getRotation(): { pitch: number; yaw: number };
}

export interface LiDARConfig {
  maxDistance: number;
  pointSize: number;
  fade: boolean;
  pointLifetime: number;
  baseColor: THREE.ColorRepresentation;
  minIntensity: number;
  maxIntensity: number;
  raysPerFrame: number;
  burstRays: number;
  pointLimit: number;
  bvhBuildTimeBudgetMs: number;
  // 新的扫描配置
  scanDuration: number; // 扫描持续时间（秒）
  scanFOV: number; // 扫描视野角度
  scanLines: number; // 垂直扫描线数
  samplesPerLine: number; // 每行采样点数
  laserColor: THREE.ColorRepresentation; // 激光颜色
  // 材质颜色映射
  materialColors: Map<string, THREE.ColorRepresentation>;
}

export interface LiDAROptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  playerProvider: IPlayerProvider;
  worldRoots: THREE.Object3D[];
  config?: Partial<LiDARConfig>;
}

export class LiDARSystem {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly playerProvider: IPlayerProvider;
  private readonly worldRoots: THREE.Object3D[];
  private readonly config: LiDARConfig;

  private _raycaster = new THREE.Raycaster();
  private _azimuthSteps = 720; // 0.5°
  private _elevationSteps = 100; // 垂直层数
  private _currentAzimuth = 0;
  private _currentElevation = 0;
  private _points!: THREE.Points;
  private _positions!: Float32Array;
  private _colors!: Float32Array;
  private _times!: Float32Array;
  private _geom!: THREE.BufferGeometry;
  private _nextWrite = 0;
  private _meshes: THREE.Mesh[] = [];
  private _manual = true;
  private _fade = true;
  private _lifetime = 10; // 秒
  private _elapsed = 0;
  private _spawnTimes?: Float32Array;
  private _baseIntensities?: Float32Array;
  private _baseColor = new THREE.Color(0x00ff88);
  private _minIntensity = 0.15;
  private _needsBoundsUpdate = false;
  private _maxIntensity = 3;
  private _densityCell = 0.1;
  private _densityMaxPerCell = 100;
  private _densityMap: Map<string, number> = new Map();
  private _pendingBVH: THREE.Mesh[] = [];
  private _bvhBuilding = false;
  private _bvhTimeBudgetMs = 6;
  private _lastBVHLog = 0;

  // 扫描状态管理
  private _scanActive = false;
  private _scanProgress = 0; // 0-1 扫描进度
  private _scanStartTime = 0;
  private _currentScanLine = 0;

  // 激光线渲染
  private _laserLine?: THREE.Line;
  private _laserGeometry?: THREE.BufferGeometry;
  private _laserMaterial?: THREE.LineBasicMaterial;

  // 手部位置（相对于相机）
  private _handOffset = new THREE.Vector3(0.25, -0.2, -0.3);

  constructor(opts: LiDAROptions) {
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.playerProvider = opts.playerProvider;
    this.worldRoots = opts.worldRoots;

    // 配置默认值
    this.config = {
      maxDistance: 200,
      pointSize: 0.05,
      fade: true,
      pointLifetime: 10,
      baseColor: 0x00ff88,
      minIntensity: 0.15,
      maxIntensity: 3,
      raysPerFrame: 400,
      burstRays: 4000,
      pointLimit: 120000,
      bvhBuildTimeBudgetMs: 6,
      // 新的扫描配置默认值
      scanDuration: 0.5,
      scanFOV: 60,
      scanLines: 32,
      samplesPerLine: 16,
      laserColor: 0xff0000,
      materialColors: new Map([
        ["default", 0x00ff88], // 默认绿色
        ["ground", 0x8b4513], // 地面棕色
        ["wall", 0x708090], // 墙壁灰色
        ["object", 0xffd700], // 物体金色
        ["vegetation", 0x228b22], // 植被深绿色
        ["water", 0x4169e1], // 水体蓝色
        ["metal", 0xc0c0c0], // 金属银色
        ["wood", 0xdaa520], // 木材黄褐色
      ]),
      ...opts.config,
    };

    // this._raycaster.firstHitOnly = true as any; // BVH功能，在patch中启用

    this._patchBVHPrototypesOnce();

    const cap = this.config.pointLimit;
    this._positions = new Float32Array(cap * 3);
    this._colors = new Float32Array(cap * 3);
    this._times = new Float32Array(cap);
    this._geom = new THREE.BufferGeometry();
    this._geom.setAttribute(
      "position",
      new THREE.BufferAttribute(this._positions, 3)
    );
    this._geom.setAttribute(
      "color",
      new THREE.BufferAttribute(this._colors, 3)
    );
    this._manual = true;
    this._fade = this.config.fade;
    this._lifetime = this.config.pointLifetime;
    if (this.config.baseColor) this._baseColor.set(this.config.baseColor);
    this._minIntensity = this.config.minIntensity;
    this._maxIntensity = this.config.maxIntensity;
    this._bvhTimeBudgetMs = this.config.bvhBuildTimeBudgetMs;

    const mat = new THREE.PointsMaterial({
      size: this.config.pointSize,
      vertexColors: true,
    });
    this._points = new THREE.Points(this._geom, mat);
    this._points.visible = false;
    this._points.frustumCulled = false;
    this.scene.add(this._points);
    if (this._fade) {
      this._spawnTimes = new Float32Array(cap);
      this._baseIntensities = new Float32Array(cap);
    }

    this.rebuild();

    // 添加到引擎更新循环
    gameEngine.addUpdateCallback(this.update.bind(this));
  }
  private _patchBVHPrototypesOnce() {
    const g: any = globalThis as any;
    if (g.__LIDAR_BVH_PATCHED__) return;
    const meshProto: any = (THREE.Mesh as any).prototype;
    if (meshProto && meshProto.raycast !== acceleratedRaycast) {
      meshProto.raycast = acceleratedRaycast;
    }
    const geoProto: any = (THREE.BufferGeometry as any).prototype;
    if (geoProto && !geoProto.computeBoundsTree) {
      geoProto.computeBoundsTree = computeBoundsTree;
      geoProto.disposeBoundsTree = disposeBoundsTree;
    }
    g.__LIDAR_BVH_PATCHED__ = true;
  }

  rebuild() {
    this._meshes = [];
    this._pendingBVH = [];
    let added = 0;
    let skipped = 0;
    for (const root of this.worldRoots) {
      root.traverse((o: THREE.Object3D) => {
        if (!(o as any).isMesh) return;
        const m = o as THREE.Mesh;
        const geo: any = m.geometry;
        if (!geo || !geo.attributes || !geo.attributes.position) {
          skipped++;
          return;
        }
        this._meshes.push(m);
        added++;
        if (!geo.boundsTree && geo.computeBoundsTree) {
          this._pendingBVH.push(m);
        }
      });
    }
    this._pendingBVH.sort((a, b) => {
      const ga: any = a.geometry;
      const gb: any = b.geometry;
      return (
        (ga.attributes.position.count || 0) -
        (gb.attributes.position.count || 0)
      );
    });
    this._bvhBuilding = this._pendingBVH.length > 0;
    console.log(
      `[LiDAR] 网格: ${added}, 跳过: ${skipped}, 待增量BVH: ${this._pendingBVH.length}`
    );
  }

  setEnabled(flag: boolean) {
    this._points.visible = flag;
    eventBus.emit("lidar:mode:changed", { mode: flag ? "lidar" : "normal" });
  }

  clear() {
    this._positions.fill(0);
    this._colors.fill(0);
    this._geom.attributes.position.needsUpdate = true;
    this._geom.attributes.color.needsUpdate = true;
    this._nextWrite = 0;
    if (this._fade && this._spawnTimes && this._baseIntensities) {
      this._spawnTimes.fill(0);
      this._baseIntensities.fill(0);
    }
    this._densityMap.clear();
  }

  private _writePoint(p: THREE.Vector3, dist: number) {
    if (this._densityCell > 0) {
      const cs = this._densityCell;
      const key = `${Math.floor(p.x / cs)},${Math.floor(p.y / cs)},${Math.floor(
        p.z / cs
      )}`;
      const c = this._densityMap.get(key) || 0;
      if (c >= this._densityMaxPerCell) return;
      this._densityMap.set(key, c + 1);
    }
    const i = this._nextWrite % this.config.pointLimit;
    const base = i * 3;
    this._positions[base] = p.x;
    this._positions[base + 1] = p.y;
    this._positions[base + 2] = p.z;
    const f = 1 - dist / this.config.maxDistance;
    let b = Math.max(0, f * f);
    if (b < this._minIntensity) b = this._minIntensity;
    if (b > this._maxIntensity) b = this._maxIntensity;
    if (this._fade && this._spawnTimes && this._baseIntensities) {
      this._spawnTimes[i] = this._elapsed;
      this._baseIntensities[i] = b;
    }
    this._colors[base] = this._baseColor.r * b;
    this._colors[base + 1] = this._baseColor.g * b;
    this._colors[base + 2] = this._baseColor.b * b;
    this._nextWrite++;
    this._needsBoundsUpdate = true as any;
  }

  update(dt: number) {
    if (!this._points.visible) return;
    this._elapsed += dt;

    // 增量 BVH 构建
    if (this._bvhBuilding && this._pendingBVH.length) {
      const start = performance.now();
      let builtThisFrame = 0;
      while (this._pendingBVH.length) {
        const m = this._pendingBVH.shift()!;
        const geo: any = m.geometry;
        try {
          if (!geo.boundsTree && geo.computeBoundsTree) geo.computeBoundsTree();
        } catch (e) {
          console.warn("[LiDAR] BVH 构建失败(跳过)", m.name, e);
        }
        builtThisFrame++;
        if (performance.now() - start > this._bvhTimeBudgetMs) break;
      }
      if (this._pendingBVH.length === 0) {
        this._bvhBuilding = false;
        console.log("[LiDAR] BVH 构建完成");
      } else if (performance.now() - this._lastBVHLog > 1000) {
        this._lastBVHLog = performance.now();
        console.log(
          `[LiDAR] BVH 进度: 剩余 ${this._pendingBVH.length} 个 (本帧 ${builtThisFrame}, 预算 ${this._bvhTimeBudgetMs}ms)`
        );
      }
    }

    // 处理新的LiDAR扫描
    if (this._scanActive && this._meshes.length > 0) {
      const scanElapsed = this._elapsed - this._scanStartTime;
      this._scanProgress = Math.min(1, scanElapsed / this.config.scanDuration);

      // 计算当前应该扫描到哪一行
      const targetLine = Math.floor(this._scanProgress * this.config.scanLines);

      // 执行新扫描线
      while (this._currentScanLine < targetLine) {
        this._performLineScan(this._currentScanLine);
        this._currentScanLine++;
      }

      // 更新几何体
      if (this._currentScanLine > 0) {
        this._geom.attributes.position.needsUpdate = true;
        this._geom.attributes.color.needsUpdate = true;
      }

      // 扫描完成
      if (this._scanProgress >= 1) {
        this._scanActive = false;
        if (this._laserLine) {
          this._laserLine.visible = false;
        }
        console.log(`[LiDAR] 扫描完成，生成 ${this.pointCount} 个点`);
      }
    }

    // 点衰减逻辑 - 10秒后渐变消失
    if (this._fade && this._spawnTimes && this._baseIntensities) {
      const count = this.pointCount;
      const life = this._lifetime; // 默认10秒
      let any = false;

      for (let i = 0; i < count; i++) {
        const age = this._elapsed - this._spawnTimes[i];
        if (age < 0) continue; // 跳过未来时间的点

        // 计算剩余生命比例 (1.0 到 0.0)
        let remainingLife = Math.max(0, 1 - age / life);

        // 应用平滑的衰减曲线（可选：使用二次函数让衰减更自然）
        const fadeAlpha = remainingLife * remainingLife;

        // 基础强度乘以衰减系数
        const currentIntensity = this._baseIntensities[i] * fadeAlpha;

        const base = i * 3;
        const newR = this._baseColor.r * currentIntensity;
        const newG = this._baseColor.g * currentIntensity;
        const newB = this._baseColor.b * currentIntensity;

        // 只有颜色变化足够大时才更新
        if (Math.abs(this._colors[base] - newR) > 0.001) {
          this._colors[base] = newR;
          this._colors[base + 1] = newG;
          this._colors[base + 2] = newB;
          any = true;
        }

        // 如果点完全衰减，可以将其标记为可重用
        if (remainingLife <= 0.001) {
          this._colors[base] = 0;
          this._colors[base + 1] = 0;
          this._colors[base + 2] = 0;
          any = true;
        }
      }

      if (any) {
        this._geom.attributes.color.needsUpdate = true;
      }
    }

    if ((this as any)._needsBoundsUpdate) {
      this._geom.computeBoundingSphere();
      delete (this as any)._needsBoundsUpdate;
    }
  }

  /**
   * 开始LiDAR扫描 - 左键触发
   */
  startScan() {
    if (this._scanActive) return;

    this._scanActive = true;
    this._scanProgress = 0;
    this._scanStartTime = this._elapsed;
    this._currentScanLine = 0;

    this._initializeLaserLine();

    console.log("[LiDAR] 开始扫描...");
  }

  /**
   * 初始化激光线渲染
   */
  private _initializeLaserLine() {
    if (this._laserLine) {
      this.scene.remove(this._laserLine);
    }

    this._laserGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6); // 两个点的坐标
    this._laserGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    this._laserMaterial = new THREE.LineBasicMaterial({
      color: this.config.laserColor,
      transparent: true,
      opacity: 0.8,
    });

    this._laserLine = new THREE.Line(this._laserGeometry, this._laserMaterial);
    this.scene.add(this._laserLine);
  }

  /**
   * 更新激光线位置
   */
  private _updateLaserLine(from: THREE.Vector3, to: THREE.Vector3) {
    if (!this._laserGeometry) return;

    const positions = this._laserGeometry.attributes.position
      .array as Float32Array;
    positions[0] = from.x;
    positions[1] = from.y;
    positions[2] = from.z;
    positions[3] = to.x;
    positions[4] = to.y;
    positions[5] = to.z;

    this._laserGeometry.attributes.position.needsUpdate = true;
  }

  /**
   * 获取手部世界坐标
   */
  private _getHandPosition(): THREE.Vector3 {
    const camera = this.camera as THREE.PerspectiveCamera;
    const handPos = this._handOffset.clone();

    // 转换到世界坐标
    handPos.applyMatrix4(camera.matrixWorld);
    return handPos;
  }

  /**
   * 根据物体获取对应颜色
   */
  private _getPointColor(object: THREE.Object3D): THREE.Color {
    // 根据物体名称或材质判断类型
    let materialType = "default";

    if (object.name.includes("ground") || object.name.includes("floor")) {
      materialType = "ground";
    } else if (
      object.name.includes("wall") ||
      object.name.includes("ceiling")
    ) {
      materialType = "wall";
    } else if (
      object.name.includes("object") ||
      object.name.includes("furniture")
    ) {
      materialType = "object";
    } else if (
      object.name.includes("tree") ||
      object.name.includes("plant") ||
      object.name.includes("vegetation")
    ) {
      materialType = "vegetation";
    } else if (
      object.name.includes("water") ||
      object.name.includes("lake") ||
      object.name.includes("river")
    ) {
      materialType = "water";
    } else if (
      object.name.includes("metal") ||
      object.name.includes("steel") ||
      object.name.includes("iron")
    ) {
      materialType = "metal";
    } else if (object.name.includes("wood") || object.name.includes("timber")) {
      materialType = "wood";
    }

    const colorValue =
      this.config.materialColors.get(materialType) ||
      this.config.materialColors.get("default")!;
    return new THREE.Color(colorValue);
  }

  /**
   * 执行单次射线投射扫描
   */
  private _performLineScan(lineIndex: number) {
    const cam = this.camera as THREE.PerspectiveCamera;
    const playerPos = this.playerProvider.getPosition();
    const playerRot = this.playerProvider.getRotation();

    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);

    // 计算当前扫描线的垂直角度（从上到下）
    const normalizedY = lineIndex / (this.config.scanLines - 1); // 0 到 1
    const vy = normalizedY - 0.5; // -0.5 到 0.5
    const pitchOffset = vy * vFov;

    const handPos = this._getHandPosition();
    let laserTarget: THREE.Vector3 | null = null;

    // 在该扫描线上随机采样点
    for (let i = 0; i < this.config.samplesPerLine; i++) {
      const vx = Math.random() - 0.5; // 随机水平位置
      const yawOffset = vx * hFov;

      const yaw = playerRot.yaw + yawOffset;
      const pitch = playerRot.pitch + pitchOffset;

      const dir = new THREE.Vector3(0, 0, -1).applyEuler(
        new THREE.Euler(pitch, yaw, 0, "YXZ")
      );

      this._raycaster.set(playerPos, dir.normalize());
      this._raycaster.far = this.config.maxDistance;

      const res = this._raycaster.intersectObjects(this._meshes, false);
      if (res.length > 0) {
        const hit = res[0];
        const distance = hit.distance;
        const hitPoint = hit.point;

        // 获取物体特定颜色
        const pointColor = this._getPointColor(hit.object);

        // 距离衰减
        const distanceFactor = Math.max(
          0.1,
          1 - distance / this.config.maxDistance
        );
        const intensity =
          this.config.minIntensity +
          (this.config.maxIntensity - this.config.minIntensity) *
            distanceFactor;

        this._writePointWithColor(hitPoint, pointColor, intensity);

        // 设置激光目标点（用于渲染激光线）
        if (!laserTarget && Math.random() < 0.3) {
          // 30%概率显示激光线
          laserTarget = hitPoint;
        }
      }
    }

    // 更新激光线
    if (laserTarget) {
      this._updateLaserLine(handPos, laserTarget);
      this._laserLine!.visible = true;
    } else {
      this._laserLine!.visible = false;
    }
  }

  /**
   * 写入带颜色的点
   */
  private _writePointWithColor(
    point: THREE.Vector3,
    color: THREE.Color,
    intensity: number
  ) {
    if (this._nextWrite >= this.config.pointLimit) return;

    const idx = this._nextWrite;
    const base3 = idx * 3;

    // 设置位置
    this._positions[base3] = point.x;
    this._positions[base3 + 1] = point.y;
    this._positions[base3 + 2] = point.z;

    // 设置颜色
    this._colors[base3] = color.r * intensity;
    this._colors[base3 + 1] = color.g * intensity;
    this._colors[base3 + 2] = color.b * intensity;

    // 记录生成时间和基础强度（用于衰减）
    if (this._spawnTimes && this._baseIntensities) {
      this._spawnTimes[idx] = this._elapsed;
      this._baseIntensities[idx] = intensity;
    }

    this._nextWrite++;
  }

  // 废弃的方法 - 保持兼容性
  fireBurst() {
    console.warn("[LiDAR] fireBurst已废弃，请使用startScan()");
  }

  scanView() {
    console.warn("[LiDAR] scanView已废弃，请使用startScan()");
  }

  private _castOne(): boolean {
    const az = (this._currentAzimuth / this._azimuthSteps) * Math.PI * 2;
    const elevNorm = this._currentElevation / (this._elevationSteps - 1);
    const elev = THREE.MathUtils.lerp(-0.35, 0.25, elevNorm);

    this._currentAzimuth = (this._currentAzimuth + 1) % this._azimuthSteps;
    if (this._currentAzimuth === 0) {
      this._currentElevation =
        (this._currentElevation + 1) % this._elevationSteps;
    }

    const dir = new THREE.Vector3(
      Math.cos(elev) * Math.sin(az),
      Math.sin(elev),
      -Math.cos(elev) * Math.cos(az)
    );

    const playerRot = this.playerProvider.getRotation();
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(playerRot.pitch, playerRot.yaw, 0, "YXZ")
    );
    dir.applyQuaternion(quat);

    this._raycaster.set(this.playerProvider.getPosition(), dir.normalize());
    this._raycaster.far = this.config.maxDistance;
    const hit = this._raycaster.intersectObjects(this._meshes, false);
    if (hit.length) {
      this._writePoint(hit[0].point, hit[0].distance);
      return true;
    }
    return false;
  }

  get pointCount() {
    return Math.min(this._nextWrite, this.config.pointLimit);
  }

  setManual(flag: boolean) {
    this._manual = flag;
  }

  get manual() {
    return this._manual;
  }

  setFade(flag: boolean) {
    this._fade = flag;
  }

  setLifetime(sec: number) {
    this._lifetime = sec;
  }

  setMaxIntensity(v: number) {
    this._maxIntensity = v;
  }

  setDensityParams(cell: number, maxPerCell: number) {
    this._densityCell = cell;
    this._densityMaxPerCell = maxPerCell;
    this._densityMap.clear();
  }

  setBVHTimeBudget(ms: number) {
    this._bvhTimeBudgetMs = Math.max(1, ms);
  }

  get bvhPending() {
    return this._pendingBVH.length;
  }
}
