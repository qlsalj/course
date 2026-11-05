import { app } from '../context.js';
import { h, openSheet, toast, copyText, download } from '../ui.js';
import { savePrefs } from '../store.js';
import { buildWidgetScript } from '../exporters.js';
import { fitWidgetText, renderWidget, runWidgetScript } from '../widget-preview.js';

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
  const tapSel = h('select', { class: 'input inline' },
    h('option', { value: 'scriptable', selected: app.prefs.widgetTap !== 'safari' }, '在 Scriptable 中查看课表'),
    h('option', { value: 'safari', selected: app.prefs.widgetTap === 'safari' }, '在 Safari 中打开网页版')
  );
  tapSel.addEventListener('change', async () => {
    app.prefs.widgetTap = tapSel.value;
    savePrefs(app.prefs);
    await generate();
  });
  const largeSel = h('select', { class: 'input inline' },
    h('option', { value: 'today', selected: app.prefs.widgetLarge !== 'week' }, '今日课程'),
    h('option', { value: 'week', selected: app.prefs.widgetLarge === 'week' }, '整周课表')
  );
  largeSel.addEventListener('change', async () => {
    app.prefs.widgetLarge = largeSel.value;
    savePrefs(app.prefs);
    await generate();
  });
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
      fitWidgetText(stage);
    } catch (e) {
      console.error(e);
      stage.replaceChildren(h('p', { class: 'muted' }, `预览失败：${e.message}`));
    }
  }

  async function generate() {
    try {
      const tpl = await loadTemplate();
      script = await buildWidgetScript(tpl, app.data, { appUrl: app.baseUrl, page: app.prefs.widgetPage, largeMode: app.prefs.widgetLarge, tapMode: app.prefs.widgetTap });
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
      h('label', { class: 'field inline-field' }, h('span', null, '点击小组件'), tapSel),
      h('label', { class: 'field inline-field' }, h('span', null, '打开后先显示'), pageSel),
      h('label', { class: 'field inline-field' }, h('span', null, '大号组件默认显示'), largeSel),
      copyBtn,
      h('button', { class: 'btn block', onclick: () => script && download('课表小组件.js', script, 'text/javascript') }, '下载 .js 文件'),
      h('section', { class: 'card' },
        h('h3', null, '使用步骤'),
        h('ol', { class: 'steps' },
          h('li', null, '在 App Store 安装免费的 ', h('a', { href: 'https://apps.apple.com/app/scriptable/id1405459188', target: '_blank', rel: 'noopener' }, 'Scriptable'), '。'),
          h('li', null, '点上面的「复制 Scriptable 脚本」，打开 Scriptable，点右上角 ＋ 新建脚本，粘贴，点左上角 Done 保存（可以点标题改名为「课表」）。'),
          h('li', null, '回到桌面，长按空白处 → 左上角 ＋ → 搜索 Scriptable → 选择小/中/大号组件添加。'),
          h('li', null, '长按刚添加的组件 →「编辑小组件」→ Script 选择刚才的脚本。锁屏组件同理（圆形显示周数，长条显示下一节课）。'),
          h('li', null, h('b', null, '同时要「今日」和「整周」？'), '不用新建脚本：在桌面添加两个大号 Scriptable 组件，都选这个脚本，其中一个的 Parameter 填 ', h('code', null, 'week'), '，它就显示整周课表。Parameter 填 ', h('code', null, 'today'), ' 强制显示今日课程，填 ', h('code', null, 'tomorrow'), ' 显示明天。'),
          h('li', null, '点击小组件会在 Scriptable 中显示完整课表，可在今天和整周之间切换，左右滑动换周。课表随脚本一起保存，无需联网。修改课程请点右上角「网页版」。'),
        ),
        h('p', { class: 'muted small' }, '⚠️ 小组件里的课表是导出那一刻的副本。修改课表后，需要重新复制脚本、在 Scriptable 中覆盖原内容。')
      ),
      h('details', { class: 'code-details' }, h('summary', null, '查看脚本源码'), codeBox)
    )
  });
  generate();
}
