/**
 * Background Service Worker
 * Handles background tasks like wallpaper prefetching
 */

// Prefetch Bing wallpapers periodically
async function prefetchBingWallpapers() {
  try {
    const response = await fetch(
      'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN&uhd=1'
    );
    const data = await response.json();

    if (data.images && data.images.length > 0) {
      const wallpapers = data.images.map(img => ({
        url: `https://www.bing.com${img.urlbase}_UHD.jpg`,
        copyright: img.copyright,
        title: img.title || '',
        date: img.startdate
      }));

      // Save to local storage
      await chrome.storage.local.set({
        bingWallpapers: wallpapers,
        bingCacheDate: new Date().toDateString()
      });

      console.log('Bing wallpapers prefetched successfully');
    }
  } catch (error) {
    console.error('Error prefetching Bing wallpapers:', error);
  }
}

// Run prefetch on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  prefetchBingWallpapers();
});

// Set up daily alarm for wallpaper prefetch
chrome.alarms.create('prefetchWallpapers', {
  periodInMinutes: 60 * 6 // Every 6 hours
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'prefetchWallpapers') {
    prefetchBingWallpapers();
  }
});
