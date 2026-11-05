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
// 大号组件默认显示什么："today" 今日课程 / "week" 整周课表（单个组件可用 Parameter 覆盖）
const LARGE_MODE = /*@LARGE*/"today";
// 点击小组件："scriptable" 在 Scriptable 里直接打开课表（不联网，秒开）/ "safari" 用 Safari 打开网页版
const TAP_MODE = /*@TAP*/"scriptable";
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

/** 估算文字宽度（pt）：中文按 1 个字号宽，其余按 0.58 个字号宽 */
function textWidth(str, size) {
  let w = 0;
  for (const ch of String(str)) w += /[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? size : size * 0.58;
  return w;
}

/**
 * 只有放不下一行时才允许缩小字号。
 * 原因：iOS 在高度紧张时会优先压缩"允许缩放"的文字，哪怕它横向放得下，
 * 导致课名莫名变小；放得下的文字就不给它缩放的机会。
 */
function scaleToFit(str, size, width, min) {
  const need = textWidth(str, size);
  return need <= width ? 1 : Math.max(min, width / need);
}

/**
 * 小号组件的边长（pt），按屏幕宽度对照 Apple 公布的尺寸估算，宁小勿大：
 * 估小了只是长文字多缩一点，估大了放不下的文字会被截断而不是缩小。
 */
function smallWidgetSide() {
  let s = { width: 390, height: 844 };
  try { s = Device.screenSize(); } catch (e) { /* 预览环境 */ }
  if (s.width >= 428) return 170;
  if (s.width >= 414) return 169;
  if (s.width >= 402) return 162;
  if (s.width >= 390) return 158;
  if (s.width >= 375 && s.height >= 812) return 155;
  return 148;
}

/**
 * 倒计时：前缀文字 + 系统实时更新的相对时间（如「还有 19分钟」）。
 * 小组件的文字只在脚本运行时生成，而 iOS 一天只会重新运行有限次数，
 * 写死的「19 分钟后」会一直停在那里；WidgetDate 的相对样式由系统每分钟自动刷新。
 * 日期放在最后，因为 iOS 会让它撑满剩余宽度。
 */
function addCountdown(parent, prefix, date, size, color, weight, opts) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const o = opts || {};
  if (prefix) addText(row, prefix, size, color, weight, { scale: 1, opacity: o.opacity });
  const d = row.addDate(date);
  d.applyRelativeStyle();
  d.font = weight === "semibold" ? Font.semiboldSystemFont(size) : weight === "medium" ? Font.mediumSystemFont(size) : Font.systemFont(size);
  d.textColor = color;
  d.lineLimit = 1;
  d.minimumScaleFactor = 0.75; // 兜底：万一放不下，缩小而不是截断
  if (o.opacity != null) d.textOpacity = o.opacity;
  if (o.right) d.rightAlignText(); else d.leftAlignText();
  return row;
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
  const fitW = o.textWidth || 999;
  addText(col, l.name, o.nameSize, THEME.text, "semibold", { opacity: past ? 0.45 : 1, scale: o.textWidth ? scaleToFit(l.name, o.nameSize, fitW, 0.75) : 0.75 });
  col.addSpacer(1);
  // 小号组件空间有限：只显示上课时间 + 教室
  const meta = o.compact
    ? `${l.startText}` + (l.room ? ` ${l.room}` : "")
    : `${l.startText}-${l.endText}` + (l.room ? ` · ${l.room}` : "");
  addText(col, meta, o.metaSize, THEME.secondary, "regular", { opacity: past ? 0.6 : 1, scale: o.textWidth ? scaleToFit(meta, o.metaSize, fitW, 0.7) : 0.7 });
  row.addSpacer();
  if (o.status && !past) {
    if (live) {
      addText(row, "上课中", o.metaSize, THEME.live, "semibold");
    } else if (l.startAt - now < 3600e3) {
      // 只在一小时内显示倒计时：「还有 59分钟」以内的文字一定放得下这一列
      // （开课前 2 小时内组件每 15 分钟刷新一次，进入一小时后就会出现）
      const cd = addCountdown(row, "还有 ", l.startAt, o.metaSize, THEME.accent, "medium", { right: true });
      cd.size = new Size(78, 0);
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
  const date = `${today.getMonth() + 1}月${today.getDate()}日 ${DAY_NAMES[weekday(today)]}`;
  const ds = big ? 15 : 13;
  addText(row, date, ds, THEME.text, "bold", { scale: scaleToFit(date, ds, big ? 220 : 88, 0.75) });
  row.addSpacer();
  const wl = weekLabel();
  const ws = big ? 13 : 12;
  addText(row, wl, ws, THEME.accent, "semibold", { scale: scaleToFit(wl, ws, big ? 100 : 44, 0.75) });
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
  w.addSpacer(8);
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
  // 课程之间、课程和底部之间用弹性间距均匀铺开。
  // 文字只在横向放不下时才允许缩小（见 scaleToFit），所以 iOS 不会为了分配高度去压缩课名。
  const shown = focus.lessons.slice(0, 2);
  shown.forEach((l, i) => {
    if (i) w.addSpacer();
    // 可用宽度 = 边长 - 左右内边距 28 - 色条 4 - 间距 7
    lessonRow(w, l, { height: 34, nameSize: 15, metaSize: 12, compact: true, textWidth: smallWidgetSide() - 39 });
  });
  w.addSpacer();
  const foot = hRow(w);
  if (focus.offset === 0 && current) {
    addText(foot, `上课中 · ${current.endText} 下课`, 11, THEME.live, "medium", { scale: 1 });
  } else if (focus.offset === 0 && minutesUntil(remaining[0].startAt) < 60) {
    addCountdown(foot, "距上课还有 ", remaining[0].startAt, 11, THEME.accent, "medium");
  } else if (focus.offset === 0) {
    addText(foot, remaining.length === 1 ? "今天的最后一节课" : `今天还剩 ${remaining.length} 节`, 11, THEME.secondary, "regular", { scale: 1 });
  } else {
    addText(foot, `${focus.label}共 ${focus.lessons.length} 节`, 11, THEME.secondary, "regular", { scale: 1 });
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

// 大号组件的尺寸（pt）。Scriptable 拿不到组件的实际大小，按屏幕高度对照 Apple 公布的组件尺寸估算；
// 估小了只会多一点留白，估大了内容会被裁掉，所以每档都取偏保守的值
function largeWidgetSize() {
  let h = 844;
  try { h = Device.screenSize().height; } catch (e) { /* 预览环境 */ }
  if (h >= 926) return { w: 364, h: 382 }; // Pro Max / Plus
  if (h >= 896) return { w: 360, h: 376 };
  if (h >= 874) return { w: 350, h: 364 }; // 16/17 Pro
  if (h >= 844) return { w: 338, h: 354 }; // 标准尺寸
  if (h >= 812) return { w: 329, h: 345 };
  return { w: 321, h: 324 };                // SE 等小屏
}

function buildLarge(w) {
  const PAD = 16;
  w.setPadding(PAD, PAD, PAD, PAD);
  header(w, true);
  w.addSpacer(12);
  // 每行课程 32pt + 间距 8pt；按组件高度算出能放几行，把空间用满
  const ROW = 32, GAP = 8, LABEL = 19, SECTION = 14;
  let avail = largeWidgetSize().h - PAD * 2 - 18 - 12;
  const fit = (space) => Math.max(0, Math.floor((space + GAP) / (ROW + GAP)));
  const used = (n) => (n ? n * ROW + (n - 1) * GAP : 0);

  // 只显示还没上完的课，已经结束的课自动隐藏，避免一天课多时后面的课被挤出去
  const done = todayLessons.length - remaining.length;
  const main = showTomorrow ? focus : { label: "今天", lessons: remaining, offset: 0 };
  if (main.lessons.length) {
    const row = hRow(w);
    addText(row, main.label, 11, THEME.secondary, "semibold");
    row.addSpacer(4);
    addText(row, main.offset === 0 ? `还剩 ${main.lessons.length} 节` : `${main.lessons.length} 节`, 11, THEME.secondary);
    if (main.offset === 0 && done) {
      row.addSpacer(4);
      addText(row, `· 已上完 ${done} 节`, 11, THEME.secondary, "regular", { opacity: 0.7 });
    }
    row.addSpacer();
    w.addSpacer(6);
    avail -= LABEL;
    let n = Math.min(main.lessons.length, fit(avail));
    // 放不下全部时留一行写"还有 N 节未显示"
    if (n < main.lessons.length) n = Math.min(n, fit(avail - 18));
    main.lessons.slice(0, n).forEach((l, i) => {
      if (i) w.addSpacer(GAP);
      lessonRow(w, l, { height: ROW, nameSize: 15, metaSize: 12, status: main.offset === 0 });
    });
    avail -= used(n);
    if (main.lessons.length > n) {
      w.addSpacer(4);
      addText(w, `还有 ${main.lessons.length - n} 节未显示`, 11, THEME.secondary);
      avail -= 18;
    }
  } else {
    addText(w, showTomorrow ? "明天没有课" : todayLessons.length ? `今天的 ${todayLessons.length} 节课都上完啦` : "今天没有课", 15, THEME.text, "semibold");
    avail -= 20;
  }
  const after = main.offset === 0 ? nextDay : findNextDay(main.offset + 1);
  const m = after ? Math.min(after.lessons.length, fit(avail - SECTION - LABEL)) : 0;
  if (m > 0) {
    w.addSpacer(SECTION);
    sectionLabel(w, dayLabel(after.offset, after.date), after.lessons.length);
    w.addSpacer(6);
    after.lessons.slice(0, m).forEach((l, i) => {
      if (i) w.addSpacer(GAP);
      lessonRow(w, l, { height: ROW, nameSize: 15, metaSize: 12 });
    });
  }
  w.addSpacer();
}

// 大号组件：整周课表
function buildWeek(w) {
  w.setPadding(12, 10, 10, 10);
  const week = Math.min(Math.max(weekOf(today), 1), DATA.totalWeeks);
  const monday = addDays(firstMonday, (week - 1) * 7);
  const sunday = addDays(monday, 6);
  const showWeekend = DATA.courses.some((c) => c.day >= 6);
  const days = showWeekend ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  const lessonsByDay = days.map((d) => lessonsOn(addDays(monday, d - 1)));
  const all = [].concat(...lessonsByDay);

  // 标题：第 N 周 + 日期范围
  const head = hRow(w);
  head.setPadding(0, 4, 0, 4);
  addText(head, `第${week}周`, 16, THEME.text, "rounded");
  head.addSpacer(6);
  addText(head, `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`, 11, THEME.secondary, "medium");
  head.addSpacer();
  addText(head, DATA.name || "", 11, THEME.secondary, "medium");
  w.addSpacer(8);

  // 只显示本周用到的节次范围，让格子尽量大
  const minP = all.length ? Math.min(...all.map((l) => l.start)) : 1;
  const maxP = all.length ? Math.max(...all.map((l) => l.end)) : 8;
  const span = Math.max(maxP - minP + 1, 4);
  const gap = 3;
  // 按 iPhone 常见尺寸（大号组件约 338×354pt）估算，放不下时 iOS 会自动裁剪
  const size = largeWidgetSize();
  const colW = Math.floor((size.w - 22 - gap * (days.length - 1)) / days.length);
  const gridH = size.h - 92;
  const unit = Math.floor(gridH / span);

  const grid = w.addStack();
  grid.layoutHorizontally();
  grid.spacing = gap;
  days.forEach((d, idx) => {
    const date = addDays(monday, d - 1);
    const isToday = diffDays(date, today) === 0;
    const col = grid.addStack();
    col.layoutVertically();
    col.size = new Size(colW, 0);

    // 列头：星期 + 日期（今天高亮）
    const dayRow = hRow(col);
    dayRow.addSpacer();
    addText(dayRow, DAY_NAMES[d].slice(1), 10, isToday ? THEME.accent : THEME.secondary, "semibold");
    dayRow.addSpacer();
    col.addSpacer(2);
    const dateRow = hRow(col);
    dateRow.addSpacer();
    const bubble = dateRow.addStack();
    bubble.size = new Size(22, 22);
    bubble.cornerRadius = 11;
    bubble.centerAlignContent();
    if (isToday) bubble.backgroundColor = THEME.accent;
    bubble.addSpacer();
    addText(bubble, String(date.getDate()), 12, isToday ? Color.white() : THEME.text, "semibold", { scale: 0.8 });
    bubble.addSpacer();
    dateRow.addSpacer();
    col.addSpacer(6);

    let p = minP;
    lessonsByDay[idx].forEach((l) => {
      if (l.start < p) return; // 冲突的课只显示第一节
      if (l.start > p) col.addSpacer(unit * (l.start - p));
      const len = l.end - l.start + 1;
      const past = l.endAt <= now;
      const color = l.color || "#4F7CFF";
      const box = col.addStack();
      box.layoutHorizontally();
      box.size = new Size(colW, unit * len - 3);
      box.cornerRadius = 6;
      box.backgroundColor = new Color(color, past ? 0.12 : 0.24);
      const bar = box.addStack();
      bar.size = new Size(3, unit * len - 3);
      bar.backgroundColor = new Color(color, past ? 0.45 : 1);
      const txt = box.addStack();
      txt.layoutVertically();
      txt.setPadding(3, 3, 3, 2);
      const lines = Math.max(1, Math.min(4, Math.floor((unit * len - 8) / 12)));
      addText(txt, l.name, 10, THEME.text, "semibold", { lines: l.room && lines > 2 ? lines - 1 : lines, scale: 0.8, opacity: past ? 0.5 : 1 });
      if (l.room && lines > 2) addText(txt, l.room, 8, THEME.secondary, "regular", { lines: 1, scale: 0.75, opacity: past ? 0.5 : 1 });
      txt.addSpacer();
      box.addSpacer();
      col.addSpacer(3);
      p = l.end + 1;
    });
    col.addSpacer();
  });
}

// 锁屏矩形组件：仿照系统「日历 · 接下来」的样式 —— 左侧竖条 + 课程名 + 时间 + 地点
function buildRectangular(w) {
  const l = focus.lessons[0];
  const row = w.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  const bar = row.addStack();
  bar.size = new Size(3, 48);
  bar.cornerRadius = 1.5;
  bar.backgroundColor = Color.white();
  row.addSpacer(6);
  const s = row.addStack();
  s.layoutVertically();
  row.addSpacer();
  const opt = { scale: 0.6 };
  const dim = Object.assign({ opacity: 0.75 }, opt);
  if (!l) {
    addText(s, todayLessons.length ? "今天的课上完啦" : "今天没有课", 15, Color.white(), "bold", opt);
    addText(s, weekLabel(), 12, Color.white(), "medium", dim);
    return;
  }
  addText(s, l.name, 15, Color.white(), "bold", opt);
  if (focus.offset === 0 && l.startAt > now && minutesUntil(l.startAt) < 60) {
    addCountdown(s, `${l.startText} · 还有 `, l.startAt, 12, Color.white(), "medium", { opacity: 0.75 });
  } else {
    let time;
    if (focus.offset !== 0) time = `${focus.label} ${l.startText}-${l.endText}`;
    else if (l.startAt <= now) time = `上课中 · ${l.endText} 下课`;
    else time = `${l.startText}-${l.endText}`;
    addText(s, time, 12, Color.white(), "medium", dim);
  }
  if (l.room) addText(s, l.room, 12, Color.white(), "regular", dim);
}

function buildInline(w) {
  const l = focus.lessons[0];
  // 单行组件很窄：有课时只显示 时间 + 课名 + 教室
  const wk = weekOf(today);
  const inTerm = wk >= 1 && wk <= DATA.totalWeeks;
  // 开学前 / 假期里保留"距开学 N 天"等提示
  const text = l
    ? `${inTerm ? "" : weekLabel() + " · "}${focus.offset === 0 ? "" : focus.label + " "}${l.startText} ${l.name}${l.room ? " " + l.room : ""}`
    : `${weekLabel()} · ${todayLessons.length ? "今天的课上完啦" : "今天没有课"}`;
  addText(w, text, 12, Color.white(), "medium", { scale: 0.7 });
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


// ================= 点击小组件后在 Scriptable 里显示的完整课表 =================
// 课表数据都在脚本里，用 WebView 渲染本地 HTML，不需要联网，所以打开很快、离线也能用。
// 下面这个函数不在 Scriptable 里执行，而是原样（toString）注入到 WebView 页面中运行。
function timetablePage(P) {
  const D = P.data;
  const DAYS = ["", "一", "二", "三", "四", "五", "六", "日"];
  const parse = (s) => { const a = String(s).split("-").map(Number); return new Date(a[0], a[1] - 1, a[2]); };
  const wd = (d) => (d.getDay() === 0 ? 7 : d.getDay());
  const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diff = (a, b) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5);
  const first = add(parse(D.startDate), 1 - wd(parse(D.startDate)));
  const today = new Date(P.today[0], P.today[1], P.today[2]);
  const weekOf = (d) => Math.floor(diff(d, first) / 7) + 1;
  const cur = weekOf(today);
  const clamp = (w) => Math.min(Math.max(w, 1), D.totalWeeks);
  const inWeek = (c, w) => !c.weeks.length || c.weeks.indexOf(w) >= 0;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const time = (c) => { const a = D.periods[c.start - 1]; const b = D.periods[c.end - 1] || a; return a ? a[0] + "-" + b[1] : ""; };
  const weekendUsed = D.courses.some((c) => c.day >= 6);
  const days = weekendUsed ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  const state = { tab: P.view === "week" ? "week" : "today", week: clamp(cur) };

  function lessonsOn(date) {
    const w = weekOf(date);
    if (w < 1 || w > D.totalWeeks) return [];
    return D.courses.filter((c) => c.day === wd(date) && inWeek(c, w)).sort((a, b) => a.start - b.start);
  }
  function dayLabel(n, date) {
    if (n === 0) return "今天";
    if (n === 1) return "明天";
    if (n === 2) return "后天";
    return "周" + DAYS[wd(date)] + " " + (date.getMonth() + 1) + "/" + date.getDate();
  }
  function card(c) {
    return '<div class="lesson" style="--c:' + esc(c.color || "#4F7CFF") + '"><div class="t">' + esc(time(c)).replace("-", "<br>") +
      '</div><div class="bar"></div><div class="m"><b>' + esc(c.name) + "</b><span>" +
      esc([c.room, c.teacher].filter(Boolean).join(" · ")) + "</span></div></div>";
  }
  function todayHTML() {
    let html = "";
    let shown = 0;
    for (let n = 0; n <= 14 && shown < 3; n++) {
      const date = add(today, n);
      const ls = lessonsOn(date);
      if (!ls.length && n > 0) continue;
      html += '<h3>' + dayLabel(n, date) + (ls.length ? "<small>" + ls.length + " 节</small>" : "") + "</h3>";
      html += ls.length ? ls.map(card).join("") : '<p class="empty">今天没有课</p>';
      shown++;
    }
    return html;
  }
  function weekHTML() {
    const w = state.week;
    const monday = add(first, (w - 1) * 7);
    const rows = Math.max(D.periods.length, ...D.courses.map((c) => c.end));
    let g = '<div class="grid" style="--days:' + days.length + ";--rows:" + rows + '"><div class="corner">' + (monday.getMonth() + 1) + "<br>月</div>";
    days.forEach((d, i) => {
      const date = add(monday, d - 1);
      g += '<div class="dh' + (diff(date, today) === 0 ? " now" : "") + '" style="grid-column:' + (i + 2) + '"><b>周' + DAYS[d] + "</b>" + (date.getMonth() + 1) + "/" + date.getDate() + "</div>";
    });
    for (let p = 1; p <= rows; p++) {
      const per = D.periods[p - 1];
      g += '<div class="pn" style="grid-row:' + (p + 1) + '"><b>' + p + "</b>" + (per ? per[0] : "") + "</div>";
    }
    days.forEach((d, i) => {
      const list = D.courses.filter((c) => c.day === d).sort((a, b) => a.start - b.start);
      let end = 0;
      list.filter((c) => inWeek(c, w)).forEach((c) => {
        if (c.start <= end) return;
        end = c.end;
        g += '<div class="cb" data-i="' + D.courses.indexOf(c) + '" style="grid-column:' + (i + 2) + ";grid-row:" + (c.start + 1) + " / " + (c.end + 2) + ";--c:" + esc(c.color || "#4F7CFF") + '"><b>' + esc(c.name) + "</b>" + (c.room ? "<span>@" + esc(c.room) + "</span>" : "") + "</div>";
      });
    });
    return g + "</div>";
  }
  function render() {
    const wl = cur < 1 ? "未开学" : cur > D.totalWeeks ? "假期中" : "第" + cur + "周";
    let html = '<header><div><small>' + (today.getMonth() + 1) + "月" + today.getDate() + "日 周" + DAYS[wd(today)] + "</small><h1>" + esc(wl) + "</h1></div>" +
      (P.appUrl ? '<a class="web" href="' + esc(P.appUrl) + '">网页版</a>' : "") + "</header>" +
      '<nav><button data-tab="today" class="' + (state.tab === "today" ? "on" : "") + '">今天</button><button data-tab="week" class="' + (state.tab === "week" ? "on" : "") + '">课表</button></nav>';
    if (state.tab === "week") {
      html += '<div class="wk"><button data-w="-1"' + (state.week <= 1 ? " disabled" : "") + '>‹</button><span>第 ' + state.week + " 周" + (state.week === cur ? '<em>本周</em>' : "") +
        '</span><button data-w="1"' + (state.week >= D.totalWeeks ? " disabled" : "") + ">›</button></div>" + weekHTML();
    } else {
      html += '<main>' + todayHTML() + "</main>";
    }
    html += '<div id="sheet" hidden></div>';
    document.getElementById("app").innerHTML = html;
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab],[data-w],[data-i],#sheet");
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; render(); }
    else if (t.dataset.w) { state.week = clamp(state.week + Number(t.dataset.w)); render(); }
    else if (t.dataset.i) {
      const c = D.courses[Number(t.dataset.i)];
      const sh = document.getElementById("sheet");
      sh.innerHTML = '<div class="card" style="--c:' + esc(c.color) + '"><h2>' + esc(c.name) + "</h2><p>周" + DAYS[c.day] + " 第" + c.start + (c.end > c.start ? "-" + c.end : "") + "节 " + esc(time(c)) + "</p>" +
        (c.room ? "<p>教室：" + esc(c.room) + "</p>" : "") + (c.teacher ? "<p>教师：" + esc(c.teacher) + "</p>" : "") + "<small>点任意处关闭</small></div>";
      sh.hidden = false;
    } else if (t.id === "sheet") t.hidden = true;
  });
  let sx = 0;
  document.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (state.tab === "week" && Math.abs(dx) > 60) { state.week = clamp(state.week + (dx < 0 ? 1 : -1)); render(); }
  }, { passive: true });
  render();
}

