/**
 * Quote module - handles Hitokoto API
 */

const Quote = {
  textElement: null,
  sourceElement: null,
  maxRetries: 3,
  retryDelay: 1000,

  /**
   * Initialize quote
   */
  async init() {
    this.textElement = document.getElementById('quote-text');
    this.sourceElement = document.getElementById('quote-source');

    // Try to load cached quote first for immediate display
    const cached = sessionStorage.getItem('hitokoto_cache');
    if (cached) {
      try {
        this.display(JSON.parse(cached));
      } catch (e) {
        // Ignore cache parse errors
      }
    }

    // Fetch new quote
    await this.fetch();
  },

  /**
   * Fetch quote from Hitokoto API with retry
   */
  async fetch(retryCount = 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch('https://v1.hitokoto.cn/', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Cache the result
      sessionStorage.setItem('hitokoto_cache', JSON.stringify(data));

      this.display(data);
    } catch (error) {
      // Retry on failure
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.fetch(retryCount + 1);
      }

      console.warn('Quote fetch failed after retries:', error.message);
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
