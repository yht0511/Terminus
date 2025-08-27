import EventEmitter from "eventemitter3";
import type { GameEvents } from "./types";

/**
 * 全局事件总线
 * 使用类型安全的事件系统管理游戏内所有事件通信
 */
export class EventBus extends EventEmitter<GameEvents> {
  private static instance: EventBus;

  private constructor() {
    super();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * 发出事件
   */
  public emit<K extends keyof GameEvents>(
    event: K,
    ...args: GameEvents[K] extends void ? [] : [GameEvents[K]]
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * 监听事件
   */
  public on<K extends keyof GameEvents>(
    event: K,
    listener: (data: GameEvents[K]) => void
  ): this {
    return super.on(event, listener as any);
  }

  /**
   * 监听一次性事件
   */
  public once<K extends keyof GameEvents>(
    event: K,
    listener: (data: GameEvents[K]) => void
  ): this {
    return super.once(event, listener as any);
  }

  /**
   * 移除事件监听器
   */
  public off<K extends keyof GameEvents>(
    event: K,
    listener?: (data: GameEvents[K]) => void
  ): this {
    return super.off(event, listener as any);
  }

  /**
   * 清除所有监听器
   */
  public removeAllListeners<K extends keyof GameEvents>(event?: K): this {
    return super.removeAllListeners(event);
  }
}

// 导出全局事件总线实例
export const eventBus = EventBus.getInstance();
