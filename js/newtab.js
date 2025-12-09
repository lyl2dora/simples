/**
 * Main entry point - initializes all modules
 */

(async function() {
  'use strict';

  try {
    // Phase 0: Apply visibility settings immediately (before rendering)
    // This prevents "flash of hidden elements" issue
    const settings = await Storage.getSettings();
    applyInitialVisibility(settings);

    // Phase 1: Immediate (no async, no network)
    Clock.init();

    // Phase 2: Load positions (needed before rendering)
    await Drag.init();

    // Phase 3: Parallel loading (independent modules with network requests)
    await Promise.all([
      Wallpaper.init(),
      Quote.init(),
      Search.init(),
      Shortcuts.init()
    ]);

    // Phase 4: Settings (after all modules ready)
    await Settings.init();

    console.log('New Tab initialized successfully');
  } catch (error) {
    console.error('Error initializing New Tab:', error);
  }
})();

/**
 * Apply visibility settings before modules render
 * Uses === false to ensure undefined is treated as visible
 */
function applyInitialVisibility(settings) {
  document.getElementById('clock-container').classList.toggle('hidden', settings.showClock === false);
  document.getElementById('search-container').classList.toggle('hidden', settings.showSearch === false);
  document.getElementById('quote-container').classList.toggle('hidden', settings.showQuote === false);
  document.getElementById('shortcuts-container').classList.toggle('hidden', settings.showShortcuts === false);
}
