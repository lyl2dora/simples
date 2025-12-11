/**
 * Storage module - handles chrome.storage.sync and chrome.storage.local
 */

const Storage = {
  // Default settings
  defaults: {
    // Wallpaper settings
    wallpaperSource: 'bing', // 'bing', 'pexels', or 'local'
    wallpaperMode: 'random', // 'random', 'sequential', 'daily'
    overlayOpacity: 30,
    currentWallpaperIndex: 0,

    // Pexels settings
    pexelsApiKey: '',
    pexelsSearchQuery: 'nature wallpaper',
    pexelsOrientation: 'landscape',

    // Search settings
    searchTarget: 'new', // 'new' or 'current'
    searchSuggestions: true,

    // Shortcuts settings
    shortcutsPerRow: 6,
    shortcuts: [],

    // Layout settings
    editMode: false,
    panelOpacity: 75, // Panel background opacity (0-100)
    positions: {
      clock: { x: 50, y: 25 },
      search: { x: 50, y: 50 },
      quote: { x: 50, y: 68 },
      shortcuts: { x: 50, y: 85 },
      crypto: { x: 50, y: 10 }
    },

    // Visibility settings
    showClock: true,
    showSearch: true,
    showQuote: true,
    showShortcuts: true,
    showCrypto: true,

    // UI settings
    autoHideControls: true  // Auto-hide add button and settings icon
  },

  /**
   * Get settings from sync storage
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(this.defaults, (result) => {
        resolve(result);
      });
    });
  },

  /**
   * Save settings to sync storage
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
   * Get single setting value
   */
  async getSetting(key) {
    const settings = await this.getSettings();
    return settings[key];
  },

  /**
   * Save single setting value
   */
  async saveSetting(key, value) {
    return this.saveSettings({ [key]: value });
  },

  /**
   * Get data from local storage (for images/cache)
   */
  async getLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  },

  /**
   * Save data to local storage
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
   * Remove data from local storage
   */
  async removeLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => {
        resolve();
      });
    });
  },

  /**
   * Get cached Bing wallpapers
   */
  async getBingCache() {
    const result = await this.getLocal(['bingWallpapers', 'bingCacheDate']);
    return {
      wallpapers: result.bingWallpapers || [],
      cacheDate: result.bingCacheDate || null
    };
  },

  /**
   * Save Bing wallpapers cache
   */
  async saveBingCache(wallpapers) {
    await this.saveLocal({
      bingWallpapers: wallpapers,
      bingCacheDate: new Date().toDateString()
    });
  },

  /**
   * Get cached Pexels wallpapers
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
   * Save Pexels wallpapers cache
   */
  async savePexelsCache(wallpapers, page) {
    await this.saveLocal({
      pexelsWallpapers: wallpapers,
      pexelsCacheDate: new Date().toDateString(),
      pexelsCachePage: page
    });
  },

  /**
   * Get last displayed wallpaper (for instant display on load)
   */
  async getLastWallpaper() {
    const result = await this.getLocal(['lastWallpaperUrl', 'lastWallpaperAvgColor']);
    return {
      url: result.lastWallpaperUrl || null,
      avgColor: result.lastWallpaperAvgColor || null
    };
  },

  /**
   * Save last displayed wallpaper
   */
  async saveLastWallpaper(url, avgColor) {
    await this.saveLocal({
      lastWallpaperUrl: url,
      lastWallpaperAvgColor: avgColor || null
    });
  },

  /**
   * Get local wallpapers (stored as base64)
   */
  async getLocalWallpapers() {
    const result = await this.getLocal(['localWallpapers']);
    return result.localWallpapers || [];
  },

  /**
   * Save local wallpapers
   */
  async saveLocalWallpapers(wallpapers) {
    await this.saveLocal({ localWallpapers: wallpapers });
  },

  /**
   * Get shortcut icons (stored locally due to size)
   */
  async getShortcutIcons() {
    const result = await this.getLocal(['shortcutIcons']);
    return result.shortcutIcons || {};
  },

  /**
   * Save shortcut icon
   */
  async saveShortcutIcon(id, base64Data) {
    const icons = await this.getShortcutIcons();
    icons[id] = base64Data;
    await this.saveLocal({ shortcutIcons: icons });
  },

  /**
   * Remove shortcut icon
   */
  async removeShortcutIcon(id) {
    const icons = await this.getShortcutIcons();
    delete icons[id];
    await this.saveLocal({ shortcutIcons: icons });
  },

  /**
   * Get cached quote
   */
  async getCachedQuote() {
    const result = await this.getLocal(['quoteCache']);
    return result.quoteCache || null;
  },

  /**
   * Save quote to cache
   */
  async saveQuoteCache(quoteData) {
    await this.saveLocal({ quoteCache: quoteData });
  },

  /**
   * Export all configuration
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
   * Import configuration
   */
  async importConfig(config) {
    if (!config || !config.version) {
      throw new Error('Invalid configuration file');
    }

    // Import sync settings
    if (config.sync) {
      await this.saveSettings(config.sync);
    }

    // Import local data
    if (config.local) {
      await this.saveLocal(config.local);
    }
  },

  /**
   * Reset to defaults
   */
  async resetToDefaults() {
    await this.saveSettings(this.defaults);
  },

  /**
   * Reset positions only
   */
  async resetPositions() {
    await this.saveSetting('positions', this.defaults.positions);
  }
};

// Make available globally
window.Storage = Storage;
