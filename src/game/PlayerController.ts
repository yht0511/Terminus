import * as THREE from "three";
import { gameEngine } from "@core/GameEngine";
import { eventBus } from "@core/EventBus";
import type { IPlayerProvider } from "./LiDARSystem";

export interface PlayerControllerConfig {
  speed: number;
  sprintSpeed: number;
  jumpHeight: number;
  gravity: number;
  mouseSensitivity: number;
  collisionRadius: number;
  eyeHeight: number;
  maxStepHeight: number;
}

/**
 * 玩家控制器
 * 处理玩家移动、视角控制、碰撞检测等
 */
export class PlayerController implements IPlayerProvider {
  private camera: THREE.PerspectiveCamera;
  private config: PlayerControllerConfig;

  // 位置和旋转
  private position = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private rotation = new THREE.Euler();

  // 控制状态
  private keys: Record<string, boolean> = {};
  private mouseMovement = new THREE.Vector2();
  private isPointerLocked = false;

  // 物理状态
  private isOnGround = false;
  private isMoving = false;

  // 碰撞检测
  private collisionObjects: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private tempVector = new THREE.Vector3();
  private tempBox = new THREE.Box3();

  constructor(config: Partial<PlayerControllerConfig> = {}) {
    this.camera = gameEngine.camera;
    this.config = {
      speed: 4,
      sprintSpeed: 7,
      jumpHeight: 1.5,
      gravity: 15,
      mouseSensitivity: 0.002,
      collisionRadius: 0.4,
      eyeHeight: 1.6,
      maxStepHeight: 0.3,
      ...config,
    };

    this.setupEventListeners();
    this.setupControls();

    // 添加到引擎更新循环
    gameEngine.addUpdateCallback(this.update.bind(this));
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 键盘事件
    document.addEventListener("keydown", this.onKeyDown.bind(this));
    document.addEventListener("keyup", this.onKeyUp.bind(this));

    // 鼠标事件
    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("click", this.requestPointerLock.bind(this));
    document.addEventListener("mousedown", this.onMouseDown.bind(this));

    // 指针锁定事件
    document.addEventListener(
      "pointerlockchange",
      this.onPointerLockChange.bind(this)
    );
  }

  /**
   * 设置控制
   */
  private setupControls(): void {
    // 设置初始位置
    this.position.set(0, this.config.eyeHeight, 0);
    this.updateCameraTransform();
  }

  /**
   * 键盘按下事件
   */
  private onKeyDown(event: KeyboardEvent): void {
    this.keys[event.code] = true;

    // 特殊键处理
    if (event.code === "Space" && this.isOnGround) {
      this.jump();
    }
  }

  /**
   * 键盘释放事件
   */
  private onKeyUp(event: KeyboardEvent): void {
    this.keys[event.code] = false;
  }

  /**
   * 鼠标移动事件
   */
  private onMouseMove(event: MouseEvent): void {
    if (!this.isPointerLocked) return;

    this.mouseMovement.x -= event.movementX * this.config.mouseSensitivity; // 反转X轴
    this.mouseMovement.y -= event.movementY * this.config.mouseSensitivity; // 反转Y轴

    // 限制垂直视角
    this.mouseMovement.y = THREE.MathUtils.clamp(
      this.mouseMovement.y,
      -Math.PI / 2 + 0.1,
      Math.PI / 2 - 0.1
    );
  }

  /**
   * 鼠标按下事件
   */
  private onMouseDown(event: MouseEvent): void {
    if (!this.isPointerLocked) return;

    // 左键触发LiDAR扫描
    if (event.button === 0) {
      eventBus.emit("lidar:startScan");
    }
  }

  /**
   * 请求指针锁定
   */
  private requestPointerLock(): void {
    gameEngine.renderer.domElement.requestPointerLock();
  }

  /**
   * 指针锁定状态变化
   */
  private onPointerLockChange(): void {
    this.isPointerLocked =
      document.pointerLockElement === gameEngine.renderer.domElement;
  }

  /**
   * 跳跃
   */
  private jump(): void {
    if (this.isOnGround) {
      this.velocity.y = Math.sqrt(
        2 * this.config.gravity * this.config.jumpHeight
      );
      this.isOnGround = false;
    }
  }

  /**
   * 更新（每帧调用）
   */
  private update(deltaTime: number): void {
    this.updateMovement(deltaTime);
    this.updatePhysics(deltaTime);
    this.updateCameraTransform();
    this.checkGroundCollision();
    this.handleHorizontalCollisions();

    // 发出移动事件
    if (this.isMoving) {
      eventBus.emit("player:moved", { position: this.position.clone() });
    }
  }

