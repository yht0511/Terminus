import * as THREE from "three";
import { gameEngine } from "@core/GameEngine";
import { eventBus } from "@core/EventBus";
import { gameState } from "@core/GameStateManager";
import type { InteractionConfig, InteractionAction } from "@core/types";

export interface Interaction {
  id: string;
  config: InteractionConfig;
  boundingBox: THREE.Box3;
  isActive: boolean;
  isCompleted: boolean;
  object3D?: THREE.Object3D;
}

/**
 * 交互管理器
 * 处理玩家与环境的交互
 */
export class InteractionManager {
  private static instance: InteractionManager;
  private interactions = new Map<string, Interaction>();
  private activeInteraction: Interaction | null = null;
  private playerPosition = new THREE.Vector3();

  // 交互检测
  private interactionRange = 2.0;
  private raycaster = new THREE.Raycaster();

  private constructor() {
    this.setupEventListeners();
    this.setupInputHandlers();

    // 添加到引擎更新循环
    gameEngine.addUpdateCallback(this.update.bind(this));
  }

  public static getInstance(): InteractionManager {
    if (!InteractionManager.instance) {
      InteractionManager.instance = new InteractionManager();
    }
    return InteractionManager.instance;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    eventBus.on("player:moved", (data) => {
      this.playerPosition.copy(data.position);
    });

    eventBus.on("scene:changed", () => {
      this.clearInteractions();
    });
  }

  /**
   * 设置输入处理
   */
  private setupInputHandlers(): void {
    document.addEventListener("keydown", (event) => {
      if (event.code === "KeyE" && this.activeInteraction) {
        this.triggerInteraction(this.activeInteraction);
      }
    });
  }

  /**
   * 注册交互
   */
  public registerInteraction(config: InteractionConfig): void {
    const interaction: Interaction = {
      id: config.id,
      config,
      boundingBox: new THREE.Box3(),
      isActive: false,
      isCompleted: gameState.isInteractionCompleted(config.id),
    };

    // 计算包围盒
    const min = config.position
      .clone()
      .sub(config.size.clone().multiplyScalar(0.5));
    const max = config.position
      .clone()
      .add(config.size.clone().multiplyScalar(0.5));
    interaction.boundingBox.set(min, max);

    this.interactions.set(config.id, interaction);
  }

  /**
   * 更新（每帧调用）
   */
  private update(deltaTime: number): void {
    this.checkInteractions();
  }

  /**
   * 检查交互
   */
  private checkInteractions(): void {
    let nearestInteraction: Interaction | null = null;
    let nearestDistance = Infinity;

    for (const interaction of this.interactions.values()) {
      // 跳过已完成的交互（除非可重复）
      if (
        interaction.isCompleted &&
        !this.isRepeatableInteraction(interaction)
      ) {
        continue;
      }

      // 检查前置条件
      if (!this.checkInteractionConditions(interaction)) {
        continue;
      }

      // 检查距离
      if (interaction.boundingBox.containsPoint(this.playerPosition)) {
        const distance = this.playerPosition.distanceTo(
          interaction.config.position
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestInteraction = interaction;
        }
      }
    }

    // 更新激活状态
    this.setActiveInteraction(nearestInteraction);
  }

  /**
   * 检查交互条件
   */
  private checkInteractionConditions(interaction: Interaction): boolean {
    const config = interaction.config;

    // 检查必需标记
    if (config.requiresFlag) {
      if (!gameState.hasFlag(config.requiresFlag, true)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查是否为可重复交互
   */
  private isRepeatableInteraction(interaction: Interaction): boolean {
    const type = interaction.config.type;
    return type === "terminal" || type === "switch";
  }

  /**
   * 设置激活交互
   */
  private setActiveInteraction(interaction: Interaction | null): void {
    if (this.activeInteraction === interaction) return;

    // 取消之前的激活状态
    if (this.activeInteraction) {
      this.activeInteraction.isActive = false;
    }

    // 设置新的激活状态
    this.activeInteraction = interaction;

    if (interaction) {
      interaction.isActive = true;

      // 显示交互提示
      eventBus.emit("ui:show", {
        component: "interaction_prompt",
        data: {
          label: interaction.config.label,
          key: "E",
        },
      });
    } else {
      // 隐藏交互提示
      eventBus.emit("ui:hide", { component: "interaction_prompt" });
    }
  }

  /**
   * 触发交互
   */
  private triggerInteraction(interaction: Interaction): void {
    console.log(`Triggering interaction: ${interaction.id}`);

    // 发出交互事件
    eventBus.emit("interaction:trigger", {
      id: interaction.id,
      type: interaction.config.type,
    });

    // 执行交互动作
    this.executeInteractionAction(interaction.config.onInteract);

    // 标记为完成
    if (!this.isRepeatableInteraction(interaction)) {
      interaction.isCompleted = true;
      gameState.markInteractionCompleted(interaction.id);
    }
  }

  /**
   * 执行交互动作
   */
  private executeInteractionAction(action: InteractionAction): void {
    switch (action.type) {
      case "dialog":
        eventBus.emit("ui:dialog:start", { dialogId: action.data.dialogId });
        break;

      case "scene_change":
        gameState.changeScene(action.data.sceneId, action.data.spawnPoint);
        break;

      case "flag_set":
        gameState.setFlag(action.data.flag, action.data.value);
        break;

      case "terminal":
        eventBus.emit("ui:show", {
          component: "terminal",
          data: { terminalId: action.data.terminalId },
        });
        break;

      case "ending":
        eventBus.emit("story:ending", { endingId: action.data.endingId });
        break;

      default:
        console.warn("Unknown interaction action type:", action.type);
    }
  }

  /**
   * 清除所有交互
   */
  public clearInteractions(): void {
    this.interactions.clear();
    this.activeInteraction = null;
  }

  /**
   * 获取活动交互
   */
  public getActiveInteraction(): Interaction | null {
    return this.activeInteraction;
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.clearInteractions();
    gameEngine.removeUpdateCallback(this.update.bind(this));
  }
}

// 导出全局交互管理器实例
export const interactionManager = InteractionManager.getInstance();
