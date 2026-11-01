import { app } from '../context.js';
import { h, openSheet, confirmDialog, toast } from '../ui.js';
import { PALETTE, sanitizeCourse, uid } from '../store.js';
import { DAY_NAMES } from '../time.js';

const P = globalThis.CourseParsers;

export function weeksText(weeks) {
  return weeks && weeks.length ? P.formatWeeks(weeks) : '每周';
}

function timeText(c) {
  const p1 = app.data.periods[c.start - 1];
  const p2 = app.data.periods[c.end - 1] || p1;
  const t = p1 ? ` (${p1.start}-${p2.end})` : '';
  return `${DAY_NAMES[c.day]} 第${c.start}${c.end > c.start ? '-' + c.end : ''}节${t}`;
}

/** 课程详情（可能是同一时间段的多门课） */
export function openCourseDetail(courses, { week } = {}) {
  const s = openSheet({
    title: courses.length > 1 ? `${courses.length} 门课程` : '课程详情',
    content: h('div', { class: 'detail-list' }, courses.map((c) => h('article', { class: 'detail', style: { '--c': c.color } },
      h('div', { class: 'detail-head' },
        h('h3', null, c.name),
        week && c.weeks.length && !c.weeks.includes(week) ? h('span', { class: 'chip' }, '本周不上') : null
      ),
      h('dl', null,
        h('dt', null, '时间'), h('dd', null, timeText(c)),
        h('dt', null, '周次'), h('dd', null, weeksText(c.weeks)),
        c.room ? [h('dt', null, '教室'), h('dd', null, c.room)] : null,
        c.teacher ? [h('dt', null, '教师'), h('dd', null, c.teacher)] : null,
        c.note ? [h('dt', null, '备注'), h('dd', null, c.note)] : null
      ),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', onclick: () => { s.close(); openEditor(c); } }, '编辑'),
        h('button', {
          class: 'btn danger-text',
          onclick: async () => {
            if (!(await confirmDialog(`删除「${c.name}」${timeText(c)} 这一时段？`, { okText: '删除', danger: true }))) return;
            app.update((d) => { d.courses = d.courses.filter((x) => x.id !== c.id); });
            s.close();
            toast('已删除');
          }
        }, '删除')
      )
    )))
  });
}

