import { app } from '../context.js';
import { h, openSheet, toast, copyText, download } from '../ui.js';
import { savePrefs } from '../store.js';
import { buildWidgetScript } from '../exporters.js';
import { renderWidget, runWidgetScript } from '../widget-preview.js';

let templateCache = null;

export async function loadTemplate() {
  if (templateCache) return templateCache;
  const res = await fetch('scriptable/widget.js', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`加载小组件模板失败（${res.status}）`);
  templateCache = await res.text();
  return templateCache;
}

const TABS = [
  ['small', '小号'],
  ['medium', '中号'],
  ['large', '大号'],
  ['week', '整周'],
  ['lock', '锁屏']
];

export function openWidgetSheet() {
  let script = '';
  let tab = 'medium';
  let dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const stage = h('div', { class: 'widget-stage' });
  const tabs = h('div', { class: 'segmented' }, TABS.map(([k, label]) =>
    h('button', { 'data-k': k, class: k === tab ? 'sel' : '', onclick: () => { tab = k; refreshTabs(); preview(); } }, label)
  ));
  const darkBtn = h('button', { class: 'btn small', onclick: () => { dark = !dark; preview(); } }, '切换深色/浅色');
  const pageSel = h('select', { class: 'input inline' },
    h('option', { value: 'today', selected: app.prefs.widgetPage === 'today' }, '今日课程'),
    h('option', { value: 'week', selected: app.prefs.widgetPage === 'week' }, '本周课表')
  );
  pageSel.addEventListener('change', async () => {
    app.prefs.widgetPage = pageSel.value;
    savePrefs(app.prefs);
    await generate();
  });
  const codeBox = h('textarea', { class: 'input mono', rows: 6, readonly: true });
  const copyBtn = h('button', { class: 'btn primary block', disabled: true, onclick: copy }, '复制 Scriptable 脚本');

  function refreshTabs() {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.k === tab));
  }

  async function renderOne(family, parameter = '') {
    const { widget } = await runWidgetScript(script, { family, parameter });
    return renderWidget(widget, { family, dark });
  }

  async function preview() {
    if (!script) return;
    stage.classList.toggle('dark', dark);
    try {
      let nodes;
      if (tab === 'lock') {
        nodes = [
          h('div', { class: 'lock-row' }, await renderOne('accessoryCircular'), await renderOne('accessoryRectangular')),
          await renderOne('accessoryInline')
        ];
        stage.classList.add('lock');
      } else {
        stage.classList.remove('lock');
        nodes = [tab === 'week' ? await renderOne('large', 'week') : await renderOne(tab)];
      }
      stage.replaceChildren(...nodes);
    } catch (e) {
      console.error(e);
      stage.replaceChildren(h('p', { class: 'muted' }, `预览失败：${e.message}`));
    }
  }

  async function generate() {
    try {
      const tpl = await loadTemplate();
      script = await buildWidgetScript(tpl, app.data, { appUrl: app.baseUrl, page: app.prefs.widgetPage });
      codeBox.value = script;
      copyBtn.disabled = false;
      await preview();
    } catch (e) {
      stage.replaceChildren(h('p', { class: 'muted' }, e.message));
    }
  }

  async function copy() {
    if (!script) return;
    if (await copyText(script)) {
      toast('已复制！打开 Scriptable 新建脚本并粘贴');
    } else {
      codeBox.closest('details').open = true;
      codeBox.focus();
      codeBox.select();
      toast('自动复制失败，请手动全选文本框内容复制');
    }
  }

  openSheet({
    title: 'iOS 桌面小组件',
    content: h('div', { class: 'widget-export' },
      tabs,
      stage,
      h('div', { class: 'row-actions center' }, darkBtn),
      h('label', { class: 'field inline-field' }, h('span', null, '点击小组件打开'), pageSel),
      copyBtn,
      h('button', { class: 'btn block', onclick: () => script && download('课表小组件.js', script, 'text/javascript') }, '下载 .js 文件'),
      h('section', { class: 'card' },
        h('h3', null, '使用步骤'),
        h('ol', { class: 'steps' },
          h('li', null, '在 App Store 安装免费的 ', h('a', { href: 'https://apps.apple.com/app/scriptable/id1405459188', target: '_blank', rel: 'noopener' }, 'Scriptable'), '。'),
          h('li', null, '点上面的「复制 Scriptable 脚本」，打开 Scriptable，点右上角 ＋ 新建脚本，粘贴，点左上角 Done 保存（可以点标题改名为「课表」）。'),
          h('li', null, '回到桌面，长按空白处 → 左上角 ＋ → 搜索 Scriptable → 选择小/中/大号组件添加。'),
          h('li', null, '长按刚添加的组件 →「编辑小组件」→ Script 选择刚才的脚本。大号组件的 Parameter 填 ', h('code', null, 'week'), ' 可显示整周课表，填 ', h('code', null, 'tomorrow'), ' 显示明天。锁屏组件同理。'),
          h('li', null, '点击小组件会用 Safari 打开本应用并自动带上课表数据（iOS 限制：网页无法直接唤起已添加到主屏幕的 Web App）。')
        ),
        h('p', { class: 'muted small' }, '⚠️ 小组件里的课表是导出那一刻的副本。修改课表后，需要重新复制脚本、在 Scriptable 中覆盖原内容。')
      ),
      h('details', { class: 'code-details' }, h('summary', null, '查看脚本源码'), codeBox)
    )
  });
  generate();
}
