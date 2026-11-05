import { app } from './context.js';
import { h, icon, clear, toast, closeAllSheets } from './ui.js';
import { load, save, loadPrefs, sanitize, assignColors } from './store.js';
import { decodeData, decodePlainB64 } from './share.js';
import { renderToday } from './views/today.js';
import { renderWeek, setViewWeek } from './views/week.js';
import { renderSettings } from './views/settings.js';
import { openImportSheet, handleImportText, openImportConfirm } from './sheets/import.js';
import { openWidgetSheet } from './sheets/widget.js';

const TABS = [
  ['today', '今天', 'today'],
  ['week', '课表', 'week'],
  ['settings', '设置', 'settings']
];

app.baseUrl = new URL('./', location.href).href;
app.data = load();
app.prefs = loadPrefs();

app.update = (fn) => {
  fn(app.data);
  assignColors(app.data.courses);
  save(app.data);
  app.render();
};

app.navigate = (hash) => {
  if (location.hash === hash) app.render();
  else location.hash = hash;
};

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query));
  return { name: parts[0] || 'today', arg: parts[1], params };
}

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
let lastRoute = '';

tabbar.append(...TABS.map(([key, label, ic]) =>
  h('a', { href: `#/${key}`, 'data-tab': key, class: 'tab' }, icon(ic), h('span', null, label))
));

app.render = ({ slide } = {}) => {
  const route = parseRoute();
  let name = route.name;
  if (!['today', 'week', 'settings'].includes(name)) name = 'today';
  if (name === 'week' && route.arg && lastRoute !== location.hash) setViewWeek(parseInt(route.arg, 10) || null);
  lastRoute = location.hash;
  const sameView = name === document.body.dataset.view;
  const scroll = sameView ? window.scrollY : 0;
  document.body.dataset.view = name;
  tabbar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  const node = name === 'week' ? renderWeek() : name === 'settings' ? renderSettings() : renderToday();
  if (slide) node.classList.add(`slide-${slide}`);
  // 只有切换页面时才播放进场动画（每 30 秒的自动刷新不闪）
  if (!sameView) node.classList.add('enter');
  clear(view).appendChild(node);
  window.scrollTo(0, scroll);
};

/** 处理链接里带的数据：?s=（小组件/分享快照）、?data=（导入助手） */
async function handleIncoming() {
  const { name, params } = parseRoute();
  if (!params.s && !params.data) return false;
  const clean = `#/${name === 'import' ? 'week' : name}`;
  history.replaceState(null, '', location.pathname + location.search + clean);
  try {
    if (params.data) {
      await handleImportText(JSON.stringify(decodePlainB64(params.data)));
      return true;
    }
    const snap = sanitize(await decodeData(params.s));
    const local = app.data;
    if (!local.courses.length) {
      // 本机没有课表（比如小组件第一次在 Safari 中打开）：直接采用
      app.data = save(snap, { touch: false });
    } else if (snap.id !== local.id) {
      // 别人分享的课表（或另一份课表）：绝不静默覆盖，交给用户确认
      openImportConfirm({
        source: `分享的课表「${snap.name}」`,
        courses: snap.courses,
        settings: {
          name: snap.name, startDate: snap.startDate, totalWeeks: snap.totalWeeks, periods: snap.periods,
          showWeekend: snap.showWeekend, showOtherWeeks: snap.showOtherWeeks
        }
      });
    } else if (snap.updatedAt > local.updatedAt) {
      // 同一份课表，小组件里的版本更新：同步
      app.data = save(snap, { touch: false });
      toast('已同步为小组件中的最新课表');
    } else if (snap.updatedAt < local.updatedAt) {
      toast('提示：小组件里的课表比本机旧，修改课表后记得重新导出小组件', 4000);
    }
  } catch (e) {
    console.warn(e);
    toast(`链接中的数据无法读取：${e.message}`);
  }
  return true;
}

window.addEventListener('hashchange', async () => {
  closeAllSheets();
  const r = parseRoute();
  if (r.params.s || r.params.data) await handleIncoming();
  if (r.name === 'import') { history.replaceState(null, '', '#/settings'); app.render(); openImportSheet(); return; }
  if (r.name === 'widget') { history.replaceState(null, '', '#/settings'); app.render(); openWidgetSheet(); return; }
  app.render();
});

// 每 30 秒刷新"今天"页的倒计时
setInterval(() => {
  if (document.body.dataset.view === 'today' && !document.body.classList.contains('sheet-open') && !document.hidden) app.render();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !document.body.classList.contains('sheet-open')) app.render();
});

// 其它标签页修改了数据
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('course-pwa:data')) { app.data = load(); app.render(); }
});

(async function boot() {
  await handleIncoming();
  const r = parseRoute();
  if (r.name === 'import') { history.replaceState(null, '', '#/settings'); app.render(); openImportSheet(); }
  else if (r.name === 'widget') { history.replaceState(null, '', '#/settings'); app.render(); openWidgetSheet(); }
  else app.render();
})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // 已经有旧版本在控制页面时，新版本接管就提示一下（第一次安装不提示）
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('新版本已下载好，下次打开时生效', 3500);
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    // iOS 主屏幕 App 常驻后台，切回前台时主动检查一次更新
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch((e) => console.warn('Service Worker 注册失败', e));
}

// 方便调试
window.__app = app;
