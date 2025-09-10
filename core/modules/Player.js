/**
 * 玩家控制器模块
 * 基于Rapier.js官方推荐的 CharacterController 实现，功能强大且稳定。
 */

import { TriMeshFlags } from "@dimforge/rapier3d-compat";
import * as THREE from "three";

export class Player {
  constructor(world, rapier, RayCaster, camera, core) {
    this.world = world;
    this.rapier = rapier;
    this.RayCaster = RayCaster;
    this.camera = camera;
    this.core = core;
    this.element = null;
    this.currentInteractEntity = null;
    this.saveInterval = null;
    this.move_enabled = true;

    // 玩家配置，可以根据游戏手感微调
    this.config = {
      // 物理参数
      height: 1.1, // 玩家总高度
      radius: 0.3, // 玩家半径
      normal_speed: 6.1, // 地面移动速度
      fast_speed: 15.0,
      fast_speed_creative: 25.0, // 创造模式下的快速移动速度
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
      stepMinWidth: 0.2, // 台阶的最小宽度
      snapDistance: 0.3, // 向下吸附到地面的最大距离，用于平稳下坡
      yvel_epsL: 0.001, //y方向楼梯检测，若y向分量处于 [L,R] 之间，需要调整速度
      yvel_epsR: 1,
      stair_speed: 10.0, //上楼梯过程中的水平速度调整

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

    this.entity = this.core.getEntity("self");
    // 相机控制
    this.cameraController = {
      pitch: this.entity.properties.rotation[0],
      yaw: this.entity.properties.rotation[1],
    };

    // 平滑旋转控制
    this.smoothRotation = {
      isActive: false,
      targetPitch: 0,
      targetYaw: 0,
      speed: 20.0, // 旋转速度，可调节
      threshold: 0.1, // 停止旋转的阈值
    };

    // 输入状态
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, locked: false };

    // Rapier 物理组件
    this.characterController = null;
    this.rigidBody = null;
    this.collider = null;

    // 缓存物理状态以避免在物理步骤期间访问
    this.cachedPosition = { x: 0, y: 0, z: 0 };
    this.cachedVelocity = { x: 0, y: 0, z: 0 };
    this.lastCacheUpdate = 0;

    this.setupPhysics();
    this.setupRenderer();

    this.saveInterval = setInterval(() => {
      this.savePlayerState();
    }, 100);

    console.log("👤 玩家控制器已初始化 (CharacterController)");
  }

  /**
   * 设置物理组件
   */
  setupPhysics() {
    // 1. 创建 Rapier 的 CharacterController 实例
    // 这是控制器的大脑，负责所有复杂的移动计算
    this.characterController = this.world.createCharacterController(
      this.config.controllerOffset
    );
    this.configureCharacterController();

    // 2. 创建一个运动学刚体 (Kinematic Body)
    // 这种刚体不受力影响，完全由代码控制其位置，非常适合角色控制器
    const initialY = this.config.height / 2 + 5.0; // 出生在空中5米
    const bodyDesc =
      this.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
        ...this.entity.properties.coordinates
      );
    this.rigidBody = this.world.createRigidBody(bodyDesc);

    // 3. 创建一个胶囊碰撞体 (Capsule Collider)
    // 这是角色控制器的最佳选择，因为它光滑的表面可以流畅地滑过墙壁和障碍物
    const halfHeight = (this.config.height - 2 * this.config.radius) / 2;
    const colliderDesc = this.rapier.ColliderDesc.capsule(
      halfHeight,
      this.config.radius
    ).setFriction(0.0); // 设置摩擦力为0，确保贴墙移动时不会被卡住

    this.collider = this.world.createCollider(colliderDesc, this.rigidBody);

    // 初始化缓存状态
    this.updateCachedState();

