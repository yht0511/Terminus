import * as Three from "three";
const cameraSize = new Three.Vector3(1, 3, 1);

export { checkCollisions };

/**
 * 碰撞检测
 * @param {Three.Vector3} cameraPosition - 当前相机位置
 * @param {Three.Vector3} movementVector - 期望移动向量
 * @param {Array} collisionBoxes - 碰撞箱数组
 * @returns {Three.Vector3} 调整后的安全移动向量
 */
function checkCollisions(cameraPosition, movementVector, collisionBoxes) {
    const config = {
        maxIterations: 5,
        safetyMargin: 0.01,
        minMovement: 0.001,
        maxCheckDistance: 10.0 
    };
    
    // 移动向量太小直接返回
    if (movementVector.length() < config.minMovement) {
        return movementVector.clone();
    }

    let adjustedMovement = movementVector.clone();
    
    // 性能优化：预筛选可能碰撞的物体
    const potentialCollisions = _broadPhaseCollisionDetection(cameraPosition, adjustedMovement, collisionBoxes, config);
    
    // 如果没有潜在碰撞，直接返回
    if (potentialCollisions.length === 0) {
        return adjustedMovement;
    }
    
    const testCameraBox = new Three.Box3();
    
    // 迭代处理碰撞
    for (let iteration = 0; iteration < config.maxIterations; iteration++) {
        const testPosition = cameraPosition.clone().add(adjustedMovement);
        testCameraBox.setFromCenterAndSize(testPosition, cameraSize);
        
        let hasCollision = false;
        let closestCollision = null;
        let minPenetration = Infinity;
        
        // 找到最严重的碰撞
        for (let collision of potentialCollisions) {
            if (testCameraBox.intersectsBox(collision.box)) {
                hasCollision = true;
                const penetration = _calculatePenetrationDepth(testCameraBox, collision.box);
                if (penetration < minPenetration) {
                    minPenetration = penetration;
                    closestCollision = collision.box;
                }
            }
        }
        
        if (!hasCollision) break;
        
        // 解决碰撞
        adjustedMovement = _resolveCollision(cameraPosition, adjustedMovement, closestCollision, config);
        
        // 如果调整后移动太小，停止迭代
        if (adjustedMovement.length() < config.minMovement) {
            break;
        }
    }
    
    return adjustedMovement;
}

// 宽相位碰撞检测
function _broadPhaseCollisionDetection(position, movement, collisionBoxes, config) {
    const potentialCollisions = [];
    const movementLength = movement.length();
    const checkRadius = Math.max(movementLength + 2.0, 3.0); // 动态检测半径
    
    for (let collision of collisionBoxes) {
        // 距离剔除：计算到碰撞箱中心的距离
        const collisionCenter = collision.box.getCenter(new Three.Vector3());
        const distance = position.distanceTo(collisionCenter);
        
        // 粗略的包围盒大小估算
        const collisionSize = collision.box.getSize(new Three.Vector3()).length();
        const totalRadius = checkRadius + collisionSize * 0.5;
        
        if (distance < totalRadius) {
            potentialCollisions.push(collision);
        }
    }
    
    return potentialCollisions;
}

// 计算渗透深度
function _calculatePenetrationDepth(cameraBox, obstacleBox) {
    const EPSILON = 1e-6; // 浮点精度阈值
    
    const overlapX = Math.min(cameraBox.max.x, obstacleBox.max.x) - Math.max(cameraBox.min.x, obstacleBox.min.x);
    const overlapY = Math.min(cameraBox.max.y, obstacleBox.max.y) - Math.max(cameraBox.min.y, obstacleBox.min.y);
    const overlapZ = Math.min(cameraBox.max.z, obstacleBox.max.z) - Math.max(cameraBox.min.z, obstacleBox.min.z);
    
    // 处理浮点精度问题
    const validOverlapX = overlapX > EPSILON ? overlapX : Infinity;
    const validOverlapY = overlapY > EPSILON ? overlapY : Infinity;
    const validOverlapZ = overlapZ > EPSILON ? overlapZ : Infinity;
    
    return Math.min(validOverlapX, validOverlapY, validOverlapZ);
}

// 解决单个碰撞
function _resolveCollision(position, movement, obstacleBox, config) {
    const adjustedMovement = new Three.Vector3();
    
    // 分轴处理X, Z, Y
    const axes = ['x', 'z', 'y'];
    
    for (let axis of axes) {
        const singleAxisMovement = new Three.Vector3();
        singleAxisMovement[axis] = movement[axis];
        
        const testPosition = position.clone().add(singleAxisMovement);
        const testBox = new Three.Box3();
        testBox.setFromCenterAndSize(testPosition, cameraSize);
        
        if (!testBox.intersectsBox(obstacleBox)) {
            // 这个轴安全
            adjustedMovement[axis] = movement[axis];
        } else {
            // 计算最大安全移动距离
            adjustedMovement[axis] = _calculateMaxSafeMovement(position, movement[axis], axis, obstacleBox, config);
        }
    }
    
    return adjustedMovement;
}

// 计算轴上最大安全移动距离
function _calculateMaxSafeMovement(position, desiredMovement, axis, obstacleBox, config) {
    if (Math.abs(desiredMovement) < config.minMovement) return 0;
    
    const halfCameraSize = cameraSize[axis] * 0.5;
    const currentEdge = position[axis] + (desiredMovement > 0 ? halfCameraSize : -halfCameraSize);
    const obstacleEdge = desiredMovement > 0 ? obstacleBox.min[axis] : obstacleBox.max[axis];
    
    const maxDistance = Math.abs(obstacleEdge - currentEdge) - config.safetyMargin;
    
    if (maxDistance <= 0) return 0;
    
    const sign = Math.sign(desiredMovement);
    const safeMovement = sign * Math.min(Math.abs(desiredMovement), maxDistance);

    return safeMovement;
}

