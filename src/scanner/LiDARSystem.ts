import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { PlayerController } from "../player/PlayerController";

interface LiDAROptions {
  scene: THREE.Scene;
  player: PlayerController;
  worldRoots: THREE.Object3D[];
  maxDistance?: number;
  raysPerFrame?: number;
  burstRays?: number;
  pointLimit?: number;
  manual?: boolean; // 手动模式（不自动扫描）
  pointSize?: number; // 点大小
  fade?: boolean; // 是否衰减
  pointLifetime?: number; // 点生命秒
  baseColor?: THREE.ColorRepresentation; // 点基础颜色
  minIntensity?: number; // 最小强度避免太暗看不见
  bvhBuildTimeBudgetMs?: number; // 每帧 BVH 构建时间预算
}

// 环形逐步扫描 + BVH firstHitOnly + 循环点缓冲
export class LiDARSystem {
  scene: THREE.Scene;
  player: PlayerController;
  worldRoots: THREE.Object3D[];
  maxDistance: number;
  raysPerFrame: number;
  burstRays: number;
  pointLimit: number;

  private _raycaster = new THREE.Raycaster();
  private _azimuthSteps = 720; // 0.5°
  private _elevationSteps = 100; // 垂直层数
  private _currentAzimuth = 0;
  private _currentElevation = 0;
  private _points: THREE.Points;
  private _positions: Float32Array;
  private _colors: Float32Array;
  private _times: Float32Array; // 预留（时间/衰减）
  private _geom: THREE.BufferGeometry;
  private _nextWrite = 0;
  private _meshes: THREE.Mesh[] = [];
  private _manual = true;
  private _fade = true;
  private _lifetime = 10; // 秒
  private _elapsed = 0;
  private _spawnTimes?: Float32Array;
  private _baseIntensities?: Float32Array;
  private _baseColor = new THREE.Color(0xffffff);
  private _minIntensity = 0;
  private _needsBoundsUpdate = false;
  private _maxIntensity = 3; // 限制最亮亮度
  private _densityCell = 0.1; // 密度体素尺寸 (米)
  private _densityMaxPerCell = 100; // 单元最大点数
  private _densityMap: Map<string, number> = new Map();
  private _pendingBVH: THREE.Mesh[] = [];
  private _bvhBuilding = false;
  private _bvhTimeBudgetMs = 6; // 默认每帧 6ms 用于增量 BVH 构建
  private _lastBVHLog = 0;
  // 垂直逐行扫描状态
  private _sweepActive = false;
  private _sweepDuration = 0.5; // 秒
  private _sweepElapsed = 0;
  private _sweepLines = 0; // 需要刷的总行数
  private _sweepLinesDone = 0;
  private _sweepSamplesX = 0;
  private _handOffset = new THREE.Vector3(0.25, -0.2, -0.3); // 摄像机局部: 右(+x) 下(-y) 前(-z)
  private _laserMaterial?: THREE.LineBasicMaterial;
  private _laserLines: THREE.Line[] = [];

