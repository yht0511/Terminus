/**
 * 覆盖于最上层的文字播报
 */

export default class Speaker {
    constructor() {
        this.bgm = document.getElementById("bgm");
        this.soundEffect = document.getElementById("soundEffect");
        this.layer = window.core.layers;
        this.textmodule = this.genTextModule();
        this.hideTimer = null; // 添加定时器属性

        this.textInit();
    }

    genTextModule() {
        // 创建主容器
        const container = document.createElement('div');
        container.className = 'speaker-container';
        
        // 创建文本显示区域
        const textArea = document.createElement('div');
        textArea.className = 'speaker-text';
        textArea.innerHTML = '';
        
        // 将文本区域添加到容器中
        container.appendChild(textArea);
        
        // 添加CSS样式
        const style = document.createElement('style');
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
                }
            }
        `;
        
        // 将样式添加到头部（如果还没有的话）
        if (!document.querySelector('style[data-speaker-styles]')) {
            style.setAttribute('data-speaker-styles', 'true');
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
            container.classList.add('visible');
        };
        
        container.hide = () => {
            container.classList.remove('visible');
        };
        
        container.show = () => {
            container.classList.add('visible');
        };
        
        container.clear = () => {
            textArea.innerHTML = '';
            container.classList.remove('visible');
        };
        
        return container;
    }

    adjustContainerSize(container, text) {
        // 根据文本长度动态调整容器尺寸（去除HTML标签后的纯文本长度）
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const textLength = tempDiv.textContent.length;
        
        if (textLength <= 50) {
            // 短文本
            container.style.minWidth = '300px';
            container.style.maxWidth = '50%';
        } else if (textLength <= 100) {
            // 中等文本
            container.style.minWidth = '400px';
            container.style.maxWidth = '70%';
        } else {
            // 长文本
            container.style.minWidth = '500px';
            container.style.maxWidth = '80%';
        }
        
        // 检查是否有换行符，如果有则增加高度
        const lineCount = (text.match(/\n/g) || []).length + 1;
        if (lineCount > 1) {
            this.textContainer.style.minHeight = `${27 * lineCount}px`;
        } else {
            this.textContainer.style.minHeight = '27px';
        }
    }

    textInit() {
        // 将文本模块添加到层级管理器中
        this.layer.push(this.textmodule);
        console.log("Speaker text module initialized");
    }

    // 显示台词文本
    speak(text, duration = null) {
        // 清除之前的定时器
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        if (this.textmodule && this.textmodule.setText) {
            this.textmodule.setText(text);
            
            // 如果指定了显示时间，设置自动隐藏
            if (duration && duration > 0) {
                this.hideTimer = setTimeout(() => {
                    this.hideSpeech();
                    this.hideTimer = null;
                }, duration);
            }
        }
    }

    // 隐藏台词
    hideSpeech() {
        // 清除定时器
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

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
        // 清除定时器
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        if (this.textmodule && this.textmodule.clear) {
            this.textmodule.clear();
        }
    }

    // 析构函数
    destructor() {
        // 清除定时器
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        if (this.textmodule) {
            this.textmodule.remove();
        }
        
        // 移除样式表
        const styleElement = document.querySelector('style[data-speaker-styles]');
        if (styleElement) {
            styleElement.remove();
        }
        
        this.textContainer = null;
        this.textmodule = null;
        this.layer = null;
    }
}