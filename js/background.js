/**
 * Background Service Worker
 * Handles background tasks like wallpaper prefetching
 */

// Get settings from storage
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

// Prefetch Pexels wallpapers
async function prefetchPexelsWallpapers(settings) {
  try {
    if (!settings.pexelsApiKey) {
      console.log('Pexels API key not configured, skipping prefetch');
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
      console.error('Pexels API error:', response.status);
      return;
    }

    const data = await response.json();

    if (data.photos && data.photos.length > 0) {
      // Use large2x instead of original for faster loading (~1880px width)
      const wallpapers = data.photos.map(photo => ({
        url: photo.src.large2x,
        title: photo.alt || 'Pexels Wallpaper',
        copyright: `Photo by ${photo.photographer} on Pexels`,
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

      console.log(`Pexels wallpapers prefetched: ${wallpapers.length} images`);
    }
  } catch (error) {
    console.error('Error prefetching Pexels wallpapers:', error);
  }
}

// Main prefetch function - prefetches based on current wallpaper source
async function prefetchWallpapers() {
  const settings = await getSettings();

  // Always prefetch Bing (as fallback)
  await prefetchBingWallpapers();

  // Also prefetch Pexels if configured
  if (settings.pexelsApiKey) {
    await prefetchPexelsWallpapers(settings);
  }
}

// Run prefetch on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  prefetchWallpapers();
});

// Set up daily alarm for wallpaper prefetch
chrome.alarms.create('prefetchWallpapers', {
  periodInMinutes: 60 * 6 // Every 6 hours
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'prefetchWallpapers') {
    prefetchWallpapers();
  }
});
