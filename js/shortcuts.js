/**
 * Shortcuts module - handles quick link management
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
   * Initialize shortcuts
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
   * Set grid columns
   */
  setGridColumns(count) {
    this.gridElement.style.setProperty('--shortcuts-per-row', count);
  },

  /**
   * Render shortcuts
   */
  render() {
    this.gridElement.innerHTML = '';

    // Render existing shortcuts
    this.shortcuts.forEach(shortcut => {
      const item = this.createShortcutElement(shortcut);
      this.gridElement.appendChild(item);
    });

    // Add "add" button
    const addButton = this.createAddButton();
    this.gridElement.appendChild(addButton);
  },

  /**
   * Create shortcut element
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

    // Set icon
    this.setIcon(iconImg, iconLetter, shortcut);

    // Click to open link
    item.addEventListener('click', (e) => {
      if (!document.body.classList.contains('edit-mode')) {
        window.open(shortcut.url, '_blank');
      }
    });

    // Right click for context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, shortcut.id);
    });

    return item;
  },

  /**
   * Set icon for shortcut
   */
  async setIcon(imgEl, letterEl, shortcut) {
    // Check for custom uploaded icon first
    if (this.icons[shortcut.id]) {
      imgEl.src = this.icons[shortcut.id];
      imgEl.classList.remove('hidden');
      letterEl.classList.add('hidden');
      return;
    }

    // Try to get favicon
    const url = new URL(shortcut.url);
    const domain = url.hostname;

    // Try direct favicon.ico first
    const faviconUrl = `${url.origin}/favicon.ico`;

    imgEl.src = faviconUrl;
    imgEl.classList.remove('hidden');
    letterEl.classList.add('hidden');

    imgEl.onerror = () => {
      // Fallback to Google S2
      const googleFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      imgEl.src = googleFavicon;

      imgEl.onerror = () => {
        // Final fallback: show letter
        imgEl.classList.add('hidden');
        letterEl.classList.remove('hidden');
        letterEl.textContent = shortcut.name.charAt(0).toUpperCase();
      };
    };
  },

  /**
   * Create add button
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
   * Bind event listeners
   */
  bindEvents() {
    // Context menu actions
    this.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.handleContextMenuAction(action);
      });
    });

    // Close context menu on click outside
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    // Dialog events
    this.dialogOverlay.addEventListener('click', () => {
      this.closeDialog();
    });

    document.getElementById('shortcut-cancel-btn').addEventListener('click', () => {
      this.closeDialog();
    });

    document.getElementById('shortcut-save-btn').addEventListener('click', () => {
      this.saveShortcut();
    });

    // Icon source tabs
    document.querySelectorAll('.icon-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.icon-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const source = tab.dataset.source;
        document.getElementById('icon-upload-area').style.display =
          source === 'upload' ? 'block' : 'none';
      });
    });

    // Icon upload
    document.getElementById('shortcut-icon-input').addEventListener('change', (e) => {
      this.handleIconUpload(e.target.files[0]);
    });
  },

  /**
   * Show context menu
   */
  showContextMenu(e, shortcutId) {
    this.currentEditId = shortcutId;
    this.contextMenu.style.left = `${e.clientX}px`;
    this.contextMenu.style.top = `${e.clientY}px`;
    this.contextMenu.classList.add('show');
  },

  /**
   * Hide context menu
   */
  hideContextMenu() {
    this.contextMenu.classList.remove('show');
  },

  /**
   * Handle context menu action
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
   * Open add/edit dialog
   */
  openDialog(editId = null) {
    this.currentEditId = editId;

    const title = document.getElementById('shortcut-dialog-title');
    const nameInput = document.getElementById('shortcut-name-input');
    const urlInput = document.getElementById('shortcut-url-input');
    const iconPreview = document.getElementById('icon-preview');

    // Reset form
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

        // Show custom icon if exists
        if (this.icons[editId]) {
          document.querySelector('.icon-tab[data-source="upload"]').click();
          iconPreview.innerHTML = `<img src="${this.icons[editId]}" alt="Icon">`;
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
   * Close dialog
   */
  closeDialog() {
    this.dialog.classList.remove('show');
    this.dialogOverlay.classList.remove('show');
    this.currentEditId = null;
  },

  /**
   * Handle icon upload
   */
  handleIconUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const iconPreview = document.getElementById('icon-preview');
      iconPreview.innerHTML = `<img src="${e.target.result}" alt="Icon">`;
      iconPreview.dataset.iconData = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  /**
   * Save shortcut
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

    // Add protocol if missing
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      alert('请输入有效的网址');
      return;
    }

    const iconData = iconPreview.dataset.iconData;

    if (this.currentEditId) {
      // Edit existing
      const index = this.shortcuts.findIndex(s => s.id === this.currentEditId);
      if (index !== -1) {
        this.shortcuts[index].name = name;
        this.shortcuts[index].url = url;

        // Update icon if uploaded
        if (iconData) {
          await Storage.saveShortcutIcon(this.currentEditId, iconData);
          this.icons[this.currentEditId] = iconData;
        }
      }
    } else {
      // Add new
      const id = 'shortcut_' + Date.now();
      this.shortcuts.push({ id, name, url });

      // Save icon if uploaded
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
   * Delete shortcut
   */
  async deleteShortcut(id) {
    const index = this.shortcuts.findIndex(s => s.id === id);
    if (index !== -1) {
      this.shortcuts.splice(index, 1);
      await Storage.saveSetting('shortcuts', this.shortcuts);

      // Remove icon if exists
      if (this.icons[id]) {
        await Storage.removeShortcutIcon(id);
        delete this.icons[id];
      }

      this.render();
    }
  },

  /**
   * Update settings
   */
  async updateSettings() {
    this.settings = await Storage.getSettings();
    this.setGridColumns(this.settings.shortcutsPerRow);
  }
};

// Make available globally
window.Shortcuts = Shortcuts;
