/**
 * Achievement System
 *  - 成就定义与达成记录存储在 localStorage
 *  - 成就触发时会弹出提示（可排队）
 */
class AchievementSystem {
  constructor(options = {}) {
    this.storageKey = options.storageKey || "terminus_achievements";
    this.duration = options.duration || 3000; // ms
    this.transitionMs = options.transitionMs || 350; // 和 CSS 过渡保持一致
    this.sfxUrl =
      options.sfxUrl !== undefined
        ? options.sfxUrl
        : "./assets/sounds/achievement.mp3";
    this.sfxVolume = options.sfxVolume !== undefined ? options.sfxVolume : 0.9;
    this.state = this._load();
    this.queue = [];
    this.isShowing = false;
    // 动态注入成就弹窗样式（右上角），避免样式缺失或被外部覆盖
    this._ensureStylesInjected();
    this.toastEl = document.getElementById("achievement-toast");
    if (!this.toastEl) this.toastEl = this._createToastEl();
    this._htmlAudio = null;
    // 简单预加载成就音效以减少首响延迟
    if (this.sfxUrl) {
      try {
        this._htmlAudio = new Audio();
        this._htmlAudio.src = this.sfxUrl;
        this._htmlAudio.preload = "auto";
        this._htmlAudio.volume = this._getEffectiveSfxVolume();
      } catch (e) {}
    }
    this.init();
  }

  init() {
    const defs = [
      {
        id: "first_steps",
        name: "初次踏足",
        description: "首次进入游戏",
        iconUrl: "./assets/images/achievements/first_steps.png",
      },
      {
        id: "brave_heart",
        name: "勇敢的心",
        description: "???",
        iconUrl: "./assets/images/achievements/brave_heart.png",
      },
      {
        id: "0d000721",
        name: "ciallo~",
        description: "ciallo~",
        iconUrl: "./assets/images/achievements/0d00.png",
      },
      {
        id: "idiot",
        name: "奇怪,怎么打不开?",
        description: "十足的傻瓜",
        iconUrl: "./assets/images/achievements/idiot.png",
      },
    ];
    this.setDefinitions(defs);
  }

  // ========== Public APIs ==========
  /**
   * 设置成就定义列表（用于计算总数）。
   * defs: Array<{ id: string, name: string, iconUrl?: string, description?: string }>
   */

  setDefinitions(defs = []) {
    const dict = this.state.definitions || {};
    defs.forEach((d) => {
      if (!d || !d.id) return;
      dict[d.id] = {
        id: d.id,
        name: d.name || d.id,
        iconUrl: d.iconUrl || "",
      };
    });
    this.state.definitions = dict;
    this._save();
  }

  /**
   * 配置触发音效
   */
  setSFX(url, volume) {
    this.sfxUrl = url;
    if (typeof volume === "number") this.sfxVolume = volume;
    if (url) {
      try {
        if (!this._htmlAudio) this._htmlAudio = new Audio();
        this._htmlAudio.src = url;
        this._htmlAudio.preload = "auto";
        this._htmlAudio.volume = this._getEffectiveSfxVolume();
      } catch (e) {}
    }
  }

  /**
   * 获取成就概览与已达成列表
   * return: { total: number, achievedCount: number, achievedList: Array<{id,name,iconUrl,achievedAt}> }
   */
  getSummary() {
    const total = Object.keys(this.state.definitions || {}).length;
    const achievedList = Object.values(this.state.achieved || {}).sort(
      (a, b) => new Date(a.achievedAt) - new Date(b.achievedAt)
    );
    return {
      total,
      achievedCount: achievedList.length,
      achievedList,
    };
  }

  /**
   * 触发成就（只接收成就 id）。
   * 不会临时创建未定义的成就；若未在 definitions 中定义则不触发。
   * @param {string} id
   * @returns {boolean} true=首次触发; false=未定义或已达成
   */
  trigger(id) {
    if (!id || typeof id !== "string") return false;
    const defs = this.state.definitions || {};
    const def = defs[id];
    if (!def) return false; // 未定义，不触发

    const achieved = this.state.achieved || {};
    if (achieved[id]) return false; // 已达成，去重

    const name = def.name || id;
    const iconUrl = def.iconUrl || "";
    const achievedAt = new Date().toISOString();
    achieved[id] = { id, name, iconUrl, achievedAt };
    this.state.achieved = achieved;
    this._save();

    // 弹窗提示
    this._enqueueToast({ name, iconUrl });
    // 音效
    this._playSfx();
    return true;
  }

