/**
 * Clock module - handles time and date display
 */

const Clock = {
  timeElement: null,
  dateElement: null,
  intervalId: null,

  /**
   * Initialize clock
   */
  init() {
    this.timeElement = document.getElementById('time');
    this.dateElement = document.getElementById('date');

    // Update immediately
    this.update();

    // Update every second
    this.intervalId = setInterval(() => this.update(), 1000);
  },

  /**
   * Update time and date display
   */
  update() {
    const now = new Date();

    // Format time with seconds (HH:MM:SS)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    this.timeElement.textContent = `${hours}:${minutes}:${seconds}`;

    // Format date
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekDay = this.getWeekDay(now.getDay());

    this.dateElement.textContent = `${year}年${month}月${date}日 ${weekDay}`;
  },

  /**
   * Get weekday name in Chinese
   */
  getWeekDay(day) {
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekDays[day];
  },

  /**
   * Destroy clock (cleanup)
   */
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
};

// Make available globally
window.Clock = Clock;
