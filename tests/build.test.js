import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, appendFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const { buildSite } = await import('../tools/build-site.mjs');
const root = fileURLToPath(new URL('..', import.meta.url));

function swAssets(sw) {
  const m = /const ASSETS = (\[[\s\S]*?\]);/.exec(sw);
  return vm.runInNewContext(m[1]);
}

test('build-site：版本号、完整文件清单、modulepreload', () => {
  const out = mkdtempSync(join(tmpdir(), 'site-'));
  const { version } = buildSite(root, out);
  assert.match(version, /^[0-9a-f]{12}$/);
  const sw = readFileSync(join(out, 'sw.js'), 'utf8');
  assert.ok(sw.includes(`const VERSION = '${version}';`));
  const assets = swAssets(sw);
  const jsFiles = readdirSync(join(root, 'js'), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => `js/${f.split('\\').join('/')}`);
  for (const f of jsFiles) assert.ok(assets.includes(f), `清单缺少 ${f}`);
  assert.ok(assets.includes('./') && assets.includes('index.html') && assets.includes('scriptable/widget.js'));
  assert.ok(!assets.includes('sw.js'));
  const index = readFileSync(join(out, 'index.html'), 'utf8');
  for (const f of jsFiles) assert.ok(index.includes(`<link rel="modulepreload" href="${f}">`), `缺少 modulepreload ${f}`);
  assert.ok(!index.includes('modulepreload" href="jw/'), 'jw/ 是普通脚本，不应 modulepreload');
});

test('build-site：任何文件变化都会改变版本号', () => {
  const src = mkdtempSync(join(tmpdir(), 'src-'));
  for (const e of ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll', 'css', 'js', 'jw', 'scriptable', 'icons']) {
    cpSync(join(root, e), join(src, e), { recursive: true });
  }
  const a = buildSite(src, mkdtempSync(join(tmpdir(), 'out-'))).version;
  const b = buildSite(src, mkdtempSync(join(tmpdir(), 'out-'))).version;
  assert.equal(a, b, '内容不变时版本号应稳定');
  appendFileSync(join(src, 'css/app.css'), '\n/* change */\n');
  const c = buildSite(src, mkdtempSync(join(tmpdir(), 'out-'))).version;
  assert.notEqual(a, c);
});
