import { eventBus } from "./EventBus";
import type { GameState, SaveData } from "./types";

/**
 * 游戏状态管理器
 * 负责管理游戏的全局状态、存档和读档
 */
export class GameStateManager {
  private static instance: GameStateManager;
  private _state: GameState;
  private _initialState: GameState;

  private constructor() {
    this._initialState = this.createInitialState();
    this._state = { ...this._initialState };
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  /**
   * 获取当前游戏状态
   */
  public get state(): Readonly<GameState> {
    return this._state;
  }

  /**
   * 创建初始游戏状态
   */
  private createInitialState(): GameState {
    return {
      currentScene: "facility_entrance",
      playerPosition: { x: 0, y: 0, z: 0 } as any,
      playerRotation: { x: 0, y: 0, z: 0 } as any,
      storyFlags: {
        game_started: false,
        terminal_accessed: false,
        choice_made: null,
        ending_seen: null,
      },
      inventory: [],
      completedInteractions: [],
      discoveredLocations: [],
      gameTime: 0,
      playtime: 0,
    };
  }

  /**
   * 重置游戏状态
   */
  public reset(): void {
    this._state = { ...this._initialState };
  }

  /**
   * 更新玩家位置
   */
  public updatePlayerPosition(position: any, rotation?: any): void {
    this._state.playerPosition = position;
    if (rotation) {
      this._state.playerRotation = rotation;
    }
    eventBus.emit("player:moved", { position });
  }

  /**
   * 切换场景
   */
  public changeScene(sceneId: string, spawnPoint?: any): void {
    const oldScene = this._state.currentScene;
    this._state.currentScene = sceneId;

    if (spawnPoint) {
      this._state.playerPosition = spawnPoint;
    }

    if (!this._state.discoveredLocations.includes(sceneId)) {
      this._state.discoveredLocations.push(sceneId);
    }

    eventBus.emit("scene:changed", { from: oldScene, to: sceneId });
  }

  /**
   * 设置剧情标记
   */
  public setFlag(flag: string, value: any): void {
    this._state.storyFlags[flag] = value;
    eventBus.emit("story:flag:set", { flag, value });
  }

  /**
   * 获取剧情标记
   */
  public getFlag(flag: string): any {
    return this._state.storyFlags[flag];
  }

  /**
   * 检查剧情标记
   */
  public hasFlag(flag: string, value?: any): boolean {
    if (value === undefined) {
      return this._state.storyFlags[flag] !== undefined;
    }
    return this._state.storyFlags[flag] === value;
  }

  /**
   * 添加到背包
   */
  public addToInventory(item: string): void {
    if (!this._state.inventory.includes(item)) {
      this._state.inventory.push(item);
    }
  }

  /**
   * 从背包移除
   */
  public removeFromInventory(item: string): void {
    const index = this._state.inventory.indexOf(item);
    if (index !== -1) {
      this._state.inventory.splice(index, 1);
    }
  }

  /**
   * 检查背包中是否有物品
   */
  public hasItem(item: string): boolean {
    return this._state.inventory.includes(item);
  }

  /**
   * 标记交互为已完成
   */
  public markInteractionCompleted(interactionId: string): void {
    if (!this._state.completedInteractions.includes(interactionId)) {
      this._state.completedInteractions.push(interactionId);
    }
  }

  /**
   * 检查交互是否已完成
   */
  public isInteractionCompleted(interactionId: string): boolean {
    return this._state.completedInteractions.includes(interactionId);
  }

  /**
   * 更新游戏时间
   */
  public updateTime(deltaTime: number): void {
    this._state.gameTime += deltaTime;
    this._state.playtime += deltaTime;
  }

  /**
   * 保存游戏
   */
  public saveGame(slot: number = 0): boolean {
    try {
      const saveData: SaveData = {
        version: "1.0.0",
        timestamp: Date.now(),
        gameState: { ...this._state },
      };

      localStorage.setItem(`terminus_save_${slot}`, JSON.stringify(saveData));
      eventBus.emit("save:created", { slot });
      return true;
    } catch (error) {
      console.error("Failed to save game:", error);
      return false;
    }
  }

  /**
   * 加载游戏
   */
  public loadGame(slot: number = 0): boolean {
    try {
      const saveDataString = localStorage.getItem(`terminus_save_${slot}`);
      if (!saveDataString) {
        return false;
      }

      const saveData: SaveData = JSON.parse(saveDataString);
      this._state = { ...saveData.gameState };
      eventBus.emit("save:loaded", { slot });
      return true;
    } catch (error) {
      console.error("Failed to load game:", error);
      return false;
    }
  }

  /**
   * 检查存档是否存在
   */
  public hasSave(slot: number = 0): boolean {
    return localStorage.getItem(`terminus_save_${slot}`) !== null;
  }

  /**
   * 删除存档
   */
  public deleteSave(slot: number = 0): void {
    localStorage.removeItem(`terminus_save_${slot}`);
  }

  /**
   * 获取所有存档信息
   */
  public getSaveInfo(): Array<{ slot: number; data: SaveData | null }> {
    const saves = [];
    for (let i = 0; i < 10; i++) {
      const saveDataString = localStorage.getItem(`terminus_save_${i}`);
      let saveData = null;
      if (saveDataString) {
        try {
          saveData = JSON.parse(saveDataString);
        } catch (error) {
          console.error(`Failed to parse save ${i}:`, error);
        }
      }
      saves.push({ slot: i, data: saveData });
    }
    return saves;
  }
}

// 导出全局状态管理器实例
export const gameState = GameStateManager.getInstance();
