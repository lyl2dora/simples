/**
 * Quote module - handles Hitokoto API
 */

const Quote = {
  textElement: null,
  sourceElement: null,

  /**
   * Initialize quote
   */
  async init() {
    this.textElement = document.getElementById('quote-text');
    this.sourceElement = document.getElementById('quote-source');

    await this.fetch();
  },

  /**
   * Fetch quote from Hitokoto API
   */
  async fetch() {
    try {
      const response = await fetch('https://v1.hitokoto.cn/');
      const data = await response.json();

      this.display(data);
    } catch (error) {
      console.error('Error fetching quote:', error);
      this.displayFallback();
    }
  },

  /**
   * Display quote
   */
  display(data) {
    if (data && data.hitokoto) {
      this.textElement.textContent = data.hitokoto;

      // Build source text
      let source = '';
      if (data.from_who) {
        source = data.from_who;
      }
      if (data.from) {
        source += source ? ` 「${data.from}」` : data.from;
      }

      this.sourceElement.textContent = source || '一言';
      this.sourceElement.style.display = source ? 'block' : 'none';
    } else {
      this.displayFallback();
    }
  },

  /**
   * Display fallback quote
   */
  displayFallback() {
    this.textElement.textContent = '生活不止眼前的苟且，还有诗和远方。';
    this.sourceElement.textContent = '高晓松';
  },

  /**
   * Refresh quote
   */
  async refresh() {
    await this.fetch();
  }
};

// Make available globally
window.Quote = Quote;
