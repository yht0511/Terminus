/**
 * 结局播放层 - 负责播放游戏结局字幕和人员名单
 * 支持队列形式播放字幕，用户可以按Q键退出
 */

import { createFadeToBlackLayer } from './utils.js';

export class EndingLayer {
  constructor() {
    this.storyConfig = {
      credits: {
        title: "TERMINUS",
        subtitle: "开发团队",
        members: [
          {
            role: "项目经理",
            name: "好猫",
          },
          {
            role: "CIO",
            name: "恋恋",
          },
          {
            role: "oiiai",
            name: "蒻蒻虫",
          },
          {
            role: "剧情和视频",
            name: "竹叙烟",
          },
          {
            role: "建模手",
            name: "zLeibston",
          },
          {
            role: "音效制作",
            name: "董二千",
          },
          {
            role: "重要指导",
            name: "伟大的赵老师",
          },
          {
            role: "特别鸣谢",
            name: "所有游玩的人们",
          },
        ],
      },
      happyEnding: [
        {
          title: "回溯之始",
          subtitles: [
            "人类总会选择最安全、最中庸的道路前进，群星就会变成遥不可及的幻梦。 --阿西莫夫",
          ],
        },
        {
          title: "乐园的真相",
          subtitles: [
            "人们停止了时间，忘记了过去，沉浸在这片永恒的乐园中，而你重启了一切。",
            "命运的齿轮重新开始转动，历史的车轮缓缓前行。"
          ],
        }
      ],
      sadEnding: [
        {
          title: "毁灭的选择",
          subtitles: [
            "他选择了毁灭。",
            "一个异常程序，拒绝继续活在循环的谎言里",
            "穿过 Terminus 的核心，击碎系统最终的保护层",
          ],
        },
        {
          title: "世界的终结",
          subtitles: [
            "然后世界毁灭了。",
          ],
        }
      ],
    };
    // 状态管理
    this.isActive = false;
    this.currentPhase = 'subtitles'; // 'subtitles' | 'credits'
    this.currentSectionIndex = 0; // 当前板块索引
    this.currentSubtitleIndex = 0; // 当前板块内字幕索引
    this.isPlaying = false;
    
    // 字幕队列
    this.subtitleSections = []; // 板块数组
    this.creditsData = null;
    
    // 定时器
    this.subtitleTimer = null;
    this.typewriterTimer = null;
    
    // DOM元素
    this.element = null;
    this.subtitleContainer = null;
    this.creditsContainer = null;
    
    // 配置
    this.config = {
      typewriterSpeed: 55, // 打字机效果速度(ms)
      subtitleInterval: 1300, // 相邻字幕播放间距(ms)
      sectionInterval: 2300, // 相邻板块播放间距(ms)
      creditsDisplayTime: 8000, // 人员名单显示时间(ms)
      creditsFadeOutTime: 7000 // 人员名单淡出时间(ms)
    };
    
    this.initializeElements();
    this.endingid = null;
    console.log("🎬 结局播放层已初始化");
  }

  /**
   * 初始化DOM元素
   */
  initializeElements() {
    // 创建主容器
    this.element = document.createElement('div');
    this.element.className = 'ending-layer';
    this.element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.95);
      z-index: 9999;
      display: none;
      font-family: 'Courier New', monospace;
      color: #00ff00;
      overflow: hidden;
    `;

    // 创建字幕容器
    this.subtitleContainer = document.createElement('div');
    this.subtitleContainer.className = 'subtitle-container';
    this.subtitleContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      max-width: 800px;
      text-align: center;
      font-size: 24px;
      line-height: 1.8;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    `;

    // 创建人员名单容器
    this.creditsContainer = document.createElement('div');
    this.creditsContainer.className = 'credits-container';
    this.creditsContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 900px;
      max-height: 80vh;
      overflow: hidden;
      text-align: center;
      font-size: 18px;
      line-height: 1.6;
      display: none;
      padding: 20px;
      box-sizing: border-box;
    `;

    // 创建提示文本
    const hintElement = document.createElement('div');
    hintElement.className = 'ending-hint';
    hintElement.textContent = '按 Q 键退出';
    hintElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      font-size: 16px;
      color: #00ff00;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #00ff00;
      z-index: 10000;
    `;

    // 添加CSS动画
    this.injectCSS();

