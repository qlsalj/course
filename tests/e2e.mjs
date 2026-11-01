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

  // iOS 快捷指令「在网页上运行 JavaScript」：代码作为函数体执行，需要调用 completion()
  await jw.reload();
  await app.click('summary:has-text("方式 A")').catch(() => {});
  const shortcut = await app.evaluate(async () => (await import('./js/sheets/import.js')).shortcutScript(location.origin + location.pathname));
  const runShortcut = (pg) => pg.evaluate((code) => new Promise((resolve) => { new Function('completion', code)(resolve); }), shortcut);
  assert.equal(await runShortcut(jw), '', '成功时 completion 返回空字符串');
  await jw.locator('#__course_importer__ .status').filter({ hasText: '识别到 5 门课程' }).waitFor({ timeout: 5000 });
  assert.ok(/^[\x20-\x7e\n]+$/.test(shortcut), '快捷指令代码应只包含 ASCII 字符');

  // 网站有 CSP、拦截外部 <script>：快捷指令改为 fetch 源码后执行
  const csp = await newPage();
  await csp.goto(`${JW}tests/fixtures/csp.html`);
  assert.equal(await runShortcut(csp), '');
  await csp.locator('#__course_importer__ .status').filter({ hasText: '识别到 1 门课程' }).waitFor({ timeout: 5000 });
  await csp.context().close();

  // 校园门户：课表在跨域 iframe 里 → 提示单独打开
  const portal = await newPage();
  await portal.goto(`${JW}tests/fixtures/portal.html`);
  const inner = `${APP}tests/fixtures/qiangzhi.html`;
  await portal.evaluate((src) => new Promise((r) => { const f = document.createElement('iframe'); f.src = src; f.onload = r; document.getElementById('slot').appendChild(f); }), inner);
  assert.equal(await runShortcut(portal), '');
  const btn = portal.locator('#__course_importer__ button[data-act="frame"]');
  await btn.waitFor({ timeout: 5000 });
  assert.equal(await btn.getAttribute('data-url'), inner);
  await portal.context().close();
  assert.ok(/^[\x20-\x7e]+$/.test(href), '书签脚本应只包含 ASCII 字符');
  await jw.context().close();
  await app.context().close();
});

await step('网页课表解析（强智 / 正方网页 / 通用表格 / 课程名[班号] 一行多字段）', async () => {
  const page = await newPage();
  await page.goto(APP);
  const parse = (html) => page.evaluate((h) => CourseParsers.parseHtml(h).courses.map((c) =>
    [c.name, c.teacher, c.room, c.day, c.start, c.end, CourseParsers.formatWeeks(c.weeks)].join('|')), html);
  assert.deepEqual(await parse(fixture('bracket-class.html')), [
    '高等数学A|田静|实验大楼 实309|1|1|2|1-16周',
    '大学物理实验|操凤萍|实验大楼 实516|2|3|4|4-17周',
    '数据结构|李华|教学楼 A201|3|1|2|4-18周(双)',
    '计算机组成课程设计|张志鹏|实验大楼 实309 机房|5|5|8|1-8,10-11周'
  ]);
  // 行头里的上课时间
  assert.deepEqual(await page.evaluate((h) => CourseParsers.parseHtml(h).periodTimes, fixture('bracket-class.html')), {
    1: { start: '08:00', end: '08:45' },
    2: { start: '08:55', end: '09:40' },
    3: { start: '10:00', end: '10:45' },
    4: { start: '10:55', end: '11:40' },
    5: { start: '14:00', end: '14:45' },
    7: { start: '15:30', end: '16:15' }
  });
  assert.deepEqual(await parse(fixture('qiangzhi.html')), [
    '高等数学|李明|教一101|1|1|2|1-16周',
    '大学物理|孙伟|理科楼201|2|3|4|2-16周(双)',
    '概率论|吴刚|教三306|3|1|2|9-16周',
    '线性代数|周红|教三305|3|1|2|1-8周',
    '数据结构|郑强|计算机楼310|4|5|7|1-16周'
  ]);
  assert.deepEqual(await parse(fixture('zhengfang-web.html')), [
    '高等数学A|李明|教一-101|1|1|2|1-16周',
    '大学英语|Smith|外语楼302|2|3|4|1-15周(单)',
    '英语听说|Lee|外语楼303|2|3|4|2-16周(双)'
  ]);
  assert.deepEqual(await parse(fixture('generic.html')), [
    '操作系统|陈老师|信息楼B402|1|1|2|1-16周',
    '编译原理|黄老师|信息楼C201|2|3|4|1-8周',
    '计算机网络|林老师|信息楼A101|4|1|2|1-12周',
    '形势与政策|何老师|大礼堂|5|3|3|5周'
  ]);
  await page.context().close();
});

