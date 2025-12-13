/**
 * 存储模块 - 处理 chrome.storage.sync 和 chrome.storage.local
 */

const Storage = {
  // 默认设置
  defaults: {
    // 壁纸设置
    wallpaperSource: 'bing', // 'bing', 'pexels', 或 'local'
    wallpaperMode: 'random', // 'random', 'sequential', 'daily'
    overlayOpacity: 30,
    currentWallpaperIndex: 0,

    // Pexels 设置
    pexelsApiKey: '',
    pexelsSearchQuery: 'nature wallpaper',
    pexelsOrientation: 'landscape',

    // 搜索设置
    searchTarget: 'new', // 'new' 或 'current'
    searchSuggestions: true,

    // 快捷链接设置
    shortcutsPerRow: 6,
    shortcuts: [],

    // 布局设置
    editMode: false,
    panelOpacity: 75, // 面板背景透明度 (0-100)
    positions: {
      clock: { x: 50, y: 15 },
      search: { x: 50, y: 38 },
      calendar: { x: 15, y: 68 },
      shortcuts: { x: 75, y: 65 },
      quote: { x: 50, y: 92 },
      crypto: { x: 85, y: 95 }
    },

    // 可见性设置
    showClock: true,
    showSearch: true,
    showQuote: true,
    showShortcuts: true,
    showCrypto: true,
    showCalendar: true,

    // UI 设置
    autoHideControls: true  // 自动隐藏添加按钮和设置图标
  },

  /**
   * 从同步存储获取设置
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.defaults, (result) => {
        resolve(result);
      });
    });
  },

  /**
   * 保存设置到同步存储
   */
  async saveSettings(settings) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * 获取单个设置值
   */
  async getSetting(key) {
    const settings = await this.getSettings();
    return settings[key];
  },

  /**
   * 保存单个设置值
   */
  async saveSetting(key, value) {
    return this.saveSettings({ [key]: value });
  },

  /**
   * 从本地存储获取数据（用于图片/缓存）
   */
  async getLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  },

  /**
   * 保存数据到本地存储
   */
  async saveLocal(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * 从本地存储删除数据
   */
  async removeLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => {
        resolve();
      });
    });
  },

  /**
   * 获取缓存的 Bing 壁纸
   */
  async getBingCache() {
    const result = await this.getLocal(['bingWallpapers', 'bingCacheDate']);
    return {
      wallpapers: result.bingWallpapers || [],
      cacheDate: result.bingCacheDate || null
    };
  },

  /**
   * 保存 Bing 壁纸缓存
   */
  async saveBingCache(wallpapers) {
    await this.saveLocal({
      bingWallpapers: wallpapers,
      bingCacheDate: new Date().toDateString()
    });
  },

  /**
   * 获取缓存的 Pexels 壁纸
   */
  async getPexelsCache() {
    const result = await this.getLocal(['pexelsWallpapers', 'pexelsCacheDate', 'pexelsCachePage']);
    return {
      wallpapers: result.pexelsWallpapers || [],
      cacheDate: result.pexelsCacheDate || null,
      cachePage: result.pexelsCachePage || 1
    };
  },

  /**
   * 保存 Pexels 壁纸缓存
   */
  async savePexelsCache(wallpapers, page) {
    await this.saveLocal({
      pexelsWallpapers: wallpapers,
      pexelsCacheDate: new Date().toDateString(),
      pexelsCachePage: page
    });
  },

  /**
   * 获取上次显示的壁纸（用于加载时即时显示）
   */
  async getLastWallpaper() {
    const result = await this.getLocal(['lastWallpaperUrl', 'lastWallpaperAvgColor']);
    return {
      url: result.lastWallpaperUrl || null,
      avgColor: result.lastWallpaperAvgColor || null
    };
  },

  /**
   * 保存上次显示的壁纸
   */
  async saveLastWallpaper(url, avgColor) {
    await this.saveLocal({
      lastWallpaperUrl: url,
      lastWallpaperAvgColor: avgColor || null
    });
  },

  /**
   * 获取本地壁纸（存储为 base64）
   */
  async getLocalWallpapers() {
    const result = await this.getLocal(['localWallpapers']);
    return result.localWallpapers || [];
  },

  /**
   * 保存本地壁纸
   */
  async saveLocalWallpapers(wallpapers) {
    await this.saveLocal({ localWallpapers: wallpapers });
  },

  /**
   * 获取快捷链接图标（由于大小原因存储在本地）
   */
  async getShortcutIcons() {
    const result = await this.getLocal(['shortcutIcons']);
    return result.shortcutIcons || {};
  },

  /**
   * 保存快捷链接图标
   */
  async saveShortcutIcon(id, base64Data) {
    const icons = await this.getShortcutIcons();
    icons[id] = base64Data;
    await this.saveLocal({ shortcutIcons: icons });
  },

  /**
   * 删除快捷链接图标
   */
  async removeShortcutIcon(id) {
    const icons = await this.getShortcutIcons();
    delete icons[id];
    await this.saveLocal({ shortcutIcons: icons });
  },

  /**
   * 获取缓存的一言
   */
  async getCachedQuote() {
    const result = await this.getLocal(['quoteCache']);
    return result.quoteCache || null;
  },

  /**
   * 保存一言到缓存
   */
  async saveQuoteCache(quoteData) {
    await this.saveLocal({ quoteCache: quoteData });
  },

  /**
   * 导出所有配置
   */
  async exportConfig() {
    const syncSettings = await this.getSettings();
    const localData = await this.getLocal(['localWallpapers', 'shortcutIcons']);

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      sync: syncSettings,
      local: {
        localWallpapers: localData.localWallpapers || [],
        shortcutIcons: localData.shortcutIcons || {}
      }
    };
  },

  /**
   * 导入配置
   */
  async importConfig(config) {
    if (!config || !config.version) {
      throw new Error('无效的配置文件');
    }

    // 导入同步设置
    if (config.sync) {
      await this.saveSettings(config.sync);
    }

    // 导入本地数据
    if (config.local) {
      await this.saveLocal(config.local);
    }
  },

  /**
   * 重置为默认值
   */
  async resetToDefaults() {
    await this.saveSettings(this.defaults);
  },

  /**
   * 仅重置位置
   */
  async resetPositions() {
    await this.saveSetting('positions', this.defaults.positions);
  },

  /**
   * 将元素可见性设置应用到 DOM
   * 使用 === false 确保 undefined 被视为可见
   */
  applyVisibility(settings) {
    document.getElementById('clock-container').classList.toggle('hidden', settings.showClock === false);
    document.getElementById('search-container').classList.toggle('hidden', settings.showSearch === false);
    document.getElementById('quote-container').classList.toggle('hidden', settings.showQuote === false);
    document.getElementById('shortcuts-container').classList.toggle('hidden', settings.showShortcuts === false);
    document.getElementById('crypto-container').classList.toggle('hidden', settings.showCrypto === false);
    document.getElementById('calendar-container').classList.toggle('hidden', settings.showCalendar === false);
  }
};

// 暴露到全局
window.Storage = Storage;
