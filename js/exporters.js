// 导出：JSON 备份 / iCalendar / CSV / Scriptable 小组件脚本 / 分享链接
import { dateOf, formatDate, toMinutes } from './time.js';
import { encodeData } from './share.js';

const P = globalThis.CourseParsers;

export function exportJson(data) {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

/**
 * CSV 中的周次：纯单/双周写成 "1-15单"，其余写成不含单双标记的区间列表（如 "1-4,6,8,10"），
 * 避免 "1-4,6-16(双)" 这种在重新导入时会被理解成整体双周的写法
 */
export function csvWeeks(weeks) {
  const w = [...weeks].sort((a, b) => a - b);
  if (!w.length) return '';
  if (w.length >= 3 && w.every((x, i) => i === 0 || x - w[i - 1] === 2)) {
    return `${w[0]}-${w[w.length - 1]}${w[0] % 2 ? '单' : '双'}`;
  }
  const out = [];
  for (let i = 0; i < w.length; i++) {
    let j = i;
    while (j + 1 < w.length && w[j + 1] === w[j] + 1) j++;
    out.push(i === j ? String(w[i]) : `${w[i]}-${w[j]}`);
    i = j;
  }
  return out.join(',');
}

/** WakeUp 模板兼容的 CSV */
export function exportCsv(data) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['课程名称', '星期', '开始节数', '结束节数', '老师', '地点', '周数', '颜色']];
  data.courses.forEach((c) => rows.push([c.name, c.day, c.start, c.end, c.teacher, c.room, csvWeeks(c.weeks), c.color]));
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

/* ---------------- iCalendar ---------------- */

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// RFC 5545：每行不超过 75 字节，续行以空格开头
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function icsTime(date, hm) {
  const min = toMinutes(hm);
  const p = (n) => String(n).padStart(2, '0');
  return `${formatDate(date).replace(/-/g, '')}T${p(Math.floor(min / 60))}${p(min % 60)}00`;
}

export function exportIcs(data, { alarmMinutes = 0 } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//course-pwa//课表//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(data.name)}`, 'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Shanghai', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:CST', 'END:STANDARD', 'END:VTIMEZONE'
  ];
  data.courses.forEach((c) => {
    const p1 = data.periods[c.start - 1];
    const p2 = data.periods[c.end - 1] || p1;
    if (!p1) return;
    // 只导出学期范围内的周（缩短学期后，课程里可能还留着更靠后的周次）
    const weeks = (c.weeks.length ? c.weeks : Array.from({ length: data.totalWeeks }, (_, i) => i + 1)).filter((w) => w <= data.totalWeeks);
    weeks.forEach((w) => {
      const day = dateOf(data.startDate, w, c.day);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${c.id}-w${w}@course-pwa`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Shanghai:${icsTime(day, p1.start)}`,
        `DTEND;TZID=Asia/Shanghai:${icsTime(day, p2.end)}`,
        `SUMMARY:${icsEscape(c.name)}`
      );
      if (c.room) lines.push(`LOCATION:${icsEscape(c.room)}`);
      const desc = [c.teacher && `教师：${c.teacher}`, `第${w}周 · 第${c.start}${c.end > c.start ? '-' + c.end : ''}节`, c.note].filter(Boolean).join('\n');
      lines.push(`DESCRIPTION:${icsEscape(desc)}`);
      if (alarmMinutes > 0) {
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(c.name)}`, `TRIGGER:-PT${alarmMinutes}M`, 'END:VALARM');
      }
      lines.push('END:VEVENT');
    });
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/* ---------------- 分享链接 / 小组件 ---------------- */

/** 用于 URL 的课表快照 */
export function snapshotOf(data) {
  return {
    v: 1,
    id: data.id,
    name: data.name,
    startDate: data.startDate,
    totalWeeks: data.totalWeeks,
    periods: data.periods,
    showWeekend: data.showWeekend,
    showOtherWeeks: data.showOtherWeeks,
    updatedAt: data.updatedAt,
    courses: data.courses.map(({ id, name, teacher, room, day, start, end, weeks, color, note }) => ({ id, name, teacher, room, day, start, end, weeks, color, note }))
  };
}

export async function shareUrl(appUrl, data, page = 'week') {
  return `${appUrl}#/${page}?s=${await encodeData(snapshotOf(data))}`;
}

/** 小组件里用的精简数据 */
export function widgetData(data) {
  return {
    name: data.name,
    startDate: data.startDate,
    totalWeeks: data.totalWeeks,
    periods: data.periods.map((p) => [p.start, p.end]),
    courses: data.courses.map((c) => ({
      name: c.name, room: c.room, teacher: c.teacher, day: c.day, start: c.start, end: c.end, weeks: c.weeks, color: c.color
    }))
  };
}

/**
 * 根据模板（scriptable/widget.js）生成 Scriptable 脚本
 * @param {string} template 模板源码
 */
export async function buildWidgetScript(template, data, { appUrl, page = 'today', largeMode = 'today', withSnapshot = true } = {}) {
  const snapshot = withSnapshot ? await encodeData(snapshotOf(data)) : '';
  const now = new Date();
  const generated = `${formatDate(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const json = JSON.stringify(widgetData(data));
  const replace = (src, marker, value) => {
    const re = new RegExp(`/\\*@${marker}\\*/(?:null|"[^"]*")`);
    if (!re.test(src)) throw new Error(`小组件模板缺少 @${marker} 标记`);
    return src.replace(re, () => value);
  };
  let out = template;
  out = replace(out, 'APP_URL', JSON.stringify(appUrl || ''));
  out = replace(out, 'PAGE', JSON.stringify(page));
  out = replace(out, 'LARGE', JSON.stringify(largeMode === 'week' ? 'week' : 'today'));
  out = replace(out, 'GENERATED', JSON.stringify(generated));
  out = replace(out, 'SNAPSHOT', JSON.stringify(snapshot));
  out = replace(out, 'DATA', json);
  return out;
}
