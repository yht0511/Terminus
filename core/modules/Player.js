/**
 * 玩家控制器模块
 * 基于Rapier.js CharacterController的速度型玩家控制
 */

import * as THREE from "three";

export class Player {
  constructor(world, rapier, scene, camera) {
    this.world = world;
    this.rapier = rapier;
    this.scene = scene;
    this.camera = camera;

    // 玩家配置
    this.config = {
      height: 1.7,
      radius: 0.3,
      speed: 5.0,
      jumpSpeed: 8.0,
      acceleration: 20.0,
      deceleration: 15.0,
      airControl: 0.3,
      maxSlopeAngle: 45,
      stepHeight: 0.5,
      snapDistance: 0.3,
    };

    // 速度状态
    this.velocity = { x: 0, y: 0, z: 0 };
    this.targetVelocity = { x: 0, y: 0, z: 0 };

    // 状态标志
    this.isGrounded = false;
    this.wasGrounded = false;
    this.jumpRequested = false;

    // 相机控制
    this.cameraController = {
      pitch: 0,
      yaw: 0,
      sensitivity: 0.002,
    };

    // 输入状态
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, locked: false };

    // 物理组件
    this.characterController = null;
    this.rigidBody = null;
    this.collider = null;

    this.setupPhysics();
    this.setupControls();

