// 用 Playwright 把 icons/icon.svg 渲染成 PNG：node tools/make-icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = readFileSync(`${root}icons/icon.svg`, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const targets = [
  ['icon-180.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true]
];
for (const [name, size, maskable] of targets) {
  // apple-touch-icon / maskable 需要不透明的满版底色，系统会自己裁圆角
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#4F6FF0;display:flex;align-items:center;justify-content:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg}</div></div>`
    : `<div style="width:${size}px;height:${size}px;background:#4F6FF0">${svg.replace('rx="112"', 'rx="0"')}</div>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${inner}<style>svg{width:100%;height:100%;display:block}</style></body></html>`);
  await page.screenshot({ path: `${root}icons/${name}`, omitBackground: false });
  console.log('wrote', name);
}
await browser.close();
