// 数据模型与本地存储
import { guessStartDate, weekOf } from './time.js';

const KEY = 'course-pwa:data:v1';
const PREFS_KEY = 'course-pwa:prefs:v1';

export const PALETTE = [
  '#4F7CFF', '#F08A3E', '#3DB46D', '#E5584F', '#8E6BD6', '#1FAFC4', '#D99A1E',
  '#E0609F', '#3F9BE0', '#6F7FE6', '#C9684E', '#33A88C', '#A06CC9', '#7D8CA3'
];

export const DEFAULT_PERIODS = [
  ['08:00', '08:45'], ['08:55', '09:40'], ['10:00', '10:45'], ['10:55', '11:40'],
  ['14:00', '14:45'], ['14:55', '15:40'], ['16:00', '16:45'], ['16:55', '17:40'],
  ['19:00', '19:45'], ['19:55', '20:40'], ['20:50', '21:35'], ['21:45', '22:30']
].map(([start, end]) => ({ start, end }));

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function defaultData() {
  return {
    version: 1,
    id: uid(),
    name: '我的课表',
    startDate: guessStartDate(),
    totalWeeks: 20,
    periods: DEFAULT_PERIODS.map((p) => ({ ...p })),
    showWeekend: 'auto',
    showOtherWeeks: true,
    courses: [],
    updatedAt: 0
  };
}

const HM = /^\d{1,2}:\d{2}$/;

/** 校验并补全数据（导入、读取时都会调用） */
export function sanitize(input) {
  const d = defaultData();
  const src = input && typeof input === 'object' ? input : {};
  if (typeof src.id === 'string' && /^[\w-]{4,40}$/.test(src.id)) d.id = src.id;
  if (typeof src.name === 'string' && src.name.trim()) d.name = src.name.trim().slice(0, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(src.startDate)) d.startDate = src.startDate;
  const tw = parseInt(src.totalWeeks, 10);
  if (tw >= 1 && tw <= 60) d.totalWeeks = tw;
  if (Array.isArray(src.periods) && src.periods.length) {
    const ps = src.periods
      .filter((p) => p && HM.test(p.start) && HM.test(p.end))
      .map((p) => ({ start: pad(p.start), end: pad(p.end) }));
    if (ps.length) d.periods = ps.slice(0, 30);
  }
  if (['auto', 'always', 'never'].includes(src.showWeekend)) d.showWeekend = src.showWeekend;
  if (typeof src.showOtherWeeks === 'boolean') d.showOtherWeeks = src.showOtherWeeks;
  if (Array.isArray(src.courses)) d.courses = assignColors(src.courses.map(sanitizeCourse).filter(Boolean));
  d.updatedAt = Number(src.updatedAt) || 0;
  return d;
}

function pad(hm) {
  const [h, m] = hm.split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

export function sanitizeCourse(c) {
  if (!c || typeof c !== 'object') return null;
  const name = String(c.name || '').trim();
  const day = parseInt(c.day, 10);
  let start = parseInt(c.start, 10);
  let end = parseInt(c.end, 10) || start;
  if (end < start) [start, end] = [end, start];
  if (!name || !(day >= 1 && day <= 7) || !(start >= 1 && start <= 30)) return null;
  const weeks = Array.isArray(c.weeks)
    ? [...new Set(c.weeks.map(Number).filter((w) => Number.isInteger(w) && w >= 1 && w <= 60))].sort((a, b) => a - b)
    : [];
  return {
    id: typeof c.id === 'string' && c.id ? c.id : uid(),
    name: name.slice(0, 60),
    teacher: String(c.teacher || '').trim().slice(0, 60),
    room: String(c.room || '').trim().slice(0, 60),
    day,
    start,
    end: Math.min(end, 30),
    weeks,
    color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '',
    note: String(c.note || '').slice(0, 500)
  };
}

/** 同名课程使用同一种颜色；没有颜色的按出现顺序分配 */
export function assignColors(courses) {
  const byName = new Map();
  courses.forEach((c) => { if (c.color && !byName.has(c.name)) byName.set(c.name, c.color); });
  let i = 0;
  const used = new Set(byName.values());
  courses.forEach((c) => {
    if (!byName.has(c.name)) {
      let color = PALETTE.find((p) => !used.has(p));
      if (!color) color = PALETTE[i++ % PALETTE.length];
      used.add(color);
      byName.set(c.name, color);
    }
    c.color = c.color || byName.get(c.name);
  });
  return courses;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const data = sanitize(parsed);
      // 旧数据没有 id：补上并保存，保证 id 稳定（用于区分"小组件同步"和"别人分享的课表"）
      if (parsed.id !== data.id) save(data, { touch: false });
      return data;
    }
  } catch (e) {
    console.warn('读取课表失败', e);
  }
  return defaultData();
}

export function save(data, { touch = true } = {}) {
  if (touch) data.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

export function loadPrefs() {
  try {
    return { widgetPage: 'today', widgetLarge: 'today', ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) };
  } catch (e) {
    return { widgetPage: 'today', widgetLarge: 'today' };
  }
}

export function savePrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/* ---------------- 查询 ---------------- */

/** 课程在第 week 周是否上课（没有周次信息视为每周都上） */
export function inWeek(course, week) {
  return !course.weeks.length || course.weeks.includes(week);
}

export function coursesOn(data, week, day) {
  return data.courses
    .filter((c) => c.day === day && inWeek(c, week))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function currentWeek(data, now = new Date()) {
  return weekOf(data.startDate, now);
}

/** 用于显示的周次（开学前显示第 1 周，学期结束后显示最后一周） */
export function displayWeek(data, now = new Date()) {
  const w = currentWeek(data, now);
  return Math.min(Math.max(w, 1), data.totalWeeks);
}

export function maxPeriodUsed(data) {
  return data.courses.reduce((m, c) => Math.max(m, c.end), 0);
}

export function hasWeekendCourses(data) {
  return data.courses.some((c) => c.day >= 6);
}

export function visibleDays(data) {
  const show = data.showWeekend === 'always' || (data.showWeekend === 'auto' && hasWeekendCourses(data));
  return show ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
}

/** 按节次把互相重叠（含连锁重叠）的课合并成块，块的范围覆盖所有课 */
function cluster(courses, other) {
  const blocks = [];
  let cur = null;
  [...courses].sort((a, b) => a.start - b.start || b.end - a.end).forEach((c) => {
    if (cur && c.start <= cur.end) {
      cur.items.push(c);
      cur.end = Math.max(cur.end, c.end);
    } else {
      cur = { start: c.start, end: c.end, items: [c], other };
      blocks.push(cur);
    }
  });
  return blocks;
}

/** 一天的课程块：本周的课优先；非本周的课只占用本周课没有占用的时间，重叠时显示 +n */
export function layoutDay(active, others) {
  const blocks = cluster(active, false);
  const free = others.filter((c) => !blocks.some((b) => c.start <= b.end && c.end >= b.start));
  return blocks.concat(cluster(free, true)).sort((a, b) => a.start - b.start);
}
