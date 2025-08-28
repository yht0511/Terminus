# 物理引擎集成指南

本项目已集成 **Cannon.js** 物理引擎，为你的 3D 应用提供真实的物理模拟。

## 已安装的库

- `cannon-es` - 现代化的 Cannon.js 物理引擎
- `@types/cannon` - TypeScript 类型定义

## 核心组件

### PhysicsManager (`src/core/PhysicsManager.ts`)

物理世界管理器，提供以下功能：

- ✅ 创建刚体（盒子、球体、自定义网格）
- ✅ 物理材质和碰撞检测
- ✅ 力和冲量施加
- ✅ 射线检测
- ✅ 自动同步 Three.js 网格和 Cannon.js 刚体

### 集成到 GameEngine

物理管理器已自动集成到游戏引擎中：

```typescript
// 访问物理引擎
gameEngine.physics.createBox(size, position, mass);
gameEngine.physics.createSphere(radius, position, mass);
```

## 基本使用方法

### 1. 创建地面

```typescript
const ground = gameEngine.physics.createGround(50); // 50x50 的地面
gameEngine.scene.add(ground.mesh);
```

### 2. 创建物理盒子

```typescript
const { physicsBody, id } = gameEngine.physics.createBox(
  new THREE.Vector3(1, 1, 1), // 尺寸
  new THREE.Vector3(0, 10, 0), // 位置
  1 // 质量
);
gameEngine.scene.add(physicsBody.mesh);
```

### 3. 创建物理球体

```typescript
const { physicsBody, id } = gameEngine.physics.createSphere(
  0.5, // 半径
  new THREE.Vector3(0, 10, 0), // 位置
  1 // 质量
);
gameEngine.scene.add(physicsBody.mesh);
```

### 4. 从现有网格创建物理体

```typescript
const mesh = new THREE.Mesh(geometry, material);
const { physicsBody, id } = gameEngine.physics.createFromMesh(
  mesh,
  1, // 质量
  false // 是否使用凸包（false = 使用包围盒，性能更好）
);
```

### 5. 施加力和冲量

```typescript
// 施加持续的力
gameEngine.physics.applyForce(
  id,
  new THREE.Vector3(0, 100, 0) // 向上的力
);

// 设置速度
gameEngine.physics.setVelocity(
  id,
  new THREE.Vector3(5, 0, 0) // 向右移动
);
```

### 6. 射线检测

```typescript
const result = gameEngine.physics.raycast(
  new THREE.Vector3(0, 10, 0), // 起点
  new THREE.Vector3(0, 0, 0) // 终点
);

if (result) {
  console.log("击中点:", result.hitPointWorld);
  console.log("击中物体:", result.body);
}
```

## 物理演示

运行物理演示来测试功能：

```typescript
import { PhysicsDemo, PhysicsControls } from "./examples/PhysicsDemo";

// 在游戏初始化后
const demo = new PhysicsDemo();
demo.initialize();

const controls = new PhysicsControls(demo);
controls.enable();
```

### 演示控制

- **B 键** - 在相机前添加盒子
- **S 键** - 在相机前添加球体
- **E 键** - 在相机位置创建爆炸效果
- **R 键** - 从相机发射射线
- **鼠标点击** - 添加盒子
- **Shift + 鼠标点击** - 添加球体

## 性能优化建议

### 1. 使用合适的碰撞形状

```typescript
// ✅ 好 - 简单形状，性能好
const box = gameEngine.physics.createBox(size, position, mass);

// ❌ 避免 - 复杂凸包，性能差
const complex = gameEngine.physics.createFromMesh(mesh, mass, true);

// ✅ 好 - 使用包围盒代替凸包
const simple = gameEngine.physics.createFromMesh(mesh, mass, false);
```

### 2. 合理设置质量

```typescript
// 静态物体（地面、墙壁）
const staticBody = gameEngine.physics.createBox(size, position, 0);

// 动态物体
const dynamicBody = gameEngine.physics.createBox(size, position, 1);
```

### 3. 限制物理体数量

```typescript
// 及时移除不需要的物理体
gameEngine.physics.removeBody(id);
```

## 高级功能

### 自定义材质

```typescript
// 创建自定义材质
const world = gameEngine.physics.getWorld();
const material = new CANNON.Material("custom");
const contactMaterial = new CANNON.ContactMaterial(material, material, {
  friction: 0.1, // 摩擦力
  restitution: 0.9, // 弹性
});
world.addContactMaterial(contactMaterial);
```

### 约束系统

```typescript
// 添加铰链约束
const world = gameEngine.physics.getWorld();
const constraint = new CANNON.HingeConstraint(bodyA, bodyB, {
  pivotA: new CANNON.Vec3(0, 0, 0),
  pivotB: new CANNON.Vec3(0, 0, 0),
});
world.addConstraint(constraint);
```

### 触发器检测

```typescript
// 设置物体为触发器
body.isTrigger = true;

// 监听碰撞事件
body.addEventListener("collide", (event) => {
  console.log("触发器被触发:", event);
});
```

## 调试工具

### 1. 可视化物理体

```typescript
// 在开发模式下显示物理体边界
if (process.env.NODE_ENV === "development") {
  const helper = new THREE.BoxHelper(physicsBody.mesh, 0xff0000);
  gameEngine.scene.add(helper);
}
```

### 2. 性能监控

```typescript
// 监控物理体数量
console.log("物理体数量:", gameEngine.physics.getBodies().size);

// 监控物理步数
const world = gameEngine.physics.getWorld();
console.log("物理步数:", world.stepnumber);
```

## 推荐的其他物理引擎选择

如果 Cannon.js 不满足你的需求，这里还有其他选择：

### Rapier (高性能)

```bash
npm install @dimforge/rapier3d-compat
```

- 基于 Rust + WebAssembly
- 性能极佳，适合大型场景
- 更复杂的 API

### Ammo.js (功能最全)

```bash
npm install ammojs-typed
```

- Bullet 物理引擎的 JS 版本
- 功能最强大
- 体积较大，学习曲线陡峭

### React Three Fiber 用户

```bash
npm install @react-three/cannon
npm install @react-three/rapier
```

选择建议：

- **Cannon.js** - 大多数项目的最佳选择
- **Rapier** - 需要极致性能时选择
- **Ammo.js** - 需要高级物理特性时选择

## 故障排除

### 常见问题

1. **物体穿透地面**

   - 检查时间步长设置
   - 确保物体质量 > 0
   - 调整碰撞检测精度

2. **性能问题**

   - 减少物理体数量
   - 使用简单碰撞形状
   - 优化求解器设置

3. **同步问题**
   - 确保物理更新在渲染前执行
   - 检查坐标系统一致性

### 调试技巧

```typescript
// 1. 显示物理世界统计
const world = gameEngine.physics.getWorld();
console.log({
  bodies: world.bodies.length,
  contacts: world.contacts.length,
  time: world.time,
});

// 2. 暂停物理模拟
world.step(0);

// 3. 单步执行
world.step(1 / 60);
```
