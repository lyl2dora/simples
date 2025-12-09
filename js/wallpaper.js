/**
 * Wallpaper module - handles Bing wallpapers and local wallpapers
 */

const Wallpaper = {
  currentLayer: 'current',
  wallpaperInfo: null,

  /**
   * Initialize wallpaper
   */
  async init() {
    const settings = await Storage.getSettings();

    // Set overlay opacity
    this.setOverlayOpacity(settings.overlayOpacity);

    // Try to show last wallpaper immediately (for instant display)
    await this.showLastWallpaperInstantly();

    // Load wallpaper based on source
    if (settings.wallpaperSource === 'bing') {
      await this.loadBingWallpaper(settings);
    } else if (settings.wallpaperSource === 'pexels') {
      await this.loadPexelsWallpaper(settings);
    } else {
      await this.loadLocalWallpaper(settings);
    }
  },

  /**
   * Show last wallpaper instantly (no transition, for immediate display on load)
   */
  async showLastWallpaperInstantly() {
    const { url, avgColor } = await Storage.getLastWallpaper();
    const currentEl = document.getElementById('wallpaper-current');

    if (url) {
      // Show last wallpaper URL (browser HTTP cache should make this instant)
      currentEl.style.backgroundImage = `url(${url})`;
    } else if (avgColor) {
      // Fallback to average color if no URL cached
      currentEl.style.backgroundColor = avgColor;
    }
    // If neither exists, keep default (will be set by loadXxxWallpaper)
  },

  /**
   * Set overlay opacity
   */
  setOverlayOpacity(opacity) {
    const overlay = document.getElementById('wallpaper-overlay');
    const opacityValue = opacity / 100;
    overlay.style.background = `linear-gradient(
      to bottom,
      rgba(0, 0, 0, ${opacityValue * 0.7}) 0%,
      rgba(0, 0, 0, ${opacityValue * 0.3}) 40%,
      rgba(0, 0, 0, ${opacityValue}) 100%
    )`;
  },

  /**
   * Get wallpaper index based on mode
   */
  async getWallpaperIndex(wallpapers, settings) {
    let index = settings.currentWallpaperIndex || 0;

    switch (settings.wallpaperMode) {
      case 'random':
        return Math.floor(Math.random() * wallpapers.length);
      case 'sequential':
        index = (index + 1) % wallpapers.length;
        await Storage.saveSetting('currentWallpaperIndex', index);
        return index;
      case 'daily':
      default:
        return 0;
    }
  },

  /**
   * Load Bing wallpaper
   */
  async loadBingWallpaper(settings) {
    try {
      // Check cache first
      let { wallpapers, cacheDate } = await Storage.getBingCache();
      const today = new Date().toDateString();

      // Fetch new wallpapers if cache is old or empty
      if (!wallpapers.length || cacheDate !== today) {
        wallpapers = await this.fetchBingWallpapers();
        await Storage.saveBingCache(wallpapers);
      }

      if (!wallpapers.length) {
        console.error('No Bing wallpapers available');
        return;
      }

      // Select wallpaper based on mode
      const index = await this.getWallpaperIndex(wallpapers, settings);
      const selectedWallpaper = wallpapers[index];
      this.wallpaperInfo = selectedWallpaper;

      // Load and display wallpaper with transition
      await this.displayWallpaper(selectedWallpaper.url);
      this.updateWallpaperInfo(selectedWallpaper);

    } catch (error) {
      console.error('Error loading Bing wallpaper:', error);
    }
  },

  /**
   * Fetch a batch of Bing wallpapers
   */
  async fetchBingBatch(idx) {
    const response = await fetch(
      `https://www.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=8&mkt=zh-CN&uhd=1`
    );
    const data = await response.json();

    if (!data.images || !data.images.length) {
      return [];
    }

    return data.images.map(img => ({
      url: `https://www.bing.com${img.urlbase}_UHD.jpg`,
      copyright: img.copyright,
      title: img.title || this.extractTitle(img.copyright),
      date: img.startdate
    }));
  },

  /**
   * Fetch Bing wallpapers from API (24 days: idx=0, 8, 16)
   */
  async fetchBingWallpapers() {
    try {
      // Fetch 3 batches in parallel for 24 days of wallpapers
      const [batch0, batch8, batch16] = await Promise.all([
        this.fetchBingBatch(0),
        this.fetchBingBatch(8),
        this.fetchBingBatch(16)
      ]);

      // Combine all batches
      const allWallpapers = [...batch0, ...batch8, ...batch16];

      // Deduplicate by date (in case of overlap)
      const uniqueWallpapers = allWallpapers.filter((wp, index, self) =>
        index === self.findIndex(w => w.date === wp.date)
      );

      return uniqueWallpapers;
    } catch (error) {
      console.error('Error fetching Bing wallpapers:', error);
      return [];
    }
  },

  /**
   * Extract title from copyright string
   */
  extractTitle(copyright) {
    if (!copyright) return '';
    // Usually format: "Title (© Author)"
    const match = copyright.match(/^([^(]+)/);
    return match ? match[1].trim() : copyright;
  },

  /**
   * Load Pexels wallpaper
   */
  async loadPexelsWallpaper(settings) {
    try {
      // Check if API key is configured
      if (!settings.pexelsApiKey) {
        console.warn('Pexels API key not configured, falling back to Bing');
        await this.loadBingWallpaper(settings);
        return;
      }

      // Check cache first
      let { wallpapers, cacheDate } = await Storage.getPexelsCache();
      const today = new Date().toDateString();

      // Fetch new wallpapers if cache is old or empty
      if (!wallpapers.length || cacheDate !== today) {
        wallpapers = await this.fetchPexelsWallpapers(settings);
        if (wallpapers.length > 0) {
          const randomPage = Math.floor(Math.random() * 100) + 1;
          await Storage.savePexelsCache(wallpapers, randomPage);
        }
      }

      if (!wallpapers.length) {
        console.warn('No Pexels wallpapers available, falling back to Bing');
        await this.loadBingWallpaper(settings);
        return;
      }

      // Select wallpaper based on mode
      const index = await this.getWallpaperIndex(wallpapers, settings);
      const selectedWallpaper = wallpapers[index];
      this.wallpaperInfo = selectedWallpaper;

      // Load and display wallpaper with transition (pass avgColor for caching)
      await this.displayWallpaper(selectedWallpaper.url, selectedWallpaper.avgColor);
      this.updateWallpaperInfo(selectedWallpaper);

    } catch (error) {
      console.error('Error loading Pexels wallpaper:', error);
      // Fallback to Bing on error
      await this.loadBingWallpaper(settings);
    }
  },

  /**
   * Fetch Pexels wallpapers from API
   */
  async fetchPexelsWallpapers(settings) {
    try {
      const query = encodeURIComponent(settings.pexelsSearchQuery || 'nature wallpaper');
      const orientation = settings.pexelsOrientation || 'landscape';
      const randomPage = Math.floor(Math.random() * 100) + 1;

      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${query}&orientation=${orientation}&size=large&per_page=40&page=${randomPage}`,
        {
          headers: {
            'Authorization': settings.pexelsApiKey
          }
        }
      );

      if (response.status === 401) {
        console.error('Pexels API key is invalid');
        return [];
      }

      if (response.status === 429) {
        console.error('Pexels API rate limit exceeded');
        return [];
      }

      if (!response.ok) {
        console.error('Pexels API error:', response.status);
        return [];
      }

      const data = await response.json();

      if (!data.photos || !data.photos.length) {
        return [];
      }

      // Use large2x instead of original for faster loading (~1880px width)
      return data.photos.map(photo => ({
        url: photo.src.large2x,
        title: photo.alt || 'Pexels Wallpaper',
        copyright: `Photo by ${photo.photographer} on Pexels`,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url,
        avgColor: photo.avg_color
      }));
    } catch (error) {
      console.error('Error fetching Pexels wallpapers:', error);
      return [];
    }
  },

  /**
   * Load local wallpaper
   */
  async loadLocalWallpaper(settings) {
    try {
      const wallpapers = await Storage.getLocalWallpapers();

      if (!wallpapers.length) {
        // No local wallpapers, show default gradient
        this.showDefaultBackground();
        return;
      }

      // Select wallpaper based on mode
      const index = await this.getWallpaperIndex(wallpapers, settings);
      const selectedWallpaper = wallpapers[index];
      this.wallpaperInfo = { title: '本地壁纸', copyright: '' };

      await this.displayWallpaper(selectedWallpaper);
      this.updateWallpaperInfo({ title: '本地壁纸', copyright: '' });

    } catch (error) {
      console.error('Error loading local wallpaper:', error);
      this.showDefaultBackground();
    }
  },

  /**
   * Display wallpaper with fade transition
   * @param {string} url - The wallpaper URL
   * @param {string} avgColor - Optional average color (for Pexels)
   */
  async displayWallpaper(url, avgColor = null) {
    return new Promise((resolve) => {
      const currentEl = document.getElementById('wallpaper-current');
      const nextEl = document.getElementById('wallpaper-next');

      // Preload image
      const img = new Image();
      img.onload = async () => {
        // Set the next layer
        nextEl.style.backgroundImage = `url(${url})`;

        // Trigger transition
        requestAnimationFrame(() => {
          nextEl.style.opacity = '1';
          currentEl.style.opacity = '0';

          // After transition, swap layers
          setTimeout(async () => {
            currentEl.style.backgroundImage = `url(${url})`;
            currentEl.style.backgroundColor = ''; // Clear any background color
            currentEl.style.opacity = '1';
            nextEl.style.opacity = '0';

            // Save as last wallpaper for instant display next time
            await Storage.saveLastWallpaper(url, avgColor);
            resolve();
          }, 800);
        });
      };

      img.onerror = () => {
        console.error('Failed to load wallpaper:', url);
        resolve();
      };

      img.src = url;
    });
  },

  /**
   * Show default gradient background
   */
  showDefaultBackground() {
    const currentEl = document.getElementById('wallpaper-current');
    currentEl.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
    currentEl.style.backgroundImage = 'none';
  },

  /**
   * Update wallpaper info tooltip
   */
  updateWallpaperInfo(info) {
    const tooltip = document.getElementById('wallpaper-info-tooltip');
    if (info && info.copyright) {
      tooltip.textContent = info.copyright;
    } else if (info && info.title) {
      tooltip.textContent = info.title;
    } else {
      tooltip.textContent = '壁纸信息不可用';
    }
  },

  /**
   * Add local wallpaper
   */
  async addLocalWallpaper(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result;
          const wallpapers = await Storage.getLocalWallpapers();
          wallpapers.push(base64);
          await Storage.saveLocalWallpapers(wallpapers);
          resolve(base64);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Remove local wallpaper
   */
  async removeLocalWallpaper(index) {
    const wallpapers = await Storage.getLocalWallpapers();
    wallpapers.splice(index, 1);
    await Storage.saveLocalWallpapers(wallpapers);
  },

  /**
   * Refresh wallpaper
   */
  async refresh() {
    const settings = await Storage.getSettings();
    if (settings.wallpaperSource === 'bing') {
      await this.loadBingWallpaper(settings);
    } else if (settings.wallpaperSource === 'pexels') {
      await this.loadPexelsWallpaper(settings);
    } else {
      await this.loadLocalWallpaper(settings);
    }
  }
};

// Make available globally
window.Wallpaper = Wallpaper;
