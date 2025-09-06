/**
 * 覆盖于最上层的文字播报
 * 支持两种模式：
 * - info: 简单文本显示，支持duration自动隐藏
 * - voice: 语音同步字幕，根据音频时间戳切换字幕
 */

export default class Speaker {
  constructor() {
    this.bgm = document.getElementById("bgm");
    this.soundEffect = document.getElementById("soundEffect");
    this.layer = window.core.layers;
    this.textmodule = this.genTextModule();
    
    // 定时器和状态管理
    this.hideTimer = null;
    this.currentType = null;
    this.currentVoiceData = null;
    this.currentSubtitleIndex = 0;
    this.voiceTimestamps = null;
    this.isVoiceSyncActive = false;

    this.textInit();
  }

  genTextModule() {
    // 创建主容器
    const container = document.createElement("div");
    container.className = "speaker-container";

    // 创建文本显示区域
    const textArea = document.createElement("div");
    textArea.className = "speaker-text";
    textArea.innerHTML = "";

    // 将文本区域添加到容器中
    container.appendChild(textArea);

    // 添加CSS样式
    const style = document.createElement("style");
    style.textContent = `
            .speaker-container {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                border: none;
                padding: 15px 25px;
                max-width: 80%;
                min-width: 300px;
                z-index: 1000;
                backdrop-filter: blur(5px);
                opacity: 0;
                transition: all 0.3s ease-in-out;
                pointer-events: none;
            }
            
            .speaker-container.visible {
                opacity: 1;
                pointer-events: auto;
            }
            
            .speaker-text {
                color: #fefefe;
                font-family: 'Microsoft YaHei', Arial, sans-serif;
                font-size: 18px;
                line-height: 1.5;
                text-align: center;
                word-wrap: break-word;
                white-space: pre-wrap;
                margin: 0;
                min-height: 27px;
                font-weight: 600;
                letter-spacing: 0.5px;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            }
            
            .speaker-text::selection {
                background: transparent;
            }
            
            .speaker-text::-moz-selection {
                background: transparent;
            }
            
            @media (max-width: 768px) {
                .speaker-container {
                    max-width: 90%;
                    min-width: 250px;
                    padding: 12px 20px;
                    bottom: 15px;
                }
                
                .speaker-text {
                    font-size: 16px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    user-select: none;
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                }
            }
        `;

    // 将样式添加到头部（如果还没有的话）
    if (!document.querySelector("style[data-speaker-styles]")) {
      style.setAttribute("data-speaker-styles", "true");
      document.head.appendChild(style);
    }

    // 存储文本区域的引用以便后续操作
    this.textContainer = textArea;

    // 添加方法到容器对象
    container.setText = (text) => {
      textArea.innerHTML = text;
      // 根据文本内容调整容器大小
      this.adjustContainerSize(container, text);
      // 显示容器
      container.classList.add("visible");
    };

    container.hide = () => {
      container.classList.remove("visible");
    };

    container.show = () => {
      container.classList.add("visible");
    };

    container.clear = () => {
      textArea.innerHTML = "";
      container.classList.remove("visible");
    };

    return container;
  }

  adjustContainerSize(container, text) {
    // 根据文本长度动态调整容器尺寸（去除HTML标签后的纯文本长度）
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    const textLength = tempDiv.textContent.length;

    if (textLength <= 50) {
      // 短文本
      container.style.minWidth = "300px";
      container.style.maxWidth = "50%";
    } else if (textLength <= 100) {
      // 中等文本
      container.style.minWidth = "400px";
      container.style.maxWidth = "70%";
    } else {
      // 长文本
      container.style.minWidth = "500px";
      container.style.maxWidth = "80%";
    }

    // 检查是否有换行符，如果有则增加高度
    const lineCount = (text.match(/\n/g) || []).length + 1;
    if (lineCount > 1) {
      this.textContainer.style.minHeight = `${27 * lineCount}px`;
    } else {
      this.textContainer.style.minHeight = "27px";
    }
  }

  textInit() {
    // 将文本模块添加到层级管理器中
    this.layer.push(this.textmodule);
    console.log("Speaker text module initialized");
  }

