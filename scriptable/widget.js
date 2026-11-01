// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: calendar-alt;

/*
 * 课表小组件 for Scriptable
 * 由「课表」PWA 生成，项目地址见 README。
 *
 * 使用方法：
 *   1. 在 Scriptable 里新建脚本，把本文件全部内容粘贴进去并保存
 *   2. 长按桌面 → 添加小组件 → Scriptable（小/中/大号，或锁屏组件）
 *   3. 长按小组件 → 编辑小组件 → Script 选择本脚本
 *   4. Parameter（可选）：
 *        week      大号组件显示整周课表
 *        tomorrow  显示明天的课程
 *   课表有修改时，请回到课表 App 重新复制脚本，覆盖本文件内容。
 */

const APP_URL = /*@APP_URL*/"";
const OPEN_PAGE = /*@PAGE*/"today";
const GENERATED_AT = /*@GENERATED*/"";
const SNAPSHOT = /*@SNAPSHOT*/"";
const DATA = /*@DATA*/null;

// ================= 外观（可按喜好修改） =================
const THEME = {
  background: Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E")),
  card: Color.dynamic(new Color("#F2F3F7"), new Color("#2C2C2E")),
  text: Color.dynamic(new Color("#1C1C1E"), new Color("#F2F2F7")),
  secondary: Color.dynamic(new Color("#8A8A8E"), new Color("#98989D")),
  accent: Color.dynamic(new Color("#4F7CFF"), new Color("#7C9DFF")),
  live: new Color("#34C759"),
};

// ================= 工具函数 =================
const DAY_NAMES = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const pad = (n) => String(n).padStart(2, "0");
const weekday = (d) => (d.getDay() === 0 ? 7 : d.getDay());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(d, 1 - weekday(d));
const diffDays = (a, b) =>
  Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5);

