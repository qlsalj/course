import { test } from 'node:test';
import assert from 'node:assert/strict';

const { layoutDay, sanitize } = await import('../js/store.js');
const c = (name, start, end) => ({ name, start, end });

test('layoutDay：重叠的课合并，块范围覆盖所有课（含连锁重叠）', () => {
  const blocks = layoutDay([c('A', 1, 2), c('B', 2, 4), c('C', 4, 5), c('D', 7, 8)], []);
  assert.equal(blocks.length, 2);
  assert.deepEqual([blocks[0].start, blocks[0].end, blocks[0].items.length], [1, 5, 3]);
  assert.deepEqual([blocks[1].start, blocks[1].end], [7, 8]);
});

test('layoutDay：多门非本周课程重叠时合并成一个块，而不是丢掉', () => {
  const blocks = layoutDay([], [c('W1', 1, 2), c('W2', 1, 2)]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[0].other, true);
});

test('layoutDay：非本周课程不占用本周课程的时间', () => {
  const blocks = layoutDay([c('A', 1, 2)], [c('X', 2, 3), c('Y', 5, 6)]);
  assert.deepEqual(blocks.map((b) => b.items[0].name), ['A', 'Y']);
});

test('sanitize 保留课表 id，缺失时生成', () => {
  assert.equal(sanitize({ id: 'abc123' }).id, 'abc123');
  assert.match(sanitize({}).id, /^[\w-]{4,40}$/);
});