  // 显示台词文本 - 支持两种类型
  speak(id) {
    const speech = window.core.getSpeech(id).properties;
    if (speech.activated !== undefined) {
      if (speech.activated) return;
      speech.activated = true;
    }
    
    // 清除所有之前的状态（共同阻断）
    this.clearAllTimers();
    
    // 根据类型分别处理
    this.currentType = speech.type || "info";
    
    if (this.currentType === "info") {
      this.handleInfoType(speech);
    } else if (this.currentType === "voice") {
      this.handleVoiceType(speech);
    }
  }

  // 处理info类型：简单文本显示
  handleInfoType(speech) {
    if (this.textmodule && this.textmodule.setText) {
      this.textmodule.setText(speech.text);

      // 如果指定了显示时间，设置自动隐藏
      if (speech.duration && speech.duration > 0) {
        this.hideTimer = setTimeout(() => {
          this.hideSpeech();
        }, speech.duration);
      }
    }
  }

  // 处理voice类型：语音同步字幕
  handleVoiceType(speech) {
    this.currentVoiceData = speech.text; // 字典格式 {"1000": "第一句", "3000": "第二句"}
    this.currentSubtitleIndex = 0;
    
    // 转换为有序数组，便于处理
    this.voiceTimestamps = Object.keys(this.currentVoiceData)
      .map(key => ({
        time: parseInt(key),
        text: this.currentVoiceData[key]
      }))
      .sort((a, b) => a.time - b.time);

    // 播放音频（如果提供了audio）
    if (speech.audio && window.core.sound) {
      try {
        // 不使用await，让音频异步播放，避免阻塞字幕显示
        window.core.sound.playNarration(speech.audio);
      } catch (error) {
        console.warn("无法播放语音文件:", speech.audio, error);
      }
    }
    
    // 显示第一个字幕
    if (this.voiceTimestamps.length > 0) {
      this.textmodule.setText(this.voiceTimestamps[0].text);
      this.currentSubtitleIndex = 0;
    }
    
    // 激活语音同步状态
    this.isVoiceSyncActive = true;
  }

  // 更新语音同步 - 由场景update方法调用
  updateVoiceSync() {
    if (!this.isVoiceSyncActive || !window.core.sound) {
      return;
    }
    
    const currentTime = window.core.sound.getNarrationCurrentTime();
    if (currentTime === null) {
      return;
    }
    
    // 检查是否需要切换到下一个字幕
    const nextIndex = this.currentSubtitleIndex + 1;
    if (nextIndex < this.voiceTimestamps.length) {
      const nextTimestamp = this.voiceTimestamps[nextIndex];
      if (currentTime >= nextTimestamp.time) {
        this.textmodule.setText(nextTimestamp.text);
        this.currentSubtitleIndex = nextIndex;
      }
    }
  }

  // 清除所有定时器
  clearAllTimers() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.isVoiceSyncActive = false;
  }

  // 隐藏台词
  hideSpeech() {
    // 清除所有定时器
    this.clearAllTimers();

    if (this.textmodule && this.textmodule.hide) {
      this.textmodule.hide();
    }
  }

  // 显示台词容器
  showSpeech() {
    if (this.textmodule && this.textmodule.show) {
      this.textmodule.show();
    }
  }

  // 清除台词内容
  clearSpeech() {
    // 清除所有定时器
    this.clearAllTimers();

    if (this.textmodule && this.textmodule.clear) {
      this.textmodule.clear();
    }
    
    // 重置状态
    this.currentType = null;
    this.currentVoiceData = null;
    this.currentSubtitleIndex = 0;
    this.voiceTimestamps = null;
    this.isVoiceSyncActive = false;
  }

  // 析构函数
  destructor() {
    // 清除所有定时器
    this.clearAllTimers();

    if (this.textmodule) {
      this.textmodule.remove();
    }

    // 移除样式表
    const styleElement = document.querySelector("style[data-speaker-styles]");
    if (styleElement) {
      styleElement.remove();
    }

    // 清空所有引用
    this.textContainer = null;
    this.textmodule = null;
    this.layer = null;
    this.currentVoiceData = null;
    this.voiceTimestamps = null;
    this.isVoiceSyncActive = false;
  }
}
