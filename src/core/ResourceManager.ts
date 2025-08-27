/**
 * 资源管理器
 * 负责管理所有游戏资源的加载、缓存和释放
 */
export class ResourceManager {
  private static instance: ResourceManager;
  private _cache = new Map<string, any>();
  private _loading = new Map<string, Promise<any>>();
  private _loaders = new Map<string, (url: string) => Promise<any>>();

  private constructor() {
    this.initializeLoaders();
  }

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * 初始化加载器
   */
  private initializeLoaders(): void {
    // JSON配置文件加载器
    this._loaders.set("json", async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load JSON: ${url}`);
      }
      return response.json();
    });

    // 文本文件加载器
    this._loaders.set("text", async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load text: ${url}`);
      }
      return response.text();
    });

    // 图片加载器
    this._loaders.set("image", (url: string) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    });

    // 音频加载器
    this._loaders.set("audio", (url: string) => {
      return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.oncanplaythrough = () => resolve(audio);
        audio.onerror = reject;
        audio.src = url;
      });
    });
  }

  /**
   * 注册自定义加载器
   */
  public registerLoader(
    type: string,
    loader: (url: string) => Promise<any>
  ): void {
    this._loaders.set(type, loader);
  }

  /**
   * 根据文件扩展名获取资源类型
   */
  private getResourceType(url: string): string {
    const extension = url.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "json":
        return "json";
      case "txt":
      case "md":
        return "text";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
        return "image";
      case "mp3":
      case "wav":
      case "ogg":
        return "audio";
      case "gltf":
      case "glb":
        return "model";
      default:
        return "text";
    }
  }

  /**
   * 加载单个资源
   */
  public async load<T = any>(url: string, type?: string): Promise<T> {
    // 检查缓存
    if (this._cache.has(url)) {
      return this._cache.get(url);
    }

    // 检查是否正在加载
    if (this._loading.has(url)) {
      return this._loading.get(url);
    }

    // 确定资源类型
    const resourceType = type || this.getResourceType(url);
    const loader = this._loaders.get(resourceType);

    if (!loader) {
      throw new Error(`No loader found for resource type: ${resourceType}`);
    }

    // 开始加载
    const loadPromise = loader(url)
      .then((resource) => {
        this._cache.set(url, resource);
        this._loading.delete(url);
        return resource;
      })
      .catch((error) => {
        this._loading.delete(url);
        throw error;
      });

    this._loading.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * 批量加载资源
   */
  public async loadAll(
    resources: Array<{ url: string; type?: string; key?: string }>
  ): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    const promises = resources.map(async ({ url, type, key }) => {
      try {
        const resource = await this.load(url, type);
        results.set(key || url, resource);
        return { url, key, resource, success: true };
      } catch (error) {
        console.error(`Failed to load resource: ${url}`, error);
        return { url, key, error, success: false };
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * 获取已缓存的资源
   */
  public get<T = any>(url: string): T | undefined {
    return this._cache.get(url);
  }

  /**
   * 检查资源是否已缓存
   */
  public has(url: string): boolean {
    return this._cache.has(url);
  }

  /**
   * 预加载资源
   */
  public async preload(urls: string[]): Promise<void> {
    const promises = urls.map((url) =>
      this.load(url).catch((error) => {
        console.warn(`Failed to preload resource: ${url}`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * 释放资源
   */
  public release(url: string): void {
    this._cache.delete(url);
  }

  /**
   * 释放所有资源
   */
  public releaseAll(): void {
    this._cache.clear();
    this._loading.clear();
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): { cached: number; loading: number } {
    return {
      cached: this._cache.size,
      loading: this._loading.size,
    };
  }
}

// 导出全局资源管理器实例
export const resourceManager = ResourceManager.getInstance();
