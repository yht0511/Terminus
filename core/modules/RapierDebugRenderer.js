import * as THREE from "three";

export class RapierDebugRenderer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mesh = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
      })
    );
    this.mesh.frustumCulled = false; // 防止在视锥外被裁剪
    this.scene.add(this.mesh);
    console.log("🐛 物理调试渲染器已启用");
  }

  update() {
    // 从 Rapier 世界获取渲染缓冲区
    const { vertices, colors } = this.world.debugRender();

    // 更新 Three.js BufferGeometry
    this.mesh.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );
    this.mesh.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 4)
    );

    // 更新边界，确保正确渲染
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    console.log("🐛 物理调试渲染器已销毁");
  }
}
