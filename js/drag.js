/**
 * Drag module - handles element dragging and positioning
 */

const Drag = {
  elements: {},
  positions: {},
  isDragging: false,
  currentElement: null,
  startX: 0,
  startY: 0,
  elementStartX: 0,
  elementStartY: 0,
  gridSize: 5, // Snap to 5% grid
  guideLines: null,

  /**
   * Initialize drag functionality
   */
  async init() {
    // Get saved positions
    const settings = await Storage.getSettings();
    this.positions = settings.positions || Storage.defaults.positions;

    // Initialize draggable elements
    document.querySelectorAll('.draggable-element').forEach(el => {
      const id = el.dataset.elementId;
      this.elements[id] = el;
      this.setPosition(id, this.positions[id] || Storage.defaults.positions[id]);
    });

    // Create guide lines
    this.createGuideLines();

    // Bind events
    this.bindEvents();
  },

  /**
   * Create guide lines for centering assistance
   */
  createGuideLines() {
    const container = document.getElementById('main-container');

    const verticalLine = document.createElement('div');
    verticalLine.className = 'guide-line vertical';
    container.appendChild(verticalLine);

    const horizontalLine = document.createElement('div');
    horizontalLine.className = 'guide-line horizontal';
    container.appendChild(horizontalLine);

    this.guideLines = {
      vertical: verticalLine,
      horizontal: horizontalLine
    };
  },

  /**
   * Set element position (in percentage)
   */
  setPosition(id, pos) {
    const el = this.elements[id];
    if (!el || !pos) return;

    // Store position
    this.positions[id] = pos;

    // Apply position (center the element at the percentage point)
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
    el.style.transform = 'translate(-50%, -50%)';
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Mouse events for dragging
    document.querySelectorAll('.draggable-element').forEach(el => {
      el.addEventListener('mousedown', (e) => this.onMouseDown(e, el));
    });

    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseUp());

    // Touch events for mobile
    document.querySelectorAll('.draggable-element').forEach(el => {
      el.addEventListener('touchstart', (e) => this.onTouchStart(e, el), { passive: false });
    });

    document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    document.addEventListener('touchend', () => this.onMouseUp());

    // Right-click to exit edit mode
    document.addEventListener('contextmenu', (e) => this.onContextMenu(e));
  },

  /**
   * Context menu handler - right-click to exit edit mode
   */
  onContextMenu(e) {
    if (!document.body.classList.contains('edit-mode')) return;

    // Check if clicking on main container or draggable elements (not on shortcuts context menu area)
    const isInMainArea = e.target.closest('#main-container') ||
                         e.target.closest('.draggable-element') ||
                         e.target === document.body;

    // Don't interfere with shortcut context menu
    const isShortcutItem = e.target.closest('.shortcut-item');
    if (isShortcutItem) return;

    if (isInMainArea) {
      e.preventDefault();
      this.exitEditMode();
    }
  },

  /**
   * Exit edit mode and update UI
   */
  async exitEditMode() {
    this.disableEditMode();
    await Storage.saveSetting('editMode', false);

    // Update settings checkbox if visible
    const editModeCheckbox = document.getElementById('setting-edit-mode');
    if (editModeCheckbox) {
      editModeCheckbox.checked = false;
    }
  },

  /**
   * Mouse down handler
   */
  onMouseDown(e, el) {
    // Only drag in edit mode
    if (!document.body.classList.contains('edit-mode')) return;

    // In edit mode, allow dragging even on input/button elements
    // The element itself will be dragged, not interacted with
    e.preventDefault();
    e.stopPropagation();
    this.startDrag(e.clientX, e.clientY, el);
  },

  /**
   * Touch start handler
   */
  onTouchStart(e, el) {
    if (!document.body.classList.contains('edit-mode')) return;

    const touch = e.touches[0];
    e.preventDefault();
    this.startDrag(touch.clientX, touch.clientY, el);
  },

  /**
   * Start dragging
   */
  startDrag(clientX, clientY, el) {
    this.isDragging = true;
    this.currentElement = el;
    this.startX = clientX;
    this.startY = clientY;

    const id = el.dataset.elementId;
    this.elementStartX = this.positions[id].x;
    this.elementStartY = this.positions[id].y;

    el.classList.add('dragging');
  },

  /**
   * Mouse move handler
   */
  onMouseMove(e) {
    if (!this.isDragging) return;
    this.updatePosition(e.clientX, e.clientY);
  },

  /**
   * Touch move handler
   */
  onTouchMove(e) {
    if (!this.isDragging) return;
    const touch = e.touches[0];
    e.preventDefault();
    this.updatePosition(touch.clientX, touch.clientY);
  },

  /**
   * Update element position during drag
   */
  updatePosition(clientX, clientY) {
    const deltaX = clientX - this.startX;
    const deltaY = clientY - this.startY;

    // Convert pixel delta to percentage
    const percentX = (deltaX / window.innerWidth) * 100;
    const percentY = (deltaY / window.innerHeight) * 100;

    let newX = this.elementStartX + percentX;
    let newY = this.elementStartY + percentY;

    // Constrain to viewport (with padding)
    const padding = 5;
    newX = Math.max(padding, Math.min(100 - padding, newX));
    newY = Math.max(padding, Math.min(100 - padding, newY));

    // Snap to grid
    newX = Math.round(newX / this.gridSize) * this.gridSize;
    newY = Math.round(newY / this.gridSize) * this.gridSize;

    // Show guide lines when near center
    this.updateGuideLines(newX, newY);

    // Apply position
    const id = this.currentElement.dataset.elementId;
    this.setPosition(id, { x: newX, y: newY });
  },

  /**
   * Update guide lines visibility
   */
  updateGuideLines(x, y) {
    const threshold = 2; // Show when within 2% of center

    // Vertical center line
    if (Math.abs(x - 50) < threshold) {
      this.guideLines.vertical.classList.add('show');
      // Snap to center
      const id = this.currentElement.dataset.elementId;
      this.positions[id].x = 50;
      this.currentElement.style.left = '50%';
    } else {
      this.guideLines.vertical.classList.remove('show');
    }

    // Horizontal center line
    if (Math.abs(y - 50) < threshold) {
      this.guideLines.horizontal.classList.add('show');
      const id = this.currentElement.dataset.elementId;
      this.positions[id].y = 50;
      this.currentElement.style.top = '50%';
    } else {
      this.guideLines.horizontal.classList.remove('show');
    }
  },

  /**
   * Mouse up handler
   */
  async onMouseUp() {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.currentElement.classList.remove('dragging');

    // Hide guide lines
    this.guideLines.vertical.classList.remove('show');
    this.guideLines.horizontal.classList.remove('show');

    // Save positions
    await this.savePositions();

    this.currentElement = null;
  },

  /**
   * Save all positions to storage
   */
  async savePositions() {
    await Storage.saveSetting('positions', this.positions);
  },

  /**
   * Reset positions to defaults
   */
  async resetPositions() {
    this.positions = { ...Storage.defaults.positions };

    Object.keys(this.elements).forEach(id => {
      this.setPosition(id, this.positions[id]);
    });

    await this.savePositions();
  },

  /**
   * Enable edit mode
   */
  enableEditMode() {
    document.body.classList.add('edit-mode');
  },

  /**
   * Disable edit mode
   */
  disableEditMode() {
    document.body.classList.remove('edit-mode');
  },

  /**
   * Toggle edit mode
   */
  async toggleEditMode(enabled) {
    if (enabled) {
      this.enableEditMode();
    } else {
      this.disableEditMode();
    }
    await Storage.saveSetting('editMode', enabled);
  }
};

// Make available globally
window.Drag = Drag;
