import * as THREE from "three";
export class PlayerController {
    camera;
    worldRoots;
    position = new THREE.Vector3();
    velocity = new THREE.Vector3();
    yaw = 0;
    pitch = 0;
    // eyeHeight: 视角高度; collisionHeight: 碰撞胶囊高度(比视角低，可避免门框顶卡)
    eyeHeight = 1.6;
    collisionHeight = 1; // 可调: 碰撞胶囊低于视角避免门框顶头
    speed = 4;
    sprint = 7;
    gravity = -18;
    jumpVel = 7;
    onGround = false;
    keys = {};
    mouseLocked = false;
    _downRay = new THREE.Raycaster();
    _hRay = new THREE.Raycaster();
    _collisionMeshes = [];
    collisionRadius = 0.45; // 水平碰撞半径
    _collisionDirs = []; // 预计算水平方向
    maxSubStep = 0.02; // 物理子步长上限
    maxIterations = 2; // 每帧额外迭代（用于连续碰撞修正）
    enableVelocitySweep = true; // 速度方向预扫
    sweepSkin = 0.02; // 与命中面保持的最小皮肤距离
    _lastSafePos = new THREE.Vector3();
    _tmp = new THREE.Vector3();
    collisionSegments = 24; // 水平方向细分数量（越多越精确）
    stepHeight = 0.3; // 台阶高度
    enableStepUp = true;
    constructor(camera, worldRoots) {
        this.camera = camera;
        this.worldRoots = worldRoots;
        this.position.copy(camera.position);
        document.addEventListener("pointerlockchange", () => {
            this.mouseLocked = document.pointerLockElement === document.body;
        });
        document.addEventListener("mousemove", (e) => {
            if (!this.mouseLocked)
                return;
            const sens = 0.0025;
            this.yaw -= e.movementX * sens;
            this.pitch -= e.movementY * sens;
            const lim = Math.PI / 2 - 0.01;
            this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
        });
        document.addEventListener("keydown", (e) => (this.keys[e.code] = true));
        document.addEventListener("keyup", (e) => (this.keys[e.code] = false));
        this._buildCollisionDirs();
        this._lastSafePos.copy(this.position);
        // 防止配置错误：若视角低于碰撞高度则强制提升
        if (this.eyeHeight < this.collisionHeight) {
            this.eyeHeight = this.collisionHeight + 0.05;
        }
    }
    _buildCollisionDirs() {
        this._collisionDirs.length = 0;
        for (let i = 0; i < this.collisionSegments; i++) {
            const a = (i / this.collisionSegments) * Math.PI * 2;
            this._collisionDirs.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
        }
    }
    requestPointerLock() {
        document.body.requestPointerLock();
    }
    update(dt) {
        // 大步长拆分，避免高速穿透
        let remaining = dt;
        while (remaining > 0) {
            const step = Math.min(this.maxSubStep, remaining);
            this._step(step);
            remaining -= step;
        }
    }
    _step(dt) {
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
        const right = new THREE.Vector3()
            .crossVectors(forward, new THREE.Vector3(0, 1, 0))
            .normalize();
        const up = new THREE.Vector3(0, 1, 0);
        let wish = new THREE.Vector3();
        if (this.keys["KeyW"])
            wish.add(forward);
        if (this.keys["KeyS"])
            wish.sub(forward);
        if (this.keys["KeyA"])
            wish.sub(right);
        if (this.keys["KeyD"])
            wish.add(right);
        if (wish.lengthSq() > 0)
            wish.normalize();
        const curSpeed = this.keys["ShiftLeft"] ? this.sprint : this.speed;
        wish.multiplyScalar(curSpeed);
        this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, wish.x, 0.15);
        this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, wish.z, 0.15);
        // gravity
        this.velocity.y += this.gravity * dt;
        // ground detect （优先使用缓存的 _collisionMeshes）
        this._downRay.set(this.position.clone().addScaledVector(up, 0.2), new THREE.Vector3(0, -1, 0));
        this._downRay.far = 3;
        const groundSet = this._collisionMeshes.length
            ? this._collisionMeshes
            : (() => {
                const tmp = [];
                for (const r of this.worldRoots) {
                    r.traverse((o) => {
                        if (o.isMesh)
                            tmp.push(o);
                    });
                }
                return tmp;
            })();
        const hits = this._downRay.intersectObjects(groundSet, false);
        if (hits.length) {
            const h = hits[0];
            // 当前位置的“脚”= 视角 - (eyeHeight - collisionHeight)
            const footY = this.position.y - (this.eyeHeight - this.collisionHeight);
            const dist = footY - h.point.y;
            if (dist <= this.collisionHeight) {
                this.onGround = true;
                // 放置使脚刚好在地上: 视角 = 地面 + eyeHeight
                this.position.y = h.point.y + this.eyeHeight;
                this.velocity.y = 0;
            }
        }
        else
            this.onGround = false;
        if (this.onGround && this.keys["Space"]) {
            this.velocity.y = this.jumpVel;
            this.onGround = false;
        }
        // 速度方向预扫（防高速钻入）
        if (this.enableVelocitySweep && this._collisionMeshes.length) {
            const vel2D = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
            const speed2D = vel2D.length();
            if (speed2D > 0) {
                const dir = vel2D.clone().normalize();
                const mid = this.position
                    .clone()
                    .add(new THREE.Vector3(0, this.collisionHeight * 0.5 -
                    (this.eyeHeight - this.collisionHeight), 0));
                this._hRay.set(mid, dir);
                this._hRay.far = speed2D * dt + this.collisionRadius;
                const sweepHits = this._hRay.intersectObjects(this._collisionMeshes, false);
                if (sweepHits.length) {
                    const h0 = sweepHits[0];
                    const hitDist = h0.distance - this.collisionRadius;
                    if (hitDist < speed2D * dt) {
                        // 截断水平速度，沿法线投影
                        const allowedMove = Math.max(0, hitDist - this.sweepSkin);
                        const moveRatio = allowedMove / (speed2D * dt);
                        if (moveRatio < 1) {
                            this.velocity.x *= moveRatio;
                            this.velocity.z *= moveRatio;
                        }
                    }
                }
            }
        }
        // 先应用（可能被截断的）本帧位移
        this.position.addScaledVector(this.velocity, dt);
        // 多方向 + 上下两圈 + 法线滑动 + 安全回退 + 台阶上步
        if (this._collisionMeshes.length) {
            const radius = this.collisionRadius;
            const ringHeights = [
                this.collisionHeight * 0.15,
                this.collisionHeight * 0.85,
            ];
            let totalPushLen = 0;
            for (let iter = 0; iter < this.maxIterations; iter++) {
                let penetrated = false;
                for (const h of ringHeights) {
                    const ringCenter = this.position
                        .clone()
                        .add(new THREE.Vector3(0, h - (this.eyeHeight - this.collisionHeight), 0));
                    for (const d of this._collisionDirs) {
                        this._hRay.set(ringCenter.clone().addScaledVector(d, -radius * 0.72), d);
                        this._hRay.far = radius + 0.18;
                        const hit = this._hRay.intersectObjects(this._collisionMeshes, false);
                        if (hit.length) {
                            const h0 = hit[0];
                            if (h0.distance < radius) {
                                const push = radius - h0.distance;
                                // 使用真实法线（若有）改进滑动
                                let normal = d;
                                if (h0.face && h0.object) {
                                    const n = h0.face.normal.clone();
                                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(h0.object.matrixWorld);
                                    n.applyMatrix3(normalMatrix).normalize();
                                    if (Math.abs(n.y) < 0.85) {
                                        normal = new THREE.Vector3(n.x, 0, n.z).normalize();
                                    }
                                }
                                const pushVec = this._tmp.copy(normal).multiplyScalar(-push);
                                this.position.add(pushVec);
                                totalPushLen += pushVec.length();
                                // 滑动: 移除速度在法线方向的分量
                                const velHoriz = this._tmp.set(this.velocity.x, 0, this.velocity.z);
                                const proj = velHoriz.dot(normal);
                                if (proj > 0) {
                                    velHoriz.addScaledVector(normal, -proj);
                                    this.velocity.x = velHoriz.x;
                                    this.velocity.z = velHoriz.z;
                                }
                                penetrated = true;
                            }
                        }
                    }
                }
                if (!penetrated)
                    break;
            }
            if (totalPushLen > radius * 0.6) {
                // 深穿透：回滚
                this.position.copy(this._lastSafePos);
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
            else if (totalPushLen < 0.01) {
                // 记录安全点
                this._lastSafePos.copy(this.position);
            }
            else if (this.enableStepUp && this.onGround && totalPushLen > 0.01) {
                // 尝试台阶上步：抬升后快速检测是否仍被阻挡
                const backup = this.position.clone();
                const upDelta = Math.min(this.stepHeight, this.collisionHeight * 0.8);
                this.position.y += upDelta;
                let blocked = false;
                const testCenter = this.position
                    .clone()
                    .add(new THREE.Vector3(0, this.collisionHeight * 0.5 -
                    (this.eyeHeight - this.collisionHeight), 0));
                for (const d of this._collisionDirs) {
                    this._hRay.set(testCenter.clone().addScaledVector(d, -radius * 0.75), d);
                    this._hRay.far = radius + 0.15;
                    const htest = this._hRay.intersectObjects(this._collisionMeshes, false);
                    if (htest.length && htest[0].distance < radius) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) {
                    this.position.copy(backup);
                }
                else {
                    this._lastSafePos.copy(this.position);
                }
            }
        }
        // 同步相机位置与旋转（之前遗漏位置导致“不能移动”）
        this.camera.position.copy(this.position);
        this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    }
    setCollisionMeshes(meshes) {
        this._collisionMeshes = meshes;
        this._buildCollisionDirs();
    }
}
