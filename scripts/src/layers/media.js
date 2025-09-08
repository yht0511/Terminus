/**
 * 媒体展示层（图片/视频）
 * - 覆盖在 3D 场景之上，支持全屏铺满（fullscreen + fit: 'cover'）
 * - 按 Q 键退出（handleInput 捕获）
 *
 * 选项（构造/调用时都可传）：
 * - title: string            标题文本
 * - fit: 'contain'|'cover'   媒体缩放方式（默认 contain）
 * - fullscreen: boolean      是否全屏铺满（默认 false）
 * - controls: boolean        showVideo 时是否显示原生控件（默认 false）
 * - showHeader: boolean      是否显示顶部信息条（默认 true，可设为 false 彻底移除）
 *
 * 常见用法：
 *   // 全屏视频，铺满窗口，隐藏原生控件与标题条
 *   mp = new mediaplayer();
 *   mp.showVideo('/assets/videos/demo.mp4', { fullscreen: true, fit: 'cover', controls: false, showHeader: false }).activate();
 *
 *   // 居中图片，保留标题条
 *   mp.showImage('/assets/images/pic.jpg', { title: '图片说明', fit: 'contain', showHeader: true }).activate();
 */
export default class MediaOverlay {
  constructor(options = {}) {
    this.name = "媒体展示层";
    this.element = null;
    this.contentEl = null;
    this.titleEl = null;
    this.hintEl = null;
    this.videoEl = null;
    this.imageEl = null;

    // 记录是否显式设置了 fit
    this._explicitFitSet = false;
    this._explicitFitValue = null;

    this.options = Object.assign(
      {
        title: "",
        fit: "contain", // contain | cover
        backdrop: "rgba(15, 15, 20, 0.9)",
        fullscreen: false,
        showHeader: true,
      },
      options
    );

    this._injectCSS();
    this.element = this._createElement();
    if (this.options.fullscreen) this.setFullscreen(true);
  }

  activate() {
    try {
      core.layers.push(this);
    } catch (e) {
      console.warn("MediaOverlay 推入层级失败，请确保 core.layers 存在");
    }
    return this;
  }

  deactivate() {
    try {
      core.layers.remove(this);
    } catch (e) {}
  }

  toggle() {
    if (this.element && this.element.parentNode) this.deactivate();
    else this.activate();
  }

  render() {
    return this.element;
  }

  setFullscreen(enabled = true) {
    this.options.fullscreen = !!enabled;
    if (this.element) this.element.classList.toggle("fullscreen", !!enabled);

    // 全屏时若未显式设置 fit，默认使用 cover
    const targetFit = enabled
      ? this._explicitFitSet
        ? this._explicitFitValue
        : "cover"
      : this._explicitFitSet
      ? this._explicitFitValue
      : this.options.fit || "contain";
    if (this.videoEl) this.videoEl.style.objectFit = targetFit;
    if (this.imageEl) this.imageEl.style.objectFit = targetFit;
    return this;
  }

  setShowHeader(enabled = true) {
    const want = !!enabled;
    this.options.showHeader = want;
    if (!this.element) return this;
    const header = this.element.querySelector(".media-view__header");
    if (want) {
      if (!header) {
        // 动态创建并插入 header
        const hdr = document.createElement("div");
        hdr.className = "media-view__header";
        hdr.innerHTML = `<div class="media-view__title"></div><div class="media-view__hint">按 Q 退出</div>`;
        const content = this.element.querySelector(".media-view__content");
        if (content && content.parentNode)
          content.parentNode.insertBefore(hdr, content);
        this.titleEl = hdr.querySelector(".media-view__title");
        this.hintEl = hdr.querySelector(".media-view__hint");
        this._setTitle(this.options.title || "");
      }
    } else {
      if (header && header.parentNode) header.parentNode.removeChild(header);
      this.titleEl = null;
      this.hintEl = null;
    }
    return this;
  }

  // ========== Public API ==========
  showImage(src, { title, fit, fullscreen } = {}) {
    this._ensureDom();
    this._setTitle(title ?? this.options.title ?? "");
    this._clearMedia();

    const img = document.createElement("img");
    img.className = "media-view__img";
    const effFit =
      fit || this.options.fit || (fullscreen ? "cover" : "contain");
    img.style.objectFit = effFit;
    if (fit) {
      this._explicitFitSet = true;
      this._explicitFitValue = fit;
    } else {
      this._explicitFitSet = false;
      this._explicitFitValue = effFit;
    }
    img.src = src;
    img.alt = title || "";
    this.contentEl.appendChild(img);
    this.imageEl = img;
    this.videoEl = null;
    if (typeof fullscreen === "boolean") this.setFullscreen(fullscreen);
    return this;
  }

