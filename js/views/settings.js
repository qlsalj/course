import { app } from '../context.js';
import { h, icon, icons, openSheet, toast, confirmDialog, copyText, download } from '../ui.js';
import { currentWeek, sanitize } from '../store.js';
import { fromMinutes, mondayOf, parseDate, startDateForCurrentWeek, formatDate, toMinutes } from '../time.js';
import { exportCsv, exportIcs, exportJson, shareUrl } from '../exporters.js';
import { openImportSheet } from '../sheets/import.js';
import { openWidgetSheet } from '../sheets/widget.js';

export const VERSION = '1.0.0';
export const REPO_URL = 'https://github.com/qlsalj/course';

function row(label, control, { onclick, hint } = {}) {
  const tag = onclick ? 'button' : 'div';
  return h(tag, { class: `row${onclick ? ' tappable' : ''}`, onclick },
    h('div', { class: 'row-label' }, h('span', null, label), hint ? h('small', null, hint) : null),
    h('div', { class: 'row-control' }, control, onclick ? icon('chevron') : null)
  );
}

function group(title, ...rows) {
  return h('section', { class: 'group' }, title ? h('h3', null, title) : null, h('div', { class: 'group-body' }, rows));
}

export function renderSettings() {
  const d = app.data;
  const cw = currentWeek(d);

  const nameInput = h('input', { class: 'input bare', value: d.name, maxlength: 40 });
  nameInput.addEventListener('change', () => app.update((x) => { x.name = nameInput.value.trim() || '我的课表'; }));

  const dateInput = h('input', { class: 'input bare', type: 'date', value: d.startDate });
  dateInput.addEventListener('change', () => {
    const dt = parseDate(dateInput.value);
    if (!dt) return;
    app.update((x) => { x.startDate = formatDate(mondayOf(dt)); });
  });

  const weekSel = h('select', { class: 'input bare' },
    h('option', { value: 0, selected: cw < 1 }, '未开学'),
    Array.from({ length: d.totalWeeks }, (_, i) => h('option', { value: i + 1, selected: cw === i + 1 }, `第 ${i + 1} 周`)),
    cw > d.totalWeeks ? h('option', { value: -1, selected: true }, '已结束') : null
  );
  weekSel.addEventListener('change', () => {
    const w = +weekSel.value;
    if (w > 0) app.update((x) => { x.startDate = startDateForCurrentWeek(w); });
  });

  const totalInput = h('input', { class: 'input bare num', type: 'number', min: 1, max: 60, value: d.totalWeeks, inputmode: 'numeric' });
  totalInput.addEventListener('change', () => {
    const n = Math.min(60, Math.max(1, parseInt(totalInput.value, 10) || d.totalWeeks));
    app.update((x) => { x.totalWeeks = n; });
  });

  const weekendSel = h('select', { class: 'input bare' },
    [['auto', '有课时显示'], ['always', '总是显示'], ['never', '不显示']].map(([v, l]) => h('option', { value: v, selected: d.showWeekend === v }, l))
  );
  weekendSel.addEventListener('change', () => app.update((x) => { x.showWeekend = weekendSel.value; }));

  const otherToggle = h('input', { type: 'checkbox', class: 'switch', checked: d.showOtherWeeks });
  otherToggle.addEventListener('change', () => app.update((x) => { x.showOtherWeeks = otherToggle.checked; }));

  const stamp = formatDate(new Date());

  return h('div', { class: 'page settings' },
    h('header', { class: 'page-head' }, h('h1', null, '设置')),
    group('导入 / 导出',
      row('导入课表', h('span', { class: 'muted' }, '教务系统 · WakeUp · 文件'), { onclick: () => openImportSheet() }),
      row('iOS 桌面小组件', h('span', { class: 'muted' }, 'Scriptable'), { onclick: () => openWidgetSheet() }),
      row('复制分享链接', h('span', { class: 'muted' }, '别人打开即可查看'), {
        onclick: async () => {
          const url = await shareUrl(app.baseUrl, d, 'week');
          toast((await copyText(url)) ? '链接已复制' : '复制失败');
        }
      }),
      row('导出到系统日历', h('span', { class: 'muted' }, '.ics'), {
        hint: 'iPhone：在分享面板选「存储到文件」，再到「文件」App 打开它，点「添加全部」',
        onclick: () => download(`${d.name}-${stamp}.ics`, exportIcs(d), 'text/calendar')
      }),
      row('备份为 JSON', null, { onclick: () => download(`${d.name}-${stamp}.json`, exportJson(d), 'application/json') }),
      row('导出 CSV', h('span', { class: 'muted' }, 'WakeUp 模板格式'), { onclick: () => download(`${d.name}-${stamp}.csv`, exportCsv(d), 'text/csv') })
    ),
    group('学期',
      row('课表名称', nameInput),
      row('开学日期', dateInput, { hint: '第 1 周的周一' }),
      row('当前周', weekSel, { hint: '修改后自动推算开学日期' }),
      row('学期总周数', totalInput)
    ),
    group('显示',
      row('作息时间', h('span', { class: 'muted' }, `每天 ${d.periods.length} 节`), { onclick: openPeriodsEditor }),
      row('显示周末', weekendSel),
      row('显示非本周课程', otherToggle, { hint: '以灰色显示在空白格子里' })
    ),
    group('数据',
      row('课程数量', h('span', { class: 'muted' }, `${new Set(d.courses.map((c) => c.name)).size} 门 · ${d.courses.length} 个时段`)),
      h('button', {
        class: 'row tappable danger-text',
        onclick: async () => {
          if (!(await confirmDialog('确定删除所有课程吗？设置会保留。建议先导出备份。', { okText: '全部删除', danger: true }))) return;
          app.update((x) => { x.courses = []; });
          toast('已清空');
        }
      }, '清空所有课程')
    ),
    h('footer', { class: 'about' },
      h('p', null, `课表 v${VERSION} · 数据只保存在本机浏览器中`),
      h('p', null, h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'GitHub 开源'), ' · MIT License')
    )
  );
}