function parseDate(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function atTime(day, hm) {
  const [h, m] = String(hm).split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const firstMonday = DATA ? mondayOf(parseDate(DATA.startDate)) : today;
const weekOf = (d) => Math.floor(diffDays(d, firstMonday) / 7) + 1;

function lessonsOn(date) {
  if (!DATA) return [];
  const w = weekOf(date);
  const d = weekday(date);
  if (w < 1 || w > DATA.totalWeeks) return [];
  return DATA.courses
    .filter((c) => c.day === d && (!c.weeks.length || c.weeks.includes(w)))
    .map((c) => {
      const p1 = DATA.periods[c.start - 1];
      const p2 = DATA.periods[c.end - 1] || p1;
      if (!p1) return null;
      return Object.assign({}, c, {
        startAt: atTime(date, p1[0]),
        endAt: atTime(date, p2[1]),
        startText: p1[0],
        endText: p2[1],
      });
    })
    .filter(Boolean)
    .sort((a, b) => a.startAt - b.startAt);
}

function findNextDay(fromOffset) {
  for (let i = fromOffset; i <= 21; i++) {
    const date = addDays(today, i);
    const lessons = lessonsOn(date);
    if (lessons.length) return { date, offset: i, lessons };
  }
  return null;
}

function dayLabel(offset, date) {
  if (offset === 0) return "今天";
  if (offset === 1) return "明天";
  if (offset === 2) return "后天";
  if (offset < 7) return DAY_NAMES[weekday(date)];
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function weekLabel(date) {
  if (!DATA) return "";
  const w = weekOf(date || today);
  if (w < 1) return `距开学 ${diffDays(firstMonday, today)} 天`;
  if (w > DATA.totalWeeks) return "假期中";
  return `第${w}周`;
}

function minutesUntil(d) {
  return Math.max(0, Math.round((d - now) / 60000));
}

function untilText(d) {
  const m = minutesUntil(d);
  if (m < 60) return `${m}分钟后`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}小时${m % 60}分后` : `${h}小时后`;
}

// ================= 当前状态 =================
let PARAM = String(args.widgetParameter || "").trim().toLowerCase();
const showTomorrow = PARAM === "tomorrow" || PARAM === "明天";
const todayLessons = lessonsOn(today);
const remaining = todayLessons.filter((l) => l.endAt > now);
const current = remaining.find((l) => l.startAt <= now);
const nextDay = findNextDay(1);

// 主列表：今天剩余的课；今天没课了就显示下一个有课的日子
let focus;
if (showTomorrow) {
  const t = lessonsOn(addDays(today, 1));
  focus = { offset: 1, date: addDays(today, 1), lessons: t, label: "明天" };
} else if (remaining.length) {
  focus = { offset: 0, date: today, lessons: remaining, label: "今天" };
} else if (nextDay) {
  focus = Object.assign({ label: dayLabel(nextDay.offset, nextDay.date) }, nextDay);
} else {
  focus = { offset: 0, date: today, lessons: [], label: "今天" };
}

// ================= 组件元素 =================
function addText(stack, str, size, color, weight, opts) {
  const t = stack.addText(String(str));
  const fonts = {
    regular: Font.systemFont(size),
    medium: Font.mediumSystemFont(size),
    semibold: Font.semiboldSystemFont(size),
    bold: Font.boldSystemFont(size),
    rounded: Font.boldRoundedSystemFont(size),
  };
  t.font = fonts[weight || "regular"];
  t.textColor = color || THEME.text;
  t.lineLimit = (opts && opts.lines) || 1;
  t.minimumScaleFactor = (opts && opts.scale) || 0.75;
  if (opts && opts.opacity != null) t.textOpacity = opts.opacity;
  return t;
}

function hRow(parent) {
  const s = parent.addStack();
  s.layoutHorizontally();
  s.centerAlignContent();
  return s;
}

function lessonRow(parent, l, o) {
  const past = l.endAt <= now;
  const live = l.startAt <= now && l.endAt > now;
  const row = hRow(parent);
  const bar = row.addStack();
  bar.size = new Size(4, o.height);
  bar.cornerRadius = 2;
  bar.backgroundColor = new Color(l.color || "#4F7CFF", past ? 0.35 : 1);
  row.addSpacer(7);
  const col = row.addStack();
  col.layoutVertically();
  addText(col, l.name, o.nameSize, THEME.text, "semibold", { opacity: past ? 0.45 : 1 });
  col.addSpacer(1);
  const meta = `${l.startText}-${l.endText}` + (l.room ? ` · ${l.room}` : "");
  addText(col, meta, o.metaSize, THEME.secondary, "regular", { opacity: past ? 0.6 : 1 });
  row.addSpacer();
  if (o.status && !past) {
    if (live) {
      addText(row, "上课中", o.metaSize, THEME.live, "semibold");
    } else if (l.startAt - now < 3 * 3600e3) {
      addText(row, untilText(l.startAt), o.metaSize, THEME.accent, "medium");
    }
  }
  return row;
}

function emptyMessage(parent, size) {
  const msg = todayLessons.length ? "今天的课上完啦" : "今天没有课";
  const sub = nextDay
    ? `${dayLabel(nextDay.offset, nextDay.date)} ${nextDay.lessons.length} 节 · ${nextDay.lessons[0].startText} 开始`
    : "近期没有课程安排";
  addText(parent, msg, size, THEME.text, "semibold");
  parent.addSpacer(3);
  addText(parent, sub, size - 3, THEME.secondary);
}

function header(w, big) {
  const row = hRow(w);
  addText(row, `${today.getMonth() + 1}月${today.getDate()}日 ${DAY_NAMES[weekday(today)]}`, big ? 15 : 13, THEME.text, "bold");
  row.addSpacer();
  addText(row, weekLabel(), big ? 13 : 12, THEME.accent, "semibold");
  return row;
}

function sectionLabel(parent, label, count) {
  const row = hRow(parent);
  addText(row, label, 11, THEME.secondary, "semibold");
  if (count != null) {
    row.addSpacer(4);
    addText(row, `${count} 节`, 11, THEME.secondary);
  }
  row.addSpacer();
}

// ================= 各尺寸布局 =================
function buildSmall(w) {
  w.setPadding(14, 14, 12, 14);
  header(w);
  w.addSpacer(focus.offset === 0 ? 10 : 6);
  if (!focus.lessons.length) {
    w.addSpacer();
    emptyMessage(w, 14);
    w.addSpacer();
    return;
  }
  if (focus.offset !== 0) {
    sectionLabel(w, focus.label);
    w.addSpacer(4);
  }
  focus.lessons.slice(0, 2).forEach((l, i) => {
    if (i) w.addSpacer(8);
    lessonRow(w, l, { height: 30, nameSize: 14, metaSize: 11 });
  });
  w.addSpacer();
  const foot = hRow(w);
  if (focus.offset === 0 && current) {
    addText(foot, `上课中 · ${current.endText} 下课`, 10, THEME.live, "medium");
  } else if (focus.offset === 0) {
    addText(foot, `${untilText(remaining[0].startAt)}上课 · 还剩 ${remaining.length} 节`, 10, THEME.secondary);
  } else {
    addText(foot, `${focus.label}共 ${focus.lessons.length} 节`, 10, THEME.secondary);
  }
  foot.addSpacer();
}

function buildMedium(w) {
  w.setPadding(14, 14, 14, 14);
  const row = w.addStack();
  row.layoutHorizontally();

  const left = row.addStack();
  left.layoutVertically();
  left.size = new Size(84, 0);
  addText(left, weekLabel(), 13, THEME.accent, "semibold");
  left.addSpacer(2);
  addText(left, `${today.getMonth() + 1}月${today.getDate()}日`, 20, THEME.text, "rounded");
  addText(left, DAY_NAMES[weekday(today)], 13, THEME.secondary, "medium");
  left.addSpacer();
  if (todayLessons.length) {
    addText(left, `今天 ${todayLessons.length} 节课`, 11, THEME.secondary);
    addText(left, remaining.length ? `还剩 ${remaining.length} 节` : "已全部结束", 11, THEME.secondary);
  } else {
    addText(left, "今天没有课", 11, THEME.secondary);
  }

  row.addSpacer(10);
  const right = row.addStack();
  right.layoutVertically();
  if (!focus.lessons.length) {
    right.addSpacer();
    emptyMessage(right, 14);
    right.addSpacer();
    return;
  }
  let slots = 3;
  if (focus.offset !== 0) {
    sectionLabel(right, focus.label, focus.lessons.length);
    right.addSpacer(5);
  }
  focus.lessons.slice(0, slots).forEach((l, i) => {
    if (i) right.addSpacer(7);
    lessonRow(right, l, { height: 31, nameSize: 14, metaSize: 11, status: focus.offset === 0 });
  });
  slots -= focus.lessons.length;
  if (slots >= 2 && focus.offset === 0 && nextDay) {
    right.addSpacer(8);
    sectionLabel(right, dayLabel(nextDay.offset, nextDay.date), nextDay.lessons.length);
    right.addSpacer(4);
    nextDay.lessons.slice(0, slots - 1).forEach((l, i) => {
      if (i) right.addSpacer(7);
      lessonRow(right, l, { height: 31, nameSize: 14, metaSize: 11 });
    });
  }
  right.addSpacer();
}

function buildLarge(w) {
  w.setPadding(16, 16, 16, 16);
  header(w, true);
  w.addSpacer(12);
  const main = showTomorrow ? focus : { label: "今天", lessons: todayLessons, offset: 0 };
  let rows = 6;
  if (main.lessons.length) {
    sectionLabel(w, main.label, main.lessons.length);
    w.addSpacer(6);
    main.lessons.slice(0, rows).forEach((l, i) => {
      if (i) w.addSpacer(8);
      lessonRow(w, l, { height: 32, nameSize: 15, metaSize: 12, status: main.offset === 0 });
    });
    rows -= Math.min(main.lessons.length, rows);
  } else {
    addText(w, showTomorrow ? "明天没有课" : "今天没有课", 15, THEME.text, "semibold");
  }
  const after = main.offset === 0 ? nextDay : findNextDay(main.offset + 1);
  if (after && rows >= 2) {
    w.addSpacer(14);
    sectionLabel(w, dayLabel(after.offset, after.date), after.lessons.length);
    w.addSpacer(6);
    after.lessons.slice(0, rows - 1).forEach((l, i) => {
      if (i) w.addSpacer(8);
      lessonRow(w, l, { height: 32, nameSize: 15, metaSize: 12 });
    });
  }
  w.addSpacer();
}

// 大号组件：整周课表
function buildWeek(w) {
  w.setPadding(12, 10, 12, 10);
  const head = hRow(w);
  addText(head, DATA.name || "课表", 14, THEME.text, "bold");
  head.addSpacer();
  addText(head, weekLabel(), 12, THEME.accent, "semibold");
  w.addSpacer(8);

  const week = Math.min(Math.max(weekOf(today), 1), DATA.totalWeeks);
  const monday = addDays(firstMonday, (week - 1) * 7);
  const showWeekend = DATA.courses.some((c) => c.day >= 6);
  const days = showWeekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  const maxP = Math.max(8, ...DATA.courses.map((c) => c.end));
  const gap = 3;
  // 按 iPhone 常见尺寸（大号组件约 338×354pt）估算，内容过多时 iOS 会自动裁剪
  const colW = Math.floor((312 - gap * (days.length - 1)) / days.length);
  const unit = Math.floor(266 / maxP);

  const grid = w.addStack();
  grid.layoutHorizontally();
  grid.spacing = gap;
  days.forEach((d) => {
    const date = addDays(monday, d - 1);
    const isToday = diffDays(date, today) === 0;
    const col = grid.addStack();
    col.layoutVertically();
    col.size = new Size(colW, 0);
    const h = hRow(col);
    h.addSpacer();
    addText(h, DAY_NAMES[d].slice(1), 11, isToday ? THEME.accent : THEME.secondary, isToday ? "bold" : "medium");
    h.addSpacer();
    col.addSpacer(6);
    const lessons = lessonsOn(date);
    let p = 1;
    lessons.forEach((l) => {
      if (l.start < p) return; // 冲突的课只显示第一节
      if (l.start > p) col.addSpacer(unit * (l.start - p));
      const span = l.end - l.start + 1;
      const box = col.addStack();
      box.layoutVertically();
      box.size = new Size(colW, unit * span - 2);
      box.cornerRadius = 5;
      box.backgroundColor = new Color(l.color || "#4F7CFF", l.endAt <= now ? 0.45 : 0.9);
      box.setPadding(3, 3, 3, 3);
      addText(box, l.name, 9, Color.white(), "semibold", { lines: span > 1 ? 2 : 1, scale: 0.7 });
      if (span > 1 && l.room) addText(box, l.room, 8, new Color("#FFFFFF", 0.85), "regular", { scale: 0.7 });
      box.addSpacer();
      col.addSpacer(2);
      p = l.end + 1;
    });
    col.addSpacer();
  });
}

function buildRectangular(w) {
  const l = focus.lessons[0];
  const s = w.addStack();
  s.layoutVertically();
  if (!l) {
    addText(s, weekLabel(), 12, Color.white(), "semibold");
    addText(s, todayLessons.length ? "今天的课上完啦" : "今天没有课", 14, Color.white(), "bold");
    return;
  }
  const live = focus.offset === 0 && l.startAt <= now;
  const top = focus.offset === 0 ? (live ? `上课中 · ${l.endText} 下课` : `${l.startText} · ${untilText(l.startAt)}`) : `${focus.label} ${l.startText}`;
  addText(s, top, 12, Color.white(), "semibold", { opacity: 0.8 });
  addText(s, l.name, 15, Color.white(), "bold");
  addText(s, l.room || weekLabel(), 12, Color.white(), "regular", { opacity: 0.8 });
}

function buildInline(w) {
  const l = focus.lessons[0];
  let text = weekLabel();
  if (l) text += ` · ${focus.offset === 0 ? "" : focus.label}${l.startText} ${l.name}${l.room ? " " + l.room : ""}`;
  else text += todayLessons.length ? " · 今天的课上完啦" : " · 今天没有课";
  addText(w, text, 12, Color.white(), "medium");
}

function buildCircular(w) {
  w.addAccessoryWidgetBackground = true;
  const wk = DATA ? weekOf(today) : 0;
  const inTerm = DATA && wk >= 1 && wk <= DATA.totalWeeks;
  const s = w.addStack();
  s.layoutVertically();
  s.centerAlignContent();
  const top = hRow(s);
  top.addSpacer();
  addText(top, inTerm ? String(wk) : "—", 22, Color.white(), "rounded");
  top.addSpacer();
  const bottom = hRow(s);
  bottom.addSpacer();
  addText(bottom, inTerm ? "周" : "假期", 10, Color.white(), "medium");
  bottom.addSpacer();
}

function buildEmptyData(w) {
  w.setPadding(14, 14, 14, 14);
  addText(w, "课表", 16, THEME.text, "bold");
  w.addSpacer(6);
  addText(w, "还没有课表数据，请在课表 App 中「导出 → 小组件」重新复制脚本。", 12, THEME.secondary, "regular", { lines: 4 });
}

// ================= 刷新时间 =================
function nextRefresh() {
  const points = [];
  todayLessons.forEach((l) => { points.push(l.startAt, l.endAt); });
  const future = points.filter((d) => d > now).sort((a, b) => a - b);
  const soon = new Date(now.getTime() + 15 * 60000);
  const tomorrow = addDays(today, 1);
  const candidates = [future[0], tomorrow].filter(Boolean);
  // 临近上课时 15 分钟刷新一次，保证"xx 分钟后"大致准确
  if (remaining.length && remaining[0].startAt - now < 2 * 3600e3) candidates.push(soon);
  return new Date(Math.min(...candidates.map((d) => d.getTime())) + 1000);
}

// ================= 入口 =================
async function createWidget(family, param) {
  if (param != null) PARAM = param;
  const w = new ListWidget();
  const accessory = String(family).startsWith("accessory");
  if (!accessory) w.backgroundColor = THEME.background;
  const page = PARAM === "week" ? "week" : OPEN_PAGE;
  if (APP_URL) w.url = `${APP_URL}#/${page}` + (SNAPSHOT ? `?s=${SNAPSHOT}` : "");
  w.refreshAfterDate = nextRefresh();
  if (!DATA) {
    buildEmptyData(w);
    return w;
  }
  switch (family) {
    case "small": buildSmall(w); break;
    case "large":
    case "extraLarge":
      if (PARAM === "week" || PARAM === "周") buildWeek(w); else buildLarge(w);
      break;
    case "accessoryRectangular": buildRectangular(w); break;
    case "accessoryInline": buildInline(w); break;
    case "accessoryCircular": buildCircular(w); break;
    default: buildMedium(w);
  }
  return w;
}

if (config.runsInWidget) {
  Script.setWidget(await createWidget(config.widgetFamily));
} else {
  // 在 App 里直接运行：选择要预览的尺寸
  const alert = new Alert();
  alert.title = DATA ? `${DATA.name} · ${weekLabel()}` : "课表小组件";
  alert.message = GENERATED_AT ? `数据生成于 ${GENERATED_AT}` : "";
  const options = [["小号", "small"], ["中号", "medium"], ["大号", "large"], ["大号 · 整周", "week"], ["打开完整课表", "open"]];
  options.forEach((o) => alert.addAction(o[0]));
  alert.addCancelAction("取消");
  const i = await alert.presentSheet();
  const choice = options[i] && options[i][1];
  if (choice === "open") {
    Safari.open(`${APP_URL}#/${OPEN_PAGE}` + (SNAPSHOT ? `?s=${SNAPSHOT}` : ""));
  } else if (choice === "week") {
    const w = await createWidget("large", "week");
    await w.presentLarge();
  } else if (choice) {
    const w = await createWidget(choice);
    if (choice === "small") await w.presentSmall();
    else if (choice === "large") await w.presentLarge();
    else await w.presentMedium();
  }
}
Script.complete();