const TIMETABLE_CSS = `
:root{--bg:#f4f5f9;--card:#fff;--text:#1c1c1e;--muted:#8a8a8e;--line:rgba(60,60,67,.12);--accent:#4f7cff;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#000;--card:#1c1c1e;--text:#f2f2f7;--muted:#98989d;--line:rgba(84,84,88,.5);--accent:#7c9dff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.4 -apple-system,"PingFang SC",sans-serif;-webkit-text-size-adjust:100%}
header{display:flex;align-items:flex-end;justify-content:space-between;padding:calc(env(safe-area-inset-top) + 14px) 16px 8px}
header small{color:var(--muted);font-weight:600}h1{margin:2px 0 0;font-size:28px}
.web{color:var(--accent);text-decoration:none;font-weight:600;font-size:14px;padding:6px 10px;border-radius:10px;background:var(--card)}
nav{display:flex;margin:4px 16px 10px;background:var(--card);border-radius:10px;padding:2px}
nav button{flex:1;border:0;background:none;padding:7px;border-radius:8px;font:inherit;font-weight:600;color:var(--muted)}
nav button.on{background:var(--accent);color:#fff}
main{padding:0 16px 24px}h3{font-size:16px;margin:16px 4px 8px}h3 small{color:var(--muted);font-weight:500;margin-left:8px;font-size:13px}
.lesson{--c:#4f7cff;display:flex;gap:10px;align-items:center;background:var(--card);border-radius:14px;padding:10px 12px;margin-bottom:8px}
.lesson .t{width:44px;text-align:center;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.lesson .bar{width:4px;align-self:stretch;border-radius:4px;background:var(--c)}
.lesson .m{display:flex;flex-direction:column;min-width:0}.lesson .m span{font-size:13px;color:var(--muted)}
.empty{color:var(--muted);padding:4px}
.wk{display:flex;align-items:center;justify-content:center;gap:14px;margin:0 16px 6px}
.wk button{border:0;background:var(--card);color:var(--text);width:34px;height:34px;border-radius:50%;font-size:20px}
.wk button:disabled{opacity:.3}.wk span{font-weight:700;font-size:17px}.wk em{font-style:normal;color:var(--accent);font-size:12px;margin-left:6px}
.grid{display:grid;grid-template-columns:28px repeat(var(--days),minmax(0,1fr));grid-template-rows:38px repeat(var(--rows),50px);padding:0 4px 24px}
.corner,.dh,.pn{display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);font-size:10px;line-height:1.2}
.corner{grid-row:1;grid-column:1}.dh{grid-row:1;border-radius:8px;margin:2px}.dh b{color:var(--text);font-size:12px}
.dh.now{background:var(--accent);color:#fff}.dh.now b{color:#fff}.pn{grid-column:1}.pn b{color:var(--text);font-size:12px}
.cb{--c:#4f7cff;margin:1.5px;border-radius:8px;background:var(--c);color:#fff;padding:4px 3px;font-size:11px;line-height:1.25;overflow:hidden;text-align:center;word-break:break-all}
.cb span{display:block;opacity:.9;font-size:10px}
#sheet{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-end}#sheet[hidden]{display:none}
#sheet .card{--c:#4f7cff;width:100%;background:var(--card);border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));border-top:5px solid var(--c)}
#sheet h2{margin:0 0 8px}#sheet p{margin:4px 0}#sheet small{color:var(--muted)}
`;

