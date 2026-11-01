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

async function render(time, family, parameter = '', screen) {
  const { widget } = await runWidgetScript(script, { family, parameter, now: new Date(time), screen });
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

test('已经上完的课不再显示在组件里（小 / 中 / 大）', async () => {
  // 周三 16:00：10:00 数据结构、14:00 马原 已结束，19:00 数据结构实验 还没上
  for (const family of ['small', 'medium', 'large']) {
    const { text } = await render('2026-11-04T16:00:00', family);
    assert.ok(!/马克思主义基本原理/.test(text), `${family} 不应显示已结束的课`);
    assert.match(text, /数据结构实验/, `${family} 应显示接下来的课`);
  }
  const { text } = await render('2026-11-04T16:00:00', 'large');
  assert.match(text, /还剩 1 节/);
  assert.match(text, /已上完 2 节/);
});

test('小号组件底部：只剩一节时才显示"最后一节课"', async () => {
  // 周三 12:00：还剩 14:00、19:00 两节
  let r = await render('2026-11-04T12:00:00', 'small');
  assert.match(r.text, /今天还剩 2 节/);
  assert.ok(!/最后一节/.test(r.text));
  // 周三 16:00：只剩 19:00 一节
  r = await render('2026-11-04T16:00:00', 'small');
  assert.match(r.text, /今天的最后一节课/);
});

test('大号组件按屏幕大小放满课程（大屏多显示明天的课）', async () => {
  const busy = sanitize(JSON.parse(fixture('userlike.json')));
  // 周一再加两节，凑成今天 4 节 + 明天 3 节
  const extra = await buildWidgetScript(template, sanitize({
    ...busy,
    courses: busy.courses.concat(
      { name: '软件工程', room: '实验大楼 实510', day: 2, start: 1, end: 2, weeks: [] },
      { name: '编译原理', room: '教学楼 A305', day: 2, start: 3, end: 4, weeks: [] }
    )
  }), { appUrl: 'https://example.github.io/course/' });
  const count = async (screen) => {
    const { widget } = await runWidgetScript(extra, { family: 'large', now: new Date('2026-11-02T02:10:00'), screen });
    const t = widgetText(widget);
    return ['计算机组成课程设计', '软件工程', '编译原理'].filter((n) => t.includes(n)).length;
  };
  const small = await count([375, 667]);
  const normal = await count([390, 844]);
  const big = await count([440, 956]);
  assert.ok(normal >= 2, `标准屏应显示至少 2 节明天的课，实际 ${normal}`);
  assert.ok(big > normal || big === 3, `大屏应比标准屏显示更多，实际 ${big} vs ${normal}`);
  assert.ok(small <= normal);
});

test('大号组件默认显示整周；Parameter 可以覆盖', async () => {
  const weekScript = await buildWidgetScript(template, data, { appUrl: 'https://example.github.io/course/', largeMode: 'week' });
  const run = async (code, parameter) => {
    const { widget } = await runWidgetScript(code, { family: 'large', parameter, now: new Date('2026-11-04T10:20:00') });
    return { text: widgetText(widget), url: widget.url };
  };
  let r = await run(weekScript, '');
  assert.match(r.text, /11\/2 - 11\/8/, '默认应为整周视图');
  assert.match(r.url, /#\/week\?/);
  r = await run(weekScript, 'today');
  assert.match(r.text, /还剩 3 节/, 'Parameter today 应显示今日课程');
  r = await run(script, 'week');
  assert.match(r.text, /11\/2 - 11\/8/, '默认今日的脚本，Parameter week 仍显示整周');
  r = await run(script, '');
  assert.ok(!/11\/2 - 11\/8/.test(r.text));
});

test('小号组件：放得下的文字不允许缩放（否则 iOS 会为了分配高度把课名压小）', async () => {
  const texts = (el, out = []) => { if (el.type === 'text') out.push(el); (el.children || []).forEach((c) => texts(c, out)); return out; };
  const { widget } = await runWidgetScript(script, { family: 'small', now: new Date('2026-11-04T08:20:00') });
  const all = texts(widget);
  const name = all.find((t) => t.text === '数据结构');
  assert.equal(name.minimumScaleFactor, 1);
  assert.ok(all.filter((t) => t.text.length <= 8).every((t) => t.minimumScaleFactor === 1), '短文字都不应缩放');
  // 很长的课名放不下一行时，才允许缩小
  const long = await buildWidgetScript(template, sanitize({ ...data, courses: [{ name: '马克思主义基本原理概论与实践', room: 'A101', day: 3, start: 3, end: 4, weeks: [] }] }), { appUrl: 'https://x/' });
  const r = await runWidgetScript(long, { family: 'small', now: new Date('2026-11-04T08:20:00') });
  const ln = texts(r.widget).find((x) => x.text.startsWith('马克思'));
  assert.ok(ln.minimumScaleFactor < 1);
});
