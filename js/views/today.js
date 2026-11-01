import { app } from '../context.js';
import { h, icon } from '../ui.js';
import { coursesOn, currentWeek } from '../store.js';
import { DAY_NAMES, addDays, courseTimes, diffDays, humanizeMinutes, mondayOf, parseDate, startOfDay, weekday } from '../time.js';
import { openCourseDetail } from '../sheets/editor.js';
import { openImportSheet } from '../sheets/import.js';

function lessonsFor(date) {
  const d = app.data;
  const w = currentWeek(d, date);
  if (w < 1 || w > d.totalWeeks) return [];
  return coursesOn(d, w, weekday(date))
    .map((c) => ({ c, t: courseTimes(c, d.periods, date) }))
    .filter((x) => x.t);
}

function nextDayWithLessons(today) {
  for (let i = 1; i <= 21; i++) {
    const date = addDays(today, i);
    const lessons = lessonsFor(date);
    if (lessons.length) return { date, offset: i, lessons };
  }
  return null;
}

function dayLabel(offset, date) {
  if (offset === 1) return '明天';
  if (offset === 2) return '后天';
  const md = `${date.getMonth() + 1}月${date.getDate()}日`;
  return offset < 7 ? `${DAY_NAMES[weekday(date)]} · ${md}` : md;
}

function lessonCard(x, now, { dim = true } = {}) {
  const { c, t } = x;
  const past = dim && t.end <= now;
  const live = t.start <= now && t.end > now;
  let status = null;
  if (live) status = h('span', { class: 'chip live' }, '上课中');
  else if (past) status = h('span', { class: 'chip' }, '已结束');
  else if (dim && t.start - now < 3 * 3600e3) status = h('span', { class: 'chip soon' }, `${humanizeMinutes((t.start - now) / 60000)}后`);
  return h('button', {
    class: `lesson${past ? ' past' : ''}${live ? ' live' : ''}`,
    style: { '--c': c.color },
    onclick: () => openCourseDetail([c])
  },
  h('div', { class: 'lesson-time' }, h('b', null, t.startText), h('span', null, t.endText)),
  h('div', { class: 'lesson-bar' }),
  h('div', { class: 'lesson-main' },
    h('div', { class: 'lesson-name' }, c.name),
    h('div', { class: 'lesson-meta' },
      c.room ? h('span', null, icon('pin'), c.room) : null,
      c.teacher ? h('span', null, icon('user'), c.teacher) : null,
      h('span', { class: 'muted' }, `第${c.start}${c.end > c.start ? '-' + c.end : ''}节`)
    )
  ),
  status
  );
}

function nowCard(today, now, lessons, next) {
  const live = lessons.find((x) => x.t.start <= now && x.t.end > now);
  const upcoming = lessons.find((x) => x.t.start > now);
  if (live) {
    const total = live.t.end - live.t.start;
    const pct = Math.min(100, Math.max(0, ((now - live.t.start) / total) * 100));
    return h('section', { class: 'now-card', style: { '--c': live.c.color } },
      h('div', { class: 'now-label' }, '正在上课'),
      h('div', { class: 'now-name' }, live.c.name),
      h('div', { class: 'now-meta' }, [live.c.room, live.c.teacher].filter(Boolean).join(' · ')),
      h('div', { class: 'progress' }, h('i', { style: { width: `${pct}%` } })),
      h('div', { class: 'now-foot' }, `${live.t.startText} - ${live.t.endText}`, h('span', null, `还有 ${humanizeMinutes((live.t.end - now) / 60000)}下课`))
    );
  }
  if (upcoming) {
    return h('section', { class: 'now-card', style: { '--c': upcoming.c.color } },
      h('div', { class: 'now-label' }, '下一节'),
      h('div', { class: 'now-name' }, upcoming.c.name),
      h('div', { class: 'now-meta' }, [upcoming.c.room, upcoming.c.teacher].filter(Boolean).join(' · ')),
      h('div', { class: 'now-foot' }, `${upcoming.t.startText} 开始`, h('span', null, `${humanizeMinutes((upcoming.t.start - now) / 60000)}后`))
    );
  }
  const msg = lessons.length ? '今天的课都上完啦' : '今天没有课';
  const sub = next ? `${dayLabel(next.offset, next.date)}有 ${next.lessons.length} 节课，${next.lessons[0].t.startText} 开始` : '最近三周都没有课程安排';
  return h('section', { class: 'now-card idle' },
    h('div', { class: 'now-name' }, msg),
    h('div', { class: 'now-meta' }, sub)
  );
}

export function renderToday() {
  const d = app.data;
  const now = new Date();
  const today = startOfDay(now);
  const w = currentWeek(d, today);
  let title;
  let sub;
  if (w < 1) {
    title = `距开学还有 ${diffDays(mondayOf(parseDate(d.startDate)), today)} 天`;
    sub = `开学日期 ${d.startDate}`;
  } else if (w > d.totalWeeks) {
    title = '假期中';
    sub = `本学期共 ${d.totalWeeks} 周，已结束`;
  } else {
    title = `第 ${w} 周`;
    sub = `${d.name} · 共 ${d.totalWeeks} 周`;
  }

  const head = h('header', { class: 'page-head' },
    h('div', { class: 'page-kicker' }, `${now.getMonth() + 1}月${now.getDate()}日 ${DAY_NAMES[weekday(now)]}`),
    h('h1', null, title),
    h('div', { class: 'page-sub' }, sub)
  );

  if (!d.courses.length) {
    return h('div', { class: 'page today' }, head,
      h('section', { class: 'empty' },
        h('div', { class: 'empty-emoji' }, '📚'),
        h('h3', null, '还没有课表'),
        h('p', null, '从教务系统、WakeUp 课程表文件导入，或者在「课表」页手动添加课程。'),
        h('button', { class: 'btn primary', onclick: () => openImportSheet() }, '导入课表'),
        h('button', { class: 'btn ghost', onclick: () => app.navigate('#/week') }, '手动添加')
      )
    );
  }

  const lessons = lessonsFor(today);
  const next = nextDayWithLessons(today);
  const sections = [nowCard(today, now, lessons, next)];

  sections.push(h('section', { class: 'day-section' },
    h('h3', null, '今天', h('small', null, lessons.length ? `${lessons.length} 节课` : '')),
    lessons.length ? h('div', { class: 'lesson-list' }, lessons.map((x) => lessonCard(x, now))) : h('p', { class: 'muted pad' }, '没有课程，好好休息 ☕️')
  ));

  if (next) {
    sections.push(h('section', { class: 'day-section' },
      h('h3', null, dayLabel(next.offset, next.date), h('small', null, `${next.lessons.length} 节课`)),
      h('div', { class: 'lesson-list' }, next.lessons.map((x) => lessonCard(x, now, { dim: false })))
    ));
  }

  const weekCount = w >= 1 && w <= d.totalWeeks ? d.courses.filter((c) => !c.weeks.length || c.weeks.includes(w)).length : 0;
  if (weekCount) {
    sections.push(h('p', { class: 'muted center small' }, `本周共 ${weekCount} 节课 · `, h('a', { href: '#/week' }, '查看本周课表')));
  }
  return h('div', { class: 'page today' }, head, sections);
}
