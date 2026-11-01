import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture } from './helpers.js';

const { exportIcs, exportCsv, buildWidgetScript } = await import('../js/exporters.js');
const { sanitize } = await import('../js/store.js');
const { parseCsv } = await import('../js/importers.js');
const { runWidgetScript, widgetText } = await import('../js/widget-preview.js');

const data = sanitize(JSON.parse(fixture('demo.json')));
const template = readFileSync(new URL('../scriptable/widget.js', import.meta.url), 'utf8');

test('ICS：按周展开、本地时区、折行', () => {
  const ics = exportIcs(data);
  const events = ics.match(/BEGIN:VEVENT/g).length;
  const expected = data.courses.reduce((n, c) => n + c.weeks.length, 0);
  assert.equal(events, expected);
  assert.match(ics, /DTSTART;TZID=Asia\/Shanghai:20260907T080000/);
  assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75));
});

test('CSV 导出可再导入', () => {
  const back = parseCsv(exportCsv(data).replace(/^﻿/, ''));
  assert.equal(back.courses.length, data.courses.length);
});

const script = await buildWidgetScript(template, data, { appUrl: 'https://example.github.io/course/' });

async function render(time, family, parameter = '') {
  const { widget } = await runWidgetScript(script, { family, parameter, now: new Date(time) });
  assert.ok(widget, '应调用 Script.setWidget');
  return { widget, text: widgetText(widget) };
}

const FAMILIES = ['small', 'medium', 'large', 'accessoryRectangular', 'accessoryInline', 'accessoryCircular'];
const TIMES = {
  开学前: '2026-08-30T09:00:00',
  上课中: '2026-11-04T10:20:00',
  课间: '2026-11-04T12:00:00',
  放学后: '2026-11-04T22:00:00',
  周末: '2026-11-07T10:00:00',
  假期: '2027-02-01T10:00:00'
};

test('小组件脚本：所有尺寸、各种时间都能正常运行', async () => {
  for (const [label, t] of Object.entries(TIMES)) {
    for (const f of FAMILIES) {
      const { text } = await render(t, f);
      assert.ok(text.length > 0, `${label} ${f} 内容为空`);
    }
    await render(t, 'large', 'week');
    await render(t, 'medium', 'tomorrow');
  }
});

test('小组件内容', async () => {
  let r = await render(TIMES.上课中, 'medium');
  assert.match(r.text, /第9周/);
  assert.match(r.text, /数据结构[\s\S]*上课中/);
  assert.equal(r.widget.url.startsWith('https://example.github.io/course/#/today?s=z'), true);

  r = await render(TIMES.放学后, 'small');
  assert.match(r.text, /明天/);
  assert.match(r.text, /概率论与数理统计/);

  r = await render(TIMES.周末, 'small');
  assert.match(r.text, /后天/); // 周六看周一
  assert.match(r.text, /数据结构/);

  r = await render(TIMES.开学前, 'accessoryInline');
  assert.match(r.text, /距开学 8 天/);

  r = await render(TIMES.假期, 'accessoryCircular');
  assert.match(r.text, /假期/);

  r = await render(TIMES.上课中, 'large', 'week');
  assert.match(r.text, /Python 数据分析/);
  assert.equal(r.widget.url, 'https://example.github.io/course/#/week?s=' + /const SNAPSHOT = "([^"]+)"/.exec(script)[1]);
});

test('refreshAfterDate 指向下一个上下课时间点', async () => {
  const { widget } = await render('2026-11-04T12:00:00', 'medium');
  const d = widget.refreshAfterDate;
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 0);
});

test('CSV：单双周混合的周次导出后再导入不丢周', async () => {
  const { exportCsv: ex, csvWeeks } = await import('../js/exporters.js');
  const weeks = [1, 2, 3, 4, 6, 8, 10, 12, 14, 16];
  assert.equal(csvWeeks(weeks), '1-4,6,8,10,12,14,16');
  assert.equal(csvWeeks([1, 3, 5, 7]), '1-7单');
  const d = sanitize({ ...data, courses: [{ name: 'X', day: 1, start: 1, end: 2, weeks }, { name: 'Y', day: 2, start: 1, end: 2, weeks: [2, 4, 6] }] });
  const back = parseCsv(ex(d).replace(/^﻿/, ''));
  assert.deepEqual(back.courses.find((c) => c.name === 'X').weeks, weeks);
  assert.deepEqual(back.courses.find((c) => c.name === 'Y').weeks, [2, 4, 6]);
});

test('ICS：不导出学期总周数之外的周', () => {
  const d = sanitize({ ...data, totalWeeks: 10 });
  const ics = exportIcs(d);
  assert.ok(!/-w1[1-9]@/.test(ics));
  assert.match(ics, /-w10@/);
});
