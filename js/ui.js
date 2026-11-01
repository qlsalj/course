// 极简 DOM 工具：h()、底部弹层、提示、剪贴板、下载

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v)) {
          if (val == null) continue;
          // CSS 自定义属性（--x）只能通过 setProperty 设置
          if (prop.startsWith('--')) el.style.setProperty(prop, String(val));
          else el.style[prop] = val;
        }
      }
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/* ---------------- 图标（内联 SVG） ---------------- */
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const icons = {
  today: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  week: svg('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M8 13h2M14 13h2M8 17h2"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>', 'width="16" height="16"'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>', 'width="18" height="18"'),
  chevron: svg('<path d="M9 18l6-6-6-6"/>', 'width="18" height="18"'),
  pin: svg('<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>', 'width="14" height="14"'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', 'width="14" height="14"'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 'width="14" height="14"')
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML = icons[name] || '';
  return span;
}

/* ---------------- 底部弹层 ---------------- */
const sheets = [];

export function openSheet({ title, content, footer, onClose, className = '' }) {
  const root = document.getElementById('sheet-root');
  const body = h('div', { class: 'sheet-body' });
  const sheet = h('div', { class: `sheet ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' },
    h('div', { class: 'sheet-grip' }),
    h('header', { class: 'sheet-head' },
      h('h2', null, title || ''),
      h('button', { class: 'icon-btn', 'aria-label': '关闭', onclick: () => api.close(), html: icons.close })
    ),
    body,
    footer ? h('footer', { class: 'sheet-foot' }, footer) : null
  );
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === backdrop) api.close(); } }, sheet);
  const api = {
    el: sheet,
    body,
    closed: false,
    close() {
      if (api.closed) return;
      api.closed = true;
      backdrop.classList.remove('open');
      const i = sheets.indexOf(api);
      if (i >= 0) sheets.splice(i, 1);
      setTimeout(() => backdrop.remove(), 260);
      if (!sheets.length) document.body.classList.remove('sheet-open');
      onClose && onClose();
    },
    setContent(node) { clear(body); append(body, [node]); }
  };
  // 按住顶部（把手 / 标题栏）向下拖动关闭
  let startY = 0; let dy = 0; let dragging = false; let t0 = 0;
  const dragStart = (e) => { dragging = true; startY = e.touches[0].clientY; dy = 0; t0 = Date.now(); sheet.style.transition = 'none'; };
  const dragMove = (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const dragEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    const fast = dy / Math.max(1, Date.now() - t0) > 0.5;
    if (dy > 110 || (fast && dy > 30)) { sheet.style.transform = ''; api.close(); } else sheet.style.transform = '';
  };
  sheet.querySelectorAll('.sheet-grip, .sheet-head').forEach((el) => {
    el.addEventListener('touchstart', dragStart, { passive: true });
    el.addEventListener('touchmove', dragMove, { passive: true });
    el.addEventListener('touchend', dragEnd, { passive: true });
    el.addEventListener('touchcancel', dragEnd, { passive: true });
  });
  if (typeof content === 'function') content = content(api);
  append(body, [content]);
  root.appendChild(backdrop);
  sheets.push(api);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('open')));
  return api;
}

export function closeAllSheets() {
  sheets.slice().forEach((s) => s.close());
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close();
});

export function confirmDialog(message, { title = '确认', okText = '确定', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const s = openSheet({
      title,
      className: 'sheet-small',
      content: h('p', { class: 'confirm-text' }, message),
      footer: [
        h('button', { class: 'btn', onclick: () => s.close() }, '取消'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { result = true; s.close(); } }, okText)
      ],
      onClose: () => resolve(result)
    });
  });
}

/* ---------------- 提示 ---------------- */
let toastTimer = 0;
export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------------- 剪贴板 / 文件 ---------------- */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* 回退 */ }
  const ta = h('textarea', { readonly: true, style: { position: 'fixed', top: '0', left: '0', opacity: '0' } });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

export async function readClipboard() {
  if (!navigator.clipboard || !navigator.clipboard.readText) throw new Error('当前浏览器不支持读取剪贴板，请手动粘贴');
  return navigator.clipboard.readText();
}

/**
 * 保存文件。iOS 上（尤其是添加到主屏幕后）网页下载会提示「无法下载此文件」，
 * 所以触屏设备优先调起系统分享面板（可选「存储到文件」、日历、微信等），电脑上用普通下载。
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function download(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (touch && typeof File === 'function' && navigator.share) {
    const file = new File([blob], filename, { type: mime });
    if (!navigator.canShare || navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        // 其它错误：退回普通下载
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
