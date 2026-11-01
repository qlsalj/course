// 把课表编码进 URL（用于小组件跳转、分享链接）
// 格式：'z' + base64url(deflate-raw(json))，不支持压缩时为 'j' + base64url(json)

function toB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeData(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') {
    try {
      return 'z' + toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch (e) { /* fallthrough */ }
  }
  return 'j' + toB64Url(bytes);
}

export async function decodeData(str) {
  const s = String(str || '').trim();
  const kind = s[0];
  const bytes = fromB64Url(s.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('当前浏览器不支持解压数据');
    return JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw'))));
  }
  if (kind === 'j') return JSON.parse(new TextDecoder().decode(bytes));
  throw new Error('无法识别的数据格式');
}

/** 解码导入助手（jw/importer.js）"在网页版打开"传来的 base64url(utf8 json) */
export function decodePlainB64(str) {
  return JSON.parse(new TextDecoder().decode(fromB64Url(str)));
}
