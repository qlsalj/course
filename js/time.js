// 日期 / 周次相关工具。所有日期都按本地时区处理。

export const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DAY_MS = 86400000;

/** "2026-09-07" -> 本地 0 点的 Date */
export function parseDate(str) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(str || ''));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

export function formatDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** 1 = 周一 ... 7 = 周日 */
export function weekday(d) {
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** 返回该日期所在周的周一 */
export function mondayOf(d) {
  return addDays(startOfDay(d), 1 - weekday(d));
}

/** 两个日期之间相差的天数（按日历日，避免夏令时误差） */
export function diffDays(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / DAY_MS);
}

/** 根据开学日期（第一周任意一天）计算 date 属于第几周；开学前返回 <=0 */
export function weekOf(startDate, date = new Date()) {
  const start = mondayOf(typeof startDate === 'string' ? parseDate(startDate) : startDate);
  return Math.floor(diffDays(date, start) / 7) + 1;
}

/** 第 week 周星期 day 的日期 */
export function dateOf(startDate, week, day) {
  const start = mondayOf(typeof startDate === 'string' ? parseDate(startDate) : startDate);
  return addDays(start, (week - 1) * 7 + (day - 1));
}

/** 让"今天"成为第 week 周，反推开学日期（周一） */
export function startDateForCurrentWeek(week, today = new Date()) {
  return formatDate(addDays(mondayOf(today), -(week - 1) * 7));
}

/** "08:05" -> 485 */
export function toMinutes(hm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || ''));
  return m ? +m[1] * 60 + +m[2] : NaN;
}

export function fromMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 第一学期默认开学日期：今年（或明年）9 月第一个周一；春季学期为 2 月最后一个周一 */
export function guessStartDate(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const firstMonday = (year, month) => {
    const d = new Date(year, month - 1, 1);
    return addDays(d, (8 - weekday(d)) % 7);
  };
  if (m >= 2 && m <= 7) return formatDate(addDays(firstMonday(y, 3), -7));
  return formatDate(firstMonday(m === 1 ? y - 1 : y, 9));
}

/** 课程在某天的具体开始/结束时间 */
export function courseTimes(course, periods, date) {
  const p1 = periods[course.start - 1];
  const p2 = periods[course.end - 1] || p1;
  if (!p1) return null;
  const s = toMinutes(p1.start);
  const e = toMinutes(p2.end);
  const base = startOfDay(date);
  return {
    start: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, s),
    end: new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, e),
    startText: p1.start,
    endText: p2.end
  };
}

/** 相对时间描述："25 分钟后" / "1 小时 5 分钟后" */
export function humanizeMinutes(min) {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
}