function timetableHTML(view) {
  const appUrl = APP_URL ? `${APP_URL}#/${view === "week" ? "week" : "today"}` + (SNAPSHOT ? `?s=${SNAPSHOT}` : "") : "";
  const payload = JSON.stringify({ data: DATA, view, today: [today.getFullYear(), today.getMonth(), today.getDate()], appUrl }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${TIMETABLE_CSS}</style></head>` +
    `<body><div id="app"></div><script>(${timetablePage.toString()})(${payload});</script></body></html>`;
}

async function presentTimetable(view) {
  const wv = new WebView();
  // 点「网页版」时用 Safari 打开，而不是在这个窗口里加载网页
  wv.shouldAllowRequest = (req) => {
    if (/^https?:/.test(req.url)) { Safari.open(req.url); return false; }
    return true;
  };
  await wv.loadHTML(timetableHTML(view));
  await wv.present(true);
}

// ================= 入口 =================
async function createWidget(family, param) {
  if (param != null) PARAM = param;
  const w = new ListWidget();
  const accessory = String(family).startsWith("accessory");
  if (!accessory) w.backgroundColor = THEME.background;
  const isLarge = family === "large" || family === "extraLarge";
  // Parameter 优先：week/周 → 整周；today/今天 → 今日；否则用导出时选的默认值
  const weekMode = isLarge && (PARAM === "week" || PARAM === "周" ||
    (LARGE_MODE === "week" && !["today", "今天", "tomorrow", "明天"].includes(PARAM)));
  const page = weekMode ? "week" : OPEN_PAGE;
  if (TAP_MODE === "scriptable" && DATA) {
    // 运行本脚本并直接显示完整课表（见 presentTimetable），不需要联网
    w.url = `scriptable:///run/${encodeURIComponent(Script.name())}?view=${page}`;
  } else if (APP_URL) {
    w.url = `${APP_URL}#/${page}` + (SNAPSHOT ? `?s=${SNAPSHOT}` : "");
  }
  w.refreshAfterDate = nextRefresh();
  if (!DATA) {
    buildEmptyData(w);
    return w;
  }
  switch (family) {
    case "small": buildSmall(w); break;
    case "large":
    case "extraLarge":
      if (weekMode) buildWeek(w); else buildLarge(w);
      break;
    case "accessoryRectangular": buildRectangular(w); break;
    case "accessoryInline": buildInline(w); break;
    case "accessoryCircular": buildCircular(w); break;
    default: buildMedium(w);
  }
  return w;
}