/** 新建 / 编辑课程 */
export function openEditor(course, preset = {}) {
  const d = app.data;
  const isNew = !course;
  const c = course
    ? { ...course, weeks: course.weeks.slice() }
    : { id: uid(), name: '', teacher: '', room: '', day: 1, start: 1, end: 2, weeks: [], color: '', note: '', ...preset };
  if (!c.weeks.length) c.weeks = Array.from({ length: d.totalWeeks }, (_, i) => i + 1);
  const rows = Math.max(d.periods.length, c.end);

  const names = [...new Set(d.courses.map((x) => x.name))];
  const nameInput = h('input', { class: 'input', value: c.name, placeholder: '必填，如：高等数学', list: 'course-names', autocomplete: 'off' });
  const roomInput = h('input', { class: 'input', value: c.room, placeholder: '如：教一 101' });
  const teacherInput = h('input', { class: 'input', value: c.teacher, placeholder: '选填' });
  const noteInput = h('textarea', { class: 'input', rows: 2, placeholder: '选填' });
  noteInput.value = c.note || '';

  const daySel = h('select', { class: 'input' }, [1, 2, 3, 4, 5, 6, 7].map((i) => h('option', { value: i, selected: i === c.day }, DAY_NAMES[i])));
  const periodOptions = (sel) => Array.from({ length: rows }, (_, i) => h('option', { value: i + 1, selected: i + 1 === sel }, `第 ${i + 1} 节`));
  const startSel = h('select', { class: 'input' }, periodOptions(c.start));
  const endSel = h('select', { class: 'input' }, periodOptions(c.end));
  startSel.addEventListener('change', () => { if (+endSel.value < +startSel.value) endSel.value = startSel.value; });
  endSel.addEventListener('change', () => { if (+endSel.value < +startSel.value) startSel.value = endSel.value; });

  // 周次选择
  const weekSet = new Set(c.weeks);
  const weekBtns = Array.from({ length: d.totalWeeks }, (_, i) => {
    const w = i + 1;
    const b = h('button', { type: 'button', class: `wk${weekSet.has(w) ? ' sel' : ''}` }, String(w));
    b.addEventListener('click', () => { weekSet.has(w) ? weekSet.delete(w) : weekSet.add(w); sync(); });
    return b;
  });
  const weekSummary = h('span', { class: 'muted small' });
  function sync() {
    weekBtns.forEach((b, i) => b.classList.toggle('sel', weekSet.has(i + 1)));
    weekSummary.textContent = weekSet.size ? P.formatWeeks([...weekSet]) : '未选择';
  }
  const quick = (label, fn) => h('button', { type: 'button', class: 'btn small', onclick: () => { weekSet.clear(); for (let w = 1; w <= d.totalWeeks; w++) if (fn(w)) weekSet.add(w); sync(); } }, label);
  sync();

  // 颜色
  let color = c.color || d.courses.find((x) => x.name === c.name)?.color || '';
  const swatches = PALETTE.map((p) => {
    const b = h('button', { type: 'button', class: 'swatch', style: { background: p }, 'aria-label': p });
    b.addEventListener('click', () => { color = p; paint(); });
    return b;
  });
  function paint() { swatches.forEach((b, i) => b.classList.toggle('sel', PALETTE[i] === color)); }
  paint();

  // 选择已有课程名时自动填写
  nameInput.addEventListener('change', () => {
    const same = d.courses.find((x) => x.name === nameInput.value.trim());
    if (!same) return;
    if (!roomInput.value) roomInput.value = same.room;
    if (!teacherInput.value) teacherInput.value = same.teacher;
    if (!c.color) { color = same.color; paint(); }
  });

  const field = (label, ...ctrl) => h('label', { class: 'field' }, h('span', null, label), ...ctrl);

  const s = openSheet({
    title: isNew ? '添加课程' : '编辑课程',
    content: h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); submit(); } },
      h('datalist', { id: 'course-names' }, names.map((n) => h('option', { value: n }))),
      field('课程名称', nameInput),
      field('教室', roomInput),
      field('教师', teacherInput),
      h('div', { class: 'field-row' }, field('星期', daySel), field('开始', startSel), field('结束', endSel)),
      h('div', { class: 'field' },
        h('span', null, '上课周次 ', weekSummary),
        h('div', { class: 'week-picker compact' }, weekBtns),
        h('div', { class: 'quick' },
          quick('全部', () => true), quick('单周', (w) => w % 2 === 1), quick('双周', (w) => w % 2 === 0),
          quick('前半学期', (w) => w <= Math.ceil(d.totalWeeks / 2)), quick('后半学期', (w) => w > Math.ceil(d.totalWeeks / 2)), quick('清空', () => false))
      ),
      h('div', { class: 'field' }, h('span', null, '颜色'), h('div', { class: 'swatches' }, swatches)),
      field('备注', noteInput),
      h('button', { type: 'submit', hidden: true })
    ),
    footer: [
      h('button', { class: 'btn', onclick: () => s.close() }, '取消'),
      h('button', { class: 'btn primary', onclick: submit }, '保存')
    ]
  });

  function submit() {
    const name = nameInput.value.trim();
    if (!name) { toast('请填写课程名称'); nameInput.focus(); return; }
    if (!weekSet.size) { toast('请至少选择一周'); return; }
    const next = sanitizeCourse({
      ...c,
      name,
      room: roomInput.value,
      teacher: teacherInput.value,
      note: noteInput.value,
      day: +daySel.value,
      start: +startSel.value,
      end: +endSel.value,
      weeks: [...weekSet],
      color
    });
    app.update((data) => {
      const i = data.courses.findIndex((x) => x.id === next.id);
      if (i >= 0) data.courses[i] = next; else data.courses.push(next);
      // 同名课程统一颜色
      if (color) data.courses.forEach((x) => { if (x.name === next.name) x.color = color; });
    });
    s.close();
    toast(isNew ? '已添加' : '已保存');
  }
}
