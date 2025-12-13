/**
 * 设置模块 - 处理设置侧边栏面板
 */

const Settings = {
  sidebar: null,
  overlay: null,
  isOpen: false,

  /**
   * 当 Pexels 设置变更时，清除缓存并刷新壁纸
   */
  async refreshPexelsIfActive() {
    const settings = await Storage.getSettings();
    if (settings.wallpaperSource === 'pexels') {
      await Storage.savePexelsCache([], 1);
      await Wallpaper.refresh();
    }
  },

  /**
   * 初始化设置
   */
  async init() {
    this.sidebar = document.getElementById('settings-sidebar');
    this.overlay = document.getElementById('settings-overlay');

    await this.loadSettings();
    this.bindEvents();
  },

  /**
   * 将当前设置加载到 UI
   */
  async loadSettings() {
    const settings = await Storage.getSettings();

    // 壁纸设置
    document.getElementById('setting-wallpaper-source').value = settings.wallpaperSource;
    document.getElementById('setting-wallpaper-mode').value = settings.wallpaperMode;
    document.getElementById('setting-overlay-opacity').value = settings.overlayOpacity;
    document.getElementById('overlay-opacity-value').textContent = `${settings.overlayOpacity}%`;

    // Pexels 设置
    document.getElementById('setting-pexels-api-key').value = settings.pexelsApiKey || '';
    document.getElementById('setting-pexels-query').value = settings.pexelsSearchQuery || 'nature wallpaper';
    document.getElementById('setting-pexels-orientation').value = settings.pexelsOrientation || 'landscape';

    // 显示/隐藏相关壁纸设置
    this.toggleWallpaperSettings(settings.wallpaperSource);

    // 加载本地壁纸预览
    await this.loadLocalWallpaperPreviews();

    // 搜索设置
    document.getElementById('setting-search-target').value = settings.searchTarget;
    document.getElementById('setting-search-suggestions').checked = settings.searchSuggestions;

    // 快捷链接设置
    document.getElementById('setting-shortcuts-per-row').value = settings.shortcutsPerRow;

    // 布局设置
    document.getElementById('setting-auto-hide-controls').checked = settings.autoHideControls !== false;
    document.getElementById('setting-edit-mode').checked = settings.editMode;
    document.getElementById('setting-panel-opacity').value = settings.panelOpacity || 75;
    document.getElementById('panel-opacity-value').textContent = `${settings.panelOpacity || 75}%`;
    document.getElementById('show-clock').checked = settings.showClock;
    document.getElementById('show-search').checked = settings.showSearch;
    document.getElementById('show-quote').checked = settings.showQuote;
    document.getElementById('show-shortcuts').checked = settings.showShortcuts;
    document.getElementById('show-crypto').checked = settings.showCrypto !== false;
    document.getElementById('show-calendar').checked = settings.showCalendar !== false;

    // 应用面板透明度
    this.applyPanelOpacity(settings.panelOpacity || 75);

    // 应用可见性
    Storage.applyVisibility(settings);

    // 应用自动隐藏控件
    this.applyAutoHideControls(settings.autoHideControls !== false);

    // 应用编辑模式
    if (settings.editMode) {
      Drag.enableEditMode();
    }
  },

  /**
   * 切换壁纸特定设置的可见性
   */
  toggleWallpaperSettings(source) {
    const bingSettings = document.getElementById('bing-settings');
    const pexelsSettings = document.getElementById('pexels-settings');
    const localSettings = document.getElementById('local-wallpaper-settings');

    // 先全部隐藏
    bingSettings.style.display = 'none';
    pexelsSettings.style.display = 'none';
    localSettings.style.display = 'none';

    // 显示相关设置
    if (source === 'bing') {
      bingSettings.style.display = 'block';
    } else if (source === 'pexels') {
      pexelsSettings.style.display = 'block';
      bingSettings.style.display = 'block'; // Pexels 也显示模式选择器
    } else {
      localSettings.style.display = 'block';
    }
  },

  /**
   * 加载本地壁纸预览
   */
  async loadLocalWallpaperPreviews() {
    const wallpapers = await Storage.getLocalWallpapers();
    const preview = document.getElementById('local-wallpaper-preview');

    preview.innerHTML = wallpapers.map((wp, index) =>
      `<img src="${wp}" class="local-wallpaper-thumb" data-index="${index}" alt="壁纸 ${index + 1}">`
    ).join('');

    // 右键点击删除
    preview.querySelectorAll('.local-wallpaper-thumb').forEach(img => {
      img.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (confirm('删除此壁纸？')) {
          const index = parseInt(img.dataset.index);
          await Wallpaper.removeLocalWallpaper(index);
          await this.loadLocalWallpaperPreviews();
        }
      });
    });
  },

  /**
   * 将面板透明度应用到设置侧边栏和对话框
   */
  applyPanelOpacity(opacity) {
    document.documentElement.style.setProperty('--panel-opacity', opacity / 100);
  },

  /**
   * 应用自动隐藏控件模式
   */
  applyAutoHideControls(enabled) {
    document.body.classList.toggle('auto-hide-controls', enabled);
  },

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 打开/关闭设置
    document.getElementById('settings-btn').addEventListener('click', () => this.open());
    document.getElementById('settings-close-btn').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());

    // 壁纸来源变更
    document.getElementById('setting-wallpaper-source').addEventListener('change', async (e) => {
      const source = e.target.value;
      await Storage.saveSetting('wallpaperSource', source);
      this.toggleWallpaperSettings(source);
      await Wallpaper.refresh();
    });

    // 壁纸模式变更
    document.getElementById('setting-wallpaper-mode').addEventListener('change', async (e) => {
      await Storage.saveSetting('wallpaperMode', e.target.value);
    });

    // 本地壁纸上传
    document.getElementById('local-wallpaper-input').addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        await Wallpaper.addLocalWallpaper(file);
      }
      await this.loadLocalWallpaperPreviews();

      // 如果来源是本地，刷新壁纸
      const settings = await Storage.getSettings();
      if (settings.wallpaperSource === 'local') {
        await Wallpaper.refresh();
      }
    });

    // Pexels API key 变更
    document.getElementById('setting-pexels-api-key').addEventListener('change', async (e) => {
      await Storage.saveSetting('pexelsApiKey', e.target.value.trim());
      const settings = await Storage.getSettings();
      if (settings.wallpaperSource === 'pexels') {
        await Wallpaper.refresh();
      }
    });

    // Pexels 搜索关键词变更
    document.getElementById('setting-pexels-query').addEventListener('change', async (e) => {
      await Storage.saveSetting('pexelsSearchQuery', e.target.value.trim() || 'nature wallpaper');
      await this.refreshPexelsIfActive();
    });

    // Pexels 方向变更
    document.getElementById('setting-pexels-orientation').addEventListener('change', async (e) => {
      await Storage.saveSetting('pexelsOrientation', e.target.value);
      await this.refreshPexelsIfActive();
    });

    // 叠加层透明度变更
    document.getElementById('setting-overlay-opacity').addEventListener('input', async (e) => {
      const opacity = parseInt(e.target.value);
      document.getElementById('overlay-opacity-value').textContent = `${opacity}%`;
      Wallpaper.setOverlayOpacity(opacity);
    });

    document.getElementById('setting-overlay-opacity').addEventListener('change', async (e) => {
      await Storage.saveSetting('overlayOpacity', parseInt(e.target.value));
    });

    // 搜索设置
    document.getElementById('setting-search-target').addEventListener('change', async (e) => {
      await Storage.saveSetting('searchTarget', e.target.value);
      await Search.updateSettings();
    });

    document.getElementById('setting-search-suggestions').addEventListener('change', async (e) => {
      await Storage.saveSetting('searchSuggestions', e.target.checked);
      await Search.updateSettings();
    });

    // 每行快捷链接数量
    document.getElementById('setting-shortcuts-per-row').addEventListener('change', async (e) => {
      const value = parseInt(e.target.value);
      await Storage.saveSetting('shortcutsPerRow', value);
      await Shortcuts.updateSettings();
    });

    // 自动隐藏控件切换
    document.getElementById('setting-auto-hide-controls').addEventListener('change', async (e) => {
      await Storage.saveSetting('autoHideControls', e.target.checked);
      this.applyAutoHideControls(e.target.checked);
    });

    // 编辑模式切换
    document.getElementById('setting-edit-mode').addEventListener('change', async (e) => {
      await Drag.toggleEditMode(e.target.checked);
    });

    // 重置位置按钮
    document.getElementById('reset-positions-btn').addEventListener('click', async () => {
      if (confirm('确定要恢复默认位置吗？')) {
        await Drag.resetPositions();
      }
    });

    // 面板透明度变更
    document.getElementById('setting-panel-opacity').addEventListener('input', async (e) => {
      const opacity = parseInt(e.target.value);
      document.getElementById('panel-opacity-value').textContent = `${opacity}%`;
      this.applyPanelOpacity(opacity);
    });

    document.getElementById('setting-panel-opacity').addEventListener('change', async (e) => {
      await Storage.saveSetting('panelOpacity', parseInt(e.target.value));
    });

    // 可见性切换
    ['clock', 'search', 'quote', 'shortcuts', 'crypto', 'calendar'].forEach(element => {
      document.getElementById(`show-${element}`).addEventListener('change', async (e) => {
        const key = `show${element.charAt(0).toUpperCase() + element.slice(1)}`;
        await Storage.saveSetting(key, e.target.checked);
        document.getElementById(`${element}-container`).classList.toggle('hidden', !e.target.checked);

        // 处理加密货币 WebSocket 连接
        if (element === 'crypto') {
          if (e.target.checked) {
            Crypto.connect();
          } else {
            Crypto.disconnect();
          }
        }
      });
    });

    // 导出配置
    document.getElementById('export-config-btn').addEventListener('click', async () => {
      await this.exportConfig();
    });

    // 导入配置
    document.getElementById('import-config-btn').addEventListener('click', () => {
      document.getElementById('import-config-input').click();
    });

    document.getElementById('import-config-input').addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        await this.importConfig(e.target.files[0]);
      }
    });
  },

  /**
   * 打开设置侧边栏
   */
  open() {
    this.sidebar.classList.add('show');
    this.overlay.classList.add('show');
    this.isOpen = true;
  },

  /**
   * 关闭设置侧边栏
   */
  close() {
    this.sidebar.classList.remove('show');
    this.overlay.classList.remove('show');
    this.isOpen = false;
  },

  /**
   * 导出配置
   */
  async exportConfig() {
    try {
      const config = await Storage.exportConfig();
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `newtab-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败');
    }
  },

  /**
   * 导入配置
   */
  async importConfig(file) {
    try {
      const text = await file.text();
      const config = JSON.parse(text);

      await Storage.importConfig(config);

      // 重新加载页面以应用更改
      alert('导入成功，页面将重新加载');
      location.reload();
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败：配置文件格式错误');
    }
  }
};

// 暴露到全局
window.Settings = Settings;
