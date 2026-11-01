// 一个最小化的 Scriptable API 模拟实现：
//  - 在 PWA 中实时预览导出的小组件
//  - 在测试里执行小组件脚本，检查输出
// 只实现了 scriptable/widget.js 用到的 API 子集（以及一些常用的），布局规则是对 SwiftUI 的近似。

export const WIDGET_SIZES = {
  small: [158, 158],
  medium: [338, 158],
  large: [338, 354],
  extraLarge: [715, 338],
  accessoryRectangular: [172, 76],
  accessoryInline: [240, 22],
  accessoryCircular: [76, 76]
};

class Color {
  constructor(hex, alpha = 1) {
    this.hex = String(hex || '#000000').replace(/^#?/, '#');
    this.alpha = alpha;
  }
  static dynamic(light, dark) {
    const c = new Color(light.hex, light.alpha);
    c.dark = dark;
    return c;
  }
  static white() { return new Color('#FFFFFF'); }
  static black() { return new Color('#000000'); }
  static clear() { return new Color('#000000', 0); }
  static gray() { return new Color('#8E8E93'); }
  static red() { return new Color('#FF3B30'); }
  static green() { return new Color('#34C759'); }
  static blue() { return new Color('#007AFF'); }
  static orange() { return new Color('#FF9500'); }
  static yellow() { return new Color('#FFCC00'); }
  static lightGray() { return new Color('#D1D1D6'); }
  static darkGray() { return new Color('#3A3A3C'); }
}

const FONT_WEIGHTS = {
  ultraLight: 100, thin: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900
};

class Font {
  constructor(name, size) { this.name = name; this.size = size; this.weight = 400; }
}
Object.entries(FONT_WEIGHTS).forEach(([w, num]) => {
  for (const variant of ['', 'Rounded', 'Monospaced']) {
    Font[`${w}${variant}SystemFont`] = (size) => Object.assign(new Font('system', size), { weight: num, variant: variant.toLowerCase() });
  }
});
Font.systemFont = (size) => Object.assign(new Font('system', size), { weight: 400 });
Font.italicSystemFont = (size) => Object.assign(new Font('system', size), { italic: true });
['largeTitle', 'title1', 'title2', 'title3', 'headline', 'subheadline', 'body', 'callout', 'footnote', 'caption1', 'caption2'].forEach((n, i) => {
  const sizes = [34, 28, 22, 20, 17, 15, 17, 16, 13, 12, 11];
  Font[n] = () => Object.assign(new Font('system', sizes[i]), { weight: n === 'headline' ? 600 : 400 });
});

class Size { constructor(width, height) { this.width = width; this.height = height; } }
class Point { constructor(x, y) { this.x = x; this.y = y; } }
class LinearGradient { constructor() { this.colors = []; this.locations = []; } }

class WidgetText {
  constructor(text) {
    this.type = 'text';
    this.text = String(text);
    this.font = Font.systemFont(17);
    this.textColor = null;
    this.textOpacity = 1;
    this.lineLimit = 0;
    this.minimumScaleFactor = 1;
    this.align = 'left';
  }
  leftAlignText() { this.align = 'left'; }
  centerAlignText() { this.align = 'center'; }
  rightAlignText() { this.align = 'right'; }
}

class WidgetDate extends WidgetText {
  constructor(date) {
    super('');
    this.type = 'date';
    this.date = date;
    this.style = 'date';
  }
  applyTimeStyle() { this.style = 'time'; }
  applyDateStyle() { this.style = 'date'; }
  applyRelativeStyle() { this.style = 'relative'; }
  applyOffsetStyle() { this.style = 'offset'; }
  applyTimerStyle() { this.style = 'timer'; }
}

class WidgetSpacer { constructor(length) { this.type = 'spacer'; this.length = length == null ? null : length; } }

class WidgetImage {
  constructor(image) { this.type = 'image'; this.image = image; this.imageSize = null; this.tintColor = null; }
  leftAlignImage() {} centerAlignImage() {} rightAlignImage() {}
  applyFittingContentMode() {} applyFillingContentMode() {}
}

class Container {
  constructor() { this.children = []; this.spacing = 0; this.padding = null; this.backgroundColor = null; this.url = null; }
  addText(t) { const e = new WidgetText(t); this.children.push(e); return e; }
  addDate(d) { const e = new WidgetDate(d); this.children.push(e); return e; }
  addSpacer(l) { const e = new WidgetSpacer(l); this.children.push(e); return e; }
  addImage(i) { const e = new WidgetImage(i); this.children.push(e); return e; }
  addStack() { const e = new WidgetStack(); this.children.push(e); return e; }
  setPadding(top, leading, bottom, trailing) { this.padding = [top, leading, bottom, trailing]; }
  useDefaultPadding() { this.padding = null; }
}

class WidgetStack extends Container {
  constructor() {
    super();
    this.type = 'stack';
    this.layout = 'h';
    this.align = 'top';
    this.size = null;
    this.cornerRadius = 0;
    this.borderWidth = 0;
    this.borderColor = null;
    this.padding = [0, 0, 0, 0];
  }
  layoutHorizontally() { this.layout = 'h'; }
  layoutVertically() { this.layout = 'v'; }
  topAlignContent() { this.align = 'top'; }
  centerAlignContent() { this.align = 'center'; }
  bottomAlignContent() { this.align = 'bottom'; }
}

class ListWidget extends Container {
  constructor() {
    super();
    this.type = 'widget';
    this.layout = 'v';
    this.refreshAfterDate = null;
    this.backgroundGradient = null;
    this.backgroundImage = null;
    this.addAccessoryWidgetBackground = false;
  }
  async presentSmall() {} async presentMedium() {} async presentLarge() {} async presentExtraLarge() {}
}

/** 生成一个 Date 类：无参构造时返回固定时间 */
function fixedDate(nowMs) {
  const RealDate = Date;
  return class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(nowMs); }
    static now() { return nowMs; }
  };
}

