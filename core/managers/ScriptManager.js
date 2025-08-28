/**
 * 脚本管理器 - 处理外部JS模块加载和脚本执行
 */

export class ScriptManager {
  constructor(core) {
    this.core = core;
    this.loadedScripts = new Map();
    this.scriptModules = new Map();

    console.log("脚本管理器已初始化");
  }

  /**
   * 加载外部脚本模块
   * @param {string} id - 脚本标识符
   * @param {string} path - 脚本路径
   */
  async loadScript(id, path) {
    if (this.loadedScripts.has(id)) {
      console.log(`脚本 ${id} 已加载，跳过`);
      return this.loadedScripts.get(id);
    }

    try {
      console.log(`加载脚本: ${id} (${path})`);

      // 动态导入模块
      const module = await import(/* @vite-ignore */ path);

      this.loadedScripts.set(id, module);

      // 如果模块有默认导出，将其注册为全局变量
      if (module.default) {
        window[id] = module.default;
        this.scriptModules.set(id, module.default);
      } else {
        // 如果没有默认导出，将整个模块注册
        window[id] = module;
        this.scriptModules.set(id, module);
      }

      console.log(`脚本加载完成: ${id}`);
      return module;
    } catch (error) {
      console.error(`脚本加载失败: ${id} (${path})`, error);
      throw error;
    }
  }

  /**
   * 执行脚本字符串
   * @param {string} script - 要执行的脚本代码
   */
  async execute(script) {
    try {
      console.log(`执行脚本: ${script}`);

      // 创建安全的执行环境
      const context = this.createExecutionContext();

      // 使用Function构造器创建函数以避免eval的安全问题
      const func = new Function(...Object.keys(context), `return (${script})`);
      const result = func(...Object.values(context));

      // 如果结果是Promise，等待它完成
      if (result && typeof result.then === "function") {
        return await result;
      }

      return result;
    } catch (error) {
      console.error(`脚本执行失败: ${script}`, error);
      throw error;
    }
  }

  /**
   * 创建脚本执行上下文
   */
  createExecutionContext() {
    const context = {
      // 核心对象
      core: this.core,

      // 管理器快捷访问
      layers: this.core.layers,
      resources: this.core.resources,
      input: this.core.input,
      scene: this.core.scene,

      // 工具函数
      console: console,
      setTimeout: setTimeout,
      setInterval: setInterval,
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,

      // 数学函数
      Math: Math,

      // 加载的脚本模块
      ...Object.fromEntries(this.scriptModules),
    };

    return context;
  }

  /**
   * 执行函数调用格式的脚本（如 "core.scene.load('main_facility')"）
   * @param {string} script - 函数调用字符串
   */
  async executeCall(script) {
    try {
      // 解析函数调用
      const { object, method, args } = this.parseMethodCall(script);

      // 获取目标对象
      const targetObject = this.resolveObject(object);
      if (!targetObject) {
        throw new Error(`对象不存在: ${object}`);
      }

      // 获取方法
      const targetMethod = targetObject[method];
      if (typeof targetMethod !== "function") {
        throw new Error(`方法不存在: ${object}.${method}`);
      }

      // 执行方法
      const result = targetMethod.apply(targetObject, args);

      // 如果结果是Promise，等待它完成
      if (result && typeof result.then === "function") {
        return await result;
      }

      return result;
    } catch (error) {
      // 如果解析失败，尝试直接执行
      return await this.execute(script);
    }
  }

  /**
   * 解析方法调用字符串
   * @param {string} script - 如 "core.scene.load('main_facility')"
   */
  parseMethodCall(script) {
    const match = script.match(/^(.+)\.(\w+)\((.*)\)$/);
    if (!match) {
      throw new Error(`无法解析方法调用: ${script}`);
    }

    const [, objectPath, method, argsString] = match;

    // 简单解析参数（支持字符串和数字）
    const args = [];
    if (argsString.trim()) {
      const argMatches = argsString.match(/'([^']*)'|"([^"]*)"|([^,\s]+)/g);
      if (argMatches) {
        for (const arg of argMatches) {
          if (arg.startsWith("'") || arg.startsWith('"')) {
            // 字符串参数
            args.push(arg.slice(1, -1));
          } else if (!isNaN(arg)) {
            // 数字参数
            args.push(Number(arg));
          } else {
            // 其他类型（布尔值等）
            if (arg === "true") args.push(true);
            else if (arg === "false") args.push(false);
            else if (arg === "null") args.push(null);
            else if (arg === "undefined") args.push(undefined);
            else args.push(arg);
          }
        }
      }
    }

    return { object: objectPath, method, args };
  }

  /**
   * 解析对象路径（如 "core.scene" -> this.core.scene）
   * @param {string} path - 对象路径
   */
  resolveObject(path) {
    const parts = path.split(".");
    let current = window;

    for (const part of parts) {
      if (current && current.hasOwnProperty(part)) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * 获取已加载的脚本
   * @param {string} id - 脚本ID
   */
  getScript(id) {
    return this.loadedScripts.get(id);
  }

  /**
   * 获取脚本模块
   * @param {string} id - 脚本ID
   */
  getModule(id) {
    return this.scriptModules.get(id);
  }

  /**
   * 清理所有脚本
   */
  dispose() {
    this.loadedScripts.clear();
    this.scriptModules.clear();
    console.log("脚本管理器已清理");
  }
}
