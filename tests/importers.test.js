import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';

const { parseImport, parseWakeUp, parseCsv } = await import('../js/importers.js');
const { encodeData } = await import('../js/share.js');

test('WakeUp 课程表文件', () => {
  const r = parseWakeUp(fixture('sample.wakeup_schedule'));
  assert.equal(r.settings.name, '大二上');
  assert.equal(r.settings.startDate, '2026-09-07');
  assert.equal(r.settings.totalWeeks, 18);
  assert.equal(r.settings.periods.length, 12);
  assert.equal(r.courses.length, 3);
  const odd = r.courses.find((c) => c.day === 3);
  assert.deepEqual(odd.weeks, [1, 3, 5, 7, 9, 11, 13, 15]);
  const net = r.courses.find((c) => c.name === '计算机网络');
  assert.deepEqual([net.start, net.end, net.color], [5, 7, '#F08A3E']);
  assert.deepEqual(net.weeks, [2, 4, 6, 8, 10, 12]);
});

test('CSV（WakeUp 模板，含引号与中文星期）', () => {
  const r = parseCsv(fixture('sample.csv'));
  assert.equal(r.courses.length, 3);
  const en = r.courses.find((c) => c.name === '大学英语, 精读');
  assert.equal(en.day, 3);
  assert.deepEqual(en.weeks, [1, 3, 5, 7, 9, 11, 13, 15]);
});

test('自动识别格式', async () => {
  assert.equal((await parseImport(fixture('sample.wakeup_schedule'), 'x.wakeup_schedule')).source, 'WakeUp 课程表');
  assert.equal((await parseImport(fixture('zhengfang.json'))).courses.length, 6);
  assert.equal((await parseImport(fixture('demo.json'))).source, '课表备份');
  assert.equal((await parseImport(fixture('sample.csv'))).source, 'CSV');
  const payload = JSON.stringify({ type: 'course-pwa/import', source: '强智教务', courses: [{ name: 'A', day: 1, start: 1, end: 2, weeks: [1] }] });
  assert.equal((await parseImport(payload)).source, '强智教务');
  await assert.rejects(parseImport('hello world'));
});

test('分享链接编码 / 解码', async () => {
  const data = JSON.parse(fixture('demo.json'));
  const s = await encodeData(data);
  assert.equal(s[0], 'z');
  const r = await parseImport(`https://example.com/course/#/week?s=${s}`);
  assert.equal(r.courses.length, data.courses.length);
  assert.equal(r.settings.startDate, data.startDate);
});
