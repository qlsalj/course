import { app } from '../context.js';
import { h, icon, openSheet } from '../ui.js';
import { currentWeek, displayWeek, inWeek, layoutDay, maxPeriodUsed, visibleDays } from '../store.js';
import { DAY_NAMES, dateOf, diffDays } from '../time.js';
import { openCourseDetail, openEditor } from '../sheets/editor.js';

let viewWeek = null; // 当前查看的周（null = 本周）

export function setViewWeek(w) {
  viewWeek = w;
}

function weekToShow() {
  const d = app.data;
  const w = viewWeek ?? displayWeek(d);
  return Math.min(Math.max(1, w), d.totalWeeks);
}

function go(delta) {
  const d = app.data;
  const w = weekToShow() + delta;
  if (w < 1 || w > d.totalWeeks) return;
  viewWeek = w;
  app.render({ slide: delta > 0 ? 'left' : 'right' });
}

function openWeekPicker() {
  const d = app.data;
  const cur = currentWeek(d);
  const shown = weekToShow();
  const s = openSheet({
    title: '选择周次',
    className: 'sheet-small',
    content: h('div', { class: 'week-picker' },
      Array.from({ length: d.totalWeeks }, (_, i) => i + 1).map((w) =>
        h('button', {
          class: `wk${w === shown ? ' sel' : ''}${w === cur ? ' cur' : ''}`,
          onclick: () => { viewWeek = w; s.close(); app.render(); }
        }, String(w))
      )
    ),
    footer: h('button', { class: 'btn', onclick: () => { viewWeek = null; s.close(); app.render(); } }, '回到本周')
  });
}

export function renderWeek() {
  const d = app.data;
  const week = weekToShow();
  const cur = currentWeek(d);
  const days = visibleDays(d);
  const rows = Math.max(d.periods.length, maxPeriodUsed(d));
  const today = new Date();
  const monday = dateOf(d.startDate, week, 1);

  const label = week === cur ? '本周' : cur < 1 ? '未开学' : cur > d.totalWeeks ? '假期中' : `非本周`;
  const head = h('header', { class: 'week-head' },
    h('button', { class: 'icon-btn', 'aria-label': '上一周', disabled: week <= 1, onclick: () => go(-1), html: icon('left').innerHTML }),
    h('button', { class: 'week-title', onclick: openWeekPicker },
      h('span', null, `第 ${week} 周`),
      h('small', { class: week === cur ? 'accent' : '' }, label),
      icon('down')
    ),
    h('button', { class: 'icon-btn', 'aria-label': '下一周', disabled: week >= d.totalWeeks, onclick: () => go(1), html: icon('right').innerHTML }),
    h('span', { class: 'spacer' }),
    week !== cur && cur >= 1 && cur <= d.totalWeeks ? h('button', { class: 'btn small', onclick: () => { viewWeek = null; app.render(); } }, '本周') : null,
    h('button', { class: 'icon-btn', 'aria-label': '添加课程', onclick: () => openEditor(null, { day: 1, start: 1 }), html: icon('plus').innerHTML })
  );

  const grid = h('div', { class: 'grid', style: { '--days': days.length, '--rows': rows } });
  // 表头
  grid.appendChild(h('div', { class: 'corner' }, h('b', null, `${monday.getMonth() + 1}`), h('span', null, '月')));
  days.forEach((day, i) => {
    const date = dateOf(d.startDate, week, day);
    const isToday = diffDays(date, today) === 0;
    grid.appendChild(h('div', { class: `day-head${isToday ? ' today' : ''}`, style: { gridColumn: i + 2 } },
      h('b', null, DAY_NAMES[day]),
      h('span', null, date.getDate() === 1 ? `${date.getMonth() + 1}月` : `${date.getMonth() + 1}/${date.getDate()}`)
    ));
  });
  // 节次列
  for (let p = 1; p <= rows; p++) {
    const per = d.periods[p - 1];
    grid.appendChild(h('div', { class: 'period', style: { gridRow: p + 1 } },
      h('b', null, String(p)),
      per ? h('span', null, per.start) : null,
      per ? h('span', null, per.end) : null
    ));
  }
  // 空白格（点击添加）
  days.forEach((day, i) => {
    for (let p = 1; p <= rows; p++) {
      grid.appendChild(h('div', {
        class: 'cell',
        style: { gridColumn: i + 2, gridRow: p + 1 },
        onclick: () => openEditor(null, { day, start: p, end: Math.min(p + 1, rows), weeks: [] })
      }));
    }
  });
  // 课程块
  days.forEach((day, i) => {
    const all = d.courses.filter((c) => c.day === day).sort((a, b) => a.start - b.start || b.end - a.end);
    const active = all.filter((c) => inWeek(c, week));
    const others = d.showOtherWeeks ? all.filter((c) => !inWeek(c, week)) : [];
    layoutDay(active, others).forEach((b) => {
      const c = b.items[0];
      grid.appendChild(h('button', {
        class: `course${b.other ? ' other' : ''}`,
        style: { gridColumn: i + 2, gridRow: `${b.start + 1} / ${b.end + 2}`, '--c': c.color },
        onclick: () => openCourseDetail(b.items, { week })
      },
      h('span', { class: 'course-name' }, b.other ? `[非本周] ${c.name}` : c.name),
      c.room ? h('span', { class: 'course-room' }, `@${c.room}`) : null,
      b.items.length > 1 ? h('span', { class: 'badge' }, `+${b.items.length - 1}`) : null
      ));
    });
  });

  const wrap = h('div', { class: 'grid-wrap' }, grid);
  // 左右滑动切换周
  let sx = 0; let sy = 0; let st = 0;
  wrap.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dy) < Math.abs(dx) * 0.6 && Date.now() - st < 600) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  return h('div', { class: 'page week' }, head, wrap);
}