const QUERY = (args && args.queryParameters) || {};
if (config.runsInWidget) {
  Script.setWidget(await createWidget(config.widgetFamily));
} else if (QUERY.view && DATA) {
  // 点击小组件打开：直接显示完整课表
  await presentTimetable(QUERY.view);
} else {
  // 在 App 里直接运行：选择要预览的尺寸
  const alert = new Alert();
  alert.title = DATA ? `${DATA.name} · ${weekLabel()}` : "课表小组件";
  alert.message = GENERATED_AT ? `数据生成于 ${GENERATED_AT}` : "";
  const options = [["查看完整课表", "timetable"], ["小号", "small"], ["中号", "medium"], ["大号", "large"], ["大号 · 整周", "week"], ["用 Safari 打开网页版", "open"]];
  options.forEach((o) => alert.addAction(o[0]));
  alert.addCancelAction("取消");
  const i = await alert.presentSheet();
  const choice = options[i] && options[i][1];
  if (choice === "timetable") {
    await presentTimetable(OPEN_PAGE);
  } else if (choice === "open") {
    Safari.open(`${APP_URL}#/${OPEN_PAGE}` + (SNAPSHOT ? `?s=${SNAPSHOT}` : ""));
  } else if (choice === "week") {
    const w = await createWidget("large", "week");
    await w.presentLarge();
  } else if (choice === "large") {
    const w = await createWidget("large", "today");
    await w.presentLarge();
  } else if (choice) {
    const w = await createWidget(choice);
    if (choice === "small") await w.presentSmall();
    else if (choice === "large") await w.presentLarge();
    else await w.presentMedium();
  }
}
Script.complete();
