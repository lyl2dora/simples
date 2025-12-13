/**
 * 一言模块 - 处理 Hitokoto API
 */

const Quote = {
  textElement: null,
  sourceElement: null,
  maxRetries: 3,
  retryDelay: 1000,

  /**
   * 初始化一言
   */
  async init() {
    this.textElement = document.getElementById('quote-text');
    this.sourceElement = document.getElementById('quote-source');

    // 尝试先加载缓存的一言以即时显示
    const cached = await Storage.getCachedQuote();
    if (cached) {
      this.display(cached);
    }

    // 获取新一言（不等待 - 让它在后台加载）
    this.fetch();
  },

  /**
   * 从 Hitokoto API 获取一言（带重试）
   */
  async fetch(retryCount = 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      const response = await fetch('https://v1.hitokoto.cn/', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // 缓存结果到 chrome.storage.local
      await Storage.saveQuoteCache(data);

      this.display(data);
    } catch (error) {
      // 失败时重试
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.fetch(retryCount + 1);
      }

      console.warn('一言获取失败（已重试）:', error.message);
      // 只有在没有缓存一言显示时才显示备用
      if (!await Storage.getCachedQuote()) {
        this.displayFallback();
      }
    }
  },

  /**
   * 显示一言
   */
  display(data) {
    if (data && data.hitokoto) {
      this.textElement.textContent = data.hitokoto;

      // 构建来源文本
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
   * 显示备用一言
   */
  displayFallback() {
    this.textElement.textContent = '生活不止眼前的苟且，还有诗和远方。';
    this.sourceElement.textContent = '高晓松';
  },

  /**
   * 刷新一言
   */
  async refresh() {
    await this.fetch();
  }
};

// 暴露到全局
window.Quote = Quote;
