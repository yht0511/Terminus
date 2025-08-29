/**
 * 玩家控制器模块
 * 基于Rapier.js官方推荐的 CharacterController 实现，功能强大且稳定。
 */

import * as THREE from "three";

export class Player {
  constructor(world, rapier, scene, camera) {
    this.world = world;
    this.rapier = rapier;
    this.scene = scene;
    this.camera = camera;

    // 玩家配置，可以根据游戏手感微调
    this.config = {
      // 物理参数
      height: 1.7, // 玩家总高度
      radius: 0.4, // 玩家半径
      speed: 6.0, // 地面移动速度
      jumpSpeed: 9.0, // 起跳时的垂直速度
      acceleration: 30.0, // 达到最高速的加速度
      deceleration: 30.0, // 停止移动时的减速度
      airControl: 0.5, // 空中控制能力（0-1）
      gravityScale: 1.0, // 应用的重力倍数
      
      // CharacterController 核心参数
      controllerOffset: 0.01, // 一个微小的偏移量，防止与地面穿透
      maxSlopeAngle: 45, // 可以爬上的最大坡度（角度）
      minSlopeSlideAngle: 60, // 开始下滑的最小坡度（角度）
      stepHeight: 0.4, // 可以自动迈上的台阶最大高度
      stepMinWidth: 0.5, // 台阶的最小宽度
      snapDistance: 0.2, // 向下吸附到地面的最大距离，用于平稳下坡
      
      // 相机参数
      mouseSensitivity: 0.002,
      cameraHeightRatio: 0.45, // 相机在身高中的位置比例（0.5为正中）
    };

    // 运动状态
    this.velocity = new THREE.Vector3();
    this.targetVelocity = new THREE.Vector3();

    // 状态标志
    this.isGrounded = false;
    this.wasGrounded = false;
    this.jumpRequested = false;

    // 相机控制
    this.cameraController = { pitch: 0, yaw: 0 };

    // 输入状态
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, locked: false };

    // Rapier 物理组件
    this.characterController = null;
    this.rigidBody = null;
    this.collider = null;

    this.setupPhysics();
    this.setupControls();

