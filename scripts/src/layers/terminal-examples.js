/**
 * runAcceptScript 使用示例 (更新版)
 * 演示如何使用清除程序功能 - 蒙版会在回调前移除
 */

// 基本使用方法
function basicExample() {
  // 获取终端管理器实例
  const terminal = window.core.getEntity('terminal_id'); // 替换为实际的终端ID
  
  // 不带回调的基本调用
  terminal.runAcceptScript();
}

// 带回调函数的使用方法
function advancedExample() {
  const terminal = window.core.getEntity('terminal_id');
  
  // 带自定义回调的调用
  terminal.runAcceptScript(() => {
    console.log("蒙版已移除！清除程序完成！执行后续操作...");
    
    // 注意：当这个回调执行时，蒙版已经被移除了
    // 在这里可以执行任何后续操作，例如：
    // - 重置游戏状态
    // - 加载新场景  
    // - 触发剧情事件
    // - 显示结束画面等
    
    // 示例：立即开始新的游戏循环（因为蒙版已移除）
    console.log("立即开始新的游戏循环...");
    // window.gameInstance.restart();
  });
}

// 层级管理示例
function layerManagementExample() {
  const terminal = window.core.getEntity('terminal_id');
  
  terminal.runAcceptScript(() => {
    console.log("回调执行时，蒙版已从 layerManager 中移除");
    
    // 可以检查当前的层级状态
    console.log("当前活跃层级:", window.core.layers.getLayers());
    
    // 执行后续逻辑...
  });
}

// 在终端命令中的使用示例
function terminalCommandExample() {
  // 在 main.json 的 commands 配置中可以这样使用：
  /*
  {
    "command": "system-reset",
    "output": "启动系统重置程序...",
    "callback": [
      "(() => { const terminal = window.core.getEntity('terminal_01'); terminal.runAcceptScript(() => { console.log('蒙版已移除，系统重置完成'); window.location.reload(); }); })()"
    ]
  }
  */
}

// 导出示例函数供测试使用
export { basicExample, advancedExample, layerManagementExample, terminalCommandExample };

// 全局绑定，方便在控制台测试
if (typeof window !== 'undefined') {
  window.terminalExamples = {
    basicExample,
    advancedExample,
    layerManagementExample,
    terminalCommandExample
  };
}
