/**
 * 搜索模块 - 使用 Chrome 搜索 API 和 Google 建议处理搜索
 */

const Search = {
  inputElement: null,
  suggestionsElement: null,
  suggestions: [],
  selectedIndex: -1,
  debounceTimer: null,
  settings: null,

  /**
   * 初始化搜索
   */
  async init() {
    this.inputElement = document.getElementById('search-input');
    this.suggestionsElement = document.getElementById('search-suggestions');
    this.settings = await Storage.getSettings();

    this.bindEvents();
  },

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 带防抖的输入事件
    this.inputElement.addEventListener('input', (e) => {
      this.onInput(e.target.value);
    });

    // 键盘导航
    this.inputElement.addEventListener('keydown', (e) => {
      this.onKeyDown(e);
    });

    // 聚焦/失焦事件
    this.inputElement.addEventListener('focus', () => {
      if (this.suggestions.length > 0) {
        this.showSuggestions();
      }
    });

    // 点击外部关闭建议
    document.addEventListener('click', (e) => {
      if (!this.inputElement.contains(e.target) && !this.suggestionsElement.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    // 建议的事件委托
    this.suggestionsElement.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        this.inputElement.value = this.suggestions[index];
        this.executeSearch();
      }
    });

    this.suggestionsElement.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        this.selectedIndex = parseInt(item.dataset.index);
        this.updateSelection();
      }
    });
  },

  /**
   * 处理输入
   */
  onInput(value) {
    // 清除之前的计时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (!value.trim()) {
      this.hideSuggestions();
      return;
    }

    // 防抖建议请求（300毫秒）
    this.debounceTimer = setTimeout(async () => {
      if (this.settings.searchSuggestions) {
        await this.fetchSuggestions(value);
      }
    }, 300);
  },

  /**
   * 处理键盘导航
   */
  onKeyDown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious();
        break;

      case 'Enter':
        e.preventDefault();
        this.executeSearch();
        break;

      case 'Escape':
        this.hideSuggestions();
        this.inputElement.blur();
        break;
    }
  },

  /**
   * 从 Google 获取搜索建议
   */
  async fetchSuggestions(query) {
    try {
      const response = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (data && data[1] && Array.isArray(data[1])) {
        this.suggestions = data[1].slice(0, 8); // 限制为8个建议
        this.selectedIndex = -1;
        this.renderSuggestions();
        this.showSuggestions();
      }
    } catch (error) {
      console.error('获取搜索建议出错:', error);
      this.suggestions = [];
      this.hideSuggestions();
    }
  },

  /**
   * 渲染建议列表
   */
  renderSuggestions() {
    if (this.suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.suggestionsElement.innerHTML = this.suggestions.map((suggestion, index) => `
      <div class="suggestion-item${index === this.selectedIndex ? ' selected' : ''}" data-index="${index}">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
        </svg>
        <span>${this.escapeHtml(suggestion)}</span>
      </div>
    `).join('');
  },

  /**
   * 显示建议下拉框
   */
  showSuggestions() {
    if (this.suggestions.length > 0) {
      this.suggestionsElement.classList.add('show');
    }
  },

  /**
   * 隐藏建议下拉框
   */
  hideSuggestions() {
    this.suggestionsElement.classList.remove('show');
    this.selectedIndex = -1;
  },

  /**
   * 选择下一个建议
   */
  selectNext() {
    if (this.suggestions.length === 0) return;

    this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
    this.updateSelection();
    this.inputElement.value = this.suggestions[this.selectedIndex];
  },

  /**
   * 选择上一个建议
   */
  selectPrevious() {
    if (this.suggestions.length === 0) return;

    this.selectedIndex = this.selectedIndex <= 0
      ? this.suggestions.length - 1
      : this.selectedIndex - 1;
    this.updateSelection();
    this.inputElement.value = this.suggestions[this.selectedIndex];
  },

  /**
   * 更新选中高亮
   */
  updateSelection() {
    const items = this.suggestionsElement.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });
  },

  /**
   * 使用 Chrome 搜索 API 执行搜索
   */
  executeSearch() {
    const query = this.inputElement.value.trim();
    if (!query) return;

    this.hideSuggestions();

    // 使用 Chrome 搜索 API
    const disposition = this.settings.searchTarget === 'new' ? 'NEW_TAB' : 'CURRENT_TAB';

    chrome.search.query({
      text: query,
      disposition: disposition
    });
  },

  /**
   * 转义 HTML 特殊字符
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 更新设置
   */
  async updateSettings() {
    this.settings = await Storage.getSettings();
  }
};

// 暴露到全局
window.Search = Search;