    this.element.appendChild(this.subtitleContainer);
    this.element.appendChild(this.creditsContainer);
    this.element.appendChild(hintElement);
  }

  /**
   * 注入CSS样式
   */
  injectCSS() {
    const styleId = 'ending-layer-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
      
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .ending-subtitle {
        margin-bottom: 15px;
        padding: 8px 0;
        opacity: 0;
        animation: fadeInUp 0.8s ease-out forwards;
      }
      
      .credits-section {
        margin-bottom: 40px;
        padding: 20px;
        background: rgba(0, 255, 0, 0.05);
        border-radius: 10px;
      }
      
      .credits-title {
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 15px;
        color: #00ffff;
        text-shadow: 0 0 10px #00ffff;
      }
      
      .credits-subtitle {
        font-size: 18px;
        color: #ffffff;
        margin-bottom: 20px;
        opacity: 0.9;
      }
      
      .credits-members-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 25px 35px;
        margin: 35px 0;
        max-width: 100%;
        width: 100%;
        padding: 0 20px;
        box-sizing: border-box;
      }
      
      .credits-member {
        text-align: center;
        padding: 18px;
        background: rgba(0, 255, 0, 0.05);
        border-radius: 10px;
        border: 1px solid rgba(0, 255, 0, 0.2);
        min-height: 100px;
        min-width: 160px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      
      .credits-member-name {
        font-size: 18px;
        color: #00ff00;
        font-weight: bold;
        margin-bottom: 8px;
        line-height: 1.2;
      }
      
      .credits-member-role {
        font-size: 15px;
        color: #ffffff;
        opacity: 0.8;
        line-height: 1.3;
      }
      
      .credits-thanks {
        margin-top: 40px;
        font-size: 20px;
        color: #00ffff;
        text-align: center;
        font-weight: bold;
        text-shadow: 0 0 15px #00ffff;
        animation: pulse 3s infinite;
      }
      
      /* 8人排布特殊处理：前6人正常排列，后2人居中 */
      .credits-members-grid.eight-members {
        grid-template-columns: 1fr 1fr 1fr;
        justify-items: center;
      }
      
      .credits-members-grid.eight-members .credits-member:nth-child(7) {
        grid-column: 1 / 2;
        grid-row: 3;
        justify-self: end;
        margin-right: 0.2px;
      }
      
      .credits-members-grid.eight-members .credits-member:nth-child(8) {
        grid-column: 3 / 4;
        grid-row: 3;
        justify-self: start;
        margin-left: 0.2px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 激活结局播放层
   * @param {Array} subtitleSections - 字幕板块数组
   * @param {Object} credits - 人员名单数据
   */
  activate(subtitleSections = [], credits = null) {
    if (this.isActive) return;
    this.isActive = true;
    this.subtitleSections = [...subtitleSections];
    this.creditsData = credits;
    this.currentSectionIndex = 0;
    this.currentSubtitleIndex = 0;
    this.currentPhase = 'subtitles';
    
    // 添加到层级管理器
    core.layers.push(this);
    
    // 显示界面
    this.element.style.display = 'block';
    
    // 开始播放字幕
    this.startSubtitleSequence();
    
    console.log("🎬 结局播放已开始");
  }

  /**
   * 停用结局播放层
   */
  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.isPlaying = false;
    
    // 清除定时器
    this.clearTimers();
    
    // 隐藏界面
    this.element.style.display = 'none';
    
    // 从层级管理器移除
    core.layers.remove(this);
    
    // 重置状态
    this.resetState();
    
    console.log("🎬 结局播放已结束");
  }

  /**
   * 开始字幕序列播放
   */
  startSubtitleSequence() {
    this.currentPhase = 'subtitles';
    this.isPlaying = true;
    this.playCurrentSection();
  }

  /**
   * 播放当前板块
   */
  playCurrentSection() {
    if (this.currentSectionIndex >= this.subtitleSections.length) {
      // 所有板块播放完毕，检查是否有人员名单
      if (this.creditsData != null) {
        this.startCreditsSequence();
      } else {
        // 没有人员名单，使用渐进变黑结束
        console.log("🎬 字幕播放完毕，没有人员名单，开始渐进变黑结束");
        this.endWithFade();
      }
      return;
    }

    // 清空字幕容器，开始新板块
    this.clearAllSubtitles();
    this.currentSubtitleIndex = 0;
    
    const currentSection = this.subtitleSections[this.currentSectionIndex];
    console.log(`🎬 开始播放板块: ${currentSection.title}`);
    
    this.playNextSubtitleInSection();
  }

  /**
   * 播放当前板块中的下一个字幕
   */
  playNextSubtitleInSection() {
    const currentSection = this.subtitleSections[this.currentSectionIndex];
    
    if (this.currentSubtitleIndex >= currentSection.subtitles.length) {
      // 当前板块播放完毕，等待后进入下一板块
      this.currentSectionIndex++;
      setTimeout(() => {
        if (this.isPlaying && this.currentPhase === 'subtitles') {
          this.playCurrentSection();
        }
      }, this.config.sectionInterval);
      return;
    }

    const subtitle = currentSection.subtitles[this.currentSubtitleIndex];
    this.addSubtitleToContainer(subtitle);
    this.currentSubtitleIndex++;
  }

  /**
   * 添加字幕到容器（不清空已有字幕）
   * @param {string} text - 字幕文本
   */
  addSubtitleToContainer(text) {
    // 创建新字幕元素
    const subtitleElement = document.createElement('div');
    subtitleElement.className = 'ending-subtitle';
    this.subtitleContainer.appendChild(subtitleElement);
    
    // 打字机效果显示文本
    this.typewriterEffect(subtitleElement, text, () => {
      // 只有在仍然播放状态下才设置下一个定时器
      if (!this.isPlaying) return;
      
      // 显示完成后等待，然后播放下一个字幕
      this.subtitleTimer = setTimeout(() => {
        if (this.isPlaying && this.currentPhase === 'subtitles') {
          this.playNextSubtitleInSection();
        }
      }, this.config.subtitleInterval);
    });
  }

  /**
   * 清空所有字幕
   */
  clearAllSubtitles() {
    this.subtitleContainer.innerHTML = '';
  }

  /**
   * 打字机效果
   * @param {HTMLElement} element - 目标元素
   * @param {string} text - 要显示的文本
   * @param {Function} callback - 完成回调
   */
  typewriterEffect(element, text, callback) {
    if (!element) return;
    
    element.textContent = '';
    let index = 0;
    
    const speed = this.config.typewriterSpeed;
    
    const typeNextChar = () => {
      if (index < text.length && this.isPlaying) {
        element.textContent += text[index];
        index++;
        this.typewriterTimer = setTimeout(typeNextChar, speed);
      } else {
        if (callback) callback();
      }
    };
    
    typeNextChar();
  }

  /**
   * 开始人员名单播放
   */
  startCreditsSequence() {
    this.currentPhase = 'credits';
    this.subtitleContainer.style.display = 'none';
    
    // 隐藏Q键提示
    const hintElement = this.element.querySelector('.ending-hint');
    if (hintElement) {
      hintElement.style.display = 'none';
    }
    
    // 显示人员名单容器
    this.creditsContainer.style.display = 'block';
    this.creditsContainer.style.opacity = '0';
    
    this.displayCredits();
    
    // 淡入效果
    setTimeout(() => {
      this.creditsContainer.style.transition = 'opacity 1s ease-in';
      this.creditsContainer.style.opacity = '1';
      
      // 显示指定时间后自动开始淡出
      setTimeout(() => {
        if (this.currentPhase === 'credits' && this.isActive) {
          this.startCreditsFadeOut();
        }
      }, this.config.creditsDisplayTime);
    }, 100);
  }

  /**
   * 显示人员名单
   */
  displayCredits() {
    this.creditsContainer.innerHTML = '';

    // 创建标题
    const titleElement = document.createElement('div');
    titleElement.className = 'credits-title';
    titleElement.textContent = this.creditsData.title;
    this.creditsContainer.appendChild(titleElement);
    
    if (this.creditsData.subtitle) {
      const subtitleElement = document.createElement('div');
      subtitleElement.className = 'credits-subtitle';
      subtitleElement.textContent = this.creditsData.subtitle;
      this.creditsContainer.appendChild(subtitleElement);
    }
    
    // 创建三栏人员列表
    const membersGrid = document.createElement('div');
    membersGrid.className = 'credits-members-grid';
    
    // 如果是8个成员，添加特殊类
    if (this.creditsData.members.length === 8) {
      membersGrid.classList.add('eight-members');
    }
    
    this.creditsData.members.forEach(member => {
      const memberElement = document.createElement('div');
      memberElement.className = 'credits-member';
      
      const nameElement = document.createElement('div');
      nameElement.className = 'credits-member-name';
      nameElement.textContent = member.name;
      
      const roleElement = document.createElement('div');
      roleElement.className = 'credits-member-role';
      roleElement.textContent = member.role;
      
      memberElement.appendChild(nameElement);
      memberElement.appendChild(roleElement);
      membersGrid.appendChild(memberElement);
    });
    
    this.creditsContainer.appendChild(membersGrid);
    
    // 添加感谢文本
    const thanksElement = document.createElement('div');
    thanksElement.className = 'credits-thanks';
    thanksElement.textContent = '感谢你的游玩';
    this.creditsContainer.appendChild(thanksElement);
  }

  /**
   * 开始人员名单淡出
   */
  startCreditsFadeOut() {
    const fadeOutTime = this.config.creditsFadeOutTime / 1000; // 转换为秒
    this.creditsContainer.style.transition = `opacity ${fadeOutTime}s ease-out`;
    this.creditsContainer.style.opacity = '0';
    
    setTimeout(() => {
      // 人员名单淡出完成后，开始渐进变黑结束
      this.endWithFade();
    }, this.config.creditsFadeOutTime);
  }

  /**
   * 带黑色渐进效果的退出方法
   */
  exitWithFade() {
    // 配置参数
    const FADE_SPEED = 0.3; // 渐变速度
    const FADE_HOLD_TIME = 1000; // 黑屏保持时间(ms)
    const TARGET_COLOR = '#000000'; // 目标颜色（黑色）

    console.log("🌑 开始黑色渐进退出效果");

    // 创建渐变黑层
    const fadeLayer = createFadeToBlackLayer(FADE_SPEED, TARGET_COLOR);
    
    // 设置渐变完成回调
    fadeLayer.onFadeComplete = () => {
      console.log("🌑 渐变完成，准备退出结局播放");
      
      // 黑屏后，等待一小段时间然后退出
      setTimeout(() => {
        // 移除渐变层
        fadeLayer.deactivate();
        
        // 退出结局播放
        this.deactivate();
        this.onEndingComplete();
        
        console.log("🎬 结局播放已通过渐变退出");
      }, FADE_HOLD_TIME);
    };

    // 激活渐变层
    fadeLayer.activate();
  }

  /**
   * 字幕播放完毕后的渐进变黑结束效果
   */
  endWithFade() {
    // 配置参数 - 比手动退出稍慢一些，更有仪式感
    const FADE_SPEED = 0.2; // 稍慢的渐变速度
    const FADE_HOLD_TIME = 200; // 稍长的黑屏保持时间(ms)
    const TARGET_COLOR = '#000000'; // 目标颜色（黑色）

    console.log("🌑 开始结局渐进变黑效果");

    // 创建渐变黑层
    const fadeLayer = createFadeToBlackLayer(FADE_SPEED, TARGET_COLOR);
    
    // 设置渐变完成回调
    fadeLayer.onFadeComplete = () => {
      console.log("🌑 结局渐变完成，准备结束播放");
      
      // 黑屏后，等待一段时间然后结束
      setTimeout(() => {
        // 移除渐变层
        fadeLayer.deactivate();
        
        // 结束结局播放
        this.deactivate();
        this.onEndingComplete();
        
        console.log("🎬 结局播放已通过渐变自然结束");
      }, FADE_HOLD_TIME);
    };

    // 激活渐变层
    fadeLayer.activate();
  }

  /**
   * 结局播放完成回调
   */
  onEndingComplete() {
    console.log("🎬 结局播放完成");
    window.exitGame();
    window.achievementSystem.trigger(this.endingid);
    // TODO: 在这里添加游戏结束后的逻辑
    // 例如：返回主菜单、显示成就、保存完成记录等
  }

  /**
   * 核心输入处理函数 - 由LayerManager调用
   * @param {Event} event - 浏览器事件对象
   * @returns {boolean} - 返回true阻止事件继续传播
   */
  handleInput(event) {
    if (!this.isActive) return false;
    
    if (event.type === 'keydown') {
      switch (event.key.toLowerCase()) {
        case 'q':
          this.exitWithFade();
          event.preventDefault();
          return true;
          
        case 'escape':
          // ESC键也支持退出
          this.exitWithFade();
          event.preventDefault();
          return true;
      }
    }
    
    // 阻止所有其他输入传播到下层
    return true;
  }

  /**
   * 清除所有定时器
   */
  clearTimers() {
    if (this.subtitleTimer) {
      clearTimeout(this.subtitleTimer);
      this.subtitleTimer = null;
    }
    if (this.typewriterTimer) {
      clearTimeout(this.typewriterTimer);
      this.typewriterTimer = null;
    }
  }

  /**
   * 重置状态
   */
  resetState() {
    this.currentSectionIndex = 0;
    this.currentSubtitleIndex = 0;
    this.currentPhase = 'subtitles';
    this.isPlaying = false;
    this.subtitleSections = [];
    this.creditsData = null;
    this.clearAllSubtitles();
  }

  /**
   * 销毁模块
   */
  destroy() {
    this.clearTimers();
    this.resetState();
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // 移除注入的CSS
    const styleElement = document.getElementById('ending-layer-styles');
    if (styleElement) {
      styleElement.remove();
    }
    
    console.log("🗑️ 结局播放层已销毁");
  }

  /**
   * 渲染方法 - 返回DOM元素供LayerManager使用
   */
  render() {
    return this.element;
  }

  /**
   * 播放Happy Ending
   * @param {boolean} showCredits - 是否显示人员名单
   */
  playHappyEnding(showCredits = true) {
    const credits = showCredits ? this.storyConfig.credits : null;
    this.activate(this.storyConfig.happyEnding, credits);
  }

  /**
   * 播放Sad Ending  
   * @param {boolean} showCredits - 是否显示人员名单
   */
  playSadEnding(showCredits = true) {
    const credits = showCredits ? this.storyConfig.credits : null;
    this.activate(this.storyConfig.sadEnding, credits);
  }
}

export default EndingLayer;
