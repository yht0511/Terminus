import type * as THREE from "three";
import type { PlayerControllerConfig } from "@game/PlayerController";
import type { LiDARConfig } from "@game/LiDARSystem";

// 核心引擎事件类型定义
export interface GameEvents {
  // 游戏生命周期
  "game:init": void;
  "game:start": void;
  "game:pause": void;
  "game:resume": void;
  "game:end": { type: "complete" | "quit" };

  // 系统生命周期
  "systems:initialized": void;
  "systems:disposed": void;

  // 场景相关
  "scene:loaded": { sceneId: string };
  "scene:changed": { from: string; to: string };

  // 玩家相关
  "player:moved": { position: THREE.Vector3 };
  "player:interact": { targetId: string };
  "player:died": void;

  // 交互相关
  "interaction:trigger": { id: string; type: string };
  "interaction:complete": { id: string; result: any };

  // UI相关
  "ui:show": { component: string; data?: any };
  "ui:hide": { component: string };
  "ui:dialog:start": { dialogId: string };
  "ui:dialog:end": { dialogId: string };

  // 扫描相关
  "lidar:scan": { points: number };
  "lidar:startScan": void;
  "lidar:mode:changed": { mode: "normal" | "lidar" };

  // 保存系统
  "save:created": { slot: number };
  "save:loaded": { slot: number };

  // 剧情相关
  "story:flag:set": { flag: string; value: any };
  "story:ending": { endingId: string };
}

// 游戏状态类型
export interface GameState {
  currentScene: string;
  playerPosition: THREE.Vector3;
  playerRotation: THREE.Euler;
  storyFlags: Record<string, any>;
  inventory: string[];
  completedInteractions: string[];
  discoveredLocations: string[];
  gameTime: number;
  playtime: number;
}

// 场景配置类型
export interface SceneConfig {
  id: string;
  name: string;
  modelPath: string;
  spawnPoint: THREE.Vector3;
  spawnRotation: THREE.Euler;
  interactions: InteractionConfig[];
  ambientSound?: string;
  backgroundMusic?: string;
}

// 交互配置类型
export interface InteractionConfig {
  id: string;
  type: "door" | "terminal" | "switch" | "item" | "trigger";
  position: THREE.Vector3;
  size: THREE.Vector3;
  label: string;
  requiresFlag?: string;
  onInteract: InteractionAction;
  model?: string;
  animation?: string;
}

// 交互动作类型
export interface InteractionAction {
  type: "dialog" | "scene_change" | "flag_set" | "terminal" | "ending";
  data: any;
}

// 对话配置类型
export interface DialogConfig {
  id: string;
  title?: string;
  entries: DialogEntry[];
}

export interface DialogEntry {
  speaker?: string;
  text: string;
  choices?: DialogChoice[];
  conditions?: DialogCondition[];
  actions?: DialogAction[];
}

export interface DialogChoice {
  text: string;
  nextEntry?: number;
  conditions?: DialogCondition[];
  actions?: DialogAction[];
}

export interface DialogCondition {
  type: "flag" | "item" | "scene";
  key: string;
  value: any;
  operator?: "eq" | "neq" | "gt" | "lt";
}

export interface DialogAction {
  type: "flag_set" | "item_give" | "item_take" | "scene_change" | "ending";
  data: any;
}

// 终端配置类型
export interface TerminalConfig {
  id: string;
  prompt: string;
  commands: TerminalCommand[];
  ascii?: string;
  bootScript?: string[];
}

export interface TerminalCommand {
  command: string;
  description?: string;
  handler: (args: string[]) => TerminalOutput;
}

export interface TerminalOutput {
  text: string[];
  clear?: boolean;
  exit?: boolean;
  actions?: DialogAction[];
}

// 结局配置类型
export interface EndingConfig {
  id: string;
  name: string;
  description: string;
  conditions: DialogCondition[];
  cutscene?: string;
  credits?: boolean;
}

// 保存数据类型
export interface SaveData {
  version: string;
  timestamp: number;
  gameState: GameState;
  screenshot?: string;
}

// 配置文件类型
export interface GameConfig {
  version: string;
  title: string;
  scenes: SceneConfig[];
  dialogs: DialogConfig[];
  terminals: TerminalConfig[];
  endings: EndingConfig[];
  defaultFlags: Record<string, any>;

  // 系统配置
  player?: Partial<PlayerControllerConfig>;
  lidar?: Partial<LiDARConfig>;

  // 渲染配置
  graphics?: {
    antialias?: boolean;
    shadows?: boolean;
    maxPixelRatio?: number;
  };
}
