/**
 * 资源管理器 - 负责加载和管理3D模型、纹理等资源
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class ResourceManager {
  constructor() {
    this.loadedModels = new Map();
    this.loadedTextures = new Map();
    this.loadingPromises = new Map();

    // 初始化加载器
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    console.log("资源管理器已初始化");
  }

  /**
   * 加载GLTF模型
   * @param {string} path - 模型路径
   * @returns {THREE.Object3D}
   */
  async loadModel(path) {
    // 如果已经加载过，直接返回克隆
    if (this.loadedModels.has(path)) {
      return this.cloneModel(this.loadedModels.get(path));
    }

    // 如果正在加载，等待加载完成
    if (this.loadingPromises.has(path)) {
      await this.loadingPromises.get(path);
      return this.cloneModel(this.loadedModels.get(path));
    }

    // 开始加载
    const loadingPromise = new Promise((resolve, reject) => {
      console.log(`加载模型: ${path}`);

      this.gltfLoader.load(
        path,
        (gltf) => {
          this.loadedModels.set(path, gltf.scene);
          console.log(`模型加载完成: ${path}`);
          resolve(gltf.scene);
        },
        (progress) => {
          // 加载进度
          const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
        //   console.log(`${path} 加载进度: ${percent}%`);
        },
        (error) => {
          console.error(`模型加载失败: ${path}`, error);
          reject(error);
        }
      );
    });

    this.loadingPromises.set(path, loadingPromise);

    try {
      const model = await loadingPromise;
      this.loadingPromises.delete(path);
      return this.cloneModel(model);
    } catch (error) {
      this.loadingPromises.delete(path);
      throw error;
    }
  }

  /**
   * 加载纹理
   * @param {string} path - 纹理路径
   * @returns {Promise<THREE.Texture>}
   */
  async loadTexture(path) {
    if (this.loadedTextures.has(path)) {
      return this.loadedTextures.get(path).clone();
    }

    return new Promise((resolve, reject) => {
      console.log(`🔄 加载纹理: ${path}`);

      this.textureLoader.load(
        path,
        (texture) => {
          this.loadedTextures.set(path, texture);
          console.log(`✅ 纹理加载完成: ${path}`);
          resolve(texture.clone());
        },
        (progress) => {
          // 加载进度
        },
        (error) => {
          console.error(`❌ 纹理加载失败: ${path}`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * 克隆模型（深拷贝）
   * @param {THREE.Object3D} model - 要克隆的模型
   * @returns {THREE.Object3D}
   */
  cloneModel(model) {
    const cloned = model.clone(true);

    // 克隆材质以避免共享状态
    cloned.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((mat) => mat.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    });

    return cloned;
  }

  /**
   * 获取已加载的模型（原始版本，不要直接使用）
   * @param {string} path - 模型路径
   * @returns {THREE.Object3D|null}
   */
  getOriginalModel(path) {
    return this.loadedModels.get(path) || null;
  }

  /**
   * 预热模型（预加载但不返回实例）
   * @param {string[]} paths - 模型路径数组
   */
  async preloadModels(paths) {
    const promises = paths.map((path) => this.loadModel(path));
    await Promise.all(promises);
    console.log(`预加载完成: ${paths.length} 个模型`);
  }

  /**
   * 清理资源
   */
  dispose() {
    this.loadedModels.forEach((model, path) => {
      model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    });

    this.loadedTextures.forEach((texture) => {
      texture.dispose();
    });

    this.loadedModels.clear();
    this.loadedTextures.clear();
    this.loadingPromises.clear();

    console.log("资源管理器已清理");
  }

  /**
   * 获取资源统计信息
   */
  getStats() {
    return {
      modelsLoaded: this.loadedModels.size,
      texturesLoaded: this.loadedTextures.size,
      loadingInProgress: this.loadingPromises.size,
    };
  }
}