export function createScriptableEnv({ family = 'medium', parameter = '', now = Date.now() } = {}) {
  const result = { widget: null, opened: [], logs: [] };
  const globals = {
    ListWidget, WidgetStack, WidgetText, WidgetDate, WidgetSpacer, WidgetImage,
    Color, Font, Size, Point, LinearGradient,
    Date: fixedDate(+now),
    config: {
      runsInWidget: true,
      runsInApp: false,
      runsInAccessoryWidget: String(family).startsWith('accessory'),
      runsWithSiri: false,
      widgetFamily: family
    },
    args: { widgetParameter: parameter || null, queryParameters: {}, plainTexts: [], urls: [] },
    Script: {
      setWidget(w) { result.widget = w; },
      complete() {},
      name() { return '课表'; }
    },
    Safari: { open(url) { result.opened.push(url); }, openInApp: async (url) => { result.opened.push(url); } },
    Pasteboard: { copy() {}, paste() { return ''; } },
    Device: { locale: () => 'zh_CN', language: () => 'zh', isUsingDarkAppearance: () => false, screenSize: () => new Size(390, 844) },
    Alert: class { addAction() {} addCancelAction() {} async presentSheet() { return -1; } async presentAlert() { return -1; } },
    console: {
      log: (...a) => result.logs.push(a.join(' ')),
      warn: (...a) => result.logs.push(a.join(' ')),
      error: (...a) => result.logs.push(a.join(' '))
    }
  };
  return { globals, result };
}

const AsyncFunction = (async () => {}).constructor;

/** 执行小组件脚本，返回 ListWidget 结构 */
export async function runWidgetScript(code, opts = {}) {
  const { globals, result } = createScriptableEnv(opts);
  const names = Object.keys(globals);
  const fn = new AsyncFunction(...names, code);
  await fn(...names.map((n) => globals[n]));
  return result;
}

