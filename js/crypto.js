/**
 * Crypto module - handles cryptocurrency price ticker via Binance WebSocket
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
   * Initialize crypto ticker
   */
  async init() {
    const settings = await Storage.getSettings();

    // Check visibility
    if (settings.showCrypto === false) {
      document.getElementById('crypto-container').classList.add('hidden');
      return;
    }

    this.connect();
    this.render();
  },

  /**
   * Connect to Binance WebSocket
   */
  connect() {
    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
    }

    // Subscribe to multiple streams
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
        console.error('Error parsing crypto data:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Crypto WebSocket error:', error);
    };

    this.ws.onclose = () => {
      // Attempt to reconnect with exponential backoff
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
   * Update price from WebSocket data
   */
  updatePrice(data) {
    const symbol = data.s; // Symbol (e.g., BTCUSDT)

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
   * Update UI for a specific symbol
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
   * Render initial UI
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
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  },

  /**
   * Refresh connection
   */
  refresh() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
};

// Make available globally
window.Crypto = Crypto;
