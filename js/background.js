/**
 * 后台 Service Worker
 * 处理后台任务，如壁纸预加载
 */

// 从存储获取设置
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      wallpaperSource: 'bing',
      pexelsApiKey: '',
      pexelsSearchQuery: 'nature wallpaper',
      pexelsOrientation: 'landscape'
    }, resolve);
  });
}

// 获取指定索引范围的 Bing 壁纸
async function fetchBingBatch(idx) {
  try {
    const response = await fetch(
      `https://www.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=8&mkt=zh-CN&uhd=1`
    );
    const data = await response.json();

    if (data.images && data.images.length > 0) {
      return data.images.map(img => ({
        url: `https://www.bing.com${img.urlbase}_UHD.jpg`,
        copyright: img.copyright,
        title: img.title || '',
        date: img.startdate
      }));
    }
    return [];
  } catch (error) {
    console.error(`获取 Bing 壁纸出错 (idx=${idx}):`, error);
    return [];
  }
}

// 定期预加载 Bing 壁纸（24天: idx=0, 8, 16）
async function prefetchBingWallpapers() {
  try {
    // 并行获取三批壁纸
    const [batch0, batch8, batch16] = await Promise.all([
      fetchBingBatch(0),
      fetchBingBatch(8),
      fetchBingBatch(16)
    ]);

    // 合并并按日期去重
    const allWallpapers = [...batch0, ...batch8, ...batch16];
    const uniqueWallpapers = allWallpapers.filter((wp, index, self) =>
      index === self.findIndex(w => w.date === wp.date)
    );

    if (uniqueWallpapers.length > 0) {
      // 保存到本地存储
      await chrome.storage.local.set({
        bingWallpapers: uniqueWallpapers,
        bingCacheDate: new Date().toDateString()
      });

      console.log(`Bing 壁纸已预加载: ${uniqueWallpapers.length} 张图片`);
    }
  } catch (error) {
    console.error('预加载 Bing 壁纸出错:', error);
  }
}

// 预加载 Pexels 壁纸
async function prefetchPexelsWallpapers(settings) {
  try {
    if (!settings.pexelsApiKey) {
      console.log('Pexels API key 未配置，跳过预加载');
      return;
    }

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

    if (!response.ok) {
      console.error('Pexels API 错误:', response.status);
      return;
    }

    const data = await response.json();

    if (data.photos && data.photos.length > 0) {
      // 使用 large2x 而非 original 以加快加载速度（约 1880px 宽度）
      const wallpapers = data.photos.map(photo => ({
        url: photo.src.large2x,
        title: photo.alt || 'Pexels 壁纸',
        copyright: `摄影师 ${photo.photographer} 来自 Pexels`,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url,
        avgColor: photo.avg_color
      }));

      await chrome.storage.local.set({
        pexelsWallpapers: wallpapers,
        pexelsCacheDate: new Date().toDateString(),
        pexelsCachePage: randomPage
      });

      console.log(`Pexels 壁纸已预加载: ${wallpapers.length} 张图片`);
    }
  } catch (error) {
    console.error('预加载 Pexels 壁纸出错:', error);
  }
}

// 主预加载函数 - 根据当前壁纸来源进行预加载
async function prefetchWallpapers() {
  const settings = await getSettings();

  // 始终预加载 Bing（作为备选）
  await prefetchBingWallpapers();

  // 如果配置了 Pexels，也进行预加载
  if (settings.pexelsApiKey) {
    await prefetchPexelsWallpapers(settings);
  }
}

// 安装时运行预加载
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装');
  prefetchWallpapers();
});

// 设置每日定时器用于壁纸预加载
chrome.alarms.create('prefetchWallpapers', {
  periodInMinutes: 60 * 6 // 每 6 小时
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'prefetchWallpapers') {
    prefetchWallpapers();
  }
});
