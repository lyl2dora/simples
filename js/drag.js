/**
 * 拖拽模块 - 处理元素拖拽和定位
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
  gridSize: 5, // 对齐到 5% 网格
  guideLines: null,

  /**
   * 初始化拖拽功能
   */
  async init() {
    // 获取保存的位置
    const settings = await Storage.getSettings();
    this.positions = settings.positions || Storage.defaults.positions;

    // 初始化可拖拽元素
    document.querySelectorAll('.draggable-element').forEach(el => {
      const id = el.dataset.elementId;
      this.elements[id] = el;
      this.setPosition(id, this.positions[id] || Storage.defaults.positions[id]);
    });

    // 创建辅助线
    this.createGuideLines();

    // 绑定事件
    this.bindEvents();
  },

  /**
   * 创建居中辅助线
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
   * 设置元素位置（百分比）
   */
  setPosition(id, pos) {
    const el = this.elements[id];
    if (!el || !pos) return;

    // 存储位置
    this.positions[id] = pos;

    // 对于搜索容器，避免使用 translateX 以防止光标定位问题
    // 改用 left/right 值进行水平定位
    if (id === 'search') {
      el.style.top = `${pos.y}%`;
      el.style.transform = 'translateY(-50%)';
      // 使用 left 和 right 计算水平位置
      // 当 pos.x = 50 时，居中元素（left: 0, right: 0, margin: auto）
      // 当 pos.x < 50 时，向左偏移；当 pos.x > 50 时，向右偏移
      const offset = (pos.x - 50) * 2; // 将中心位置转换为偏移百分比
      if (offset === 0) {
        el.style.left = '0';
        el.style.right = '0';
      } else if (offset < 0) {
        // 向左偏移
        el.style.left = '0';
        el.style.right = `${-offset}%`;
      } else {
        // 向右偏移
        el.style.left = `${offset}%`;
        el.style.right = '0';
      }
    } else {
      // 应用位置（将元素中心对齐到百分比点）
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
      el.style.transform = 'translate(-50%, -50%)';
    }
  },

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 拖拽的鼠标事件
    document.querySelectorAll('.draggable-element').forEach(el => {
      el.addEventListener('mousedown', (e) => this.onMouseDown(e, el));
    });

    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseUp());

    // 移动端触摸事件
    document.querySelectorAll('.draggable-element').forEach(el => {
      el.addEventListener('touchstart', (e) => this.onTouchStart(e, el), { passive: false });
    });

    document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    document.addEventListener('touchend', () => this.onMouseUp());

    // 右键点击退出编辑模式
    document.addEventListener('contextmenu', (e) => this.onContextMenu(e));
  },

  /**
   * 右键菜单处理 - 右键点击退出编辑模式
   */
  onContextMenu(e) {
    if (!document.body.classList.contains('edit-mode')) return;

    // 检查是否点击在主容器或可拖拽元素上（不是在快捷链接右键菜单区域）
    const isInMainArea = e.target.closest('#main-container') ||
                         e.target.closest('.draggable-element') ||
                         e.target === document.body;

    // 不干扰快捷链接的右键菜单
    const isShortcutItem = e.target.closest('.shortcut-item');
    if (isShortcutItem) return;

    if (isInMainArea) {
      e.preventDefault();
      this.exitEditMode();
    }
  },

  /**
   * 退出编辑模式并更新 UI
   */
  async exitEditMode() {
    this.disableEditMode();
    await Storage.saveSetting('editMode', false);

    // 如果可见，更新设置复选框
    const editModeCheckbox = document.getElementById('setting-edit-mode');
    if (editModeCheckbox) {
      editModeCheckbox.checked = false;
    }
  },

  /**
   * 鼠标按下处理
   */
  onMouseDown(e, el) {
    // 只在编辑模式下拖拽
    if (!document.body.classList.contains('edit-mode')) return;

    // 在编辑模式下，即使在 input/button 元素上也允许拖拽
    // 元素本身将被拖拽，而不是交互
    e.preventDefault();
    e.stopPropagation();
    this.startDrag(e.clientX, e.clientY, el);
  },

  /**
   * 触摸开始处理
   */
  onTouchStart(e, el) {
    if (!document.body.classList.contains('edit-mode')) return;

    const touch = e.touches[0];
    e.preventDefault();
    this.startDrag(touch.clientX, touch.clientY, el);
  },

  /**
   * 开始拖拽
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
   * 鼠标移动处理
   */
  onMouseMove(e) {
    if (!this.isDragging) return;
    this.updatePosition(e.clientX, e.clientY);
  },

  /**
   * 触摸移动处理
   */
  onTouchMove(e) {
    if (!this.isDragging) return;
    const touch = e.touches[0];
    e.preventDefault();
    this.updatePosition(touch.clientX, touch.clientY);
  },

  /**
   * 拖拽时更新元素位置
   */
  updatePosition(clientX, clientY) {
    const deltaX = clientX - this.startX;
    const deltaY = clientY - this.startY;

    // 将像素差转换为百分比
    const percentX = (deltaX / window.innerWidth) * 100;
    const percentY = (deltaY / window.innerHeight) * 100;

    let newX = this.elementStartX + percentX;
    let newY = this.elementStartY + percentY;

    // 限制在视口内（带边距）
    const padding = 5;
    newX = Math.max(padding, Math.min(100 - padding, newX));
    newY = Math.max(padding, Math.min(100 - padding, newY));

    // 对齐到网格
    newX = Math.round(newX / this.gridSize) * this.gridSize;
    newY = Math.round(newY / this.gridSize) * this.gridSize;

    // 接近中心时显示辅助线
    this.updateGuideLines(newX, newY);

    // 应用位置
    const id = this.currentElement.dataset.elementId;
    this.setPosition(id, { x: newX, y: newY });
  },

  /**
   * 更新辅助线可见性
   */
  updateGuideLines(x, y) {
    const threshold = 2; // 距中心 2% 以内时显示

    // 垂直中心线
    if (Math.abs(x - 50) < threshold) {
      this.guideLines.vertical.classList.add('show');
      // 吸附到中心
      const id = this.currentElement.dataset.elementId;
      this.positions[id].x = 50;
      this.currentElement.style.left = '50%';
    } else {
      this.guideLines.vertical.classList.remove('show');
    }

    // 水平中心线
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
   * 鼠标释放处理
   */
  async onMouseUp() {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.currentElement.classList.remove('dragging');

    // 隐藏辅助线
    this.guideLines.vertical.classList.remove('show');
    this.guideLines.horizontal.classList.remove('show');

    // 保存位置
    await this.savePositions();

    this.currentElement = null;
  },

  /**
   * 保存所有位置到存储
   */
  async savePositions() {
    await Storage.saveSetting('positions', this.positions);
  },

  /**
   * 重置位置为默认值
   */
  async resetPositions() {
    this.positions = { ...Storage.defaults.positions };

    Object.keys(this.elements).forEach(id => {
      this.setPosition(id, this.positions[id]);
    });

    await this.savePositions();
  },

  /**
   * 启用编辑模式
   */
  enableEditMode() {
    document.body.classList.add('edit-mode');
  },

  /**
   * 禁用编辑模式
   */
  disableEditMode() {
    document.body.classList.remove('edit-mode');
  },

  /**
   * 切换编辑模式
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

// 暴露到全局
window.Drag = Drag;
