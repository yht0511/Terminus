// --- 全局变量定义 ---
window.currentUser = localStorage.getItem("terminus_currentUser") || null;
// 创建全局音量变量，并从 localStorage 初始化，提供默认值

//全局背景音和音效音量
window.musicsound = null;
window.soundeffect = null;

window.isGamePaused = false;
let isGamePaused = false;
let menuContext = "main"; // 'main' 或 'pause'
let activeSubPage = null; // 追踪打开的子页面ID

// --- 开始游戏

function menu_beginNewGame() {
  stopMenuBGM();
  window.beginNewGame();
}

// --- 菜单逻辑 ---
let currentPage = "home";

// --- showPage 函数，只管理主菜单的页面切换 ---
function showPage(pageId) {
  const currentPageElement = document.getElementById(currentPage);
  const nextPageElement = document.getElementById(pageId);

  if (currentPageElement && nextPageElement) {
    playSoundEffect();
    currentPageElement.classList.add("fade-out");
    setTimeout(() => {
      currentPageElement.classList.remove("active", "fade-out");
      nextPageElement.classList.add("active");
      currentPage = pageId;

      if (pageId === "load-game") populateSavedGames();
      if (pageId === "settings") loadSettings();
      if (
        pageId === "achievements" &&
        typeof window.renderAchievements === "function"
      ) {
        window.renderAchievements("achievements");
      }
    }, 300);
  }
}

// --- 用户认证 (LocalStorage) ---

function registerUser() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;
  if (!username || !password) return showNotification("用户名和密码不能为空！");

  const users = JSON.parse(localStorage.getItem("terminus_users")) || {};
  if (users[username]) return showNotification("用户名已存在！");

  users[username] = password;
  localStorage.setItem("terminus_users", JSON.stringify(users));
  showNotification("注册成功！");
  showPage("login");
}

function loginUser() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  if (!username || !password) return showNotification("请输入用户名和密码！");

  const users = JSON.parse(localStorage.getItem("terminus_users")) || {};
  if (users[username] && users[username] === password) {
    window.currentUser = username; // 更新全局变量
    localStorage.setItem("terminus_currentUser", username);
    updateAuthButton(); // 刷新按钮状态
    showNotification(`欢迎回来, ${username}`);
    showPage("home");
  } else {
    showNotification("用户名或密码错误！");
  }
}

/**
 * 处理用户退出登录
 */
function logoutUser() {
  showNotification(`用户 ${window.currentUser} 已退出登录`);
  window.currentUser = null;
  localStorage.removeItem("terminus_currentUser");
  // 退出后，立即更新按钮状态
  updateAuthButton();
}

/**
 * 根据当前用户登录状态，更新认证按钮的文本和功能
 */
function updateAuthButton() {
  const authButton = document.getElementById("auth-button");
  if (!authButton) return; // 如果按钮不存在，则中止

  if (window.currentUser) {
    // 用户已登录
    authButton.textContent = "退出登录";
    authButton.onclick = logoutUser; // 点击时触发退出登录函数
  } else {
    // 用户未登录
    authButton.textContent = "注册 / 登录";
    authButton.onclick = () => showPage("login"); // 点击时跳转到登录页面
  }
}

// --- 存档/读档 功能 ---