    console.log("👤 玩家控制器已初始化 (CharacterController)");
  }

  /**
   * 设置物理组件
   */
  setupPhysics() {
    // 1. 创建 Rapier 的 CharacterController 实例
    // 这是控制器的大脑，负责所有复杂的移动计算
    this.characterController = this.world.createCharacterController(this.config.controllerOffset);
    this.configureCharacterController();

    // 2. 创建一个运动学刚体 (Kinematic Body)
    // 这种刚体不受力影响，完全由代码控制其位置，非常适合角色控制器
    const initialY = this.config.height / 2 + 5.0; // 出生在空中5米
    const bodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, initialY, 5);
    this.rigidBody = this.world.createRigidBody(bodyDesc);

    // 3. 创建一个胶囊碰撞体 (Capsule Collider)
    // 这是角色控制器的最佳选择，因为它光滑的表面可以流畅地滑过墙壁和障碍物
    const halfHeight = (this.config.height - 2 * this.config.radius) / 2;
    const colliderDesc = this.rapier.ColliderDesc.capsule(halfHeight, this.config.radius)
      .setFriction(0.0); // 设置摩擦力为0，确保贴墙移动时不会被卡住
      
    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

    console.log(`👤 玩家物理组件已创建 - 高度: ${this.config.height}m, 半径: ${this.config.radius}m`);
  }

  /**
   * 配置 CharacterController 的高级功能
   */
  configureCharacterController() {
    this.characterController.enableAutostep(this.config.stepHeight, this.config.stepMinWidth, true);
    this.characterController.enableSnapToGround(this.config.snapDistance);
    this.characterController.setMaxSlopeClimbAngle(this.config.maxSlopeAngle * Math.PI / 180);
    this.characterController.setMinSlopeSlideAngle(this.config.minSlopeSlideAngle * Math.PI / 180);
  }

  /**
   * 设置输入控制监听
   */
  setupControls() {
    document.addEventListener("keydown", (event) => this.keys.add(event.code));
    document.addEventListener("keyup", (event) => this.keys.delete(event.code));
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
   * 主更新循环，在 Scene 的 animate 方法中被调用
   */
  update(deltaTime) {
    this.updateGroundState();
    this.handleJumping();
    this.updateHorizontalVelocity(deltaTime);
    this.applyGravity(deltaTime);
    this.performMovement(deltaTime);
    this.updateCamera();
    this.postUpdate();
  }

  /**
   * 使用 CharacterController 的内置方法更新地面状态
   */
  updateGroundState() {
    this.wasGrounded = this.isGrounded;
    // computedGrounded() 是 CharacterController 的核心功能之一，它能精确判断是否着地
    this.isGrounded = this.characterController.computedGrounded();
  }
  
  /**
   * 处理跳跃输入
   */
  handleJumping() {
    if (this.keys.has("Space")) {
      // 只有在着地且尚未请求跳跃时，才执行跳跃
      if (!this.jumpRequested && this.isGrounded) {
        this.velocity.y = this.config.jumpSpeed;
        this.jumpRequested = true; // 标记为已请求，防止按住空格连续跳
      }
    } else {
      this.jumpRequested = false; // 松开空格键后，重置请求状态
    }
  }

  /**
   * 根据输入更新水平速度
   */
  updateHorizontalVelocity(deltaTime) {
    let moveX = 0, moveZ = 0;
    if (this.keys.has("KeyW")) moveZ = -1;
    if (this.keys.has("KeyS")) moveZ = 1;
    if (this.keys.has("KeyA")) moveX = -1;
    if (this.keys.has("KeyD")) moveX = 1;

    // 计算相对于相机方向的移动向量
    const moveDirection = new THREE.Vector3(moveX, 0, moveZ).normalize();
    if (moveDirection.length() > 0.1) {
        moveDirection.applyQuaternion(this.camera.quaternion).normalize();
        this.targetVelocity.x = moveDirection.x * this.config.speed;
        this.targetVelocity.z = moveDirection.z * this.config.speed;
    } else {
        this.targetVelocity.x = 0;
        this.targetVelocity.z = 0;
    }

    // 根据是否在地面应用不同的加速度，实现空中控制
    const controlFactor = this.isGrounded ? 1.0 : this.config.airControl;
    const accel = this.targetVelocity.length() > 0.1 ? this.config.acceleration : this.config.deceleration;

    // 使用线性插值平滑地改变当前速度，获得更好的手感
    this.velocity.x = this.lerp(this.velocity.x, this.targetVelocity.x, accel * controlFactor * deltaTime);
    this.velocity.z = this.lerp(this.velocity.z, this.targetVelocity.z, accel * controlFactor * deltaTime);
  }

  /**
   * 线性插值函数
   */
  lerp(start, end, amount) {
    return (1 - amount) * start + amount * end;
  }

  /**
   * 应用重力
   */
  applyGravity(deltaTime) {
    if (this.isGrounded) {
      if (this.velocity.y < 0) this.velocity.y = 0;
    } else {
      this.velocity.y += this.world.gravity.y * this.config.gravityScale * deltaTime;
    }
  }

  /**
   * 使用 CharacterController 执行物理移动
   */
  performMovement(deltaTime) {
    const desiredTranslation = this.velocity.clone().multiplyScalar(deltaTime);

    // 核心步骤：让 CharacterController 计算考虑碰撞后的实际可移动距离
    this.characterController.computeColliderMovement(this.collider, desiredTranslation);

    const movement = this.characterController.computedMovement();

    // 应用计算出的安全移动
    const currentPos = this.rigidBody.translation();
    this.rigidBody.setNextKinematicTranslation({
      x: currentPos.x + movement.x,
      y: currentPos.y + movement.y,
      z: currentPos.z + movement.z
    });
    
    // 如果发生碰撞（实际移动距离小于期望距离），则将该方向的速度清零
    if (Math.abs(desiredTranslation.x - movement.x) > 0.001) this.velocity.x = 0;
    if (Math.abs(desiredTranslation.z - movement.z) > 0.001) this.velocity.z = 0;
    if (Math.abs(desiredTranslation.y - movement.y) > 0.001) this.velocity.y = 0;
  }

  /**
   * 更新相机位置和朝向
   */
  updateCamera() {
    if (!this.mouse.locked) return;

    // 更新旋转角度
    this.cameraController.yaw -= this.mouse.x * this.config.mouseSensitivity;
    this.cameraController.pitch -= this.mouse.y * this.config.mouseSensitivity;
    this.cameraController.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraController.pitch));
    this.mouse.x = this.mouse.y = 0; // 重置鼠标增量

    // 应用旋转到相机
    this.camera.rotation.set(this.cameraController.pitch, this.cameraController.yaw, 0, "YXZ");

    // 相机位置跟随刚体
    const playerPos = this.rigidBody.translation();
    const cameraY = playerPos.y + this.config.height * this.config.cameraHeightRatio;
    this.camera.position.set(playerPos.x, cameraY, playerPos.z);
  }
  
  /**
   * 在更新循环末尾执行的后处理
   */
  postUpdate() {
    if (!this.wasGrounded && this.isGrounded) this.onLanded();
    if (this.wasGrounded && !this.isGrounded) this.onLeftGround();
  }

  // --- 公共API ---
  getPosition() { return this.rigidBody.translation(); }
  getVelocity() { return this.velocity.clone(); }
  isOnGround() { return this.isGrounded; }

  // --- 事件回调 ---
  onLanded() { console.log("👤 玩家着地"); }
  onLeftGround() { console.log("👤 玩家离地"); }
  
  /**
   * 销毁玩家以释放资源
   */
  destroy() {
    if (this.characterController) this.world.removeCharacterController(this.characterController);
    if (this.collider) this.world.removeCollider(this.collider, true);
    if (this.rigidBody) this.world.removeRigidBody(this.rigidBody);
    console.log("👤 玩家已销毁");
  }
}