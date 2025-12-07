/**
 * Main entry point - initializes all modules
 */

(async function() {
  'use strict';

  // Initialize modules in order
  try {
    // Initialize clock first (immediate visual feedback)
    Clock.init();

    // Initialize drag functionality
    await Drag.init();

    // Initialize wallpaper (may take time to load)
    await Wallpaper.init();

    // Initialize quote
    await Quote.init();

    // Initialize search
    await Search.init();

    // Initialize shortcuts
    await Shortcuts.init();

    // Initialize settings (last, after all modules are ready)
    await Settings.init();

    console.log('New Tab initialized successfully');
  } catch (error) {
    console.error('Error initializing New Tab:', error);
  }
})();
