// 极简静态服务器（无依赖），行为接近 GitHub Pages：UTF-8 编码、允许跨域读取
// node tools/serve.mjs [端口] [根目录]
// 环境变量 DELAY_MS：给每个请求加延迟，用来模拟慢网络（测试用）
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[3] || fileURLToPath(new URL('..', import.meta.url));
const delay = Number(process.env.DELAY_MS || 0);
const port = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.csv': 'text/csv; charset=utf-8'
};

createServer(async (req, res) => {
  if (delay) await new Promise((r) => setTimeout(r, delay));
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(body);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}/`));
