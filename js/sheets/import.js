import { app } from '../context.js';
import { h, openSheet, toast, copyText, readClipboard, readFile } from '../ui.js';
import { assignColors, currentWeek, sanitize, sanitizeCourse, uid } from '../store.js';
import { DAY_NAMES, startDateForCurrentWeek } from '../time.js';
import { parseImport } from '../importers.js';
import { weeksText } from './editor.js';

// 加载 jw/parsers.js + jw/importer.js 的代码。只用 ASCII 字符和单引号，
// 避免 Safari 保存书签时改写特殊字符。done 为加载完成（或失败）后执行的代码
function loader(base, done = '') {
  const b = base.replace(/'/g, "\\'");
  return `var b='${b}';window.__COURSE_APP_URL__=b;var D=function(){${done}};function l(u,c){var s=document.createElement('script');s.src=b+u+'?v='+Date.now();s.charset='utf-8';s.onload=c;s.onerror=function(){alert('\\u5bfc\\u5165\\u811a\\u672c\\u52a0\\u8f7d\\u5931\\u8d25\\uff0c\\u8bf7\\u68c0\\u67e5\\u7f51\\u7edc');D()};(document.body||document.documentElement).appendChild(s)}l('jw/parsers.js',function(){l('jw/importer.js',D)});`;
}

// 项目官方站点及维护者分享的「导入课表」快捷指令（只在官方站点显示，自己部署的需要手动创建）
const OFFICIAL_SITE = 'https://qlsalj.github.io/course/';
const OFFICIAL_SHORTCUT = 'https://www.icloud.com/shortcuts/48bc18b94a7e4d46a095c80b31ea3036';

/** 书签脚本（电脑浏览器 / iOS Safari 书签） */
export function bookmarklet(base) {
  return `javascript:(function(){${loader(base)}})();void 0`;
}

/** 把非 ASCII 字符转成 \uXXXX，保证粘贴到任何地方都不会被改写 */
function ascii(code) {
  return code.replace(/[^\x00-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/**
 * iOS 快捷指令「在网页上运行 JavaScript」使用的代码。
 *  1. 先用 <script> 标签加载导入助手（和书签脚本一样）
 *  2. 如果被网站的安全策略（CSP）拦截，改为 fetch 源码后直接执行
 *  3. 通过 completion() 返回结果，配合「显示结果」操作，出问题时能看到原因
 */
export function shortcutScript(base) {
  const b = base.replace(/'/g, "\\'");
  return ascii(`var b='${b}';window.__COURSE_APP_URL__=b;var F=0;
function E(m){if(!F){F=1;completion(m||'')}}
function I(){var t=0;try{t=document.querySelectorAll('table').length}catch(e){}return '\\n页面：'+location.href+'\\n表格数：'+t+'\\n框架数：'+(window.frames?frames.length:0)}
setTimeout(function(){E('超时：导入助手 15 秒内没有出现。'+I())},15000);
function V(){Promise.all(['jw/parsers.js','jw/importer.js'].map(function(u){return fetch(b+u+'?v='+Date.now()).then(function(r){if(!r.ok)throw new Error(u+' '+r.status);return r.text()})})).then(function(t){(0,eval)(t[0]);(0,eval)(t[1]);E(document.getElementById('__course_importer__')?'':'导入助手没有显示。'+I())}).catch(function(e){E('导入助手加载失败：'+(e&&e.message||e)+I())})}
function l(u,c){var s=document.createElement('script');s.src=b+u+'?v='+Date.now();s.charset='utf-8';s.onload=c;s.onerror=V;(document.body||document.documentElement).appendChild(s)}
l('jw/parsers.js',function(){l('jw/importer.js',function(){E('')})});`);
}

export function openImportSheet() {
  const bm = bookmarklet(app.baseUrl);
  const textarea = h('textarea', { class: 'input mono', rows: 5, placeholder: '把导入助手复制的数据、WakeUp 文件内容、备份 JSON、CSV 或网页源码粘贴到这里' });
  const fileInput = h('input', { type: 'file', hidden: true });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try {
      await handleImportText(await readFile(f), f.name);
    } catch (e) {
      toast(`读取失败：${e.message}`);
    }
    fileInput.value = '';
  });

  const s = openSheet({
    title: '导入课表',
    content: h('div', { class: 'import' },
      h('section', { class: 'card' },
        h('h3', null, '① 从教务系统导入'),
        h('p', { class: 'muted small' }, '支持正方（自动调用接口）、强智，以及大多数以表格显示课表的教务系统。原理是在已登录的教务页面运行一小段脚本（通过快捷指令或书签），识别课表后复制到剪贴板，数据不会上传到任何服务器。'),
        h('p', { class: 'muted small' }, '下面两种方式任选其一。iPhone 上如果书签提示「无法运行脚本」，请用快捷指令。'),
        h('details', { class: 'method', open: true },
          h('summary', null, '方式 A：快捷指令（iPhone / iPad 推荐）'),
          h('ol', { class: 'steps' },
            OFFICIAL_SHORTCUT && app.baseUrl === OFFICIAL_SITE
              ? h('li', null, '添加快捷指令：', h('a', { class: 'btn small primary', href: OFFICIAL_SHORTCUT, target: '_blank', rel: 'noopener' }, '获取「导入课表」快捷指令'), ' → 在打开的页面点「添加快捷指令」。')
              : h('li', null, '先按下面「手动创建快捷指令」的步骤建一个名为「导入课表」的快捷指令。'),
            h('li', null, '在 Safari 中登录教务系统（或校园门户），打开「个人课表 / 学期课表」页面 → 点 Safari 的分享按钮 → 选「导入课表」。第一次运行会询问是否允许访问该网站，选允许。'),
            h('li', null, h('b', null, '运行后不会直接复制'), '：网页上会弹出「课表导入助手」窗口，列出识别到的课程，点里面的「复制课表数据」。'),
            h('li', null, '回到这里，点下面的「从剪贴板粘贴」，确认导入。')
          ),
          h('details', { class: 'sub-method' },
            h('summary', null, '手动创建快捷指令'),
            h('ol', { class: 'steps' },
              h('li', null, '打开「快捷指令」App → 右上角 ＋ 新建 → 添加操作，搜索并添加「在网页上运行 JavaScript」。'),
              h('li', null, '把操作里的默认代码全部删掉，粘贴这段代码：', h('button', { class: 'btn small primary', onclick: async () => toast((await copyText(shortcutScript(app.baseUrl))) ? '已复制快捷指令代码' : '复制失败') }, '复制代码')),
              h('li', null, '点底部的 ⓘ → 打开「在共享表单中显示」。点顶部「从共享表单接收…」里蓝色的类型，', h('b', null, '只保留「Safari 网页」'), '。'),
              h('li', null, '确认操作写的是「在 ', h('b', null, '快捷指令输入'), ' 上运行 JavaScript」。如果显示成灰色的「网页」，点它选「快捷指令输入」。'),
              h('li', null, '可选：最后再加一个「显示结果」操作，导入失败时会显示原因。'),
              h('li', null, '命名为「导入课表」。如果运行时提示不允许运行脚本：系统「设置」→「快捷指令」→「高级」→ 打开「允许运行脚本」。不要在快捷指令编辑器里点 ▶ 运行，那里没有网页。')
            )
          ),
          h('p', { class: 'muted small' }, '课表在校园门户里打开、导入助手提示找不到课表时，它会列出门户里嵌套的教务页面，点「打开」单独打开后再运行一次。')
        ),
        h('details', { class: 'method' },
          h('summary', null, '方式 B：书签脚本（电脑浏览器，或 iPhone 书签）'),
          h('ol', { class: 'steps' },
            h('li', null, '复制书签脚本：', h('button', { class: 'btn small primary', onclick: async () => toast((await copyText(bm)) ? '已复制书签脚本' : '复制失败，请长按下方链接复制') }, '复制')),
            h('li', null, h('b', null, '电脑：'), '把这个按钮拖到浏览器书签栏 → ', h('a', { class: 'bookmarklet', href: bm, onclick: (e) => { e.preventDefault(); toast('请把它拖到书签栏，而不是点击'); } }, '导入课表')),
            h('li', null, h('b', null, 'iPhone / iPad：'), '在 Safari 中随便把一个网页添加为书签 → 打开书签列表，长按刚才的书签选「编辑」→ 名称改为「导入课表」，地址全部删掉并粘贴刚才复制的内容。'),
            h('li', null, '登录教务系统，打开课表页面后，从 Safari 的「书签」列表（📖 图标）里点「导入课表」。', h('b', null, '不要在地址栏输入或搜索书签名'), '，iOS 不允许从地址栏运行脚本，会提示「无法运行脚本」。')
          )
        ),
        h('p', { class: 'small' }, '两种方式运行后，网页上都会弹出「课表导入助手」窗口：点「复制课表数据」，再回到这里点下面的「从剪贴板粘贴」。')
      ),
      h('section', { class: 'card' },
        h('h3', null, '② 粘贴导入'),
        textarea,
        h('div', { class: 'row-actions' },
          h('button', {
            class: 'btn primary',
            onclick: async () => {
              try {
                const t = await readClipboard();
                if (!t.trim()) return toast('剪贴板是空的');
                textarea.value = t;
                await handleImportText(t);
              } catch (e) {
                toast(e.message || '无法读取剪贴板，请手动粘贴到输入框');
                textarea.focus();
              }
            }
          }, '从剪贴板粘贴'),
          h('button', { class: 'btn', onclick: () => handleImportText(textarea.value) }, '解析输入框')
        )
      ),
      h('section', { class: 'card' },
        h('h3', null, '③ 从文件导入'),
        h('p', { class: 'muted small' }, '支持 WakeUp 课程表导出的 .wakeup_schedule 文件（WakeUp → 右上角菜单 → 导出 → 导出为 WakeUp 课程表文件）、本应用的 JSON 备份、CSV（WakeUp 模板格式：课程名称,星期,开始节数,结束节数,老师,地点,周数）以及保存的课表网页 .html。'),
        fileInput,
        h('button', { class: 'btn', onclick: () => fileInput.click() }, '选择文件')
      )
    )
  });
  return s;
}

export async function handleImportText(text, filename = '') {
  if (!String(text || '').trim()) { toast('请先粘贴内容'); return; }
  try {
    const result = await parseImport(text, filename);
    if (!result.courses || !result.courses.length) throw new Error('没有识别到课程');
    openImportConfirm(result);
  } catch (e) {
    toast(`导入失败：${e.message}`, 3500);
  }
}

export function openImportConfirm(result) {
  const d = app.data;
  const courses = result.courses.map((c) => sanitizeCourse({ ...c, id: uid() })).filter(Boolean);
  const hasSettings = !!(result.settings && Object.keys(result.settings).length);
  // 教务课表行头里识别到的上课时间（可能只有部分节次）
  const times = Object.entries(result.periodTimes || {})
    .map(([n, t]) => [parseInt(n, 10), t])
    .filter(([n, t]) => n >= 1 && n <= 30 && t && (/^\d{2}:\d{2}$/.test(t.start) || /^\d{2}:\d{2}$/.test(t.end)));
  const useTimes = h('input', { type: 'checkbox', checked: times.length > 0 });
  const byName = new Map();
  courses.forEach((c) => { if (!byName.has(c.name)) byName.set(c.name, []); byName.get(c.name).push(c); });

  const replace = h('input', { type: 'radio', name: 'mode', value: 'replace', checked: true });
  const appendRadio = h('input', { type: 'radio', name: 'mode', value: 'append' });
  const useSettings = h('input', { type: 'checkbox', checked: hasSettings });
  const cw = currentWeek(d);
  const maxWeek = Math.max(d.totalWeeks, ...courses.flatMap((c) => c.weeks));
  const weekSel = h('select', { class: 'input inline' },
    h('option', { value: 0, selected: cw < 1 || cw > d.totalWeeks }, '未开学 / 保持不变'),
    Array.from({ length: maxWeek }, (_, i) => h('option', { value: i + 1, selected: i + 1 === cw }, `第 ${i + 1} 周`))
  );
  const weekRow = h('label', { class: 'field inline-field' }, h('span', null, '这周是'), weekSel);
  const toggleWeekRow = () => { weekRow.hidden = useSettings.checked && !!(result.settings && result.settings.startDate); };
  useSettings.addEventListener('change', toggleWeekRow);
  toggleWeekRow();

  const s = openSheet({
    title: '确认导入',
    content: h('div', { class: 'import-confirm' },
      h('p', null, `识别到 `, h('b', null, String(byName.size)), ` 门课程，共 ${courses.length} 个上课时段`, h('br'), h('span', { class: 'muted small' }, `来源：${result.source}${result.semester ? ' · ' + result.semester : ''}`)),
      h('div', { class: 'preview-list' }, [...byName.entries()].map(([name, list]) => h('div', { class: 'preview-item' },
        h('b', null, name),
        h('div', { class: 'muted small' }, list.map((c) => `${DAY_NAMES[c.day]} ${c.start}-${c.end}节 ${weeksText(c.weeks)}${c.room ? ' ' + c.room : ''}`).join('；'))
      ))),
      h('div', { class: 'options' },
        d.courses.length ? h('div', { class: 'radio-group' },
          h('label', null, replace, ` 替换现有的 ${d.courses.length} 个时段`),
          h('label', null, appendRadio, ' 追加到现有课表')
        ) : null,
        hasSettings ? h('label', { class: 'check' }, useSettings, ' 同时导入作息时间、开学日期等设置') : null,
        times.length ? h('label', { class: 'check' }, useTimes, ` 用课表中的上课时间更新作息时间（识别到 ${times.length} 节）`) : null,
        weekRow,
        h('p', { class: 'muted small' }, '导入后可以在「设置」里调整开学日期和作息时间，在「课表」里修改单门课程。')
      )
    ),
    footer: [
      h('button', { class: 'btn', onclick: () => s.close() }, '取消'),
      h('button', { class: 'btn primary', onclick: apply }, '导入')
    ]
  });

  function apply() {
    app.update((data) => {
      if (useSettings.checked && hasSettings) {
        const merged = sanitize({ ...data, ...result.settings, courses: [] });
        Object.assign(data, { name: merged.name, startDate: merged.startDate, totalWeeks: merged.totalWeeks, periods: merged.periods, showWeekend: merged.showWeekend, showOtherWeeks: merged.showOtherWeeks });
      }
      data.courses = !data.courses.length || replace.checked ? courses : data.courses.concat(courses);
      const w = +weekSel.value;
      if (!weekRow.hidden && w > 0) data.startDate = startDateForCurrentWeek(w);
      const max = Math.max(0, ...data.courses.flatMap((c) => c.weeks));
      if (max > data.totalWeeks) data.totalWeeks = max;
      const maxP = Math.max(0, ...data.courses.map((c) => c.end));
      while (data.periods.length < maxP) {
        const last = data.periods[data.periods.length - 1] || { end: '07:50' };
        const [hh, mm] = last.end.split(':').map(Number);
        const s1 = hh * 60 + mm + 10;
        const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        data.periods.push({ start: fmt(s1), end: fmt(s1 + 45) });
      }
      if (useTimes.checked && times.length) {
        times.forEach(([n, t]) => {
          while (data.periods.length < n) data.periods.push({ ...data.periods[data.periods.length - 1] });
          const p = { ...data.periods[n - 1] };
          if (/^\d{2}:\d{2}$/.test(t.start)) p.start = t.start;
          if (/^\d{2}:\d{2}$/.test(t.end)) p.end = t.end;
          data.periods[n - 1] = p;
        });
      }
      assignColors(data.courses);
    });
    s.close();
    toast(`已导入 ${courses.length} 个上课时段`);
    app.navigate('#/week');
  }
}