  constructor(opts: LiDAROptions) {
    this.scene = opts.scene;
    this.player = opts.player;
    this.worldRoots = opts.worldRoots;
    this.maxDistance = opts.maxDistance ?? 200;
    this.raysPerFrame = opts.raysPerFrame ?? 400;
    this.burstRays = opts.burstRays ?? 4000; // 手动模式多给一点
    this.pointLimit = opts.pointLimit ?? 120000;
    this._raycaster.firstHitOnly = true as any;

    this._patchBVHPrototypesOnce();

    const cap = this.pointLimit;
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
    this._manual = opts.manual ?? true;
    this._fade = opts.fade ?? true;
    this._lifetime = opts.pointLifetime ?? 10;
    const pointSize = opts.pointSize ?? 0.05; // 更小
    if (opts.baseColor) this._baseColor.set(opts.baseColor);
    this._minIntensity = opts.minIntensity ?? 0.15; // 默认保证最低亮度可见
    const mat = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
    });
    this._points = new THREE.Points(this._geom, mat);
    this._points.visible = false;
    // 避免因为 boundingSphere 未及时更新而被视锥整体裁掉
    this._points.frustumCulled = false;
    this.scene.add(this._points);
    if (this._fade) {
      this._spawnTimes = new Float32Array(cap);
      this._baseIntensities = new Float32Array(cap);
    }
    if (opts.bvhBuildTimeBudgetMs !== undefined)
      this._bvhTimeBudgetMs = opts.bvhBuildTimeBudgetMs;
    this.rebuild(); // 初次调用会生成待 BVH 队列并开启增量流程
  }

  // 全局一次执行，避免重复 patch
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
        // 若尚无 BVH 且具备 computeBoundsTree，则放入待构建队列
        if (!geo.boundsTree && geo.computeBoundsTree) {
          this._pendingBVH.push(m);
        }
      });
    }
    // 体积大的优先后构建（按顶点数排序：先小后大，加快可用性）
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
    // 密度限制：若同一体素已达上限则放弃
    if (this._densityCell > 0) {
      const cs = this._densityCell;
      const key = `${Math.floor(p.x / cs)},${Math.floor(p.y / cs)},${Math.floor(
        p.z / cs
      )}`;
      const c = this._densityMap.get(key) || 0;
      if (c >= this._densityMaxPerCell) return; // 丢弃
      this._densityMap.set(key, c + 1);
    }
    const i = this._nextWrite % this.pointLimit;
    const base = i * 3;
    this._positions[base] = p.x;
    this._positions[base + 1] = p.y;
    this._positions[base + 2] = p.z;
    const f = 1 - dist / this.maxDistance;
    let b = Math.max(0, f * f);
    if (b < this._minIntensity) b = this._minIntensity;
    if (b > this._maxIntensity) b = this._maxIntensity;
    if (this._fade && this._spawnTimes && this._baseIntensities) {
      this._spawnTimes[i] = this._elapsed;
      this._baseIntensities[i] = b;
    }
    // 基础颜色乘以亮度
    this._colors[base] = this._baseColor.r * b;
    this._colors[base + 1] = this._baseColor.g * b;
    this._colors[base + 2] = this._baseColor.b * b;
    this._nextWrite++;
    // 简单策略：写点时标记需要更新包围体（延迟到下一次 update 统一做）
    this._needsBoundsUpdate = true as any;
  }

  update(dt: number) {
    if (!this._points.visible) return;
    this._elapsed += dt;
    // 增量 BVH 构建：限制时间预算
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
    // 处理垂直逐行扫描
    if (this._sweepActive && this._meshes.length > 0) {
      this._sweepElapsed += dt;
      const cam = this.player.camera;
      const vFov = THREE.MathUtils.degToRad(cam.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect);
      const targetLines = Math.min(
        this._sweepLines,
        Math.floor(
          (this._sweepElapsed / this._sweepDuration) * this._sweepLines
        )
      );
      for (; this._sweepLinesDone < targetLines; this._sweepLinesDone++) {
        const lineIndex = this._sweepLines - 1 - this._sweepLinesDone; // 顶部 -> 底部
        const vy = (lineIndex + 0.5) / this._sweepLines - 0.5;
        const pitchOffset = vy * vFov;
        // 选择一个激光列
        const laserX = Math.floor(Math.random() * this._sweepSamplesX);
        let laserDir: THREE.Vector3 | null = null;
        let laserHit: THREE.Vector3 | null = null;
        for (let x = 0; x < this._sweepSamplesX; x++) {
          const vx = (x + 0.5) / this._sweepSamplesX - 0.5;
          const yawOffset = vx * hFov;
          const yaw = this.player.yaw + yawOffset;
          const pitch = this.player.pitch + pitchOffset;
          const dir = new THREE.Vector3(0, 0, -1).applyEuler(
            new THREE.Euler(pitch, yaw, 0, "YXZ")
          );
          this._raycaster.set(this.player.position, dir.normalize());
          this._raycaster.far = this.maxDistance;
          const res = this._raycaster.intersectObjects(this._meshes, false);
          if (res.length) this._writePoint(res[0].point, res[0].distance);
          if (x === laserX) {
            laserDir = dir.clone();
            if (res.length) laserHit = res[0].point.clone();
          }
        }
        if (laserDir) this._renderLaserShot(laserDir, laserHit);
        this._geom.attributes.position.needsUpdate = true;
        this._geom.attributes.color.needsUpdate = true;
      }
      if (this._sweepLinesDone >= this._sweepLines) this._endSweep();
    }
    if (this._fade && this._spawnTimes && this._baseIntensities) {
      const count = this.pointCount;
      const life = this._lifetime;
      let any = false;
      for (let i = 0; i < count; i++) {
        const age = this._elapsed - this._spawnTimes[i];
        if (age < 0) continue;
        let remain = 1 - age / life;
        if (remain < 0) remain = 0;
        const inten = this._baseIntensities[i] * remain;
        const base = i * 3;
        const r = this._baseColor.r * inten;
        if (Math.abs(this._colors[base] - r) > 0.002) {
          this._colors[base] = r;
          this._colors[base + 1] = this._baseColor.g * inten;
          this._colors[base + 2] = this._baseColor.b * inten;
          any = true;
        }
      }
      if (any) this._geom.attributes.color.needsUpdate = true;
    }
    // 若启用了包围体更新（且未禁用裁剪，这里仍计算供其他用途）
    if ((this as any)._needsBoundsUpdate) {
      this._geom.computeBoundingSphere();
      delete (this as any)._needsBoundsUpdate;
    }
  }

  fireBurst() {
    if (!this._points.visible) return;
    if (this._meshes.length === 0) return;
    let hits = 0;
    for (let i = 0; i < this.burstRays; i++) {
      if (this._castOne()) hits++;
    }
    this._geom.attributes.position.needsUpdate = true;
    this._geom.attributes.color.needsUpdate = true;
    console.log(
      `[LiDAR] burst rays=${this.burstRays} hits=${hits} totalPoints=${this.pointCount}`
    );
  }

  // 视野扇形扫描：一次性覆盖当前相机视锥（前向）
  scanView(samplesX = 80, samplesY = 45) {
    if (!this._points.visible) return;
    if (this._meshes.length === 0) return;
    const cam = this.player.camera;
    const vFov = THREE.MathUtils.degToRad(cam.fov); // 垂直 FOV
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * cam.aspect); // 水平 FOV
    let hits = 0;
    for (let y = 0; y < samplesY; y++) {
      const vy = (y + 0.5) / samplesY - 0.5; // -0.5..0.5
      const pitchOffset = vy * vFov; // 垂直偏移
      for (let x = 0; x < samplesX; x++) {
        const vx = (x + 0.5) / samplesX - 0.5; // -0.5..0.5
        const yawOffset = vx * hFov; // 水平偏移
        const yaw = this.player.yaw + yawOffset;
        const pitch = this.player.pitch + pitchOffset;
        // 摄像机前向应为 -Z，之前使用 +Z 造成点落在身后，这里改成从 (0,0,-1) 旋转
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(
          new THREE.Euler(pitch, yaw, 0, "YXZ")
        );
        this._raycaster.set(this.player.position, dir.normalize());
        this._raycaster.far = this.maxDistance;
        const res = this._raycaster.intersectObjects(this._meshes, false);
        if (res.length) {
          this._writePoint(res[0].point, res[0].distance);
          hits++;
        }
      }
    }
    this._geom.attributes.position.needsUpdate = true;
    this._geom.attributes.color.needsUpdate = true;
    console.log(
      `[LiDAR] view scan rays=${samplesX * samplesY} hits=${hits} totalPoints=${
        this.pointCount
      }`
    );
  }

  startVerticalSweep(
    samplesX = 80,
    samplesY = 60,
    duration = 0.5,
    perLineSamples = 4
  ) {
    if (!this._points.visible) return;
    if (this._meshes.length === 0) return;
    this._sweepActive = true;
    this._sweepElapsed = 0;
    this._sweepLines = samplesY;
    this._sweepLinesDone = 0;
    this._sweepSamplesX = samplesX; // 保留参数（当前改为随机, 不再逐列）
    this._sweepDuration = duration;
    this._clearLaserLines();
  }

  private _endSweep() {
    this._sweepActive = false;
    this._clearLaserLines();
  }

  private _renderLaserShot(dir: THREE.Vector3, hitPoint: THREE.Vector3 | null) {
    if (!this._laserMaterial) {
      this._laserMaterial = new THREE.LineBasicMaterial({ color: 0xff3030 });
    }
    // 计算“手”的世界位置
    const hand = this.player.camera.localToWorld(this._handOffset.clone());
    const end = hitPoint
      ? hitPoint.clone()
      : hand.clone().addScaledVector(dir.normalize(), this.maxDistance * 0.2);
    // 只显示当前一条激光
    this._clearLaserLines();
    const geo = new THREE.BufferGeometry().setFromPoints([hand, end]);
    const line = new THREE.Line(geo, this._laserMaterial);
    this.scene.add(line);
    this._laserLines.push(line);
  }

  private _clearLaserLines() {
    for (const l of this._laserLines) {
      this.scene.remove(l);
      l.geometry.dispose();
    }
    this._laserLines.length = 0;
  }

  private _castOne(): boolean {
    // 环扫描方向
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
      -Math.cos(elev) * Math.cos(az) // 反转 Z 以对齐摄像机 forward
    );
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.player.pitch, this.player.yaw, 0, "YXZ")
    );
    dir.applyQuaternion(quat);

    this._raycaster.set(this.player.position, dir.normalize());
    this._raycaster.far = this.maxDistance;
    const hit = this._raycaster.intersectObjects(this._meshes, false);
    if (hit.length) {
      this._writePoint(hit[0].point, hit[0].distance);
      return true;
    }
    return false;
  }

  get pointCount() {
    return Math.min(this._nextWrite, this.pointLimit);
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
