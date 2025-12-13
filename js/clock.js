/**
 * 时钟模块 - 处理时间和日期显示
 */

const Clock = {
  timeElement: null,
  dateElement: null,
  intervalId: null,

  /**
   * 初始化时钟
   */
  init() {
    this.timeElement = document.getElementById('time');
    this.dateElement = document.getElementById('date');

    // 立即更新
    this.update();

    // 每秒更新
    this.intervalId = setInterval(() => this.update(), 1000);
  },

  /**
   * 更新时间和日期显示
   */
  update() {
    const now = new Date();

    // 格式化时间，带秒 (HH:MM:SS)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    this.timeElement.textContent = `${hours}:${minutes}:${seconds}`;

    // 格式化日期
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekDay = this.getWeekDay(now.getDay());

    this.dateElement.textContent = `${year}年${month}月${date}日 ${weekDay}`;
  },

  /**
   * 获取中文星期名称
   */
  getWeekDay(day) {
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekDays[day];
  }
};

// 暴露到全局
window.Clock = Clock;
