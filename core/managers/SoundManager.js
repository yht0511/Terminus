/**
 * 高级声音管理器设计
 * 功能分类:
 * 1. BGM (背景音乐, 可淡入淡出 / 交叉淡化)
 * 2. Ambience (环境循环声)
 * 3. Narration / Voice (旁白/对白, 单通道队列)
 * 4. Footsteps (脚步，根据移动速度/状态节奏播放)
 * 5. SFX (普通一次性音效, 可并发, 可限流)
 * 6. Entity SFX (带 3D 位置的音效)
 *
 * 使用 Web Audio 优先 (AudioContext + GainNode 分组 + Buffer 缓存)，
 * 如果在受限环境失败回退到 <audio> 元素。
 */

export class SoundManager {
  constructor(core, opts = {}) {
    this.core = core;
    this.options = Object.assign(
      {
        footstepBaseInterval: 0.45, // 走路基础间隔(s)
        runIntervalFactor: 0.65, // 跑步时间隔倍率
        fadeStep: 0.03, // 渐变步进时间 (s)
        maxSFXInstancesPerKey: 6,
        entityMaxDistance: 50,
      },
      opts
    );

    // 缓存
    this.bufferCache = new Map(); // url -> AudioBuffer
    this.loadingPromises = new Map();

    // 播放通道引用
    this.channels = {}; // {name:{gain:GainNode, list:Set}} for bookkeeping
    this.activeNarration = null;
    this.narrationQueue = [];
    this.lastFootstepTime = 0;
    this.footstepSurface = "default"; // 可扩展: 不同材质不同声音
    this.entitySoundMap = new Map(); // entityId -> {eventKey:{url,...}}
    this.sfxCounters = new Map();

    // Fallback HTML 元素
    this.html = {
      bgm: document.getElementById("bgm"),
      sfx: document.getElementById("soundEffect"),
    };

    this._initContext();
  }