await step('单元格各种写法（标签、英文教师、课程名含"节"、|单周、只有地点）', async () => {
  const page = await newPage();
  await page.goto(APP);
  const cell = (lines) => page.evaluate((h) => CourseParsers.parseHtml(h).courses.map((c) =>
    [c.name, c.teacher, c.room, CourseParsers.formatWeeks(c.weeks)].join('|')).join(';'),
  `<table><tr><th>节次</th><th>周一</th><th>周二</th><th>周三</th><th>周四</th><th>周五</th></tr><tr><td>第1节</td><td>${lines.join('<br>')}</td><td></td><td></td><td></td><td></td></tr><tr><td>第2节</td><td></td><td></td><td></td><td></td><td></td></tr></table>`);
  assert.equal(await cell(['数据库原理', '教师：王五', '上课时间：第3-8周', '地点：A101']), '数据库原理|王五|A101|3-8周');
  assert.equal(await cell(['数据库原理', '周次：(1-16周)', '王五', 'A101']), '数据库原理|王五|A101|1-16周');
  assert.equal(await cell(['编译原理 1-8周 Smith 信息楼C201']), '编译原理|Smith|信息楼C201|1-8周');
  assert.equal(await cell(['节能技术 1-16周 李明 教一101']), '节能技术|李明|教一101|1-16周');
  assert.equal(await cell(['高等数学', '周一第1,2节{第1-15周|单周}', '张三', 'B202']), '高等数学|张三|B202|1-15周(单)');
  assert.equal(await cell(['电路实验[02] 2-9周 实验大楼 实309']), '电路实验||实验大楼 实309|2-9周');
  await page.context().close();
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

await step('别人分享的课表不会覆盖本机课表；同一份课表的新版本会同步', async () => {
  const page = await newPage();
  await page.goto(APP);
  const mine = { ...JSON.parse(fixture('demo.json')), id: 'mine-0001', updatedAt: 1000 };
  await page.evaluate((d) => localStorage.setItem('course-pwa:data:v1', JSON.stringify(d)), mine);
  const link = (obj) => page.evaluate(async (o) => {
    const { shareUrl } = await import('./js/exporters.js');
    return shareUrl(location.origin + '/', o, 'week');
  }, obj);
  const friend = { ...mine, id: 'friend-001', name: '朋友的课表', updatedAt: 9e12, courses: mine.courses.slice(0, 2) };
  const open = async (obj, v) => page.goto(`${APP}index.html?v=${v}#${(await link(obj)).split('#')[1]}`);
  await open(friend, 1);
  await page.waitForSelector('.import-confirm');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('course-pwa:data:v1')));
  assert.equal(saved.courses.length, mine.courses.length, '不应静默覆盖');
  assert.equal(saved.id, 'mine-0001');

  const newer = { ...mine, updatedAt: 9e12, courses: mine.courses.slice(0, 3) };
  await open(newer, 2);
  await page.waitForSelector('.page.week .course');
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('course-pwa:data:v1')));
  assert.equal(saved.courses.length, 3, '同一份课表的新版本应同步');
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
