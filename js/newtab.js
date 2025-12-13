/**
 * 主入口 - 初始化所有模块
 */

(async function() {
  'use strict';

  try {
    // 阶段0：立即应用可见性设置（渲染前）
    // 这可以防止"隐藏元素闪烁"问题
    const settings = await Storage.getSettings();
    Storage.applyVisibility(settings);

    // 阶段1：即时初始化（无异步，无网络）
    Clock.init();

    // 阶段2：加载位置（渲染前需要）
    await Drag.init();

    // 阶段3：并行加载（带网络请求的独立模块）
    await Promise.all([
      Wallpaper.init(),
      Quote.init(),
      Search.init(),
      Shortcuts.init(),
      Crypto.init(),
      Calendar.init()
    ]);

    // 阶段4：设置（所有模块就绪后）
    await Settings.init();

    console.log('新标签页初始化成功');
  } catch (error) {
    console.error('新标签页初始化出错:', error);
  }
})();
