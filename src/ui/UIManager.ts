import { eventBus } from "@core/EventBus";

export interface UIComponent {
  id: string;
  element: HTMLElement;
  isVisible: boolean;
  show(data?: any): void;
  hide(): void;
  update?(deltaTime: number): void;
  dispose(): void;
}

/**
 * UI管理器
 * 统一管理所有UI组件
 */
export class UIManager {
  private static instance: UIManager;
  private components = new Map<string, UIComponent>();
  private container: HTMLElement;

  private constructor() {
    this.container = document.getElementById("app") || document.body;
    this.setupEventListeners();
    this.initializeBaseComponents();
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    eventBus.on("ui:show", (data) => {
      this.showComponent(data.component, data.data);
    });

    eventBus.on("ui:hide", (data) => {
      this.hideComponent(data.component);
    });
  }

  /**
   * 初始化基础UI组件
   */
  private initializeBaseComponents(): void {
    this.registerComponent(new HUDComponent());
    this.registerComponent(new InteractionPromptComponent());
    this.registerComponent(new MenuComponent());
    this.registerComponent(new LoadingComponent());
  }

  /**
   * 注册UI组件
   */
  public registerComponent(component: UIComponent): void {
    this.components.set(component.id, component);
    this.container.appendChild(component.element);
  }

  /**
   * 显示组件
   */
  public showComponent(id: string, data?: any): void {
    const component = this.components.get(id);
    if (component) {
      component.show(data);
    }
  }

  /**
   * 隐藏组件
   */
  public hideComponent(id: string): void {
    const component = this.components.get(id);
    if (component) {
      component.hide();
    }
  }

  /**
   * 获取组件
   */
  public getComponent<T extends UIComponent>(id: string): T | undefined {
    return this.components.get(id) as T;
  }

  /**
   * 更新所有组件
   */
  public update(deltaTime: number): void {
    for (const component of this.components.values()) {
      if (component.update && component.isVisible) {
        component.update(deltaTime);
      }
    }
  }

  /**
   * 清理所有组件
   */
  public dispose(): void {
    for (const component of this.components.values()) {
      component.dispose();
    }
    this.components.clear();
  }
}

/**
 * HUD组件 - 显示游戏信息
 */
class HUDComponent implements UIComponent {
  id = "hud";
  element: HTMLElement;
  isVisible = true;

  private fpsDisplay!: HTMLElement;
  private coordDisplay!: HTMLElement;
  private modeDisplay!: HTMLElement;

  constructor() {
    this.element = this.createElement();
    this.setupElements();
  }

  private createElement(): HTMLElement {
    const element = document.createElement("div");
    element.id = "hud";
    element.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      color: #00ff88;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    `;
    return element;
  }

  private setupElements(): void {
    // FPS显示
    this.fpsDisplay = document.createElement("div");
    this.element.appendChild(this.fpsDisplay);

    // 坐标显示
    this.coordDisplay = document.createElement("div");
    this.element.appendChild(this.coordDisplay);

    // 模式显示
    this.modeDisplay = document.createElement("div");
    this.modeDisplay.textContent = "MODE: LiDAR";
    this.element.appendChild(this.modeDisplay);
  }

  show(): void {
    this.isVisible = true;
    this.element.style.display = "flex";
  }

  hide(): void {
    this.isVisible = false;
    this.element.style.display = "none";
  }

  update(deltaTime: number): void {
    // 更新FPS
    const fps = Math.round(1 / deltaTime);
    this.fpsDisplay.textContent = `FPS: ${fps}`;
  }

  updateCoordinates(x: number, y: number, z: number): void {
    this.coordDisplay.textContent = `X: ${x.toFixed(2)} Y: ${y.toFixed(
      2
    )} Z: ${z.toFixed(2)}`;
  }

  updateMode(mode: string): void {
    this.modeDisplay.textContent = `MODE: ${mode}`;
  }

  dispose(): void {
    this.element.remove();
  }
}

/**
 * 交互提示组件
 */
class InteractionPromptComponent implements UIComponent {
  id = "interaction_prompt";
  element: HTMLElement;
  isVisible = false;

  constructor() {
    this.element = this.createElement();
  }

  private createElement(): HTMLElement {
    const element = document.createElement("div");
    element.style.cssText = `
      position: fixed;
      bottom: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #00ff88;
      padding: 12px 20px;
      border: 1px solid #00ff88;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      z-index: 1000;
      display: none;
      animation: pulse 2s infinite;
    `;
    return element;
  }

