/**
 * 加密货币模块 - 通过 Binance WebSocket 处理加密货币价格行情
 */

const Crypto = {
  ws: null,
  prices: {
    BTCUSDT: { price: '0.00', change: '0.00', changePercent: '0.00' },
    ETHUSDT: { price: '0.00', change: '0.00', changePercent: '0.00' }
  },
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,      // 初始重连延迟
  maxReconnectDelay: 30000,  // 最大重连延迟

  /**
   * 初始化加密货币行情
   */
  async init() {
    const settings = await Storage.getSettings();

    // 检查可见性
    if (settings.showCrypto === false) {
      document.getElementById('crypto-container').classList.add('hidden');
      return;
    }

    this.connect();
    this.render();
  },

  /**
   * 连接到 Binance WebSocket
   */
  connect() {
    // 如果存在连接，先关闭
    if (this.ws) {
      this.ws.close();
    }

    // 订阅多个数据流
    const streams = ['btcusdt@ticker', 'ethusdt@ticker'].join('/');
    this.ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.stream && data.data) {
          this.updatePrice(data.data);
        }
      } catch (error) {
        console.error('解析加密货币数据出错:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('加密货币 WebSocket 错误:', error);
    };

    this.ws.onclose = () => {
      // 使用指数退避策略尝试重连
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        // 指数退避：3s, 6s, 12s, 24s, 30s (上限)
        const delay = Math.min(
          this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
          this.maxReconnectDelay
        );
        setTimeout(() => this.connect(), delay);
      }
    };
  },

  /**
   * 从 WebSocket 数据更新价格
   */
  updatePrice(data) {
    const symbol = data.s; // 交易对（如 BTCUSDT）

    if (this.prices[symbol]) {
      this.prices[symbol] = {
        price: parseFloat(data.c).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        change: parseFloat(data.p).toFixed(2),
        changePercent: parseFloat(data.P).toFixed(2)
      };

      this.updateUI(symbol);
    }
  },

  /**
   * 更新特定交易对的 UI
   */
  updateUI(symbol) {
    const data = this.prices[symbol];
    const el = document.querySelector(`[data-crypto="${symbol}"]`);

    if (!el) return;

    const priceEl = el.querySelector('.crypto-price');
    const changeEl = el.querySelector('.crypto-change');

    if (priceEl) {
      priceEl.textContent = `$${data.price}`;
    }

    if (changeEl) {
      const isPositive = parseFloat(data.changePercent) >= 0;
      changeEl.textContent = `${isPositive ? '+' : ''}${data.changePercent}%`;
      changeEl.classList.toggle('positive', isPositive);
      changeEl.classList.toggle('negative', !isPositive);
    }
  },

  /**
   * 渲染初始 UI
   */
  render() {
    const btcEl = document.querySelector('[data-crypto="BTCUSDT"]');
    const ethEl = document.querySelector('[data-crypto="ETHUSDT"]');

    if (btcEl) {
      btcEl.querySelector('.crypto-price').textContent = '$--';
      btcEl.querySelector('.crypto-change').textContent = '--%';
    }

    if (ethEl) {
      ethEl.querySelector('.crypto-price').textContent = '$--';
      ethEl.querySelector('.crypto-change').textContent = '--%';
    }
  },

  /**
   * 断开 WebSocket 连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  },

  /**
   * 刷新连接
   */
  refresh() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
};

// 暴露到全局
window.Crypto = Crypto;
