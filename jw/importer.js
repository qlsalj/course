/*
 * 课表导入助手 —— 在教务系统页面中运行（由书签脚本注入）
 *
 * 流程：识别课表 -> 预览 -> 复制到剪贴板 -> 回到课表 App 粘贴导入
 * 依赖：jw/parsers.js（需先加载）
 */
(function () {
  'use strict';
  var P = window.CourseParsers;
  if (!P) { alert('课表解析器加载失败，请重试'); return; }

  var script = document.currentScript;
  var APP_URL = (window.__COURSE_APP_URL__ || (script && script.src ? script.src.replace(/jw\/importer\.js.*$/, '') : '')) || '';
  var ID = '__course_importer__';
  var old = document.getElementById(ID);
  if (old) old.remove();

  var DAYS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  var host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  shadow.innerHTML =
    '<style>' +
    ':host,*{box-sizing:border-box}' +
    '.mask{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;font:15px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#1c1c1e}' +
    '@media(min-width:640px){.mask{align-items:center}}' +
    '.panel{background:#fff;width:100%;max-width:520px;max-height:88vh;border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.25)}' +
    '@media(min-width:640px){.panel{border-radius:18px}}' +
    'header{padding:16px 18px 8px;display:flex;align-items:center;gap:8px}' +
    'h2{font-size:18px;margin:0;flex:1}' +
    '.x{border:0;background:#f2f2f7;width:30px;height:30px;border-radius:50%;font-size:16px;cursor:pointer;color:#555}' +
    '.status{padding:0 18px 10px;color:#6b6b70;font-size:14px}' +
    '.list{overflow:auto;padding:0 18px;flex:1}' +
    '.item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #eee}' +
    '.bar{width:4px;border-radius:2px;background:#4f7cff;flex:none}' +
    '.name{font-weight:600}' +
    '.meta{font-size:12.5px;color:#6b6b70}' +
    '.actions{padding:12px 18px calc(14px + env(safe-area-inset-bottom));display:grid;gap:8px;border-top:1px solid #eee}' +
    'button.b{appearance:none;border:0;border-radius:12px;padding:12px;font-size:15.5px;font-weight:600;cursor:pointer}' +
    '.primary{background:#4f7cff;color:#fff}' +
    '.secondary{background:#f2f2f7;color:#1c1c1e}' +
    '.link{background:none;color:#4f7cff;font-weight:500;padding:6px!important}' +
    'textarea{width:100%;height:120px;font:12px ui-monospace,monospace;border:1px solid #ddd;border-radius:10px;padding:8px;margin:8px 0}' +
    '.tip{font-size:13px;color:#6b6b70;padding:8px 0}' +
    '</style>' +
    '<div class="mask"><div class="panel">' +
    '<header><h2>课表导入助手</h2><button class="x" data-act="close" aria-label="关闭">✕</button></header>' +
    '<div class="status">正在识别课表…</div>' +
    '<div class="list"></div>' +
    '<div class="actions"></div>' +
    '</div></div>';
  document.documentElement.appendChild(host);

  var $ = function (sel) { return shadow.querySelector(sel); };
  var statusEl = $('.status');
  var listEl = $('.list');
  var actionsEl = $('.actions');
  var payload = '';

  shadow.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (e.target.classList && e.target.classList.contains('mask')) return close();
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'close') close();
    if (act === 'copy') copy(payload, t, '已复制！回到课表 App 粘贴导入');
    if (act === 'open') openApp();
    if (act === 'html') copy(dumpHtml(), t, '已复制页面源码');
    if (act === 'frame') window.open(t.getAttribute('data-url'), '_blank');
  });

  function close() { host.remove(); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function dumpHtml() {
    return P.collectDocuments(window).map(function (d) {
      return '<!-- ' + (d.location ? d.location.href : '') + ' -->\n' + d.documentElement.outerHTML;
    }).join('\n\n');
  }

  function copy(text, btn, okText) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = okText;
      setTimeout(function () { btn.textContent = old; }, 2500);
    };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      shadow.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) return done();
      // 实在复制不了：显示文本框让用户手动复制
      var box = document.createElement('textarea');
      box.value = text;
      listEl.prepend(box);
      box.focus();
      box.select();
      statusEl.textContent = '自动复制失败，请手动全选下面的内容并复制';
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function openApp() {
    if (!APP_URL) return;
    var encoded = btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    window.open(APP_URL + '#/import?data=' + encoded, '_blank');
  }

  function render(result) {
    var courses = result.courses || [];
    if (!courses.length) {
      statusEl.innerHTML = '没有在当前页面找到课表。';
      var frames = P.crossOriginFrames(window);
      var frameTip = frames.length
        ? '<div class="tip"><b>这个页面里嵌套了其他网站的页面，脚本读不到里面的内容。</b>课表很可能就在其中，请点下面的按钮单独打开它，再在新页面里运行一次导入：</div>' +
          frames.slice(0, 6).map(function (u) {
            return '<button class="b secondary" style="width:100%;margin:4px 0;text-align:left;font-weight:500;font-size:13px;word-break:break-all" data-act="frame" data-url="' + esc(u) + '">打开 ' + esc(u.length > 80 ? u.slice(0, 80) + '…' : u) + '</button>';
          }).join('')
        : '';
      listEl.innerHTML = frameTip +
        '<div class="tip">请确认：<br>1. 已登录教务系统；<br>2. 当前打开的是「个人课表 / 学期课表」页面（能看到课表格子）；<br>' +
        '3. 部分系统需要先选好学年学期并点「查询」。<br><br>' +
        '如果仍然识别失败，欢迎点击下面的按钮复制页面源码，到项目 GitHub 提 issue 适配你的学校（注意先删掉学号姓名等隐私信息）。</div>';
      actionsEl.innerHTML =
        '<button class="b secondary" data-act="html">复制页面源码（用于反馈）</button>' +
        '<button class="b link" data-act="close">关闭</button>';
      return;
    }
    payload = JSON.stringify({
      type: 'course-pwa/import',
      version: 1,
      source: result.source,
      semester: result.semester || '',
      from: location.host,
      courses: courses,
      periodTimes: result.periodTimes || {}
    });
    var names = {};
    courses.forEach(function (c) { names[c.name] = true; });
    statusEl.textContent = '识别到 ' + Object.keys(names).length + ' 门课程，共 ' + courses.length + ' 个上课时段（' + result.source + (result.semester ? ' · ' + result.semester : '') + '）';
    listEl.innerHTML = courses.map(function (c) {
      return '<div class="item"><div class="bar"></div><div><div class="name">' + esc(c.name) + '</div>' +
        '<div class="meta">' + DAYS[c.day] + ' 第' + c.start + (c.end > c.start ? '-' + c.end : '') + '节 · ' +
        esc(P.formatWeeks(c.weeks) || '周次未知') + (c.room ? ' · ' + esc(c.room) : '') + (c.teacher ? ' · ' + esc(c.teacher) : '') +
        '</div></div></div>';
    }).join('');
    actionsEl.innerHTML =
      '<button class="b primary" data-act="copy">复制课表数据</button>' +
      '<div class="tip" style="padding:0 2px">复制后打开课表 App →「设置」→「导入课表」→「粘贴导入」。</div>' +
      (APP_URL ? '<button class="b secondary" data-act="open">在浏览器中打开课表网页版导入</button>' : '') +
      '<button class="b link" data-act="html">识别有误？复制页面源码反馈</button>';
  }

  P.extractFromWindow(window).then(render, function (err) {
    statusEl.textContent = '识别出错：' + (err && err.message ? err.message : err);
    actionsEl.innerHTML = '<button class="b secondary" data-act="html">复制页面源码（用于反馈）</button>';
  });
})();
