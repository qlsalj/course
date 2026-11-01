// 端到端测试（需要先在 8080 端口启动静态服务：npm start）
// node tests/e2e.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const APP = process.env.APP_URL || 'http://localhost:8080/';
// 用另一个 origin 模拟教务系统（跨域加载书签脚本）
const JW = APP.replace('localhost', '127.0.0.1');
const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

const browser = await chromium.launch();
const errors = [];
async function newPage(time = '2026-11-04T10:20:00') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(APP).origin });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(time) });
  return page;
}
const step = async (name, fn) => { await fn(); console.log('✓', name); };

let importPayload;

await step('书签脚本在"教务系统"页面识别强智课表', async () => {
  const app = await newPage();
  await app.goto(`${APP}#/import`);
  const href = await app.getAttribute('a.bookmarklet', 'href');
  assert.ok(href.startsWith('javascript:'));
  const jw = await newPage();
  await jw.goto(`${JW}tests/fixtures/qiangzhi.html`);
  await jw.evaluate(decodeURIComponent(href.slice('javascript:'.length)));
  const status = jw.locator('#__course_importer__ .status');
  await status.filter({ hasText: '识别到' }).waitFor({ timeout: 5000 });
  assert.match(await status.textContent(), /识别到 5 门课程/);
  importPayload = await jw.evaluate(() => {
    // 直接读取面板生成的数据（等价于点击"复制课表数据"）
    const items = document.querySelector('#__course_importer__').shadowRoot.querySelectorAll('.item');
    return items.length;
  });
  assert.equal(importPayload, 5);
  await jw.context().close();
  await app.context().close();
});

await step('粘贴导入 正方 JSON → 确认 → 课表显示', async () => {
  const page = await newPage();
  await page.goto(`${APP}#/import`);
  await page.fill('.import textarea', fixture('zhengfang.json'));
  await page.click('button:has-text("解析输入框")');
  await page.waitForSelector('.import-confirm');
  assert.match(await page.textContent('.import-confirm'), /识别到 5 门课程/);
  await page.selectOption('.import-confirm select', '9');
  await page.click('.sheet-foot button:has-text("导入")');
  await page.waitForSelector('.page.week .course');
  assert.match(await page.textContent('.week-title'), /第 9 周/);
  const names = await page.$$eval('.course .course-name', (els) => els.map((e) => e.textContent));
  assert.ok(names.includes('高等数学A(1)'));
  // 周三 3-4 节双周英语：第 9 周是单周，应显示为非本周
  assert.ok(names.includes('[非本周] 大学英语(1)'));
  await page.context().close();
});

await step('WakeUp 文件导入（含作息时间与开学日期）', async () => {
  const page = await newPage();
  await page.goto(`${APP}#/import`);
  await page.setInputFiles('.import input[type=file]', {
    name: 'sample.wakeup_schedule', mimeType: 'application/octet-stream', buffer: Buffer.from(fixture('sample.wakeup_schedule'))
  });
  await page.waitForSelector('.import-confirm');
  await page.click('.sheet-foot button:has-text("导入")');
  await page.waitForSelector('.page.week .course');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('course-pwa:data:v1')));
  assert.equal(data.name, '大二上');
  assert.equal(data.startDate, '2026-09-07');
  assert.equal(data.totalWeeks, 18);
  assert.equal(data.periods.length, 12);
  assert.equal(data.courses.length, 3);
  await page.context().close();
});

let widgetUrl;
await step('导出小组件脚本：预览、复制', async () => {
  const page = await newPage();
  await page.goto(APP);
  await page.evaluate((d) => localStorage.setItem('course-pwa:data:v1', d), fixture('demo.json'));
  await page.goto(`${APP}index.html#/widget`);
  await page.waitForSelector('.widget-stage .sw-widget');
  assert.match(await page.textContent('.widget-stage'), /数据结构/);
  await page.click('button:has-text("复制 Scriptable 脚本")');
  const script = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(script, /^\/\/ Variables used by Scriptable/);
  assert.ok(!script.includes('/*@DATA*/'));
  widgetUrl = /const APP_URL = "([^"]+)"/.exec(script)[1] + '#/today?s=' + /const SNAPSHOT = "([^"]+)"/.exec(script)[1];
  await page.context().close();
});

await step('点击小组件链接：在没有数据的浏览器中自动带上课表', async () => {
  const page = await newPage();
  await page.goto(widgetUrl);
  await page.waitForSelector('.now-card');
  assert.match(await page.textContent('.now-card'), /正在上课\s*数据结构/);
  assert.ok(!page.url().includes('?s='), 'URL 中的数据应被清理');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('course-pwa:data:v1')).courses.length);
  assert.equal(saved, 15);
  await page.context().close();
});

await step('手动添加课程', async () => {
  const page = await newPage();
  await page.goto(`${APP}#/week`);
  await page.click('.cell >> nth=0');
  await page.fill('.form input >> nth=0', '测试课程');
  await page.fill('.form input >> nth=1', 'A101');
  await page.click('.sheet-foot button:has-text("保存")');
  await page.waitForSelector('.course:has-text("测试课程")');
  await page.context().close();
});

await browser.close();
assert.deepEqual(errors, [], `页面错误：${errors.join('\n')}`);
console.log('全部通过');