  show(data?: { label: string; key: string }): void {
    if (data) {
      this.element.textContent = `按 ${data.key} ${data.label}`;
    }
    this.isVisible = true;
    this.element.style.display = "block";
  }

  hide(): void {
    this.isVisible = false;
    this.element.style.display = "none";
  }

  dispose(): void {
    this.element.remove();
  }
}

/**
 * 菜单组件
 */
class MenuComponent implements UIComponent {
  id = "menu";
  element: HTMLElement;
  isVisible = false;

  constructor() {
    this.element = this.createElement();
    this.setupMenuItems();
  }

  private createElement(): HTMLElement {
    const element = document.createElement("div");
    element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff88;
      font-family: 'Courier New', monospace;
      display: none;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      z-index: 2000;
    `;
    return element;
  }

  private setupMenuItems(): void {
    const title = document.createElement("h1");
    title.textContent = "TERMINUS";
    title.style.cssText = `
      font-size: 48px;
      margin-bottom: 40px;
      text-align: center;
    `;
    this.element.appendChild(title);

    const menuItems = [
      { text: "开始游戏", action: () => this.startGame() },
      { text: "加载游戏", action: () => this.loadGame() },
      { text: "设置", action: () => this.showSettings() },
      { text: "退出", action: () => this.quit() },
    ];

    menuItems.forEach((item) => {
      const button = document.createElement("button");
      button.textContent = item.text;
      button.style.cssText = `
        background: transparent;
        border: 1px solid #00ff88;
        color: #00ff88;
        padding: 12px 24px;
        margin: 8px;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s;
      `;

      button.onmouseenter = () => {
        button.style.background = "#00ff88";
        button.style.color = "#000";
      };

      button.onmouseleave = () => {
        button.style.background = "transparent";
        button.style.color = "#00ff88";
      };

      button.onclick = item.action;
      this.element.appendChild(button);
    });
  }

  private startGame(): void {
    eventBus.emit("game:start");
    this.hide();
  }

  private loadGame(): void {
    // TODO: 实现加载游戏
    console.log("Load game");
  }

  private showSettings(): void {
    // TODO: 实现设置界面
    console.log("Show settings");
  }

  private quit(): void {
    window.close();
  }

  show(): void {
    this.isVisible = true;
    this.element.style.display = "flex";
  }

  hide(): void {
    this.isVisible = false;
    this.element.style.display = "none";
  }

  dispose(): void {
    this.element.remove();
  }
}

/**
 * 加载组件
 */
class LoadingComponent implements UIComponent {
  id = "loading";
  element: HTMLElement;
  isVisible = false;

  private progressBar!: HTMLElement;
  private statusText!: HTMLElement;

  constructor() {
    this.element = this.createElement();
    this.setupElements();
  }

  private createElement(): HTMLElement {
    const element = document.createElement("div");
    element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      color: #00ff88;
      font-family: 'Courier New', monospace;
      display: none;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      z-index: 3000;
    `;
    return element;
  }

  private setupElements(): void {
    // 状态文本
    this.statusText = document.createElement("div");
    this.statusText.style.cssText = `
      font-size: 18px;
      margin-bottom: 20px;
      text-align: center;
    `;
    this.element.appendChild(this.statusText);

    // 进度条容器
    const progressContainer = document.createElement("div");
    progressContainer.style.cssText = `
      width: 300px;
      height: 4px;
      border: 1px solid #00ff88;
      position: relative;
    `;

    // 进度条
    this.progressBar = document.createElement("div");
    this.progressBar.style.cssText = `
      height: 100%;
      background: #00ff88;
      width: 0%;
      transition: width 0.3s ease;
    `;

    progressContainer.appendChild(this.progressBar);
    this.element.appendChild(progressContainer);
  }

  show(data?: { text?: string; progress?: number }): void {
    this.isVisible = true;
    this.element.style.display = "flex";

    if (data) {
      if (data.text) {
        this.statusText.textContent = data.text;
      }
      if (data.progress !== undefined) {
        this.progressBar.style.width = `${Math.max(
          0,
          Math.min(100, data.progress)
        )}%`;
      }
    }
  }

  hide(): void {
    this.isVisible = false;
    this.element.style.display = "none";
  }

  updateProgress(progress: number, text?: string): void {
    this.progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    if (text) {
      this.statusText.textContent = text;
    }
  }

  dispose(): void {
    this.element.remove();
  }
}

// 导出全局UI管理器实例
export const uiManager = UIManager.getInstance();