  /**
   * 更新移动
   */
  private updateMovement(deltaTime: number): void {
    const moveVector = new THREE.Vector3();

    // 获取输入
    if (this.keys["KeyW"]) moveVector.z -= 1; // 向前
    if (this.keys["KeyS"]) moveVector.z += 1; // 向后
    if (this.keys["KeyA"]) moveVector.x += 1; // 向左
    if (this.keys["KeyD"]) moveVector.x -= 1; // 向右

    // 检查是否有移动输入
    this.isMoving = moveVector.length() > 0;

    if (this.isMoving) {
      // 标准化移动向量
      moveVector.normalize();

      // 应用相机旋转（只有水平旋转）
      const cameraDirection = new THREE.Vector3(0, 0, 1);
      cameraDirection.applyEuler(new THREE.Euler(0, this.rotation.y, 0));

      const cameraRight = new THREE.Vector3(-1, 0, 0);
      cameraRight.applyEuler(new THREE.Euler(0, this.rotation.y, 0));

      // 计算世界空间移动方向
      const worldMove = new THREE.Vector3();
      worldMove.addScaledVector(cameraDirection, moveVector.z);
      worldMove.addScaledVector(cameraRight, moveVector.x);

      // 应用速度
      const speed = this.keys["ShiftLeft"]
        ? this.config.sprintSpeed
        : this.config.speed;
      const targetVelocity = worldMove.multiplyScalar(speed);

      // 平滑插值到目标速度
      this.velocity.x = THREE.MathUtils.lerp(
        this.velocity.x,
        targetVelocity.x,
        10 * deltaTime
      );
      this.velocity.z = THREE.MathUtils.lerp(
        this.velocity.z,
        targetVelocity.z,
        10 * deltaTime
      );
    } else {
      // 减速
      this.velocity.x = THREE.MathUtils.lerp(
        this.velocity.x,
        0,
        10 * deltaTime
      );
      this.velocity.z = THREE.MathUtils.lerp(
        this.velocity.z,
        0,
        10 * deltaTime
      );
    }

    // 更新视角旋转
    this.rotation.y = this.mouseMovement.x;
    this.rotation.x = this.mouseMovement.y;
  }

  /**
   * 更新物理
   */
  private updatePhysics(deltaTime: number): void {
    // 应用重力
    if (!this.isOnGround) {
      this.velocity.y -= this.config.gravity * deltaTime;
    }

    // 应用速度到位置
    this.position.addScaledVector(this.velocity, deltaTime);
  }

  /**
   * 检查地面碰撞
   */
  private checkGroundCollision(): void {
    if (this.collisionObjects.length === 0) {
      // 如果没有碰撞对象，设置一个默认地面
      if (this.position.y < 0) {
        this.position.y = this.config.eyeHeight;
        this.velocity.y = 0;
        this.isOnGround = true;
      } else {
        this.isOnGround = false;
      }
      return;
    }

    // 从玩家脚部稍微上方向下发射射线
    const footPosition = this.position.clone();
    footPosition.y -= this.config.eyeHeight - 0.1; // 稍微抬高一点起始位置

    this.raycaster.set(footPosition, new THREE.Vector3(0, -1, 0));
    this.raycaster.far = 5.0; // 增加检测距离到5米

    const intersections = this.raycaster.intersectObjects(
      this.collisionObjects,
      true
    );

    // 调试信息 - 每隔一段时间打印一次
    const now = Date.now();
    if (!this.lastDebugTime || now - this.lastDebugTime > 1000) {
      console.log("碰撞检测调试:", {
        playerPos: this.position.clone(),
        footPos: footPosition.clone(),
        intersections: intersections.length,
        isOnGround: this.isOnGround,
        velocity: this.velocity.clone(),
      });
      if (intersections.length > 0) {
        console.log(
          "最近的交点:",
          intersections[0].point,
          "距离:",
          intersections[0].distance
        );
      }
      this.lastDebugTime = now;
    }

    if (intersections.length > 0) {
      const intersection = intersections[0];
      const groundY = intersection.point.y;
      const playerFootY = this.position.y - this.config.eyeHeight;

      // 更宽松的地面检测
      if (playerFootY <= groundY + 0.1) {
        this.isOnGround = true;
        this.position.y = groundY + this.config.eyeHeight;
        if (this.velocity.y < 0) {
          this.velocity.y = 0;
        }
      } else {
        this.isOnGround = false;
      }
    } else {
      this.isOnGround = false;
    }

    // 调试信息
    if (this.position.y < -10) {
      console.warn("玩家掉落过深，重置位置");
      this.position.set(0, this.config.eyeHeight, 0);
      this.velocity.set(0, 0, 0);
      this.isOnGround = false;
    }
  }

