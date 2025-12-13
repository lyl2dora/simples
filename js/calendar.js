/**
 * 日历模块 - 带中国农历支持的月历
 */

const Calendar = {
  container: null,
  currentYear: null,
  currentMonth: null,

  /**
   * 初始化日历
   */
  async init() {
    this.container = document.getElementById('calendar-container');
    if (!this.container) return;

    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth() + 1;

    this.bindEvents();
    this.render();
  },

  /**
   * 绑定事件监听器（使用事件委托，只需绑定一次）
   */
  bindEvents() {
    this.container.addEventListener('click', (e) => {
      // 上个月按钮
      if (e.target.closest('.calendar-prev')) {
        e.stopPropagation();
        this.prevMonth();
        return;
      }

      // 下个月按钮
      if (e.target.closest('.calendar-next')) {
        e.stopPropagation();
        this.nextMonth();
        return;
      }

      // 标题点击返回今天
      if (e.target.closest('.calendar-title')) {
        e.stopPropagation();
        this.goToToday();
        return;
      }
    });
  },

  /**
   * 跳转到上个月
   */
  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 1) {
      this.currentMonth = 12;
      this.currentYear--;
    }
    this.render();
  },

  /**
   * 跳转到下个月
   */
  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 12) {
      this.currentMonth = 1;
      this.currentYear++;
    }
    this.render();
  },

  /**
   * 跳转到今天
   */
  goToToday() {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth() + 1;
    this.render();
  },

  /**
   * 渲染日历
   */
  render() {
    const now = new Date();
    const today = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate()
    };

    // 获取当前月份头部的农历信息
    const lunar = Lunar.solarToLunar(this.currentYear, this.currentMonth, 15);

    // 构建头部
    const headerHtml = `
      <div class="calendar-header">
        <button class="calendar-nav calendar-prev" title="上个月">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/>
          </svg>
        </button>
        <div class="calendar-title" title="返回今天">
          <span class="calendar-year-month">${this.currentYear}年${this.currentMonth}月</span>
          <span class="calendar-lunar-info">${lunar.ganZhi}年 ${lunar.animal}年</span>
        </div>
        <button class="calendar-nav calendar-next" title="下个月">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
          </svg>
        </button>
      </div>
    `;

    // 构建星期头部（从周一开始）
    const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
    const weekdayHtml = `
      <div class="calendar-weekdays">
        ${weekdays.map((day, i) => `<div class="calendar-weekday${i >= 5 ? ' weekend' : ''}">${day}</div>`).join('')}
      </div>
    `;

    // 构建日期网格
    const daysHtml = this.buildDaysGrid(today);

    this.container.querySelector('.calendar-content').innerHTML = headerHtml + weekdayHtml + daysHtml;
  },

  /**
   * 构建日期网格 HTML
   */
  buildDaysGrid(today) {
    const year = this.currentYear;
    const month = this.currentMonth;

    // 获取本月第一天和月份天数
    const firstDay = new Date(year, month - 1, 1);
    // 将周日(0)转换为6，周一(1)转换为0，以此类推（周一开始）
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    // 获取上个月信息
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    let html = '<div class="calendar-days">';

    // 上个月末尾的日期
    for (let i = startWeekday - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const lunar = Lunar.solarToLunar(prevYear, prevMonth, day);
      const lunarText = this.getLunarDisplayText(lunar, prevYear, prevMonth, day);

      html += `
        <div class="calendar-day other-month">
          <span class="day-solar">${day}</span>
          <span class="day-lunar">${lunarText}</span>
        </div>
      `;
    }

    // 本月的日期
    for (let day = 1; day <= daysInMonth; day++) {
      const lunar = Lunar.solarToLunar(year, month, day);
      const lunarText = this.getLunarDisplayText(lunar, year, month, day);
      const isToday = year === today.year && month === today.month && day === today.day;
      const isWeekend = new Date(year, month - 1, day).getDay() % 6 === 0;
      const solarTerm = Lunar.getSolarTerm(year, month, day);
      const festival = Lunar.getFestival(month, day, lunar.month, lunar.day, solarTerm);

      let classes = ['calendar-day'];
      if (isToday) classes.push('today');
      if (isWeekend) classes.push('weekend');
      if (festival || solarTerm) classes.push('has-event');

      html += `
        <div class="${classes.join(' ')}" title="${lunar.monthCn}${lunar.dayCn}${festival ? ' ' + festival : ''}${solarTerm ? ' ' + solarTerm : ''}">
          <span class="day-solar">${day}</span>
          <span class="day-lunar${festival || solarTerm ? ' festival' : ''}">${lunarText}</span>
        </div>
      `;
    }

    // 下个月开头的日期
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const nextMonthDays = totalCells - startWeekday - daysInMonth;

    for (let day = 1; day <= nextMonthDays; day++) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const lunar = Lunar.solarToLunar(nextYear, nextMonth, day);
      const lunarText = this.getLunarDisplayText(lunar, nextYear, nextMonth, day);

      html += `
        <div class="calendar-day other-month">
          <span class="day-solar">${day}</span>
          <span class="day-lunar">${lunarText}</span>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  /**
   * 获取农历日期的显示文本
   * 优先级: 节日 > 节气 > 农历日（初一显示月份名）
   */
  getLunarDisplayText(lunar, year, month, day) {
    const solarTerm = Lunar.getSolarTerm(year, month, day);
    const festival = Lunar.getFestival(month, day, lunar.month, lunar.day, solarTerm);

    if (festival) {
      return festival;
    }

    if (solarTerm) {
      return solarTerm;
    }

    // 农历月初一显示月份名
    if (lunar.day === 1) {
      return lunar.monthCn;
    }

    return lunar.dayCn;
  }
};

// 暴露到全局
window.Calendar = Calendar;
