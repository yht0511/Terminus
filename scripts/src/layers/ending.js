/**
 * 结局播放层 - 负责播放游戏结局字幕和人员名单
 * 支持队列形式播放字幕，用户可以按E键快进
 */

export class EndingLayer {
  constructor() {
    this.config = {
      "credits": {
        "title": "TERMINUS",
        "subtitle": "开发团队",
        "members": [
          {
            "role": "项目经理",
            "name": "好猫"
          },
          {
            "role": "CIO",
            "name": "恋恋"
          },
          {
            "role": "oiiai",
            "name": "蒻蒻虫"
          },
          {
            "role": "剧情和视频",
            "name": "竹叙烟"
          },
          {
            "role": "建模手",
            "name": "zLeibston"
          },
          {
            "role": "音效制作",
            "name": "董二千"
          },
          {
            "role": "重要指导",
            "name": "伟大的赵老师"
          },
          {
            "role": "特别鸣谢",
            "name": "所有游玩的朋友们"
          }
        ]
      },
      "happyEnding": [

      ],
      "sadEnding": [

      ]
    }
    // 状态管理
    this.isActive = false;
    this.currentPhase = 'subtitles'; // 'subtitles' | 'credits'
    this.currentIndex = 0;
    this.isPlaying = false;
    
    // 字幕队列
    this.subtitleQueue = [];
    this.creditsData = null;
    
    // 定时器
    this.subtitleTimer = null;
    this.typewriterTimer = null;
    
    // DOM元素
    this.element = null;
    this.subtitleContainer = null;
    this.creditsContainer = null;
    this.currentSubtitleElement = null;
    
    // 配置
    this.config = {
      subtitleDisplayTime: 3000, // 字幕显示时间(ms)
      typewriterSpeed: 50, // 打字机效果速度(ms)
      creditsDisplayTime: 8000, // 人员名单显示时间(ms)
      creditsFadeOutTime: 7000 // 人员名单淡出时间(ms)
    };
    
    this.initializeElements();
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
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: 80%;
      max-width: 800px;
      text-align: center;
      font-size: 24px;
      line-height: 1.5;
      min-height: 100px;
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
    hintElement.textContent = '按 E 键快进';
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
      
      .ending-subtitle {
        margin-bottom: 20px;
        padding: 10px;
        background: rgba(0, 255, 0, 0.1);
        border-radius: 8px;
        border-left: 4px solid #00ff00;
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
   * @param {Array} subtitles - 字幕数组
   * @param {Object} credits - 人员名单数据
   */
  activate(subtitles = [], credits = null) {
    if (this.isActive) return;
    this.isActive = true;
    this.subtitleQueue = [...subtitles];
    this.creditsData = credits;
    this.currentIndex = 0;
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
    this.playNextSubtitle();
  }

  /**
   * 播放下一个字幕
   */
  playNextSubtitle() {
    if (this.currentIndex >= this.subtitleQueue.length) {
      // 字幕播放完毕，检查是否有人员名单
      if (this.creditsData != null) {
        this.startCreditsSequence();
      } else {
        // 没有人员名单，直接结束
        console.log("🎬 字幕播放完毕，没有人员名单，结束播放");
        this.deactivate();
        this.onEndingComplete();
      }
      return;
    }

    // 确保清除之前的字幕，防止重叠
    this.clearCurrentSubtitle();
    
    const subtitle = this.subtitleQueue[this.currentIndex];
    this.displaySubtitle(subtitle);
    this.currentIndex++;
  }

  /**
   * 显示单个字幕
   * @param {string} text - 字幕文本
   */
  displaySubtitle(text) {
    // 确保清除之前的字幕和定时器
    this.clearCurrentSubtitle();
    this.clearTimers();
    
    // 创建新字幕元素
    this.currentSubtitleElement = document.createElement('div');
    this.currentSubtitleElement.className = 'ending-subtitle';
    this.subtitleContainer.appendChild(this.currentSubtitleElement);
    
    // 打字机效果显示文本
    this.typewriterEffect(text, () => {
      // 只有在仍然播放状态下才设置下一个定时器
      if (!this.isPlaying) return;
      
      // 显示完成后等待
      const displayTime = this.config.subtitleDisplayTime;
        
      this.subtitleTimer = setTimeout(() => {
        if (this.isPlaying && this.currentPhase === 'subtitles') {
          // 直接清空当前字幕，不使用淡出效果
          this.clearCurrentSubtitle();
          this.playNextSubtitle();
        }
      }, displayTime);
    });
  }

  /**
   * 打字机效果
   * @param {string} text - 要显示的文本
   * @param {Function} callback - 完成回调
   */
  typewriterEffect(text, callback) {
    if (!this.currentSubtitleElement) return;
    
    this.currentSubtitleElement.textContent = '';
    let index = 0;
    
    const speed = this.config.typewriterSpeed;
    
    const typeNextChar = () => {
      if (index < text.length && this.isPlaying) {
        this.currentSubtitleElement.textContent += text[index];
        index++;
        this.typewriterTimer = setTimeout(typeNextChar, speed);
      } else {
        if (callback) callback();
      }
    };
    
    typeNextChar();
  }

  /**
   * 清除当前字幕
   */
  clearCurrentSubtitle() {
    if (this.currentSubtitleElement) {
      this.currentSubtitleElement.remove();
      this.currentSubtitleElement = null;
    }
  }

  /**
   * 开始人员名单播放
   */
  startCreditsSequence() {
    this.currentPhase = 'credits';
    this.subtitleContainer.style.display = 'none';
    
    // 隐藏E键提示
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
      this.deactivate();
      this.onEndingComplete();
    }, this.config.creditsFadeOutTime);
  }

  /**
   * 快进功能 - 只快速结束当前语句
   */
  fastForwardToggle() {
    if (this.currentPhase === 'subtitles') {
      // 如果正在打字机效果中，立即完成当前字幕
      if (this.typewriterTimer && this.currentSubtitleElement) {
        // 停止打字机效果
        clearTimeout(this.typewriterTimer);
        this.typewriterTimer = null;
        
        // 立即显示完整文本
        const currentText = this.subtitleQueue[this.currentIndex - 1];
        if (currentText) {
          this.currentSubtitleElement.textContent = currentText;
        }
        
        // 设置正常的等待时间后播放下一个字幕
        this.subtitleTimer = setTimeout(() => {
          if (this.isPlaying && this.currentPhase === 'subtitles') {
            this.clearCurrentSubtitle();
            this.playNextSubtitle();
          }
        }, this.config.subtitleDisplayTime);
      }
    } else if (this.currentPhase === 'credits') {
      // 如果在人员名单阶段，立即开始淡出
      this.startCreditsFadeOut();
    }
  }

  /**
   * 结局播放完成回调
   */
  onEndingComplete() {
    console.log("🎬 结局播放完成");
    window.exitGame();
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
        case 'e':
          this.fastForwardToggle();
          event.preventDefault();
          return true;
          
        case 'escape':
          // ESC键退出结局播放
          this.deactivate();
          this.onEndingComplete();
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
    this.currentIndex = 0;
    this.currentPhase = 'subtitles';
    this.isPlaying = false;
    this.subtitleQueue = [];
    this.creditsData = null;
    this.clearCurrentSubtitle();
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
}

export default EndingLayer;
