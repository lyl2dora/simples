/**
 * Main entry point - initializes all modules
 */

(async function() {
  'use strict';

  try {
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
