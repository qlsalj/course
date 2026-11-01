import { test } from 'node:test';
import assert from 'node:assert/strict';
import { P, fixture } from './helpers.js';

const range = (a, b, step = 1) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);

test('parseWeeks 常见格式', () => {
  const cases = {
    '1-16周': range(1, 16),
    '1-15周(单)': range(1, 15, 2),
    '2-16(双周)': range(2, 16, 2),
    '1-8,10-16周': [...range(1, 8), ...range(10, 16)],
    '1-4周,6-16周(双)': [...range(1, 4), ...range(6, 16, 2)],
    '1-8,10-16周(双)': [...range(2, 8, 2), ...range(10, 16, 2)],
    '第3周': [3],
    '1,3,5,7周': [1, 3, 5, 7],
    '1-16(周)[01-02节]': range(1, 16),
    '(1-2节)1-16周': range(1, 16),
    '周一第1,2节{第1-15周|单周}': range(1, 15, 2),
    '１－８周': range(1, 8),
    '1~16周': range(1, 16),
    '1-15 周(单)': range(1, 15, 2),
    '': []
  };
  for (const [input, expected] of Object.entries(cases)) assert.deepEqual(P.parseWeeks(input), expected, input);
});

test('formatWeeks 与 parseWeeks 互逆', () => {
  for (const s of ['1-16周', '1-15周(单)', '2-16周(双)', '1-8,10-16周', '1-4周,6-16周(双)', '3周', '1-3,5周']) {
    assert.equal(P.formatWeeks(P.parseWeeks(s)), s);
  }
});

test('parsePeriods', () => {
  assert.deepEqual(P.parsePeriods('[01-02节]'), { start: 1, end: 2 });
  assert.deepEqual(P.parsePeriods('[05-06-07节]'), { start: 5, end: 7 });
  assert.deepEqual(P.parsePeriods('第5,6节'), { start: 5, end: 6 });
  assert.deepEqual(P.parsePeriods('第十一节'), { start: 11, end: 11 });
  assert.deepEqual(P.parsePeriods('第三大节'), { start: 5, end: 6, big: true });
  assert.equal(P.parsePeriods('1-16周'), null);
});

test('parseDay', () => {
  assert.equal(P.parseDay('星期一'), 1);
  assert.equal(P.parseDay('周日'), 7);
  assert.equal(P.parseDay('Wed'), 3);
  assert.equal(P.parseDay('6'), 6);
  assert.equal(P.parseDay('abc'), 0);
});

test('正方接口 JSON', () => {
  const r = P.parseZhengfangJson(fixture('zhengfang.json'));
  assert.equal(r.courses.length, 6);
  const prog = r.courses.find((c) => c.name === '程序设计基础');
  assert.deepEqual([prog.day, prog.start, prog.end], [2, 5, 7]);
  assert.deepEqual(prog.weeks, [...range(1, 8), ...range(10, 17)]);
  const en = r.courses.filter((c) => c.name === '大学英语(1)');
  assert.equal(en.length, 2);
  assert.deepEqual(en[0].weeks, range(1, 15, 2));
});

test('相邻节次合并', () => {
  const merged = P.finalize([
    { name: 'A', teacher: 't', room: 'r', day: 1, start: 1, end: 1, weeks: [1, 2] },
    { name: 'A', teacher: 't', room: 'r', day: 1, start: 2, end: 2, weeks: [1, 2] },
    { name: 'A', teacher: 't', room: 'r', day: 1, start: 3, end: 3, weeks: [3] }
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual([merged[0].start, merged[0].end], [1, 2]);
});

test('正方 base 路径（含 webvpn 前缀）', () => {
  const loc = (u) => { const x = new URL(u); return { origin: x.origin, pathname: x.pathname }; };
  assert.equal(P.zhengfangBase(loc('https://jw.x.edu.cn/jwglxt/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151')), 'https://jw.x.edu.cn/jwglxt/');
  assert.equal(P.zhengfangBase(loc('https://webvpn.x.edu.cn/https/abc123/jwglxt/xtgl/index_initMenu.html')), 'https://webvpn.x.edu.cn/https/abc123/jwglxt/');
  assert.equal(P.zhengfangBase(loc('https://jw.x.edu.cn/other/page')), null);
});
