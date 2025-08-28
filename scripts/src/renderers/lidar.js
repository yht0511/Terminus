/**
 * 激光雷达渲染器 - 示例渲染器模块
 * 提供特殊的视觉效果，比如雷达扫描视图
 */

import * as THREE from "three";

export default class LidarRenderer {
  constructor() {
    this.name = "激光雷达渲染器";
    this.isActive = false;
    this.radarMaterial = null;
    this.scanLine = null;
    this.scanAngle = 0;

    console.log("📡 激光雷达渲染器已加载");
  }

  /**
   * 激活雷达视图
   */
  activate() {
    const core = window.core;
    if (!core.scene || !core.scene.scene) {
      console.error("❌ 场景未初始化，无法激活雷达渲染器");
      return null;
    }

    this.isActive = true;
    this.createRadarView();

    // 创建雷达界面元素
    const radarElement = this.createRadarElement();

    console.log("📡 激光雷达渲染器已激活");
    return radarElement;
  }

  /**
   * 创建雷达视图
   */
  createRadarView() {
    const core = window.core;
    const scene = core.scene.scene;

    // 为所有实体添加雷达材质
    core.script.entities.forEach((entityConfig) => {
      const entity = core.scene.entities.get(entityConfig.id);
      if (entity && entity.model && entityConfig.properties.lidar_color) {
        this.applyLidarMaterial(
          entity.model,
          entityConfig.properties.lidar_color
        );
      }
    });

    // 创建扫描线
    this.createScanLine();
  }

  /**
   * 应用雷达材质
   */
  applyLidarMaterial(model, color) {
    const lidarMaterial = new THREE.MeshBasicMaterial({
      color: color,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });

    model.traverse((child) => {
      if (child.isMesh) {
        child.material = lidarMaterial;
      }
    });
  }

  /**
   * 创建扫描线
   */
  createScanLine() {
    const core = window.core;
    const scene = core.scene.scene;

    const geometry = new THREE.BufferGeometry();
    const positions = [];

    // 创建从中心发出的射线
    for (let i = 0; i <= 100; i++) {
      positions.push(0, 0.1, 0); // 起点
      positions.push(50, 0.1, 0); // 终点
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
    });

    this.scanLine = new THREE.Line(geometry, material);
    scene.add(this.scanLine);
  }

  /**
   * 创建雷达界面元素
   */
  createRadarElement() {
    const container = document.createElement("div");
    container.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 200px;
            height: 200px;
            border: 2px solid #00ff00;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.7);
            overflow: hidden;
        `;

    // 雷达圆心
    const center = document.createElement("div");
    center.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 4px;
            height: 4px;
            background: #00ff00;
            border-radius: 50%;
            transform: translate(-50%, -50%);
        `;
    container.appendChild(center);

    // 雷达扫描线
    const scanLine = document.createElement("div");
    scanLine.id = "radarScanLine";
    scanLine.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 2px;
            height: 100px;
            background: linear-gradient(to top, transparent, #00ff00);
            transform-origin: bottom center;
            transform: translate(-50%, -100%) rotate(0deg);
            animation: radarScan 2s linear infinite;
        `;
    container.appendChild(scanLine);

    // 添加CSS动画
    if (!document.getElementById("radarAnimation")) {
      const style = document.createElement("style");
      style.id = "radarAnimation";
      style.textContent = `
                @keyframes radarScan {
                    from { transform: translate(-50%, -100%) rotate(0deg); }
                    to { transform: translate(-50%, -100%) rotate(360deg); }
                }
            `;
      document.head.appendChild(style);
    }

    // 雷达信息面板
    const infoPanel = document.createElement("div");
    infoPanel.style.cssText = `
            position: absolute;
            top: 220px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff00;
            padding: 10px;
            border: 1px solid #00ff00;
            font-family: monospace;
            font-size: 12px;
            min-width: 200px;
        `;
    infoPanel.innerHTML = `
            <div>📡 LIDAR STATUS: ACTIVE</div>
            <div>🎯 TARGETS: SCANNING...</div>
            <div>📊 RANGE: 50m</div>
            <div>⚡ REFRESH: 2Hz</div>
        `;

    const wrapper = document.createElement("div");
    wrapper.appendChild(container);
    wrapper.appendChild(infoPanel);

    return wrapper;
  }

  /**
   * 更新雷达（每帧调用）
   */
  update(deltaTime) {
    if (!this.isActive || !this.scanLine) return;

    // 旋转扫描线
    this.scanAngle += deltaTime * 2; // 2弧度/秒
    this.scanLine.rotation.y = this.scanAngle;
  }

  /**
   * 停用雷达渲染器
   */
  deactivate() {
    this.isActive = false;

    const core = window.core;
    if (this.scanLine && core.scene && core.scene.scene) {
      core.scene.scene.remove(this.scanLine);
    }

    // 恢复原始材质
    if (core.scene) {
      core.script.entities.forEach((entityConfig) => {
        const entity = core.scene.entities.get(entityConfig.id);
        if (entity && entity.model) {
          this.restoreOriginalMaterials(entity.model);
        }
      });
    }

    console.log("📡 激光雷达渲染器已停用");
  }

  /**
   * 恢复原始材质
   */
  restoreOriginalMaterials(model) {
    // 这里应该恢复模型的原始材质
    // 简化处理，使用默认材质
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshLambertMaterial({ color: 0x888888 });
      }
    });
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    this.deactivate();
    console.log("🗑️ 激光雷达渲染器已销毁");
  }
}
