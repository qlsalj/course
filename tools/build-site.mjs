// 生成要部署的站点目录（GitHub Actions 部署时运行）：
//   node tools/build-site.mjs [输出目录=_site]
//
// 1. 复制站点文件
// 2. 计算所有文件内容的哈希作为版本号，写入 sw.js，并写入完整的文件清单
//    —— 任何文件变化都会让 sw.js 变化，浏览器据此在后台安装新版本、整体切换缓存
// 3. 给 index.html 加上 <link rel="modulepreload">，首次打开时并行下载所有模块，
//    而不是 app.js → views → sheets 一层层串行请求
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTRIES = ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll', 'css', 'js', 'jw', 'scriptable', 'icons'];

export function buildSite(srcRoot, outDir) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const e of ENTRIES) cpSync(join(srcRoot, e), join(outDir, e), { recursive: true });

  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(relative(outDir, full).split(sep).join('/'));
    }
  })(outDir);
  const assets = files.filter((f) => f !== 'sw.js' && f !== '.nojekyll' && !f.endsWith('.map'));

  // modulepreload：js/ 下都是 ES 模块（jw/ 是普通脚本，不能 modulepreload）
  const modules = assets.filter((f) => f.startsWith('js/') && f.endsWith('.js'));
  const indexPath = join(outDir, 'index.html');
  let index = readFileSync(indexPath, 'utf8');
  const anchor = '<script type="module" src="js/app.js"></script>';
  if (!index.includes(anchor)) throw new Error('index.html 里找不到 js/app.js 的 <script type="module">');
  const preload = modules.map((m) => `  <link rel="modulepreload" href="${m}">`).join('\n');
  index = index.replace(anchor, `${preload.trimStart()}\n  ${anchor}`);
  writeFileSync(indexPath, index);

  // 版本号 = 所有文件（含改写后的 index.html）内容的哈希
  const hash = createHash('sha256');
  for (const f of assets) {
    hash.update(f);
    hash.update(readFileSync(join(outDir, f)));
  }
  const version = hash.digest('hex').slice(0, 12);

  const swPath = join(outDir, 'sw.js');
  let sw = readFileSync(swPath, 'utf8');
  if (!sw.includes("const VERSION = 'dev';")) throw new Error("sw.js 里找不到 const VERSION = 'dev';");
  if (!/\/\*@ASSETS\*\/[\s\S]*?\/\*@END\*\//.test(sw)) throw new Error('sw.js 里找不到 /*@ASSETS*/ … /*@END*/');
  sw = sw.replace("const VERSION = 'dev';", `const VERSION = '${version}';`);
  sw = sw.replace(/\/\*@ASSETS\*\/[\s\S]*?\/\*@END\*\//, () => JSON.stringify(['./', ...assets], null, 2));
  writeFileSync(swPath, sw);
  return { version, assets };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const out = process.argv[2] || join(root, '_site');
  const { version, assets } = buildSite(root, out);
  console.log(`built ${out}: version ${version}, ${assets.length} files`);
}