  // ========== Private ==========
  _load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return { definitions: {}, achieved: {} };
      const data = JSON.parse(raw);
      return {
        definitions: data.definitions || {},
        achieved: data.achieved || {},
      };
    } catch (e) {
      console.warn("成就存储读取失败，已重置", e);
      return { definitions: {}, achieved: {} };
    }
  }

  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (e) {
      console.error("成就存储失败", e);
    }
  }

  _createToastEl() {
    const el = document.createElement("div");
    el.id = "achievement-toast";
    el.className = "achievement-toast";
    el.innerHTML = `
        <img class="achievement-toast__icon" alt="" />
        <div class="achievement-toast__text">
          <div class="achievement-toast__title">成就达成</div>
          <div class="achievement-toast__name"></div>
        </div>
      `;
    document.body.appendChild(el);
    return el;
  }

  _ensureStylesInjected() {
    const STYLE_ID = "achievement-toast-style";
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .achievement-toast {
        position: fixed;
        top: 16px;
    bottom: auto;
    left: auto;
        right: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 10px;
        background: rgba(10, 10, 12, 0.72);
        color: #fff;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
        transform: translateY(-120%) translateZ(0);
        transition: transform 0.35s ease, opacity 0.35s ease;
        opacity: 0.95;
        z-index: 2000;
        pointer-events: none;
        backdrop-filter: blur(8px) saturate(1.05);
      }
      .achievement-toast.show {
        transform: translateY(0) translateZ(0);
        opacity: 1;
      }
      .achievement-toast__icon {
        width: 40px;
        height: 40px;
        border-radius: 6px;
        object-fit: cover;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
      }
      .achievement-toast__text { display: flex; flex-direction: column; }
      .achievement-toast__title { font-size: 12px; opacity: 0.8; letter-spacing: 0.5px; }
      .achievement-toast__name { font-size: 16px; font-weight: 700; }
      @media (max-width: 768px) {
        .achievement-toast { top: 10px; right: 10px; padding: 10px 12px; }
        .achievement-toast__icon { width: 36px; height: 36px; }
      }
    `;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.type = "text/css";
    style.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(style);
  }

  _enqueueToast(item) {
    this.queue.push(item);
    if (!this.isShowing) this._showNext();
  }

  _showNext() {
    const item = this.queue.shift();
    if (!item) {
      this.isShowing = false;
      return;
    }
    this.isShowing = true;

    const el = this.toastEl;
    const icon = el.querySelector(".achievement-toast__icon");
    const nameEl = el.querySelector(".achievement-toast__name");
    if (icon) {
      if (item.iconUrl) {
        icon.src = item.iconUrl;
        icon.style.display = "block";
      } else {
        icon.removeAttribute("src");
        icon.style.display = "none";
      }
    }
    if (nameEl) nameEl.textContent = item.name || "";

    // 显示
    el.classList.add("show");

    // 停留后隐藏
    setTimeout(() => {
      el.classList.remove("show");
      // 等待隐藏过渡结束再显示下一个
      setTimeout(() => {
        this.isShowing = false;
        this._showNext();
      }, this.transitionMs + 50);
    }, this.duration);
  }

  _getEffectiveSfxVolume() {
    try {
      const raw = localStorage.getItem("terminus_settings");
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.sfxVolume === "number") {
          return Math.max(0, Math.min(1, obj.sfxVolume));
        }
      }
    } catch (e) {}
    return Math.max(0, Math.min(1, Number(this.sfxVolume)));
  }

  _playSfx() {
    if (!this.sfxUrl) return;
    const vol = this._getEffectiveSfxVolume();
    try {
      if (!this._htmlAudio) this._htmlAudio = new Audio(this.sfxUrl);
      if (this._htmlAudio.src !== this.sfxUrl)
        this._htmlAudio.src = this.sfxUrl;
      this._htmlAudio.volume = vol;
      this._htmlAudio.currentTime = 0;
      this._htmlAudio.play().catch(() => {});
    } catch (e) {}
  }
}

// 暴露到全局
window.AchievementSystem = AchievementSystem;
window.achievementSystem = new AchievementSystem();