function openPeriodsEditor() {
  const d = app.data;
  let periods = d.periods.map((p) => ({ ...p }));
  const list = h('div', { class: 'periods' });

  function draw() {
    list.replaceChildren(...periods.map((p, i) => {
      const s = h('input', { class: 'input', type: 'time', value: p.start });
      const e = h('input', { class: 'input', type: 'time', value: p.end });
      s.addEventListener('change', () => { p.start = s.value; });
      e.addEventListener('change', () => { p.end = e.value; });
      return h('div', { class: 'period-row' },
        h('b', null, `第 ${i + 1} 节`), s, h('span', null, '–'), e,
        h('button', { class: 'period-del', 'aria-label': `删除第 ${i + 1} 节`, onclick: () => { periods.splice(i, 1); draw(); }, html: icons.close })
      );
    }));
  }
  draw();

  // 快速生成
  const g = {
    am: h('input', { class: 'input', type: 'time', value: periods[0]?.start || '08:00' }),
    amN: h('input', { class: 'input num', type: 'number', min: 0, max: 8, value: 4 }),
    pm: h('input', { class: 'input', type: 'time', value: periods[4]?.start || '14:00' }),
    pmN: h('input', { class: 'input num', type: 'number', min: 0, max: 8, value: 4 }),
    ev: h('input', { class: 'input', type: 'time', value: periods[8]?.start || '19:00' }),
    evN: h('input', { class: 'input num', type: 'number', min: 0, max: 8, value: 4 }),
    len: h('input', { class: 'input num', type: 'number', min: 10, max: 180, value: 45 }),
    gap: h('input', { class: 'input num', type: 'number', min: 0, max: 60, value: 10 })
  };
  const generate = () => {
    const len = +g.len.value || 45;
    const gap = +g.gap.value || 0;
    const out = [];
    [[g.am, g.amN], [g.pm, g.pmN], [g.ev, g.evN]].forEach(([t, n]) => {
      let m = toMinutes(t.value);
      for (let i = 0; i < (+n.value || 0); i++) {
        out.push({ start: fromMinutes(m), end: fromMinutes(m + len) });
        m += len + gap;
      }
    });
    if (out.length) { periods = out; draw(); toast(`已生成 ${out.length} 节`); }
  };

  const s = openSheet({
    title: '作息时间',
    content: h('div', null,
      list,
      h('div', { class: 'row-actions' },
        h('button', {
          class: 'btn small',
          onclick: () => {
            const last = periods[periods.length - 1];
            const start = last ? toMinutes(last.end) + 10 : 480;
            periods.push({ start: fromMinutes(start), end: fromMinutes(start + 45) });
            draw();
          }
        }, '＋ 添加一节')
      ),
      h('details', { class: 'card' },
        h('summary', null, '快速生成'),
        h('div', { class: 'gen-grid' },
          h('label', null, '上午开始', g.am), h('label', null, '节数', g.amN),
          h('label', null, '下午开始', g.pm), h('label', null, '节数', g.pmN),
          h('label', null, '晚上开始', g.ev), h('label', null, '节数', g.evN),
          h('label', null, '每节（分钟）', g.len), h('label', null, '课间（分钟）', g.gap)
        ),
        h('button', { class: 'btn small primary', onclick: generate }, '生成')
      )
    ),
    footer: [
      h('button', { class: 'btn', onclick: () => s.close() }, '取消'),
      h('button', {
        class: 'btn primary',
        onclick: () => {
          const valid = sanitize({ periods }).periods;
          if (periods.some((p) => !p.start || !p.end)) return toast('请填写完整的时间');
          if (periods.some((p) => toMinutes(p.end) <= toMinutes(p.start))) return toast('下课时间需要晚于上课时间');
          app.update((x) => { x.periods = valid; });
          s.close();
          toast('已保存');
        }
      }, '保存')
    ]
  });
}