  showVideo(
    src,
    {
      title,
      autoplay = true,
      loop = false,
      muted = false,
      poster = "",
      fit,
      fullscreen,
      controls,
    } = {}
  ) {
    
    this._ensureDom();
    this._setTitle(title ?? this.options.title ?? "");
    this._clearMedia();

    const video = document.createElement("video");
    video.className = "media-view__video";
    const effFit =
      fit || this.options.fit || (fullscreen ? "cover" : "contain");
    video.style.objectFit = effFit;
    if (fit) {
      this._explicitFitSet = true;
      this._explicitFitValue = fit;
    } else {
      this._explicitFitSet = false;
      this._explicitFitValue = effFit;
    }
    const showControls = typeof controls === "boolean" ? controls : false;
    video.controls = showControls;
    if (!showControls) video.classList.add("no-native-controls");
    else video.classList.remove("no-native-controls");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute(
      "controlsList",
      "nodownload noplaybackrate noremoteplayback"
    );
    video.addEventListener("contextmenu", (e) => e.preventDefault());
    video.autoplay = !!autoplay;
    video.loop = !!loop;
    video.muted = !!muted;
    if (poster) video.poster = poster;
    const source = document.createElement("source");
    source.src = src;
    if (src.endsWith(".mp4")) source.type = "video/mp4";
    else if (src.endsWith(".webm")) source.type = "video/webm";
    video.appendChild(source);
    this.contentEl.appendChild(video);
    this.videoEl = video;
    this.imageEl = null;
    if (typeof fullscreen === "boolean") this.setFullscreen(fullscreen);
    return this;
  }

  handleInput(event) {
    if (event.type === "keydown" && (event.key === "q" || event.key === "Q")) {
      this.deactivate();
      return 1;
    }
    return 1;
  }

  destroy() {
    try {
      if (this.videoEl) {
        try {
          this.videoEl.pause();
        } catch (e) {}
      }
      this.element = null;
      this.contentEl = null;
      this.titleEl = null;
      this.hintEl = null;
      this.videoEl = null;
      this.imageEl = null;
    } catch (e) {}
  }

  // ========== Private ==========
  _ensureDom() {
    if (!this.element) this.element = this._createElement();
  }

  _setTitle(text) {
    if (this.titleEl) this.titleEl.textContent = text || "";
  }

  _clearMedia() {
    if (this.contentEl) this.contentEl.innerHTML = "";
  }

  _createElement() {
    const el = document.createElement("div");
    el.id = "media-view";
    const headerHtml = this.options.showHeader
      ? `<div class="media-view__header"><div class="media-view__title"></div><div class="media-view__hint">按 Q 退出</div></div>`
      : "";
    el.innerHTML = `
      <div class="media-view__panel">
        ${headerHtml}
        <div class="media-view__content"></div>
      </div>
    `;
    this.titleEl = el.querySelector(".media-view__title");
    this.hintEl = el.querySelector(".media-view__hint");
    this.contentEl = el.querySelector(".media-view__content");
    this._setTitle(this.options.title || "");
    return el;
  }

  _injectCSS() {
    if (document.getElementById("media-view-styles")) return;
    const style = document.createElement("style");
    style.id = "media-view-styles";
    style.textContent = `
			#media-view {
				position: absolute;
				inset: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				background: ${this.options.backdrop};
			}
      #media-view.fullscreen {
        position: fixed;
        inset: 0;
        background: #000;
      }
			.media-view__panel {
				width: 82vw;
				max-width: 1100px;
				height: 78vh;
				max-height: 820px;
				display: flex;
				flex-direction: column;
				border: 1px solid #22c3c3;
				background: rgba(10,20,25,0.85);
				border-radius: 10px;
				box-shadow: 0 0 30px rgba(0,0,0,0.5), 0 0 10px rgba(0,255,255,0.25) inset;
				overflow: hidden;
			}
      #media-view.fullscreen .media-view__panel {
				width: 100vw;
				height: 100vh;
				max-width: 100vw;
				max-height: 100vh;
				border-radius: 0;
        border: none;
        background: transparent;
        box-shadow: none;
			}
			.media-view__header {
				height: 44px;
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0 14px;
				color: #bfefff;
				background: linear-gradient(180deg, rgba(30, 60, 70, .5), rgba(10, 20, 25, .6));
				border-bottom: 1px solid rgba(0,255,255,0.25);
				user-select: none;
			}
  /* 全屏时，信息条（如保留）宽度占满 */
  #media-view.fullscreen .media-view__header { width: 100vw; }
			.media-view__title { font-weight: 600; letter-spacing: 1px; }
			.media-view__hint { opacity: .8; font-size: 12px; }
			.media-view__content {
				flex: 1;
				display: flex;
				align-items: center;
				justify-content: center;
				background: rgba(0,0,0,0.35);
			}
  #media-view.fullscreen .media-view__content { background: #000; padding: 0; margin: 0; }
			.media-view__img, .media-view__video {
				max-width: 100%;
				max-height: 100%;
				border-radius: 4px;
				box-shadow: 0 8px 30px rgba(0,0,0,0.35);
				background: #000;
			}
			#media-view.fullscreen .media-view__img,
			#media-view.fullscreen .media-view__video {
				width: 100%;
				height: 100%;
				max-width: 100%;
				max-height: 100%;
				object-fit: cover;
				border-radius: 0;
				box-shadow: none;
			}
      .media-view__video { background: #000; }
      /* 隐藏原生控件（部分浏览器可见度不同）*/
      .media-view__video.no-native-controls::-webkit-media-controls,
      .media-view__video.no-native-controls::-webkit-media-controls-enclosure,
      .media-view__video.no-native-controls::-webkit-media-controls-panel {
        display: none !important;
        -webkit-appearance: none;
        appearance: none;
      }
		`;
    document.head.appendChild(style);
  }
}