  private lastDebugTime = 0;

  /**
   * 处理水平碰撞
   */
  private handleHorizontalCollisions(): void {
    if (this.collisionObjects.length === 0) return;

    const directions = [
      new THREE.Vector3(1, 0, 0), // 右
      new THREE.Vector3(-1, 0, 0), // 左
      new THREE.Vector3(0, 0, 1), // 前
      new THREE.Vector3(0, 0, -1), // 后
    ];

    for (const direction of directions) {
      const rayOrigin = this.position.clone();
      rayOrigin.y -= this.config.eyeHeight * 0.5; // 从腰部发射

      this.raycaster.set(rayOrigin, direction);
      this.raycaster.far = this.config.collisionRadius;

      const intersections = this.raycaster.intersectObjects(
        this.collisionObjects,
        true
      );

      if (intersections.length > 0) {
        const intersection = intersections[0];
        const distance = intersection.distance;

        if (distance < this.config.collisionRadius) {
          // 推出玩家
          const pushDistance = this.config.collisionRadius - distance + 0.01;
          this.position.addScaledVector(direction, -pushDistance);

          // 停止该方向的速度
          if (direction.x !== 0) this.velocity.x = 0;
          if (direction.z !== 0) this.velocity.z = 0;
        }
      }
    }
  }

  /**
   * 更新相机变换
   */
  private updateCameraTransform(): void {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.rotation.x, this.rotation.y, 0, "YXZ");
  }

  /**
   * 设置位置
   */
  public setPosition(position: THREE.Vector3): void {
    this.position.copy(position);
    this.updateCameraTransform();
  }

  /**
   * 设置旋转
   */
  public setRotation(rotation: THREE.Euler): void {
    this.rotation.copy(rotation);
    this.mouseMovement.set(rotation.y, rotation.x);
    this.updateCameraTransform();
  }

  /**
   * 获取前进方向
   */
  public getForwardDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyEuler(this.rotation);
    return direction;
  }

  /**
   * 设置碰撞对象
   */
  public setCollisionObjects(objects: THREE.Object3D[]): void {
    this.collisionObjects = objects;
    console.log(`PlayerController: 设置了 ${objects.length} 个碰撞对象`);

    // 调试信息：打印碰撞对象的详细信息
    objects.forEach((obj, index) => {
      if (obj instanceof THREE.Mesh) {
        const bbox = new THREE.Box3().setFromObject(obj);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());
        console.log(`碰撞对象 ${index}:`, {
          name: obj.name || "未命名",
          type: obj.constructor.name,
          position: obj.position.clone(),
          center: center,
          size: size,
          boundingBox: {
            min: bbox.min.clone(),
            max: bbox.max.clone(),
          },
        });
      }
    });
  }

  /**
   * 传送到位置
   */
  public teleport(position: THREE.Vector3, rotation?: THREE.Euler): void {
    this.position.copy(position);
    if (rotation) {
      this.setRotation(rotation);
    }
    this.velocity.set(0, 0, 0);
    this.isOnGround = false; // 重置地面状态，让下一帧检查
    this.updateCameraTransform();

    // 立即检查地面碰撞
    setTimeout(() => {
      this.checkGroundCollision();
    }, 100);
  }

  /**
   * 清理
   */
  public dispose(): void {
    document.removeEventListener("keydown", this.onKeyDown.bind(this));
    document.removeEventListener("keyup", this.onKeyUp.bind(this));
    document.removeEventListener("mousemove", this.onMouseMove.bind(this));
    document.removeEventListener("click", this.requestPointerLock.bind(this));
    document.removeEventListener("mousedown", this.onMouseDown.bind(this));
    document.removeEventListener(
      "pointerlockchange",
      this.onPointerLockChange.bind(this)
    );

    gameEngine.removeUpdateCallback(this.update.bind(this));
  }

  // Getter方法用于LiDAR系统
  public getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  public getRotation(): { pitch: number; yaw: number } {
    return {
      pitch: this.rotation.x,
      yaw: this.rotation.y,
    };
  }

  // 兼容性属性（保持向后兼容）
  public get playerPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  public get pitch(): number {
    return this.rotation.x;
  }

  public get yaw(): number {
    return this.rotation.y;
  }
}
