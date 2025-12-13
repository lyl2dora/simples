/**
 * 快捷链接模块 - 处理快捷链接管理
 */

const Shortcuts = {
  gridElement: null,
  contextMenu: null,
  dialog: null,
  dialogOverlay: null,
  currentEditId: null,
  settings: null,
  shortcuts: [],
  icons: {},

  /**
   * 初始化快捷链接
   */
  async init() {
    this.gridElement = document.getElementById('shortcuts-grid');
    this.contextMenu = document.getElementById('shortcut-context-menu');
    this.dialog = document.getElementById('shortcut-dialog');
    this.dialogOverlay = document.getElementById('shortcut-dialog-overlay');

    this.settings = await Storage.getSettings();
    this.shortcuts = this.settings.shortcuts || [];
    this.icons = await Storage.getShortcutIcons();

    this.setGridColumns(this.settings.shortcutsPerRow);
    this.render();
    this.bindEvents();
  },

  /**
   * 设置网格列数
   */
  setGridColumns(count) {
    this.gridElement.style.setProperty('--shortcuts-per-row', count);
  },

  /**
   * 渲染快捷链接
   */
  render() {
    this.gridElement.innerHTML = '';

    // 渲染现有快捷链接
    this.shortcuts.forEach(shortcut => {
      const item = this.createShortcutElement(shortcut);
      this.gridElement.appendChild(item);
    });

    // 添加"添加"按钮
    const addButton = this.createAddButton();
    this.gridElement.appendChild(addButton);
  },

  /**
   * 创建快捷链接元素
   */
  createShortcutElement(shortcut) {
    const template = document.getElementById('shortcut-template');
    const clone = template.content.cloneNode(true);
    const item = clone.querySelector('.shortcut-item');

    item.dataset.id = shortcut.id;

    const iconImg = item.querySelector('.shortcut-icon img');
    const iconLetter = item.querySelector('.shortcut-letter');
    const nameEl = item.querySelector('.shortcut-name');

    nameEl.textContent = shortcut.name;
    nameEl.title = shortcut.name;

    // 设置图标
    this.setIcon(iconImg, iconLetter, shortcut);

    // 点击打开链接
    item.addEventListener('click', (e) => {
      if (!document.body.classList.contains('edit-mode')) {
        window.open(shortcut.url, '_blank');
      }
    });

    // 右键显示上下文菜单
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, shortcut.id);
    });

    return item;
  },

  /**
   * 使用 Chrome Favicon API 设置快捷链接图标
   */
  async setIcon(imgEl, letterEl, shortcut) {
    // 首先检查自定义上传的图标
    if (this.icons[shortcut.id]) {
      imgEl.src = this.icons[shortcut.id];
      imgEl.classList.remove('hidden');
      letterEl.classList.add('hidden');
      return;
    }

    // 使用 Chrome Favicon API（需要 "favicon" 权限）
    const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(shortcut.url)}&size=64`;

    imgEl.classList.remove('hidden');
    letterEl.classList.add('hidden');
    imgEl.src = faviconUrl;

    // 如果图标加载失败，回退到首字母
    imgEl.onerror = () => {
      imgEl.classList.add('hidden');
      letterEl.classList.remove('hidden');
      letterEl.textContent = shortcut.name.charAt(0).toUpperCase();
    };
  },

  /**
   * 创建添加按钮
   */
  createAddButton() {
    const template = document.getElementById('add-shortcut-template');
    const clone = template.content.cloneNode(true);
    const item = clone.querySelector('.shortcut-item');

    item.addEventListener('click', () => {
      this.openDialog();
    });

    return item;
  },

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 上下文菜单操作
    this.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.handleContextMenuAction(action);
      });
    });

    // 点击外部关闭上下文菜单
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    // 对话框事件
    this.dialogOverlay.addEventListener('click', () => {
      this.closeDialog();
    });

    document.getElementById('shortcut-cancel-btn').addEventListener('click', () => {
      this.closeDialog();
    });

    document.getElementById('shortcut-save-btn').addEventListener('click', () => {
      this.saveShortcut();
    });

    // 图标来源切换
    document.querySelectorAll('.icon-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.icon-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const source = tab.dataset.source;
        document.getElementById('icon-upload-area').style.display =
          source === 'upload' ? 'block' : 'none';
      });
    });

    // 图标上传
    document.getElementById('shortcut-icon-input').addEventListener('change', (e) => {
      this.handleIconUpload(e.target.files[0]);
    });
  },

  /**
   * 显示上下文菜单
   */
  showContextMenu(e, shortcutId) {
    this.currentEditId = shortcutId;
    this.contextMenu.style.left = `${e.clientX}px`;
    this.contextMenu.style.top = `${e.clientY}px`;
    this.contextMenu.classList.add('show');
  },

  /**
   * 隐藏上下文菜单
   */
  hideContextMenu() {
    this.contextMenu.classList.remove('show');
  },

  /**
   * 处理上下文菜单操作
   */
  handleContextMenuAction(action) {
    this.hideContextMenu();

    switch (action) {
      case 'edit':
        this.openDialog(this.currentEditId);
        break;
      case 'delete':
        this.deleteShortcut(this.currentEditId);
        break;
    }
  },

  /**
   * 打开添加/编辑对话框
   */
  openDialog(editId = null) {
    this.currentEditId = editId;

    const title = document.getElementById('shortcut-dialog-title');
    const nameInput = document.getElementById('shortcut-name-input');
    const urlInput = document.getElementById('shortcut-url-input');
    const iconPreview = document.getElementById('icon-preview');

    // 重置表单
    nameInput.value = '';
    urlInput.value = '';
    iconPreview.innerHTML = '';
    document.querySelectorAll('.icon-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.icon-tab[data-source="auto"]').classList.add('active');
    document.getElementById('icon-upload-area').style.display = 'none';
    document.getElementById('shortcut-icon-input').value = '';

    if (editId) {
      title.textContent = '编辑快捷链接';
      const shortcut = this.shortcuts.find(s => s.id === editId);
      if (shortcut) {
        nameInput.value = shortcut.name;
        urlInput.value = shortcut.url;

        // 如果存在自定义图标则显示
        if (this.icons[editId]) {
          document.querySelector('.icon-tab[data-source="upload"]').click();
          iconPreview.innerHTML = `<img src="${this.icons[editId]}" alt="图标">`;
        }
      }
    } else {
      title.textContent = '添加快捷链接';
    }

    this.dialog.classList.add('show');
    this.dialogOverlay.classList.add('show');
    nameInput.focus();
  },

  /**
   * 关闭对话框
   */
  closeDialog() {
    this.dialog.classList.remove('show');
    this.dialogOverlay.classList.remove('show');
    this.currentEditId = null;
  },

  /**
   * 处理图标上传
   */
  handleIconUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const iconPreview = document.getElementById('icon-preview');
      iconPreview.innerHTML = `<img src="${e.target.result}" alt="图标">`;
      iconPreview.dataset.iconData = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  /**
   * 保存快捷链接
   */
  async saveShortcut() {
    const nameInput = document.getElementById('shortcut-name-input');
    const urlInput = document.getElementById('shortcut-url-input');
    const iconPreview = document.getElementById('icon-preview');

    const name = nameInput.value.trim();
    let url = urlInput.value.trim();

    if (!name || !url) {
      alert('请填写名称和网址');
      return;
    }

    // 如果缺少协议则添加
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }

    // 验证 URL
    try {
      new URL(url);
    } catch {
      alert('请输入有效的网址');
      return;
    }

    const iconData = iconPreview.dataset.iconData;

    if (this.currentEditId) {
      // 编辑现有
      const index = this.shortcuts.findIndex(s => s.id === this.currentEditId);
      if (index !== -1) {
        this.shortcuts[index].name = name;
        this.shortcuts[index].url = url;

        // 如果上传了新图标则更新
        if (iconData) {
          await Storage.saveShortcutIcon(this.currentEditId, iconData);
          this.icons[this.currentEditId] = iconData;
        }
      }
    } else {
      // 添加新的
      const id = 'shortcut_' + Date.now();
      this.shortcuts.push({ id, name, url });

      // 如果上传了图标则保存
      if (iconData) {
        await Storage.saveShortcutIcon(id, iconData);
        this.icons[id] = iconData;
      }
    }

    await Storage.saveSetting('shortcuts', this.shortcuts);
    this.closeDialog();
    this.render();
  },

  /**
   * 删除快捷链接
   */
  async deleteShortcut(id) {
    const index = this.shortcuts.findIndex(s => s.id === id);
    if (index !== -1) {
      this.shortcuts.splice(index, 1);
      await Storage.saveSetting('shortcuts', this.shortcuts);

      // 如果存在图标则删除
      if (this.icons[id]) {
        await Storage.removeShortcutIcon(id);
        delete this.icons[id];
      }

      this.render();
    }
  },

  /**
   * 更新设置
   */
  async updateSettings() {
    this.settings = await Storage.getSettings();
    this.setGridColumns(this.settings.shortcutsPerRow);
  }
};

// 暴露到全局
window.Shortcuts = Shortcuts;