  /* ========================= 基础上下文 ========================= */
  _initContext() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // 主监听 (可与 Three.js 结合: camera.add(listener))
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);
      this._createChannel("bgm", 0.8);
      this._createChannel("ambience", 0.7);
      this._createChannel("voice", 1.0);
      this._createChannel("footsteps", 0.9);
      this._createChannel("sfx", 1.0);
      this._createChannel("entity", 1.0);
      this.webAudio = true;
    } catch (e) {
      console.warn("Web Audio 初始化失败, 使用 <audio> 后备.", e);
      this.webAudio = false;
    }
  }

  _createChannel(name, gain = 1) {
    if (!this.webAudio) return;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(this.masterGain);
    this.channels[name] = { gain: g, list: new Set() };
  }

  async resumeContextOnUserGesture() {
    if (this.webAudio && this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn("音频上下文恢复失败", e);
      }
    }
  }

  /* ========================= 资源加载 ========================= */
  async loadBuffer(url) {
    if (!this.webAudio) return null;
    if (this.bufferCache.has(url)) return this.bufferCache.get(url);
    if (this.loadingPromises.has(url)) return this.loadingPromises.get(url);
    const p = (async () => {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.bufferCache.set(url, buf);
      this.loadingPromises.delete(url);
      return buf;
    })();
    this.loadingPromises.set(url, p);
    return p;
  }

  /* ========================= 通用播放 ========================= */
  async _playBufferOnChannel(channel, url, { loop = false, volume = 1 } = {}) {
    if (!this.webAudio) return this._fallbackPlay(channel, url, loop, volume);
    // 若指定通道尚未创建，进行惰性创建，避免访问未定义
    if (!this.channels[channel]) {
      this._createChannel(channel, 1);
    }
    const buf = await this.loadBuffer(url);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.channels[channel].gain);
    src.start();
    const handle = { src, gain: g, channel, url, loop };
    this.channels[channel].list.add(handle);
    src.onended = () => this.channels[channel].list.delete(handle);
    return handle;
  }

  _fallbackPlay(channel, url, loop, volume) {
    // 简易后备: 只对 bgm / sfx 分两类
    if (channel === "bgm" && this.html.bgm) {
      this.html.bgm.src = url;
      this.html.bgm.loop = loop;
      this.html.bgm.volume = volume;
      this.html.bgm.play();
      return { html: this.html.bgm };
    }
    if (this.html.sfx) {
      this.html.sfx.src = url;
      this.html.sfx.loop = loop;
      this.html.sfx.volume = volume;
      this.html.sfx.play();
      return { html: this.html.sfx };
    }
  }

  /* ========================= BGM & 环境 ========================= */
  async playBGM(url, { fade = 0.8, loop = true } = {}) {
    await this.resumeContextOnUserGesture();
    // 交叉淡化
    if (this.currentBGM) this._fadeOutHandle(this.currentBGM, fade);
    this.currentBGM = await this._playBufferOnChannel("bgm", url, {
      loop,
      volume: 0,
    });
    this._fadeTo(this.currentBGM.gain, 1, fade);
  }

  async playAmbience(url, { loop = true, volume = 1 } = {}) {
    await this._playBufferOnChannel("ambience", url, { loop, volume });
  }

  stopBGM({ fade = 0.6 } = {}) {
    if (this.currentBGM) {
      this._fadeOutHandle(this.currentBGM, fade);
      this.currentBGM = null;
    }
  }

  /* ========================= Narration / Voice ========================= */
  async playNarration(url, { queue = true, interrupt = false, onEnd } = {}) {
    if (interrupt && this.activeNarration) this.stopNarration();
    if (this.activeNarration && queue) {
      this.narrationQueue.push({ url, onEnd });
      return;
    }
    await this.resumeContextOnUserGesture();
    const handle = await this._playBufferOnChannel("voice", url, {
      loop: false,
      volume: 1,
    });
    
    // 记录播放开始时间，用于计算音频播放位置
    if (this.webAudio) {
      handle.startTime = this.ctx.currentTime;
    }
    
    this.activeNarration = handle;
    handle.src.onended = () => {
      if (onEnd) onEnd();
      this.channels.voice.list.delete(handle);
      this.activeNarration = null;
      if (this.narrationQueue.length) {
        const next = this.narrationQueue.shift();
        this.playNarration(next.url, { queue: true, onEnd: next.onEnd });
      }
    };
  }

  stopNarration() {
    if (this.activeNarration) {
      try {
        this.activeNarration.src.stop();
      } catch (e) {}
      this.activeNarration = null;
      this.narrationQueue = [];
    }
  }

  /**
   * 获取当前旁白音频的播放位置
   * @returns {number|null} 音频播放位置(毫秒)，如果没有播放则返回null
   */
  getNarrationCurrentTime() {
    if (!this.activeNarration || !this.webAudio || !this.activeNarration.startTime) {
      return null;
    }
    
    const playTime = (this.ctx.currentTime - this.activeNarration.startTime) * 1000;
    return Math.max(0, Math.round(playTime));
  }

  /* ========================= Footsteps ========================= */
  async updateFootsteps(
    playerSpeed,
    isGrounded,
    delta,
    { running = false } = {}
  ) {
    if (!isGrounded || playerSpeed < 0.2) return;
    const interval =
      this.options.footstepBaseInterval *
      (running ? this.options.runIntervalFactor : 1);
    this.lastFootstepTime += delta;
    if (this.lastFootstepTime >= interval) {
      this.lastFootstepTime = 0;
      const key = `foot_${this.footstepSurface}_${running ? "run" : "walk"}`;
      const url = this._resolveFootstepUrl(this.footstepSurface, running);
      if (url) this.playSFX(url, { key, volume: running ? 1 : 0.7 });
    }
  }

  _resolveFootstepUrl(surface, running) {
    // TODO: 可改为配置映射
    return running
      ? `/assets/sounds/ingamesounds/${surface}_run.mp3`
      : `/assets/sounds/ingamesounds/${surface}_walk.mp3`;
  }

  /* ========================= 普通 SFX ========================= */
  async playSFX(
    url,
    {
      volume = 1,
      key = url,
      limitPerKey = this.options.maxSFXInstancesPerKey,
    } = {}
  ) {
    // 限流
    const count = this.sfxCounters.get(key) || 0;
    if (count >= limitPerKey) return;
    this.sfxCounters.set(key, count + 1);
    const handle = await this._playBufferOnChannel("sfx", url, {
      loop: false,
      volume,
    });
    handle.src.onended = () => {
      this.sfxCounters.set(key, (this.sfxCounters.get(key) || 1) - 1);
      this.channels.sfx.list.delete(handle);
    };
  }

  /* ========================= 实体 3D 音效 ========================= */
  registerEntitySound(entityId, eventKey, { url, loop = false, volume = 1 }) {
    if (!this.entitySoundMap.has(entityId))
      this.entitySoundMap.set(entityId, {});
    this.entitySoundMap.get(entityId)[eventKey] = { url, loop, volume };
  }

  async triggerEntitySound(entityId, eventKey, position) {
    if (!this.webAudio) return; // 简化: 不提供 fallback
    const def = this.entitySoundMap.get(entityId)?.[eventKey];
    if (!def) return;
    const buf = await this.loadBuffer(def.url);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = def.loop;
    const panner = this.ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.maxDistance = this.options.entityMaxDistance;
    panner.refDistance = 2;
    panner.rolloffFactor = 1;
    if (position) panner.setPosition(position.x, position.y, position.z);
    const g = this.ctx.createGain();
    g.gain.value = def.volume;
    src.connect(g).connect(panner).connect(this.channels.entity.gain);
    src.start();
    const handle = { src, panner, gain: g, entityId, eventKey };
    this.channels.entity.list.add(handle);
    src.onended = () => this.channels.entity.list.delete(handle);
    return handle;
  }

  /* ========================= 辅助: 渐变 & 停止 ========================= */
  _fadeTo(gainNode, target, duration) {
    if (!this.webAudio) return;
    const now = this.ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(target, now + duration);
  }
  _fadeOutHandle(handle, duration) {
    if (!handle || !handle.gain) return;
    this._fadeTo(handle.gain, 0, duration);
    setTimeout(() => {
      try {
        handle.src.stop();
      } catch (e) {}
    }, duration * 1000 + 30);
  }

  setCategoryVolume(name, v) {
    if (this.webAudio && this.channels[name])
      this.channels[name].gain.gain.value = v;
  }
  setMasterVolume(v) {
    if (this.webAudio) this.masterGain.gain.value = v;
    if (!this.webAudio && this.html.bgm) this.html.bgm.volume = v;
  }

  /* ========================= 统一停止 / 释放 ========================= */
  stopAll() {
    if (this.webAudio) {
      Object.values(this.channels).forEach((c) => {
        c.list.forEach((h) => {
          try {
            h.src.stop();
          } catch (e) {}
        });
        c.list.clear();
      });
    } else {
      if (this.html.bgm) this.html.bgm.pause();
      if (this.html.sfx) this.html.sfx.pause();
    }
    this.activeNarration = null;
    this.narrationQueue = [];
  }

  dispose() {
    this.stopAll();
    if (this.webAudio) {
      try {
        this.ctx.close();
      } catch (e) {}
    }
  }
}

window.SoundManager = SoundManager;