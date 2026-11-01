// 识别并解析各种导入来源
// 统一返回：{ source, courses: [...], settings?: { name, startDate, totalWeeks, periods } }
import { decodeData, decodePlainB64 } from './share.js';

const P = globalThis.CourseParsers;

export async function parseImport(text, filename = '') {
  const raw = String(text || '').replace(/^﻿/, '').trim();
  if (!raw) throw new Error('内容为空');

  // 1. 分享链接 / 小组件链接
  const link = /[#?&](s|data)=([A-Za-z0-9_-]+)/.exec(raw);
  if (/^https?:\/\//.test(raw) && link) {
    const obj = link[1] === 's' ? await decodeData(link[2]) : decodePlainB64(link[2]);
    return fromJson(obj);
  }

  // 2. WakeUp 课程表导出文件（多行 JSON）
  if (/\.wakeup_schedule$/i.test(filename) || (/"courseLen"|"courseName"/.test(raw) && /"startNode"/.test(raw))) {
    return parseWakeUp(raw);
  }

  // 3. JSON
  if (/^[[{]/.test(raw)) {
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { obj = undefined; }
    if (obj !== undefined) return fromJson(obj);
  }

  // 4. HTML 网页源码
  if (/<table[\s>]/i.test(raw) || /\.html?$/i.test(filename)) {
    const r = P.parseHtml(raw);
    if (!r.courses.length) throw new Error('没有在网页源码中找到课表表格');
    return { source: r.source, courses: r.courses };
  }

  // 5. CSV / TSV
  if (/[,\t]/.test(raw.split('\n')[0])) return parseCsv(raw);

  throw new Error('无法识别的格式');
}

function fromJson(obj) {
  // 导入助手输出
  if (obj && obj.type === 'course-pwa/import') {
    return { source: obj.source || '教务系统', courses: obj.courses || [], semester: obj.semester };
  }
  // 本应用的备份
  if (obj && Array.isArray(obj.courses) && (obj.periods || obj.startDate)) {
    return {
      source: '课表备份',
      courses: obj.courses,
      settings: {
        name: obj.name,
        startDate: obj.startDate,
        totalWeeks: obj.totalWeeks,
        periods: obj.periods,
        showWeekend: obj.showWeekend,
        showOtherWeeks: obj.showOtherWeeks
      }
    };
  }
  // 正方接口原始 JSON
  if (P.looksLikeZhengfangJson(obj)) {
    const r = P.parseZhengfangJson(obj);
    return { source: r.source, courses: r.courses, semester: r.semester };
  }
  // 纯课程数组
  if (Array.isArray(obj)) {
    return { source: 'JSON', courses: P.finalize(obj) };
  }
  if (obj && Array.isArray(obj.courses)) {
    return { source: 'JSON', courses: P.finalize(obj.courses) };
  }
  throw new Error('JSON 中没有找到课程数据');
}

/* ---------------- WakeUp 课程表 ---------------- */

function wakeColor(c) {
  if (typeof c !== 'string') return '';
  const m = /^#?([0-9a-f]{8}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return '';
  return '#' + m[1].slice(-6).toUpperCase();
}

function wakeDate(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
  if (!m) return undefined;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

export function parseWakeUp(text) {
  const blocks = [];
  text.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line) return;
    try { blocks.push(JSON.parse(line)); } catch (e) { /* 忽略无法解析的行 */ }
  });
  let nodes = null; let table = null; let base = null; let details = null;
  blocks.forEach((b) => {
    if (Array.isArray(b) && b.length) {
      const f = b[0];
      if ('node' in f && 'startTime' in f) nodes = b;
      else if ('courseName' in f) base = b;
      else if ('startNode' in f && 'day' in f) details = b;
    } else if (b && typeof b === 'object' && ('maxWeek' in b || 'startDate' in b || 'tableName' in b)) {
      table = b;
    }
  });
  if (!base || !details) throw new Error('不是有效的 WakeUp 课程表文件');
  const byId = new Map(base.map((c) => [c.id, c]));
  const courses = [];
  details.forEach((d) => {
    const b = byId.get(d.id);
    if (!b) return;
    const weeks = [];
    for (let w = d.startWeek; w <= d.endWeek; w++) {
      if (d.type === 1 && w % 2 === 0) continue;
      if (d.type === 2 && w % 2 === 1) continue;
      weeks.push(w);
    }
    courses.push({
      name: b.courseName,
      teacher: d.teacher || '',
      room: d.room || '',
      day: d.day,
      start: d.startNode,
      end: d.startNode + Math.max(1, d.step || 1) - 1,
      weeks,
      color: wakeColor(b.color),
      note: b.note || ''
    });
  });
  const settings = {};
  if (table) {
    if (table.tableName) settings.name = table.tableName;
    const sd = wakeDate(table.startDate);
    if (sd) settings.startDate = sd;
    if (table.maxWeek) settings.totalWeeks = table.maxWeek;
  }
  if (nodes) {
    const count = (table && table.nodes) || nodes.length;
    settings.periods = nodes
      .slice()
      .sort((a, b) => a.node - b.node)
      .filter((n) => n.node <= count)
      .map((n) => ({ start: n.startTime, end: n.endTime }));
  }
  return { source: 'WakeUp 课程表', courses, settings };
}

/* ---------------- CSV ---------------- */

export function parseCsvRows(text) {
  const delim = text.split('\n')[0].includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const COLS = {
  name: /课程名称|课程名|课程|课名|^name$|course/i,
  day: /星期|周几|^day$|weekday/i,
  start: /开始节|起始节|开始|^start/i,
  end: /结束节|终止节|结束|^end/i,
  periods: /^节次$|^节数$|^periods?$/i,
  teacher: /老师|教师|teacher/i,
  room: /地点|教室|room|location|place/i,
  weeks: /周数|周次|weeks?/i,
  color: /颜色|color/i,
  note: /备注|note/i
};

export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) throw new Error('CSV 为空');
  const header = rows[0].map((h) => h.trim());
  const idx = {};
  header.forEach((h, i) => {
    for (const [k, re] of Object.entries(COLS)) {
      if (idx[k] == null && re.test(h)) { idx[k] = i; break; }
    }
  });
  let data = rows.slice(1);
  if (idx.name == null || idx.day == null) {
    // 没有表头：按 WakeUp 模板顺序 课程名称,星期,开始节数,结束节数,老师,地点,周数
    Object.assign(idx, { name: 0, day: 1, start: 2, end: 3, teacher: 4, room: 5, weeks: 6 });
    data = rows;
  }
  const get = (r, k) => (idx[k] != null ? String(r[idx[k]] || '').trim() : '');
  const courses = data.map((r) => {
    let start = get(r, 'start');
    let end = get(r, 'end');
    if ((!start || !end) && get(r, 'periods')) {
      const p = P.parsePeriods(get(r, 'periods'), { loose: true });
      if (p) { start = p.start; end = p.end; }
    }
    return {
      name: get(r, 'name'),
      day: P.parseDay(get(r, 'day')),
      start: parseInt(start, 10),
      end: parseInt(end, 10) || parseInt(start, 10),
      teacher: get(r, 'teacher'),
      room: get(r, 'room'),
      weeks: P.parseWeeks(get(r, 'weeks')),
      color: get(r, 'color'),
      note: get(r, 'note')
    };
  });
  const valid = courses.filter((c) => c.name && c.day && c.start);
  if (!valid.length) throw new Error('CSV 中没有有效的课程行');
  const colors = new Map(valid.map((c) => [c.name, c.color]));
  const merged = P.finalize(valid).map((c) => ({ ...c, color: colors.get(c.name) || '' }));
  return { source: 'CSV', courses: merged };
}