    console.log(
      `👤 玩家物理组件已创建 - 高度: ${this.config.height}m, 半径: ${this.config.radius}m`
    );
  }

  setupRenderer() {
    const hint = document.createElement("div");
    hint.id = "interaction-hint";
    hint.textContent = "按 E 进行交互";
    hint.style.position = "absolute";
    hint.style.bottom = "20%";
    hint.style.left = "50%";
    hint.style.transform = "translateX(-50%)";
    hint.style.padding = "12px 24px";
    hint.style.background = "rgba(0,0,0,0.7)";
    hint.style.color = "#fff";
    hint.style.fontSize = "1.2em";
    hint.style.borderRadius = "8px";
    hint.style.display = "none";
    hint.style.pointerEvents = "none";
    // hint.style.zIndex = "1000";
    this.element = hint;
    return this.element;
  }

  /**
   * 配置 CharacterController 的高级功能
   */
  configureCharacterController() {
    this.characterController.enableAutostep(
      this.config.stepHeight,
      this.config.stepMinWidth,
      true
    );
    this.characterController.enableSnapToGround(this.config.snapDistance);
    this.characterController.setMaxSlopeClimbAngle(
      (this.config.maxSlopeAngle * Math.PI) / 180
    );
    this.characterController.setMinSlopeSlideAngle(
      (this.config.minSlopeSlideAngle * Math.PI) / 180
    );
  }

  handleInput(event) {
    if (event.type === "keydown") {
      this.handleInputKeyDown(event);
    }
    if (event.type === "keyup") {
      this.handleInputKeyUp(event);
    }
    if (event.type === "mousemove") {
      this.handleInputMouseMove(event);
    }
    if (event.type === "click") {
      this.core.scene.flashlight = 1;
    }
    this.checkInputPointerLock();
  }

  handleInputKeyDown(event) {
    // 键盘输入处理
    if (event.code === "KeyW") {
      this.keys.add("KeyW");
    } else if (event.code === "KeyS") {
      this.keys.add("KeyS");
    } else if (event.code === "KeyA") {
      this.keys.add("KeyA");
    } else if (event.code === "KeyD") {
      this.keys.add("KeyD");
    } else if (event.code === "Space") {
      this.keys.add("Space");
    } else if (event.code === "ShiftLeft") {
      this.keys.add("ShiftLeft");
    } else if (event.code === "ArrowUp") {
      this.keys.add("KeyUp");
    } else if (event.code === "ArrowDown") {
      this.keys.add("KeyDown");
    } else if (event.code === "KeyE") {
      this.handleInteraction();
    }
  }

  handleInputKeyUp(event) {
    // 键盘输入处理
    if (event.code === "KeyW") {
      this.keys.delete("KeyW");
    } else if (event.code === "KeyS") {
      this.keys.delete("KeyS");
    } else if (event.code === "KeyA") {
      this.keys.delete("KeyA");
    } else if (event.code === "KeyD") {
      this.keys.delete("KeyD");
    } else if (event.code === "Space") {
      this.keys.delete("Space");
    } else if (event.code === "ShiftLeft") {
      this.keys.delete("ShiftLeft");
    } else if (event.code === "ArrowUp") {
      this.keys.delete("KeyUp");
    } else if (event.code === "ArrowDown") {
      this.keys.delete("KeyDown");
    } else if (event.code === "KeyF") {
      this.core.scene.flashlight = 0;
    }
  }

  handleInputMouseMove(event) {
    // 鼠标移动输入处理
    if (document.mouse_locked) {
      this.mouse.x += event.movementX;
      this.mouse.y += event.movementY;
    }
  }

  checkInputPointerLock() {
    // 检查指针锁定状态
    this.mouse.locked = document.mouse_locked;
    if (!this.mouse.locked) {
      this.mouse.x = 0;
      this.mouse.y = 0;
      this.keys.clear();
    }
  }

  /**
   * 主更新循环，在 Scene 的 animate 方法中被调用
   */
  update(deltaTime) {
    this.updateGroundState();
    this.handleJumping();
    this.updateVelocity(deltaTime);
    this.applyGravity(deltaTime);
    this.performMovement(deltaTime);
    this.updateCamera();
    this.updateSmoothRotation(deltaTime); // 添加平滑旋转更新
    this.postUpdate();
    this.updateInteraction();
    this.updateDistanceInteraction();
    this.checkDeath();
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
    if (this.keys.has("Space") && !core.script.creative) {
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
   * 根据输入更新速度
   */
  updateVelocity(deltaTime) {
    let moveX = 0,
      moveZ = 0,
      moveY = 0,
      speed = this.config.normal_speed;
    if (this.keys.has("KeyW")) moveZ = -1;
    if (this.keys.has("KeyS")) moveZ = 1;
    if (this.keys.has("KeyA")) moveX = -1;
    if (this.keys.has("KeyD")) moveX = 1;
    if (this.keys.has("ShiftLeft")) {
      speed = this.config.fast_speed;
      if (core.script.creative) speed = this.config.fast_speed_creative;
    }
    if (core.script.creative) {
      if (this.keys.has("KeyUp") || this.keys.has("Space")) moveY = 1;
      if (this.keys.has("KeyDown")) moveY = -1;
      this.velocity.y = moveY * speed;
    }

    // 计算相对于相机方向的移动向量
    const moveDirection = new THREE.Vector3(moveX, 0, moveZ).normalize();
    if (moveDirection.length() > 0.1) {
      moveDirection.applyQuaternion(this.camera.quaternion).normalize();
      this.targetVelocity.x = moveDirection.x * speed;
      this.targetVelocity.z = moveDirection.z * speed;
    } else {
      this.targetVelocity.x = 0;
      this.targetVelocity.z = 0;
    }

    // 根据是否在地面应用不同的加速度，实现空中控制
    const controlFactor = this.isGrounded ? 1.0 : this.config.airControl;
    const accel =
      this.targetVelocity.length() > 0.1
        ? this.config.acceleration
        : this.config.deceleration;

    // 使用线性插值平滑地改变当前速度，获得更好的手感
    this.velocity.x = this.lerp(
      this.velocity.x,
      this.targetVelocity.x,
      accel * controlFactor * deltaTime
    );
    this.velocity.z = this.lerp(
      this.velocity.z,
      this.targetVelocity.z,
      accel * controlFactor * deltaTime
    );
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
    } else if (!core.script.creative) {
      this.velocity.y +=
        this.world.gravity.y * this.config.gravityScale * deltaTime;
    }
  }

  /**
   * 使用 CharacterController 执行物理移动
   */
  performMovement(deltaTime) {
    if (!this.move_enabled) return;
    const desiredTranslation = this.velocity.clone().multiplyScalar(deltaTime);

    // 核心步骤：让 CharacterController 计算考虑碰撞后的实际可移动距离
    this.characterController.computeColliderMovement(
      this.collider,
      desiredTranslation
    );

    const movement = this.characterController.computedMovement();

    // 简易检测是否在上楼梯
    if (
      movement.y < this.config.yvel_epsR &&
      movement.y > this.config.yvel_epsL &&
      this.isGrounded &&
      !this.jumpRequested &&
      !core.script.creative
    ) {
      this.config.speed = this.config.stair_speed;
    } else this.config.speed = this.config.normal_speed;

    // 应用计算出的安全移动
    const currentPos = this.rigidBody.translation();
    this.rigidBody.setNextKinematicTranslation({
      x: currentPos.x + movement.x,
      y: currentPos.y + movement.y,
      z: currentPos.z + movement.z,
    });

    // 如果发生碰撞（实际移动距离小于期望距离），则将该方向的速度清零
    if (Math.abs(desiredTranslation.x - movement.x) > 0.001)
      this.velocity.x = 0;
    if (Math.abs(desiredTranslation.z - movement.z) > 0.001)
      this.velocity.z = 0;
    if (Math.abs(desiredTranslation.y - movement.y) > 0.001)
      this.velocity.y = 0;
  }

  /**
   * 更新相机位置和朝向
   */
  updateCamera() {
    if (!document.mouse_locked) return;
    if (!this.move_enabled) return;

    // 更新旋转角度
    this.cameraController.yaw -= this.mouse.x * this.config.mouseSensitivity;
    this.cameraController.pitch -= this.mouse.y * this.config.mouseSensitivity;
    this.cameraController.pitch = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.cameraController.pitch)
    );
    this.mouse.x = this.mouse.y = 0; // 重置鼠标增量

    // 应用旋转到相机
    this.camera.rotation.set(
      this.cameraController.pitch,
      this.cameraController.yaw,
      0,
      "YXZ"
    );

    // 相机位置跟随刚体
    const playerPos = this.rigidBody.translation();
    const cameraY =
      playerPos.y + this.config.height * this.config.cameraHeightRatio;
    this.camera.position.set(playerPos.x, cameraY, playerPos.z);
  }

  /**
   * 更新平滑旋转
   */
  updateSmoothRotation(deltaTime) {
    if (!this.smoothRotation.isActive) return;

    const currentPitch = this.cameraController.pitch;
    const currentYaw = this.cameraController.yaw;
    const targetPitch = this.smoothRotation.targetPitch;
    const targetYaw = this.smoothRotation.targetYaw;

    // 计算角度差，处理角度环绕问题
    let pitchDiff = targetPitch - currentPitch;
    let yawDiff = this.normalizeAngleDifference(targetYaw - currentYaw);

    // 检查是否已经足够接近目标
    if (
      Math.abs(pitchDiff) < this.smoothRotation.threshold &&
      Math.abs(yawDiff) < this.smoothRotation.threshold
    ) {
      // 直接设置为目标值并停止平滑旋转
      this.cameraController.pitch = targetPitch;
      this.cameraController.yaw = targetYaw;
      this.smoothRotation.isActive = false;

      console.log("👤 平滑旋转完成");

      // 执行回调函数（如果有的话）
      if (this.smoothRotation.callback) {
        this.smoothRotation.callback();
        this.smoothRotation.callback = null;
      }
    } else {
      // 使用线性插值进行平滑旋转
      const rotationSpeed = this.smoothRotation.speed * deltaTime;
      this.cameraController.pitch = this.lerp(
        currentPitch,
        targetPitch,
        rotationSpeed
      );
      this.cameraController.yaw = this.lerp(
        currentYaw,
        currentYaw + yawDiff,
        rotationSpeed
      );
    }

    // 限制俯仰角
    this.cameraController.pitch = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.cameraController.pitch)
    );

    // 应用旋转到相机
    this.camera.rotation.set(
      this.cameraController.pitch,
      this.cameraController.yaw,
      0,
      "YXZ"
    );
  }

  /**
   * 规范化角度差值，处理角度环绕问题
   */
  normalizeAngleDifference(angleDiff) {
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    return angleDiff;
  }

  /**
   * 在更新循环末尾执行的后处理
   */
  postUpdate() {
    if (!this.wasGrounded && this.isGrounded) this.onLanded();
    if (this.wasGrounded && !this.isGrounded) this.onLeftGround();

    // 在物理更新完成后安全地更新缓存
    this.updateCachedState();
  }

  /**
   * 更新缓存的物理状态（在安全时机调用）
   */
  updateCachedState() {
    try {
      this.cachedPosition = this.rigidBody.translation();
      this.cachedVelocity = this.velocity.clone();
      this.lastCacheUpdate = performance.now();
    } catch (error) {
      // 如果物理对象正在被访问，跳过这次更新
      console.warn("跳过物理状态更新，对象正在使用中");
    }
  }

  /**
   * 保存玩家状态
   */
  savePlayerState() {
    // 使用缓存的位置而不是直接访问物理对象
    const state = {
      position: this.cachedPosition,
      velocity: this.cachedVelocity,
      isGrounded: this.isGrounded,
    };
    const self_entity = window.core.getEntity("self");
    self_entity.properties.coordinates = [
      state.position.x,
      state.position.y,
      state.position.z,
    ];
    self_entity.properties.rotation = [
      this.camera.rotation._x,
      this.camera.rotation._y,
      this.camera.rotation._z,
    ];
  }

  /**
   * 按E處理交互
   */
  handleInteraction() {
    if (
      this.currentInteractEntity &&
      this.currentInteractEntity.interact_callback
    ) {
      console.log(`👤 触发交互实体: ${this.currentInteractEntity.id}`);
      const command = this.currentInteractEntity.interact_callback.join(";");
      core.scripts.execute(command, { name: this.currentInteractEntity.id });
    }
  }

  /**
   * 檢查能否交互
   */
  updateInteraction() {
    const playercast = this.RayCaster.castFromCamera(
      this.camera,
      5,
      this.collider
    );
    if (playercast) {
      const now_entity = window.core.getEntity(playercast.entityId);
      if (playercast && playercast.entityId && now_entity.interact_callback) {
        this.currentInteractEntity = now_entity;
        document.getElementById("interaction-hint").style.display = "block";
        return;
      }
    }
    this.currentInteractEntity = null;
    document.getElementById("interaction-hint").style.display = "none";
  }

  updateDistanceInteraction() {
    const objects = window.core.script.entities.concat(
      window.core.script.speeches
    );
    objects
      .filter((e) => e.distance_callback)
      .forEach((object) => {
        const target = object.properties.coordinates;
        // 取玩家位置（对象形式 {x,y,z}）
        const playerPosObj = this.getPosition();
        const playerVec = new THREE.Vector3(
          playerPosObj.x || 0,
          playerPosObj.y || 0,
          playerPosObj.z || 0
        );
        // 目标坐标有效性检查
        let targetVec = null;
        if (Array.isArray(target) && target.length >= 3) {
          targetVec = new THREE.Vector3(
            Number(target[0]) || 0,
            Number(target[1]) || 0,
            Number(target[2]) || 0
          );
        } else if (target && typeof target === "object") {
          targetVec = new THREE.Vector3(
            Number(target.x) || 0,
            Number(target.y) || 0,
            Number(target.z) || 0
          );
        } else {
          return; // 无效目标
        }

        const distance = playerVec.distanceTo(targetVec);
        if (isNaN(distance) || !isFinite(distance)) return; // 防护

        if (
          distance <
          (object.properties.distance ||
            window.core.script.global.interact_distance)
        ) {
          if (!object.properties.activated) {
            for (let command in object.distance_callback) {
              eval(object.distance_callback[command]);
            }
          }
        }
      });
  }

  // --- 公共API ---
  getPosition() {
    // 使用缓存的位置，如果缓存太旧则尝试更新
    const now = performance.now();
    if (now - this.lastCacheUpdate > 16) {
      // 超过16ms更新一次
      this.updateCachedState();
    }
    return this.cachedPosition;
  }

  /**
   * 传送玩家到指定位置
   * @param {Object|Array} position - 目标位置，可以是 {x, y, z} 对象或 [x, y, z] 数组
   */
  teleport(position) {
    try {
      // 解析位置参数
      let targetPos;
      if (Array.isArray(position)) {
        targetPos = { x: position[0], y: position[1], z: position[2] };
      } else if (position && typeof position === "object") {
        targetPos = { x: position.x, y: position.y, z: position.z };
      } else {
        console.error("❌ 传送失败：位置参数格式错误", position);
        return false;
      }

      console.log(
        `🌟 开始传送玩家到位置: (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`
      );

      // 临时禁用碰撞检测
      this.collider.setEnabled(false);

      // 直接设置刚体位置
      this.rigidBody.setTranslation(targetPos, true);

      // 确保 collider 位置同步（虽然理论上应该自动跟随，但显式同步更安全）
      this.collider.setTranslation(targetPos);

      // 清除当前速度，避免传送后继续移动
      this.velocity.set(0, 0, 0);
      this.velocityY = 0;

      // 重新启用碰撞检测
      this.collider.setEnabled(true);

      // 更新缓存状态
      this.updateCachedState();

      console.log(
        `✅ 玩家传送成功到: (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`
      );
      return true;
    } catch (error) {
      console.error("❌ 传送过程中发生错误:", error);
      // 确保碰撞检测重新启用
      if (this.collider) {
        this.collider.setEnabled(true);
      }
      return false;
    }
  }
  getVelocity() {
    return this.velocity.clone();
  }
  isOnGround() {
    return this.isGrounded;
  }
  getRotation() {
    return this.camera.rotation;
  }

  setRotation(pitch, yaw) {
    this.cameraController.pitch = pitch;
    this.cameraController.yaw = yaw;
    this.camera.rotation.set(pitch, yaw, 0, "YXZ");
  }

  setRotationDestination(x, y, z) {
    const direction = new THREE.Vector3();
    direction.subVectors(new THREE.Vector3(x, y, z), this.camera.position);
    direction.normalize();
    const yaw = Math.atan2(direction.x, direction.z);
    this.cameraController.yaw = yaw;
    this.camera.rotation.set(this.cameraController.pitch, yaw, 0, "YXZ");
  }

  /**
   * 平滑地将视角转向指定的世界坐标点
   * @param {number} x - 目标点的 X 坐标
   * @param {number} y - 目标点的 Y 坐标
   * @param {number} z - 目标点的 Z 坐标
   * @param {number} [speed=2.0] - 旋转速度，数值越大旋转越快
   * @param {Function} [callback] - 旋转完成后的回调函数
   */
  setRotationDestinationSmooth(x, y, z, speed = 2.0, callback = null) {
    // 计算从相机到目标点的方向向量
    const direction = new THREE.Vector3();
    direction.subVectors(new THREE.Vector3(x, y, z), this.camera.position);

    // 计算水平距离（在 xz 平面上的距离）
    const horizontalDistance = Math.sqrt(
      direction.x * direction.x + direction.z * direction.z
    );

    // 计算目标的俯仰角和偏航角
    const targetYaw = Math.atan2(direction.x, direction.z);
    const targetPitch = -Math.atan2(direction.y, horizontalDistance); // y是高度轴，向上为正，但相机pitch向上为负

    // 设置平滑旋转参数
    this.smoothRotation.targetPitch = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, targetPitch)
    ); // 限制俯仰角范围
    this.smoothRotation.targetYaw = targetYaw;
    this.smoothRotation.speed = speed;
    this.smoothRotation.isActive = true;
    this.smoothRotation.callback = callback;

    console.log(
      `👤 开始平滑旋转到目标: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(
        2
      )})`
    );
    console.log(
      `👤 目标角度: pitch=${((targetPitch * 180) / Math.PI).toFixed(
        1
      )}°, yaw=${((targetYaw * 180) / Math.PI).toFixed(1)}°`
    );
    console.log(
      `👤 方向向量: (${direction.x.toFixed(3)}, ${direction.y.toFixed(
        3
      )}, ${direction.z.toFixed(3)})`
    );
    console.log(`👤 水平距离: ${horizontalDistance.toFixed(3)}`);
  }

  /**
   * 停止当前的平滑旋转
   */
  stopSmoothRotation() {
    if (this.smoothRotation.isActive) {
      this.smoothRotation.isActive = false;
      this.smoothRotation.callback = null;
      console.log("👤 平滑旋转已停止");
    }
  }

  /**
   * 检查是否正在进行平滑旋转
   * @returns {boolean} 是否正在平滑旋转
   */
  isSmoothRotating() {
    return this.smoothRotation.isActive;
  }

  checkDeath() {
    if (this.getPosition().y < -10) {
      death.activate(
        (currentUser || "Player") + " fell out of the world!<br/>你掉出了世界!"
      );
    }
  }

  // --- 事件回调 ---
  onLanded() {
    //console.log("👤 玩家着地");
  }
  onLeftGround() {
    //console.log("👤 玩家离地");
  }

  /**
   * 销毁玩家以释放资源
   */
  destroy() {
    if (this.characterController)
      this.world.removeCharacterController(this.characterController);
    if (this.collider) this.world.removeCollider(this.collider, true);
    if (this.rigidBody) this.world.removeRigidBody(this.rigidBody);
    clearInterval(this.saveInterval);
    this.saveInterval = null;
    console.log("👤 玩家已销毁");
  }
}
