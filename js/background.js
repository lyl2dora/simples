/**
 * Background Service Worker
 * Handles background tasks like wallpaper prefetching
 */

// Fetch Bing wallpapers for a specific index range
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
    console.error(`Error fetching Bing wallpapers (idx=${idx}):`, error);
    return [];
  }
}

// Prefetch Bing wallpapers periodically (24 days: idx=0, 8, 16)
async function prefetchBingWallpapers() {
  try {
    // Fetch all three batches in parallel
    const [batch0, batch8, batch16] = await Promise.all([
      fetchBingBatch(0),
      fetchBingBatch(8),
      fetchBingBatch(16)
    ]);

    // Combine and deduplicate by date
    const allWallpapers = [...batch0, ...batch8, ...batch16];
    const uniqueWallpapers = allWallpapers.filter((wp, index, self) =>
      index === self.findIndex(w => w.date === wp.date)
    );

    if (uniqueWallpapers.length > 0) {
      // Save to local storage
      await chrome.storage.local.set({
        bingWallpapers: uniqueWallpapers,
        bingCacheDate: new Date().toDateString()
      });

      console.log(`Bing wallpapers prefetched: ${uniqueWallpapers.length} images`);
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
