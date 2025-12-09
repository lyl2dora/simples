/**
 * Settings module - handles settings sidebar panel
 */

const Settings = {
  sidebar: null,
  overlay: null,
  isOpen: false,

  /**
   * Initialize settings
   */
  async init() {
    this.sidebar = document.getElementById('settings-sidebar');
    this.overlay = document.getElementById('settings-overlay');

    await this.loadSettings();
    this.bindEvents();
  },

  /**
   * Load current settings into UI
   */
  async loadSettings() {
    const settings = await Storage.getSettings();

    // Wallpaper settings
    document.getElementById('setting-wallpaper-source').value = settings.wallpaperSource;
    document.getElementById('setting-wallpaper-mode').value = settings.wallpaperMode;
    document.getElementById('setting-overlay-opacity').value = settings.overlayOpacity;
    document.getElementById('overlay-opacity-value').textContent = `${settings.overlayOpacity}%`;

    // Pexels settings
    document.getElementById('setting-pexels-api-key').value = settings.pexelsApiKey || '';
    document.getElementById('setting-pexels-query').value = settings.pexelsSearchQuery || 'nature wallpaper';
    document.getElementById('setting-pexels-orientation').value = settings.pexelsOrientation || 'landscape';

    // Show/hide relevant wallpaper settings
    this.toggleWallpaperSettings(settings.wallpaperSource);

    // Load local wallpaper previews
    await this.loadLocalWallpaperPreviews();

    // Search settings
    document.getElementById('setting-search-target').value = settings.searchTarget;
    document.getElementById('setting-search-suggestions').checked = settings.searchSuggestions;

    // Shortcuts settings
    document.getElementById('setting-shortcuts-per-row').value = settings.shortcutsPerRow;

    // Layout settings
    document.getElementById('setting-edit-mode').checked = settings.editMode;
    document.getElementById('setting-panel-opacity').value = settings.panelOpacity || 75;
    document.getElementById('panel-opacity-value').textContent = `${settings.panelOpacity || 75}%`;
    document.getElementById('show-clock').checked = settings.showClock;
    document.getElementById('show-search').checked = settings.showSearch;
    document.getElementById('show-quote').checked = settings.showQuote;
    document.getElementById('show-shortcuts').checked = settings.showShortcuts;

    // Apply panel opacity
    this.applyPanelOpacity(settings.panelOpacity || 75);

    // Apply visibility
    this.applyVisibility(settings);

    // Apply edit mode
    if (settings.editMode) {
      Drag.enableEditMode();
    }
  },

  /**
   * Toggle wallpaper-specific settings visibility
   */
  toggleWallpaperSettings(source) {
    const bingSettings = document.getElementById('bing-settings');
    const pexelsSettings = document.getElementById('pexels-settings');
    const localSettings = document.getElementById('local-wallpaper-settings');

    // Hide all first
    bingSettings.style.display = 'none';
    pexelsSettings.style.display = 'none';
    localSettings.style.display = 'none';

    // Show relevant settings
    if (source === 'bing') {
      bingSettings.style.display = 'block';
    } else if (source === 'pexels') {
      pexelsSettings.style.display = 'block';
      bingSettings.style.display = 'block'; // Also show mode selector for Pexels
    } else {
      localSettings.style.display = 'block';
    }
  },

  /**
   * Load local wallpaper previews
   */
  async loadLocalWallpaperPreviews() {
    const wallpapers = await Storage.getLocalWallpapers();
    const preview = document.getElementById('local-wallpaper-preview');

    preview.innerHTML = wallpapers.map((wp, index) =>
      `<img src="${wp}" class="local-wallpaper-thumb" data-index="${index}" alt="Wallpaper ${index + 1}">`
    ).join('');

    // Bind delete on right-click
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
   * Apply element visibility
   * Use === false to ensure undefined is treated as true (visible)
   */
  applyVisibility(settings) {
    document.getElementById('clock-container').classList.toggle('hidden', settings.showClock === false);
    document.getElementById('search-container').classList.toggle('hidden', settings.showSearch === false);
    document.getElementById('quote-container').classList.toggle('hidden', settings.showQuote === false);
    document.getElementById('shortcuts-container').classList.toggle('hidden', settings.showShortcuts === false);
  },

  /**
   * Apply panel opacity to settings sidebar and dialogs
   */
  applyPanelOpacity(opacity) {
    document.documentElement.style.setProperty('--panel-opacity', opacity / 100);
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Open/close settings
    document.getElementById('settings-btn').addEventListener('click', () => this.open());
    document.getElementById('settings-close-btn').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());

    // Wallpaper source change
    document.getElementById('setting-wallpaper-source').addEventListener('change', async (e) => {
      const source = e.target.value;
      await Storage.saveSetting('wallpaperSource', source);
      this.toggleWallpaperSettings(source);
      await Wallpaper.refresh();
    });

    // Wallpaper mode change
    document.getElementById('setting-wallpaper-mode').addEventListener('change', async (e) => {
      await Storage.saveSetting('wallpaperMode', e.target.value);
    });

    // Local wallpaper upload
    document.getElementById('local-wallpaper-input').addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        await Wallpaper.addLocalWallpaper(file);
      }
      await this.loadLocalWallpaperPreviews();

      // If source is local, refresh wallpaper
      const settings = await Storage.getSettings();
      if (settings.wallpaperSource === 'local') {
        await Wallpaper.refresh();
      }
    });

    // Pexels API key change
    document.getElementById('setting-pexels-api-key').addEventListener('change', async (e) => {
      await Storage.saveSetting('pexelsApiKey', e.target.value.trim());
      const settings = await Storage.getSettings();
      if (settings.wallpaperSource === 'pexels') {
        await Wallpaper.refresh();
      }
    });

    // Pexels search query change
    document.getElementById('setting-pexels-query').addEventListener('change', async (e) => {
      await Storage.saveSetting('pexelsSearchQuery', e.target.value.trim() || 'nature wallpaper');
      const settings = await Storage.getSettings();
      if (settings.wallpaperSource === 'pexels') {
        // Clear cache to fetch new results
        await Storage.savePexelsCache([], 1);
        await Wallpaper.refresh();
      }
    });

    // Pexels orientation change
    document.getElementById('setting-pexels-orientation').addEventListener('change', async (e) => {
      await Storage.saveSetting('pexelsOrientation', e.target.value);
      const settings = await Storage.getSettings();
      if (settings.wallpaperSource === 'pexels') {
        // Clear cache to fetch new results
        await Storage.savePexelsCache([], 1);
        await Wallpaper.refresh();
      }
    });

    // Overlay opacity change
    document.getElementById('setting-overlay-opacity').addEventListener('input', async (e) => {
      const opacity = parseInt(e.target.value);
      document.getElementById('overlay-opacity-value').textContent = `${opacity}%`;
      Wallpaper.setOverlayOpacity(opacity);
    });

    document.getElementById('setting-overlay-opacity').addEventListener('change', async (e) => {
      await Storage.saveSetting('overlayOpacity', parseInt(e.target.value));
    });

    // Search settings
    document.getElementById('setting-search-target').addEventListener('change', async (e) => {
      await Storage.saveSetting('searchTarget', e.target.value);
      await Search.updateSettings();
    });

    document.getElementById('setting-search-suggestions').addEventListener('change', async (e) => {
      await Storage.saveSetting('searchSuggestions', e.target.checked);
      await Search.updateSettings();
    });

    // Shortcuts per row
    document.getElementById('setting-shortcuts-per-row').addEventListener('change', async (e) => {
      const value = parseInt(e.target.value);
      await Storage.saveSetting('shortcutsPerRow', value);
      await Shortcuts.updateSettings();
    });

    // Edit mode toggle
    document.getElementById('setting-edit-mode').addEventListener('change', async (e) => {
      await Drag.toggleEditMode(e.target.checked);
    });

    // Reset positions button
    document.getElementById('reset-positions-btn').addEventListener('click', async () => {
      if (confirm('确定要恢复默认位置吗？')) {
        await Drag.resetPositions();
      }
    });

    // Panel opacity change
    document.getElementById('setting-panel-opacity').addEventListener('input', async (e) => {
      const opacity = parseInt(e.target.value);
      document.getElementById('panel-opacity-value').textContent = `${opacity}%`;
      this.applyPanelOpacity(opacity);
    });

    document.getElementById('setting-panel-opacity').addEventListener('change', async (e) => {
      await Storage.saveSetting('panelOpacity', parseInt(e.target.value));
    });

    // Visibility toggles
    ['clock', 'search', 'quote', 'shortcuts'].forEach(element => {
      document.getElementById(`show-${element}`).addEventListener('change', async (e) => {
        const key = `show${element.charAt(0).toUpperCase() + element.slice(1)}`;
        await Storage.saveSetting(key, e.target.checked);
        document.getElementById(`${element}-container`).classList.toggle('hidden', !e.target.checked);
      });
    });

    // Export config
    document.getElementById('export-config-btn').addEventListener('click', async () => {
      await this.exportConfig();
    });

    // Import config
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
   * Open settings sidebar
   */
  open() {
    this.sidebar.classList.add('show');
    this.overlay.classList.add('show');
    this.isOpen = true;
  },

  /**
   * Close settings sidebar
   */
  close() {
    this.sidebar.classList.remove('show');
    this.overlay.classList.remove('show');
    this.isOpen = false;
  },

  /**
   * Export configuration
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
      console.error('Export failed:', error);
      alert('导出失败');
    }
  },

  /**
   * Import configuration
   */
  async importConfig(file) {
    try {
      const text = await file.text();
      const config = JSON.parse(text);

      await Storage.importConfig(config);

      // Reload page to apply changes
      alert('导入成功，页面将重新加载');
      location.reload();
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败：配置文件格式错误');
    }
  }
};

// Make available globally
window.Settings = Settings;
