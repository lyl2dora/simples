/**
 * 壁纸模块 - 处理 Bing 壁纸和本地壁纸
 */

const Wallpaper = {
  currentLayer: 'current',
  wallpaperInfo: null,

  /**
   * 初始化壁纸
   */
  async init() {
    const settings = await Storage.getSettings();

    // 设置叠加层透明度
    this.setOverlayOpacity(settings.overlayOpacity);

    // 尝试立即显示上次的壁纸（用于即时显示）
    await this.showLastWallpaperInstantly();

    // 根据壁纸源加载壁纸
    await this.loadWallpaperBySource(settings);
  },

  /**
   * 根据壁纸源加载壁纸
   */
  async loadWallpaperBySource(settings) {
    switch (settings.wallpaperSource) {
      case 'bing':
        await this.loadBingWallpaper(settings);
        break;
      case 'pexels':
        await this.loadPexelsWallpaper(settings);
        break;
      default:
        await this.loadLocalWallpaper(settings);
    }
  },

  /**
   * 立即显示上次的壁纸（无过渡效果，用于加载时即时显示）
   */
  async showLastWallpaperInstantly() {
    const { url, avgColor } = await Storage.getLastWallpaper();
    const currentEl = document.getElementById('wallpaper-current');

    if (url) {
      // 显示上次的壁纸 URL（浏览器 HTTP 缓存应该使其即时显示）
      currentEl.style.backgroundImage = `url(${url})`;
    } else if (avgColor) {
      // 如果没有缓存的 URL，则使用平均颜色作为备选
      currentEl.style.backgroundColor = avgColor;
    }
    // 如果都不存在，保持默认状态（将由 loadXxxWallpaper 设置）
  },

  /**
   * 设置叠加层透明度
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
   * 根据模式获取壁纸索引
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
   * 加载 Bing 壁纸
   */
  async loadBingWallpaper(settings) {
    try {
      // 首先检查缓存
      let { wallpapers, cacheDate } = await Storage.getBingCache();
      const today = new Date().toDateString();

      // 如果缓存过期或为空，获取新壁纸
      if (!wallpapers.length || cacheDate !== today) {
        wallpapers = await this.fetchBingWallpapers();
        await Storage.saveBingCache(wallpapers);
      }

      if (!wallpapers.length) {
        console.error('没有可用的 Bing 壁纸');
        return;
      }

      // 根据模式选择壁纸
      const index = await this.getWallpaperIndex(wallpapers, settings);
      const selectedWallpaper = wallpapers[index];
      this.wallpaperInfo = selectedWallpaper;

      // 加载并显示带过渡效果的壁纸
      await this.displayWallpaper(selectedWallpaper.url);
      this.updateWallpaperInfo(selectedWallpaper);

    } catch (error) {
      console.error('加载 Bing 壁纸出错:', error);
    }
  },

  /**
   * 获取一批 Bing 壁纸
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
   * 从 API 获取 Bing 壁纸（24天: idx=0, 8, 16）
   */
  async fetchBingWallpapers() {
    try {
      // 并行获取 3 批壁纸，共 24 天
      const [batch0, batch8, batch16] = await Promise.all([
        this.fetchBingBatch(0),
        this.fetchBingBatch(8),
        this.fetchBingBatch(16)
      ]);

      // 合并所有批次
      const allWallpapers = [...batch0, ...batch8, ...batch16];

      // 按日期去重（以防重叠）
      const uniqueWallpapers = allWallpapers.filter((wp, index, self) =>
        index === self.findIndex(w => w.date === wp.date)
      );

      return uniqueWallpapers;
    } catch (error) {
      console.error('获取 Bing 壁纸出错:', error);
      return [];
    }
  },

  /**
   * 从版权字符串中提取标题
   */
  extractTitle(copyright) {
    if (!copyright) return '';
    // 通常格式: "标题 (© 作者)"
    const match = copyright.match(/^([^(]+)/);
    return match ? match[1].trim() : copyright;
  },

  /**
   * 加载 Pexels 壁纸
   */
  async loadPexelsWallpaper(settings) {
    try {
      // 检查是否配置了 API key
      if (!settings.pexelsApiKey) {
        await this.loadBingWallpaper(settings);
        return;
      }

      // 首先检查缓存
      let { wallpapers, cacheDate } = await Storage.getPexelsCache();
      const today = new Date().toDateString();

      // 如果缓存过期或为空，获取新壁纸
      if (!wallpapers.length || cacheDate !== today) {
        wallpapers = await this.fetchPexelsWallpapers(settings);
        if (wallpapers.length > 0) {
          const randomPage = Math.floor(Math.random() * 100) + 1;
          await Storage.savePexelsCache(wallpapers, randomPage);
        }
      }

      if (!wallpapers.length) {
        await this.loadBingWallpaper(settings);
        return;
      }

      // 根据模式选择壁纸
      const index = await this.getWallpaperIndex(wallpapers, settings);
      const selectedWallpaper = wallpapers[index];
      this.wallpaperInfo = selectedWallpaper;

      // 加载并显示带过渡效果的壁纸（传递 avgColor 用于缓存）
      await this.displayWallpaper(selectedWallpaper.url, selectedWallpaper.avgColor);
      this.updateWallpaperInfo(selectedWallpaper);

    } catch (error) {
      console.error('加载 Pexels 壁纸出错:', error);
      // 出错时回退到 Bing
      await this.loadBingWallpaper(settings);
    }
  },

  /**
   * 从 API 获取 Pexels 壁纸
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
        console.error('Pexels API key 无效');
        return [];
      }

      if (response.status === 429) {
        console.error('Pexels API 请求频率超限');
        return [];
      }

      if (!response.ok) {
        console.error('Pexels API 错误:', response.status);
        return [];
      }

      const data = await response.json();

      if (!data.photos || !data.photos.length) {
        return [];
      }

      // 使用 large2x 而非 original 以加快加载速度（约 1880px 宽度）
      return data.photos.map(photo => ({
        url: photo.src.large2x,
        title: photo.alt || 'Pexels 壁纸',
        copyright: `摄影师 ${photo.photographer} 来自 Pexels`,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url,
        avgColor: photo.avg_color
      }));
    } catch (error) {
      console.error('获取 Pexels 壁纸出错:', error);
      return [];
    }
  },

  /**
   * 加载本地壁纸
   */
  async loadLocalWallpaper(settings) {
    try {
      const wallpapers = await Storage.getLocalWallpapers();

      if (!wallpapers.length) {
        // 没有本地壁纸，显示默认渐变背景
        this.showDefaultBackground();
        return;
      }

      // 根据模式选择壁纸
      const index = await this.getWallpaperIndex(wallpapers, settings);
      const selectedWallpaper = wallpapers[index];
      this.wallpaperInfo = { title: '本地壁纸', copyright: '' };

      await this.displayWallpaper(selectedWallpaper);
      this.updateWallpaperInfo({ title: '本地壁纸', copyright: '' });

    } catch (error) {
      console.error('加载本地壁纸出错:', error);
      this.showDefaultBackground();
    }
  },

  /**
   * 显示带渐变过渡效果的壁纸
   * @param {string} url - 壁纸 URL
   * @param {string} avgColor - 可选的平均颜色（用于 Pexels）
   */
  async displayWallpaper(url, avgColor = null) {
    return new Promise((resolve) => {
      const currentEl = document.getElementById('wallpaper-current');
      const nextEl = document.getElementById('wallpaper-next');

      // 预加载图片
      const img = new Image();
      img.onload = async () => {
        // 设置下一层
        nextEl.style.backgroundImage = `url(${url})`;

        // 触发过渡
        requestAnimationFrame(() => {
          nextEl.style.opacity = '1';
          currentEl.style.opacity = '0';

          // 过渡完成后，交换图层
          setTimeout(async () => {
            currentEl.style.backgroundImage = `url(${url})`;
            currentEl.style.backgroundColor = ''; // 清除背景颜色
            currentEl.style.opacity = '1';
            nextEl.style.opacity = '0';

            // 保存为上次壁纸，以便下次即时显示
            await Storage.saveLastWallpaper(url, avgColor);
            resolve();
          }, 800);
        });
      };

      img.onerror = () => {
        console.error('加载壁纸失败:', url);
        resolve();
      };

      img.src = url;
    });
  },

  /**
   * 显示默认渐变背景
   */
  showDefaultBackground() {
    const currentEl = document.getElementById('wallpaper-current');
    currentEl.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
    currentEl.style.backgroundImage = 'none';
  },

  /**
   * 更新壁纸信息提示
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
   * 添加本地壁纸
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
   * 删除本地壁纸
   */
  async removeLocalWallpaper(index) {
    const wallpapers = await Storage.getLocalWallpapers();
    wallpapers.splice(index, 1);
    await Storage.saveLocalWallpapers(wallpapers);
  },

  /**
   * 刷新壁纸
   */
  async refresh() {
    const settings = await Storage.getSettings();
    await this.loadWallpaperBySource(settings);
  }
};

// 暴露到全局
window.Wallpaper = Wallpaper;
