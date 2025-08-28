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

  // 临时变量，减少垃圾回收压力
  private tempVector1 = new THREE.Vector3();
  private tempVector2 = new THREE.Vector3();
  private tempVector3 = new THREE.Vector3();
  private tempVector4 = new THREE.Vector3();
  private tempEuler = new THREE.Euler();
  private tempQuaternion = new THREE.Quaternion();
  private tempMatrix = new THREE.Matrix4();
  private tempBox = new THREE.Box3();
  private tempRayOrigin = new THREE.Vector3();

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

    this.mouseMovement.x -= event.movementX * this.config.mouseSensitivity;
    this.mouseMovement.y -= event.movementY * this.config.mouseSensitivity;

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
    // moveVector 存储原始输入方向
    const moveVector = this.tempVector1.set(0, 0, 0);
    if (this.keys["KeyW"]) moveVector.z = -1;
    if (this.keys["KeyS"]) moveVector.z = 1;
    if (this.keys["KeyA"]) moveVector.x = -1;
    if (this.keys["KeyD"]) moveVector.x = 1;

    this.isMoving = moveVector.lengthSq() > 0;

    if (this.isMoving) {
      moveVector.normalize();

      // 旋转输入向量以匹配相机方向
      // 使用一个只用于水平旋转的四元数
      const horizontalQuaternion = this.tempQuaternion.setFromEuler(this.tempEuler.set(0, this.rotation.y, 0));

      // worldMove 存储旋转后的方向
      const worldMove = this.tempVector2.copy(moveVector).applyQuaternion(horizontalQuaternion);

      // 计算目标速度向量
      const speed = this.keys["ShiftLeft"] ? this.config.sprintSpeed : this.config.speed;
      worldMove.multiplyScalar(speed);

      // 平滑插值到目标速度
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, worldMove.x, 10 * deltaTime);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, worldMove.z, 10 * deltaTime);
    } else {
      // 减速
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, 10 * deltaTime);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, 10 * deltaTime);
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
    const footPosition = this.tempVector1.copy(this.position);
    footPosition.y -= this.config.eyeHeight - 0.1;

    this.raycaster.set(footPosition, this.tempVector2.set(0, -1, 0));
    this.raycaster.far = 0.2; // 减小检测距离，只检查非常靠近地面的情况

    const intersections = this.raycaster.intersectObjects(
      this.collisionObjects,
      true
    );

    // 仅在玩家向下或静止时进行地面碰撞修正
    if (this.velocity.y <= 0) {
      if (intersections.length > 0) {
        const intersection = intersections[0];
        const groundY = intersection.point.y;
        const playerFootY = this.position.y - this.config.eyeHeight;

        // 检查是否在地面上或非常接近
        if (playerFootY <= groundY + 0.1) {
          this.isOnGround = true;
          this.position.y = groundY + this.config.eyeHeight;
          if (this.velocity.y < 0) {
            this.velocity.y = 0; // 停止下落
          }
        } else {
          this.isOnGround = false;
        }
      } else {
        this.isOnGround = false;
      }
    } else {
      // 向上移动时，玩家绝对不在地面上
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

    // 预先创建所有方向向量，但不要将它们放入数组，以免相互影响
    const right = this.tempVector1.set(1, 0, 0);
    const left = this.tempVector2.set(-1, 0, 0);
    const forward = this.tempVector3.set(0, 0, 1);
    const backward = this.tempVector4.set(0, 0, -1);
    
    // 创建一个包含所有方向的数组
    const directions = [right, left, forward, backward];

    // 复用 rayOrigin 变量
    const rayOrigin = this.tempRayOrigin;
    
    for (const direction of directions) {
      // 使用 .clone() 或者在循环外声明一个单独的 tempRayOrigin
      rayOrigin.copy(this.position);
      rayOrigin.y -= this.config.eyeHeight * 0.5;

      this.raycaster.set(rayOrigin, direction);
      this.raycaster.far = this.config.collisionRadius;

      const intersections = this.raycaster.intersectObjects(this.collisionObjects, true);

      if (intersections.length > 0) {
        const intersection = intersections[0];
        const distance = intersection.distance;

        if (distance < this.config.collisionRadius) {
          const pushDistance = this.config.collisionRadius - distance + 0.01;
          this.position.addScaledVector(direction, -pushDistance);

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