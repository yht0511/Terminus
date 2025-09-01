// --- 菜单逻辑 ---

let currentPage = "home";

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

function populateSavedGames() {
  const saves = JSON.parse(localStorage.getItem("terminus_saves")) || {};
  const listElement = document.getElementById("saved-games-list");
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

function confirmLoad(saveName) {
  const message = `确定要加载存档 "${saveName}" 吗？`;

  // 第二个参数是一个箭头函数，它包含了原来 if 语句成功后要执行的代码
  showConfirm(message, () => {
    showNotification("开始加载"); // 可以在这里给一个反馈
    window.loadSavedGame(saveName);
    console.log("123");
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

//手动建档，用于调试

function manualSave() {
  showPrompt("请输入存档名称：", (saveName) => {
    if (!saveName) {
      showNotification("存档名称不能为空！", 2000);
      return;
    }
    const saves = JSON.parse(localStorage.getItem("terminus_saves")) || {};

    if (saves[saveName]) {
      showConfirm(`存档 "${saveName}" 已存在，是否要覆盖？`, () => {
        performSave(saveName, saves);
      });
    } else {
      performSave(saveName, saves);
    }
  });
}

/**
 * @param {string} saveName 存档名称
 * @param {object} saves 当前所有存档的对象
 */

async function performSave(saveName, saves) {
  const now = new Date();
  try {
    const response = await fetch("../scripts/main.json");
    if (!response.ok) {
      throw new Error(`HTTP 错误! 状态: ${response.status}`);
    }
    const data = await response.json();
    saves[saveName] = {
      saveTime: now.toISOString(),
      savingdata: data,
    };
    localStorage.setItem("terminus_saves", JSON.stringify(saves));
    showNotification(`游戏已存档: ${saveName}`, 2000);
  } catch (error) {
    console.error("存档失败:", error);
    showNotification("存档失败，请查看控制台获取更多信息。");
  }

  populateSavedGames();
}

// --- 设置 功能 ---


const bgmVolumeSlider = document.getElementById("bgm-volume");
const sfxVolumeSlider = document.getElementById("sfx-volume");

// 添加一些音频素材链接 (请替换成你自己的)
// window.sounds.setBGM("../../assets/sounds/mainmenu_bgm.mp3");
// window.sounds.setSoundEffect("../../assets/sounds/mainmenu_click.mp3");

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem("terminus_settings")) || {};
  const bgmVolume = settings.bgmVolume !== undefined ? settings.bgmVolume : 0.5;
  const sfxVolume = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.8;
  bgmVolumeSlider.value = bgmVolume;
  sfxVolumeSlider.value = sfxVolume;
  window.sounds.setBGMVolume(bgmVolume);
  window.sounds.setSoundEffectVolume(sfxVolume);
}

function saveSettings() {
  const settings = {
    bgmVolume: bgmVolumeSlider.value,
    sfxVolume: sfxVolumeSlider.value,
  };
  localStorage.setItem("terminus_settings", JSON.stringify(settings));
  loadSettings();
  showNotification("设置已保存！");
  showPage("home");
}

function cancelSettings() {
  loadSettings();
  showPage("home");
}

function playSoundEffect() {
  window.sounds.playSoundEffect();
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
  // 1. 设置提示信息
  confirmMessage.textContent = message;

  // 2. 显示遮罩层和对话框
  confirmOverlay.classList.add("show");
  confirmBox.classList.add("show");

  // 3. 定义一个关闭对话框的函数，避免代码重复
  const hideConfirm = () => {
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

  // 监听用户交互以播放背景音乐
  document.body.addEventListener(
    "click",
    () => {
      if (window.sounds.bgm.paused) {
        window.sounds.playBGM();
      }
    },
    { once: true }
  );

  // 实时更新音量
  bgmVolumeSlider.addEventListener(
    "input",
    (e) => window.sounds.setBGMVolume(e.target.value)
  );
  sfxVolumeSlider.addEventListener(
    "input",
    (e) => window.sounds.setSoundEffectVolume(e.target.value)
  );
});
