import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekOf, dateOf, startDateForCurrentWeek, formatDate, mondayOf, guessStartDate } from '../js/time.js';

test('周次计算', () => {
  assert.equal(weekOf('2026-09-07', new Date(2026, 8, 7)), 1);
  assert.equal(weekOf('2026-09-07', new Date(2026, 8, 13)), 1); // 周日
  assert.equal(weekOf('2026-09-07', new Date(2026, 8, 14)), 2);
  assert.equal(weekOf('2026-09-09', new Date(2026, 8, 7)), 1); // 开学日期不是周一
  assert.equal(weekOf('2026-09-07', new Date(2026, 8, 6)), 0);
  assert.equal(weekOf('2026-09-07', new Date(2026, 10, 4)), 9);
});

test('dateOf / startDateForCurrentWeek', () => {
  assert.equal(formatDate(dateOf('2026-09-07', 9, 3)), '2026-11-04');
  assert.equal(startDateForCurrentWeek(9, new Date(2026, 10, 4)), '2026-09-07');
  assert.equal(formatDate(mondayOf(new Date(2026, 10, 8))), '2026-11-02');
});

test('guessStartDate 返回周一', () => {
  for (const m of [0, 3, 8, 11]) {
    const d = new Date(guessStartDate(new Date(2026, m, 15)) + 'T00:00:00');
    assert.equal(d.getDay(), 1);
  }
});
