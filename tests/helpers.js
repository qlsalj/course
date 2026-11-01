// 测试辅助：加载普通脚本 jw/parsers.js 到全局
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

vm.runInThisContext(readFileSync(new URL('../jw/parsers.js', import.meta.url), 'utf8'));
export const P = globalThis.CourseParsers;
export const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