    console.log("👤 玩家控制器已初始化");
  }

  /**
   * 设置物理组件
   */
  setupPhysics() {
    const initialY = this.config.height / 2 + 0.1;

    // 创建 CharacterController
    this.characterController = this.world.createCharacterController(0.01);
    this.configureCharacterController();

    // 创建运动学刚体（用于 CharacterController）
    const bodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, initialY, 5);
    this.rigidBody = this.world.createRigidBody(bodyDesc);

    // 创建胶囊碰撞器
    const halfHeight = (this.config.height - 2 * this.config.radius) / 2;
    const colliderDesc = this.rapier.ColliderDesc.capsule(halfHeight, this.config.radius)
      .setFriction(0.0);
    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

    console.log(`👤 玩家物理组件已创建 - 高度: ${this.config.height}m, 半径: ${this.config.radius}m`);
  }

  /**
   * 配置 CharacterController
   */
  configureCharacterController() {
    this.characterController.enableAutostep(this.config.stepHeight, 0.2, true);
    this.characterController.enableSnapToGround(this.config.snapDistance);
    this.characterController.setMaxSlopeClimbAngle(this.config.maxSlopeAngle * Math.PI / 180);
    this.characterController.setMinSlopeSlideAngle(60 * Math.PI / 180);
  }

  /**
   * 设置控制
   */
  setupControls() {
    document.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
    });

    document.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    document.addEventListener("mousemove", (event) => {
      if (this.mouse.locked) {
        this.mouse.x += event.movementX;
        this.mouse.y += event.movementY;
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.mouse.locked = document.pointerLockElement !== null;
    });
  }

  /**
   * 主更新函数
   */
  update(deltaTime) {
    this.updateGroundState(deltaTime);
    this.handleJumping(deltaTime);
    this.updateHorizontalVelocity(deltaTime);
    this.performMovement(deltaTime);
    this.updateCamera(deltaTime);
    this.postUpdate();
  }

  /**
   * 更新地面状态
   */
  updateGroundState(deltaTime) {
    this.wasGrounded = this.isGrounded;
    this.isGrounded = this.characterController.computedGrounded();
  }

  /**
   * 更新水平速度
   */
  updateHorizontalVelocity(deltaTime) {
    let moveX = 0, moveZ = 0;

    // 输入检测
    if (this.keys.has("KeyW")) moveZ = -1;
    if (this.keys.has("KeyS")) moveZ = 1;
    if (this.keys.has("KeyA")) moveX = -1;
    if (this.keys.has("KeyD")) moveX = 1;

    // 标准化输入向量
    if (moveX !== 0 || moveZ !== 0) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;

      // 相对于相机方向
      const direction = new THREE.Vector3(moveX, 0, moveZ);
      direction.applyQuaternion(this.camera.quaternion);
      direction.y = 0;
      direction.normalize();

      this.targetVelocity.x = direction.x * this.config.speed;
      this.targetVelocity.z = direction.z * this.config.speed;
    } else {
      this.targetVelocity.x = 0;
      this.targetVelocity.z = 0;
    }

    // 选择加速度（地面 vs 空中）
    const controlFactor = this.isGrounded ? 1.0 : this.config.airControl;
    const accel = (moveX !== 0 || moveZ !== 0) 
      ? this.config.acceleration * controlFactor
      : this.config.deceleration * controlFactor;

    // 平滑插值到目标速度
    this.velocity.x = this.lerpVelocity(this.velocity.x, this.targetVelocity.x, accel, deltaTime);
    this.velocity.z = this.lerpVelocity(this.velocity.z, this.targetVelocity.z, accel, deltaTime);
  }

  /**
   * 速度插值
   */
  lerpVelocity(current, target, acceleration, deltaTime) {
    const diff = target - current;
    const maxChange = acceleration * deltaTime;
    
    if (Math.abs(diff) <= maxChange) {
      return target;
    }
    return current + Math.sign(diff) * maxChange;
  }

  /**
   * 处理跳跃
   */
  handleJumping(deltaTime) {
    if (this.keys.has("Space")) {
      if (!this.jumpRequested && this.isGrounded) {
        this.velocity.y = this.config.jumpSpeed;
        this.jumpRequested = true;
      }
    } else {
      this.jumpRequested = false;
    }
  }

  /**
   * 执行物理移动
   */
  performMovement(deltaTime) {
    // 计算期望移动
    const desiredTranslation = {
      x: this.velocity.x * deltaTime,
      y: this.velocity.y * deltaTime,
      z: this.velocity.z * deltaTime
    };

    // 使用 CharacterController 计算碰撞
    this.characterController.computeColliderMovement(this.collider, desiredTranslation);

    // 获取修正后的移动
    const movement = this.characterController.computedMovement();

    // 应用移动
    const currentPos = this.rigidBody.translation();
    this.rigidBody.setNextKinematicTranslation({
      x: currentPos.x + movement.x,
      y: currentPos.y + movement.y,
      z: currentPos.z + movement.z
    });

    // 处理碰撞反馈
    this.handleCollisionFeedback(desiredTranslation, movement);
  }

  /**
   * 处理碰撞反馈
   */
  handleCollisionFeedback(desired, actual) {
    const tolerance = 0.001;

    // 检查水平碰撞
    if (Math.abs(desired.x - actual.x) > tolerance) {
      this.velocity.x = 0; // 撞墙停止水平速度
    }
    if (Math.abs(desired.z - actual.z) > tolerance) {
      this.velocity.z = 0;
    }

    // 检查垂直碰撞（主要处理跳跃后撞到天花板的情况）
    if (Math.abs(desired.y - actual.y) > tolerance && desired.y > 0) {
      this.velocity.y = 0; // 撞天花板
    }
  }

  /**
   * 更新相机
   */
  updateCamera(deltaTime) {
    if (!this.mouse.locked) return;

    // 更新旋转
    this.cameraController.yaw -= this.mouse.x * this.cameraController.sensitivity;
    this.cameraController.pitch -= this.mouse.y * this.cameraController.sensitivity;
    this.cameraController.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraController.pitch));

    // 重置鼠标增量
    this.mouse.x = 0;
    this.mouse.y = 0;

    // 应用旋转
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.cameraController.yaw;
    this.camera.rotation.x = this.cameraController.pitch;

    // 跟随玩家
    const playerPos = this.rigidBody.translation();
    this.camera.position.set(
      playerPos.x,
      playerPos.y + this.config.height * 0.35,
      playerPos.z
    );
  }

  /**
   * 后处理
   */
  postUpdate() {
    // 限制最大速度
    const maxSpeed = 20.0;
    const horizontalSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    if (horizontalSpeed > maxSpeed) {
      const factor = maxSpeed / horizontalSpeed;
      this.velocity.x *= factor;
      this.velocity.z *= factor;
    }

    // 着地事件
    if (!this.wasGrounded && this.isGrounded) {
      this.onLanded();
    }
    if (this.wasGrounded && !this.isGrounded) {
      this.onLeftGround();
    }
  }

  /**
   * 获取位置
   */
  getPosition() {
    return this.rigidBody.translation();
  }

  /**
   * 获取速度
   */
  getVelocity() {
    return { ...this.velocity };
  }

  /**
   * 检查是否在地面
   */
  isOnGround() {
    return this.isGrounded;
  }

  /**
   * 传送到指定位置
   */
  teleport(position) {
    this.rigidBody.setTranslation(position, true);
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  /**
   * 事件回调
   */
  onLanded() {
    console.log("👤 玩家着地");
  }

  onLeftGround() {
    console.log("👤 玩家离地");
  }

  /**
   * 销毁玩家
   */
  destroy() {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
    }
    if (this.rigidBody) {
      this.world.removeRigidBody(this.rigidBody);
    }
    if (this.characterController) {
      this.world.removeCharacterController(this.characterController);
    }
    console.log("👤 玩家已销毁");
  }
}