/**
 * Search module - handles search with Chrome Search API and Google suggestions
 */

const Search = {
  inputElement: null,
  suggestionsElement: null,
  suggestions: [],
  selectedIndex: -1,
  debounceTimer: null,
  settings: null,

  /**
   * Initialize search
   */
  async init() {
    this.inputElement = document.getElementById('search-input');
    this.suggestionsElement = document.getElementById('search-suggestions');
    this.settings = await Storage.getSettings();

    this.bindEvents();
  },

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Input event with debounce
    this.inputElement.addEventListener('input', (e) => {
      this.onInput(e.target.value);
    });

    // Keyboard navigation
    this.inputElement.addEventListener('keydown', (e) => {
      this.onKeyDown(e);
    });

    // Focus/blur events
    this.inputElement.addEventListener('focus', () => {
      if (this.suggestions.length > 0) {
        this.showSuggestions();
      }
    });

    // Click outside to close suggestions
    document.addEventListener('click', (e) => {
      if (!this.inputElement.contains(e.target) && !this.suggestionsElement.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    // Event delegation for suggestions
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
   * Handle input
   */
  onInput(value) {
    // Clear previous timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (!value.trim()) {
      this.hideSuggestions();
      return;
    }

    // Debounce suggestions request (300ms)
    this.debounceTimer = setTimeout(async () => {
      if (this.settings.searchSuggestions) {
        await this.fetchSuggestions(value);
      }
    }, 300);
  },

  /**
   * Handle keyboard navigation
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
   * Fetch suggestions from Google
   */
  async fetchSuggestions(query) {
    try {
      const response = await fetch(
        `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (data && data[1] && Array.isArray(data[1])) {
        this.suggestions = data[1].slice(0, 8); // Limit to 8 suggestions
        this.selectedIndex = -1;
        this.renderSuggestions();
        this.showSuggestions();
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      this.suggestions = [];
      this.hideSuggestions();
    }
  },

  /**
   * Render suggestions list
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
   * Show suggestions dropdown
   */
  showSuggestions() {
    if (this.suggestions.length > 0) {
      this.suggestionsElement.classList.add('show');
    }
  },

  /**
   * Hide suggestions dropdown
   */
  hideSuggestions() {
    this.suggestionsElement.classList.remove('show');
    this.selectedIndex = -1;
  },

  /**
   * Select next suggestion
   */
  selectNext() {
    if (this.suggestions.length === 0) return;

    this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
    this.updateSelection();
    this.inputElement.value = this.suggestions[this.selectedIndex];
  },

  /**
   * Select previous suggestion
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
   * Update selection highlight
   */
  updateSelection() {
    const items = this.suggestionsElement.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });
  },

  /**
   * Execute search using Chrome Search API
   */
  executeSearch() {
    const query = this.inputElement.value.trim();
    if (!query) return;

    this.hideSuggestions();

    // Use Chrome Search API
    const disposition = this.settings.searchTarget === 'new' ? 'NEW_TAB' : 'CURRENT_TAB';

    chrome.search.query({
      text: query,
      disposition: disposition
    });
  },

  /**
   * Escape HTML special characters
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Update settings
   */
  async updateSettings() {
    this.settings = await Storage.getSettings();
  }
};

// Make available globally
window.Search = Search;