/** 把 ListWidget 结构转成纯文本（测试用） */
export function widgetText(el) {
  if (!el) return '';
  if (el.type === 'text') return el.text;
  if (el.type === 'date') return formatDateEl(el, Date.now());
  if (!el.children) return '';
  return el.children.map(widgetText).filter(Boolean).join(el.layout === 'h' ? ' ' : '\n');
}

/* ======================= DOM 渲染 ======================= */

function cssColor(c, dark) {
  if (!c) return '';
  const col = dark && c.dark ? c.dark : c;
  const hex = col.hex.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((x) => x + x).join('') : hex.slice(-6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${col.alpha})`;
}

function formatDateEl(el, nowMs) {
  const d = el.date;
  const diff = Math.round((d - nowMs) / 60000);
  const p = (n) => String(n).padStart(2, '0');
  switch (el.style) {
    case 'time': return `${p(d.getHours())}:${p(d.getMinutes())}`;
    case 'relative':
    case 'offset': {
      const m = Math.abs(diff);
      const t = m < 60 ? `${m}分钟` : `${Math.floor(m / 60)}小时${m % 60 ? (m % 60) + '分钟' : ''}`;
      return diff >= 0 ? `${t}后` : `${t}前`;
    }
    case 'timer': {
      const s = Math.abs(Math.round((d - nowMs) / 1000));
      return `${Math.floor(s / 60)}:${p(s % 60)}`;
    }
    default: return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
}

function greedy(el, axis) {
  if (el.type === 'spacer') return el.length == null ? axis : null;
  if (el.type !== 'stack') return null;
  if (el.size && (axis === 'h' ? el.size.width > 0 : el.size.height > 0)) return null;
  return el.children.some((c) => {
    if (c.type === 'spacer') return c.length == null && el.layout === axis;
    return greedy(c, axis) === axis;
  }) ? axis : null;
}

function renderEl(el, parentLayout, ctx) {
  const node = document.createElement('div');
  const s = node.style;
  if (el.type === 'spacer') {
    if (el.length == null) { s.flex = '1 1 0'; s.minWidth = '0'; s.minHeight = '0'; } else {
      s.flex = 'none';
      if (parentLayout === 'h') s.width = `${el.length}px`; else s.height = `${el.length}px`;
    }
    return node;
  }
  if (el.type === 'text' || el.type === 'date') {
    node.textContent = el.type === 'date' ? formatDateEl(el, ctx.now) : el.text;
    const f = el.font || {};
    s.fontSize = `${f.size || 17}px`;
    s.fontWeight = f.weight || 400;
    s.fontFamily = f.variant === 'rounded'
      ? 'ui-rounded, "SF Pro Rounded", -apple-system, "PingFang SC", sans-serif'
      : f.variant === 'monospaced' ? 'ui-monospace, Menlo, monospace' : '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif';
    s.color = cssColor(el.textColor, ctx.dark) || ctx.defaultText;
    s.opacity = el.textOpacity;
    s.lineHeight = '1.2';
    s.textAlign = el.align;
    s.minWidth = '0';
    s.maxWidth = '100%';
    s.flexShrink = '1';
    if (el.lineLimit === 1) {
      s.whiteSpace = 'nowrap'; s.overflow = 'hidden'; s.textOverflow = 'ellipsis';
    } else if (el.lineLimit > 1) {
      s.display = '-webkit-box'; s.webkitBoxOrient = 'vertical'; s.webkitLineClamp = String(el.lineLimit); s.overflow = 'hidden';
    }
    if (parentLayout === 'root') s.alignSelf = 'stretch';
    if (el.minimumScaleFactor < 1) {
      node.dataset.fit = String(f.size || 17);
      node.dataset.min = String((f.size || 17) * el.minimumScaleFactor);
    }
    return node;
  }
  if (el.type === 'image') {
    s.width = s.height = '16px';
    return node;
  }
  // stack
  s.display = 'flex';
  s.flexDirection = el.layout === 'h' ? 'row' : 'column';
  s.minWidth = '0';
  s.minHeight = '0';
  s.boxSizing = 'border-box';
  const align = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[el.align];
  s.alignItems = align;
  if (el.spacing) s.gap = `${el.spacing}px`;
  if (el.padding) s.padding = el.padding.map((v) => `${v}px`).join(' ');
  if (el.backgroundColor) s.background = cssColor(el.backgroundColor, ctx.dark);
  if (el.cornerRadius) { s.borderRadius = `${el.cornerRadius}px`; s.overflow = 'hidden'; }
  if (el.borderWidth && el.borderColor) s.border = `${el.borderWidth}px solid ${cssColor(el.borderColor, ctx.dark)}`;
  s.flexShrink = '1';
  if (el.size) {
    if (el.size.width > 0) { s.width = `${el.size.width}px`; s.flexShrink = '0'; }
    if (el.size.height > 0) { s.height = `${el.size.height}px`; }
  }
  const gh = greedy(el, 'h');
  const gv = greedy(el, 'v');
  if (parentLayout === 'h') {
    if (gh) s.flex = '1 1 0';
    if (gv) s.alignSelf = 'stretch';
  } else {
    if (gv) s.flex = '1 1 0';
    if (gh) s.alignSelf = 'stretch';
    else if (parentLayout === 'root') s.alignSelf = 'center';
  }
  el.children.forEach((c) => node.appendChild(renderEl(c, el.layout, ctx)));
  return node;
}

/**
 * 模拟 minimumScaleFactor：文字放不下时先缩小字号（最多缩到 size × 比例），再截断。
 * 需要在节点插入页面、完成布局之后调用。
 */
export function fitWidgetText(root) {
  root.querySelectorAll('[data-fit]').forEach((node) => {
    let size = Number(node.dataset.fit);
    const min = Number(node.dataset.min);
    const overflow = () => node.scrollWidth > node.clientWidth + 0.5 || node.scrollHeight > node.clientHeight + 0.5;
    while (overflow() && size > min) {
      size = Math.max(min, size - 0.5);
      node.style.fontSize = `${size}px`;
    }
  });
}

/** 渲染为 DOM 元素 */
export function renderWidget(widget, { family = 'medium', dark = false, now = Date.now() } = {}) {
  const [w, h] = WIDGET_SIZES[family] || WIDGET_SIZES.medium;
  const accessory = String(family).startsWith('accessory');
  const root = document.createElement('div');
  root.className = `sw-widget sw-${family}`;
  const s = root.style;
  s.width = `${w}px`;
  s.height = `${h}px`;
  s.boxSizing = 'border-box';
  s.display = 'flex';
  s.flexDirection = 'column';
  s.justifyContent = 'center';
  s.alignItems = 'flex-start';
  s.overflow = 'hidden';
  s.position = 'relative';
  s.borderRadius = family === 'accessoryCircular' ? '50%' : accessory ? '14px' : '22px';
  const pad = widget.padding || (accessory ? [0, 0, 0, 0] : [16, 16, 16, 16]);
  s.padding = pad.map((v) => `${v}px`).join(' ');
  if (accessory) {
    s.background = widget.addAccessoryWidgetBackground ? 'rgba(255,255,255,.22)' : 'transparent';
    s.color = '#fff';
    if (family === 'accessoryCircular') s.alignItems = 'center';
  } else if (widget.backgroundGradient && widget.backgroundGradient.colors.length) {
    s.background = `linear-gradient(180deg, ${widget.backgroundGradient.colors.map((c) => cssColor(c, dark)).join(',')})`;
  } else {
    s.background = cssColor(widget.backgroundColor, dark) || (dark ? '#1c1c1e' : '#fff');
  }
  if (widget.spacing) s.gap = `${widget.spacing}px`;
  const ctx = { dark, now: +now, defaultText: accessory ? '#fff' : dark ? '#fff' : '#000' };
  // 只有固定间距和内容时，SwiftUI 会把内容垂直居中；有弹性 spacer 时由 spacer 撑开
  widget.children.forEach((c) => root.appendChild(renderEl(c, 'root', ctx)));
  return root;
}