function populateSavedGames(isfrompause) {
  const saves = JSON.parse(localStorage.getItem("terminus_saves")) || {};
  let listElement;
  if (isfrompause) {
    listElement = document.getElementById("pause-saved-games-list");
  } else {
    listElement = document.getElementById("saved-games-list");
  }
  listElement.innerHTML = "";

  const sortedSaves = Object.keys(saves).sort().reverse();
  if (sortedSaves.length === 0) {
    listElement.innerHTML = "<li>没有找到任何存档。</li>";
    return;
  }

  sortedSaves.forEach((saveName) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <span class="save-name">${saveName}</span>
      <div class="save-actions">
        <button class="menu-button" onclick="confirmLoad('${saveName}')">加载</button>
        <button class="menu-button" onclick="confirmDelete('${saveName}')">删除</button>
      </div>`;
    listElement.appendChild(listItem);
  });
}

async function confirmLoad(saveName) {
  const message = `确定要加载存档 "${saveName}" 吗？`;

  // 第二个参数是一个箭头函数，它包含了原来 if 语句成功后要执行的代码
  showConfirm(message, () => {
    stopMenuBGM();
    if (window.gameInstance.isgaming) {
      showNotification("正在关闭。。。");
      window.exitGame(() => {
        window.loadSavedGame(saveName);
      });
    } else {
      showNotification("开始加载");
      window.loadSavedGame(saveName);
      console.log(saveName);
    }
  });
}

function confirmDelete(saveName) {
  const message = `警告：确定要永久删除存档 "${saveName}" 吗？此操作无法撤销。`;

  // 第二个参数是一个箭头函数，它包含了原来 if 语句成功后要执行的代码
  showConfirm(message, () => {
    deleteSave(saveName);
    showNotification("存档已删除"); // 可以在这里给一个反馈
  });
}

function deleteSave(saveName) {
  let saves = JSON.parse(localStorage.getItem("terminus_saves")) || {};
  delete saves[saveName];
  localStorage.setItem("terminus_saves", JSON.stringify(saves));
  populateSavedGames();
}

// --- 设置 功能 ---

const menu_bgm = document.getElementById("bgm");
const menu_soundEffect = document.getElementById("soundEffect");
const bgmVolumeSlider = document.getElementById("bgm-volume");
const sfxVolumeSlider = document.getElementById("sfx-volume");

//menu_bgm.src = "./assets/sounds/mainmenu_bgm.mp3";
//menu_soundEffect.src = "./assets/sounds/mainmenu_click.mp3";
//menu_bgm.preload = "auto";
menu_soundEffect.preload = "auto";
menu_bgm.addEventListener("error", () => {
  console.error("主菜单BGM资源加载失败:", menu_bgm.currentSrc || menu_bgm.src);
});
menu_soundEffect.addEventListener("error", () => {
  console.error(
    "主菜单点击音效资源加载失败:",
    menu_soundEffect.currentSrc || menu_soundEffect.src
  );
});

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem("terminus_settings")) || {};
  window.musicsound =
    settings.bgmVolume !== undefined ? Number(settings.bgmVolume) : 0.1;
  window.soundeffect =
    settings.sfxVolume !== undefined ? Number(settings.sfxVolume) : 0.8;

  // 主菜单滑块
  if (bgmVolumeSlider) bgmVolumeSlider.value = window.musicsound;
  if (sfxVolumeSlider) sfxVolumeSlider.value = window.soundeffect;

  // 暂停菜单滑块（如果存在）
  const pauseBgm = document.getElementById("pause-bgm-volume");
  const pauseSfx = document.getElementById("pause-sfx-volume");
  if (pauseBgm) pauseBgm.value = window.musicsound;
  if (pauseSfx) pauseSfx.value = window.soundeffect;

  // 应用到菜单音频与 SoundManager
  if (menu_bgm) menu_bgm.volume = window.musicsound;
  if (menu_soundEffect) menu_soundEffect.volume = window.soundeffect;
  if (window.core && window.core.sound) {
    window.core.sound.setCategoryVolume("bgm", Number(window.musicsound));
    window.core.sound.setCategoryVolume("sfx", Number(window.soundeffect));
  }
}

function saveSettings(bgmVolume, sfxVolume) {
  // 读取来源优先级：显式参数 > 主菜单滑块 > 现有全局
  let bgm =
    bgmVolume != null
      ? Number(bgmVolume)
      : Number(bgmVolumeSlider?.value ?? window.musicsound ?? 0.5);
  let sfx =
    sfxVolume != null
      ? Number(sfxVolume)
      : Number(sfxVolumeSlider?.value ?? window.soundeffect ?? 0.8);
  // 约束到 [0,1]
  bgm = Math.max(0, Math.min(1, bgm));
  sfx = Math.max(0, Math.min(1, sfx));

  window.musicsound = bgm;
  window.soundeffect = sfx;

  const settings = { bgmVolume: bgm, sfxVolume: sfx };
  localStorage.setItem("terminus_settings", JSON.stringify(settings));

  // 同步到所有相关控件
  if (bgmVolumeSlider) bgmVolumeSlider.value = bgm;
  if (sfxVolumeSlider) sfxVolumeSlider.value = sfx;
  const pauseBgm = document.getElementById("pause-bgm-volume");
  const pauseSfx = document.getElementById("pause-sfx-volume");
  if (pauseBgm) pauseBgm.value = bgm;
  if (pauseSfx) pauseSfx.value = sfx;

  // 应用到菜单音频与 SoundManager
  if (menu_bgm) menu_bgm.volume = bgm;
  if (menu_soundEffect) menu_soundEffect.volume = sfx;
  if (window.core && window.core.sound) {
    window.core.sound.setCategoryVolume("bgm", bgm);
    window.core.sound.setCategoryVolume("sfx", sfx);
  }

  showNotification("设置已保存！");

  // 兼容：主菜单“保存设置”按钮期望返回主页；
  // 若函数是无参调用（来自主菜单按钮），则回主页；带参（来自暂停菜单）则不导航。
  if (arguments.length === 0) {
    showPage("home");
  }
}

function cancelSettings() {
  loadSettings();
  showPage("home");
}

function playSoundEffect() {
  if (!menu_soundEffect) return;
  menu_soundEffect.volume = Number(window.soundeffect) || 0.8; // 读取全局音效音量
  menu_soundEffect.currentTime = 0;
  try {
    menu_soundEffect.play();
  } catch (e) {
    // 忽略未解锁等异常
  }
}

/**
 * 播放主菜单BGM (音量遵循全局变量)
 */
function playMenuBGM() {
  menu_bgm.volume = window.musicsound; // 读取全局音量
  if (menu_bgm.paused) {
    menu_bgm.play().catch((e) => console.error("主菜单BGM播放失败:", e));
  }
}

/**
 * 停止主菜单BGM
 */
function stopMenuBGM() {
  menu_bgm.pause();
  menu_bgm.currentTime = 0; // 重置到开头
}

// --- 通知框逻辑 ---

// 全局变量，用于获取元素和管理定时器
const notificationBox = document.getElementById("notification-box");
const notificationMessage = document.getElementById("notification-message");
let notificationTimeout; // 用于存放setTimeout的ID，方便清除

/**
 * 显示一个短暂的通知信息
 *
 * @param {string} message 要显示的信息
 * @param {number} duration 显示的持续时间（毫秒），默认为1000ms (1秒)
 */
function showNotification(message, duration = 1000) {
  //清除上一个还未结束的定时器，防止动画冲突
  clearTimeout(notificationTimeout);

  notificationMessage.textContent = message;

  //移除可能残留的消失动画类
  notificationBox.classList.remove("hide");
  notificationBox.classList.add("show");

  notificationTimeout = setTimeout(() => {
    notificationBox.classList.add("hide");

    // 使用 { once: true } 确保事件只被触发一次
    notificationBox.addEventListener(
      "animationend",
      () => {
        notificationBox.classList.remove("show", "hide");
      },
      { once: true }
    );
  }, duration);
}

// --- 确认对话框逻辑 ---

// 获取对话框相关的元素
const confirmOverlay = document.getElementById("confirm-dialog-overlay");
const confirmBox = document.getElementById("confirm-dialog-box");
const confirmMessage = document.getElementById("confirm-message");
const confirmBtnYes = document.getElementById("confirm-btn-yes");
const confirmBtnNo = document.getElementById("confirm-btn-no");

/**
 * 显示一个确认对话框
 * @param {string} message 要显示的问题
 * @param {function} onConfirm 用户点击“确认”后要执行的回调函数
 */
function showConfirm(message, onConfirm) {
  confirmOverlay.style.display = "block";
  // 1. 设置提示信息
  confirmMessage.textContent = message;

  // 2. 显示遮罩层和对话框
  confirmOverlay.classList.add("show");
  confirmBox.classList.add("show");

  // 3. 定义一个关闭对话框的函数，避免代码重复
  const hideConfirm = () => {
    confirmOverlay.style.display = "none";
    confirmOverlay.classList.remove("show");
    confirmBox.classList.remove("show");
  };

  // 4. 为按钮和遮罩层设置点击事件
  // 使用 .onclick 赋值可以自动覆盖上一次的事件，防止监听器重复叠加
  confirmBtnYes.onclick = () => {
    hideConfirm();
    onConfirm(); // 执行传入的回调函数
  };

  confirmBtnNo.onclick = () => {
    hideConfirm(); // 只关闭，不执行任何操作
  };

  confirmOverlay.onclick = () => {
    hideConfirm(); // 点击背景遮罩也相当于取消
  };
}

// --- 自定义文本输入框 (Prompt) 逻辑 ---

// 获取 Prompt 对话框相关的元素
const promptOverlay = document.getElementById("prompt-dialog-overlay");
const promptBox = document.getElementById("prompt-dialog-box");
const promptMessage = document.getElementById("prompt-message");
const promptInput = document.getElementById("prompt-input");
const promptBtnYes = document.getElementById("prompt-btn-yes");
const promptBtnNo = document.getElementById("prompt-btn-no");

/**
 * 显示一个带输入框的对话框
 * @param {string} message 提示信息
 * @param {function(string)} onConfirm 用户点击“确认”后执行的回调，接收输入的文本作为参数
 */
function showPrompt(message, onConfirm) {
  // 1. 设置提示信息并清空上次输入
  promptMessage.textContent = message;
  promptInput.value = "";

  // 2. 显示遮罩层和对话框
  promptOverlay.classList.add("show");
  promptBox.classList.add("show");

  // 3. 自动聚焦到输入框，方便用户直接输入
  setTimeout(() => promptInput.focus(), 100);

  // 4. 定义关闭函数
  const hidePrompt = () => {
    promptOverlay.classList.remove("show");
    promptBox.classList.remove("show");
  };

  // 5. 为按钮和遮罩层设置点击事件
  promptBtnYes.onclick = () => {
    const inputValue = promptInput.value.trim(); // 获取并清理输入值
    hidePrompt();
    onConfirm(inputValue); // 将输入值传递给回调函数
  };

  promptBtnNo.onclick = hidePrompt;
  promptOverlay.onclick = hidePrompt;

  // 允许按 Enter 键确认
  promptInput.onkeydown = (event) => {
    if (event.key === "Enter") {
      promptBtnYes.onclick();
    }
  };
}

// --- 初始化 ---
// 当DOM内容加载完毕后，执行初始化操作
document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  updateAuthButton();
  window.gameInstance.pauseMenu.initEventListeners();

  // 监听用户交互以播放背景音乐
  document.body.addEventListener(
    "click",
    () => {
      if (menu_bgm.paused) {
        menu_bgm.play().catch((e) => console.log("背景音乐自动播放失败:", e));
      }
    },
    { once: true }
  );

  // 实时更新全局变量 (当用户拖动滑块时)
  bgmVolumeSlider.addEventListener("input", (e) => {
    window.musicsound = Number(e.target.value);
    menu_bgm.volume = window.musicsound; // 实时应用到菜单BGM
    if (window.core && window.core.sound) {
      window.core.sound.setCategoryVolume("bgm", window.musicsound);
    }
  });
  sfxVolumeSlider.addEventListener("input", (e) => {
    // 暂停菜单滑块的实时应用
    const pauseBgmSlider = document.getElementById("pause-bgm-volume");
    const pauseSfxSlider = document.getElementById("pause-sfx-volume");
    if (pauseBgmSlider) {
      pauseBgmSlider.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        window.musicsound = v;
        if (menu_bgm) menu_bgm.volume = v;
        if (window.core && window.core.sound) {
          window.core.sound.setCategoryVolume("bgm", v);
        }
      });
    }
    if (pauseSfxSlider) {
      pauseSfxSlider.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        window.soundeffect = v;
        if (menu_soundEffect) menu_soundEffect.volume = v;
        if (window.core && window.core.sound) {
          window.core.sound.setCategoryVolume("sfx", v);
        }
      });
    }
    window.soundeffect = Number(e.target.value);
    if (menu_soundEffect) menu_soundEffect.volume = window.soundeffect;
    if (window.core && window.core.sound) {
      window.core.sound.setCategoryVolume("sfx", window.soundeffect);
    }
  });
});

// 成就列表渲染：在指定根ID的菜单页面中生成/更新成就展示
window.renderAchievements = function renderAchievements(rootId) {
  try {
    const root = document.getElementById(rootId);
    if (!root) return;

    const hasSystem = !!(
      window.achievementSystem &&
      typeof window.achievementSystem.getSummary === "function"
    );
    const summary = hasSystem
      ? window.achievementSystem.getSummary()
      : { total: 0, achievedCount: 0, achievedList: [] };

    // 找到返回按钮，确保列表插在它之前
    const backBtn = root.querySelector("button.menu-button:last-of-type");
    let container = root.querySelector(".achievements-list");
    if (!container) {
      container = document.createElement("div");
      container.className = "achievements-list";
      if (backBtn) root.insertBefore(container, backBtn);
      else root.appendChild(container);
    }

    // 渲染内容
    const { total, achievedCount, achievedList } = summary;
    const titleHtml = `<div style="margin:8px 0 4px;opacity:.85">已达成 ${achievedCount} / ${total}</div>`;

    if (!total) {
      container.innerHTML = `${titleHtml}<div style="opacity:.75">暂无成就定义</div>`;
      return;
    }

    if (achievedList.length === 0) {
      container.innerHTML = `${titleHtml}<div style="opacity:.75">还没有达成任何成就</div>`;
      return;
    }

    const items = achievedList
      .map((a) => {
        const dateStr = new Date(a.achievedAt).toLocaleString();
        const icon = a.iconUrl
          ? `<img src="${a.iconUrl}" alt="" style="width:28px;height:28px;border-radius:6px;object-fit:cover;margin-right:10px;">`
          : `<span style="display:inline-block;width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,.12);margin-right:10px"></span>`;
        return `<li style="display:flex;align-items:center;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,.08)">${icon}<div style="display:flex;flex-direction:column"><span style="font-weight:700">${
          a.name || a.id
        }</span><span style="opacity:.6;font-size:12px">${dateStr}</span></div></li>`;
      })
      .join("");

    container.innerHTML = `${titleHtml}<ul style="list-style:none;margin:6px 0 0;padding:0;max-height:260px;overflow:auto">${items}</ul>`;
  } catch (e) {
    console.warn("渲染成就列表失败:", e);
  }
};
