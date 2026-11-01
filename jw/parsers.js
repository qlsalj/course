/*
 * 课表解析器（教务系统 / 通用表格）
 *
 * 这是一个普通脚本（非 ES Module），同时被三个地方使用：
 *   1. PWA 本身（解析粘贴进来的网页源码）
 *   2. jw/importer.js —— 通过书签脚本注入到教务系统页面里运行
 *   3. 单元测试（tests/）
 * 所以这里只能用浏览器原生 API，不能 import 任何东西。
 *
 * 导出：globalThis.CourseParsers
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                            */
  /* ------------------------------------------------------------------ */

  // 全角 -> 半角
  function toHalfWidth(s) {
    return String(s == null ? '' : s)
      .replace(/[！-～]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
      })
      .replace(/　/g, ' ');
  }

  function clean(s) {
    return toHalfWidth(s).replace(/[\s ]+/g, ' ').trim();
  }

  var CN_NUM = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

  // "十二" -> 12, "三" -> 3, "二十" -> 20
  function cnToInt(s) {
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (!s) return NaN;
    var n = 0;
    if (s.indexOf('十') >= 0) {
      var parts = s.split('十');
      var tens = parts[0] ? CN_NUM[parts[0]] : 1;
      var ones = parts[1] ? CN_NUM[parts[1]] : 0;
      if (tens == null || ones == null) return NaN;
      return tens * 10 + ones;
    }
    for (var i = 0; i < s.length; i++) {
      var v = CN_NUM[s[i]];
      if (v == null) return NaN;
      n = n * 10 + v;
    }
    return n;
  }

  /* ------------------------------------------------------------------ */
  /* 周次 / 节次                                                          */
  /* ------------------------------------------------------------------ */

  var MAX_WEEK = 60;

  /**
   * 解析周次字符串，返回升序去重后的周次数组。
   *   "1-16周"            -> 1..16
   *   "1-15周(单)"        -> 1,3,...,15
   *   "2-16(双周)"        -> 2,4,...,16
   *   "1-8,10-16周"       -> 1..8,10..16
   *   "1-4周,6-16周(双)"  -> 1..4, 6,8,...,16
   *   "第3周"             -> 3
   *   "1,3,5,7周"         -> 1,3,5,7
   */
  function parseWeeks(str) {
    var s = toHalfWidth(str)
      .replace(/[~～—–至到]/g, '-')
      .replace(/\s*-\s*/g, '-')
      .replace(/[\[\]{}|]/g, ' ')
      // 星期与节次信息（如 "周一"、"[01-02节]"、"第1,2节"）不是周次，先去掉
      .replace(/(?:星期|周|礼拜)[一二三四五六日天]/g, ' ')
      .replace(/第?\s*\d+(?:\s*[-,，、]\s*\d+)*\s*小?节/g, ' ')
      .replace(/\(\s*\)/g, ' ')
      .replace(/[，、;；\s]+/g, ',')
      .replace(/第/g, '');
    var parts = s.split(',').filter(Boolean);
    var markers = parts.map(function (p) {
      if (/单/.test(p)) return 1;
      if (/双/.test(p)) return 2;
      return 0;
    });
    // "{1-15周|单周}"：单独的"单周/双周"作用于前一段
    for (var mi = 1; mi < parts.length; mi++) {
      if (markers[mi] && !/\d/.test(parts[mi]) && !markers[mi - 1]) markers[mi - 1] = markers[mi];
    }
    // "1-8,10-16周(双)" 这种只有最后带标记、前面不带"周"的，标记作用于全部
    var lastMarker = markers[markers.length - 1];
    if (lastMarker && markers.slice(0, -1).every(function (m, i) { return !m && !/周/.test(parts[i]); })) {
      markers = markers.map(function () { return lastMarker; });
    }
    var set = {};
    parts.forEach(function (p, i) {
      var m = p.match(/(\d+)(?:-(\d+))?/);
      if (!m) return;
      var a = parseInt(m[1], 10);
      var b = m[2] ? parseInt(m[2], 10) : a;
      if (a > b) { var t = a; a = b; b = t; }
      for (var w = a; w <= b && w <= MAX_WEEK; w++) {
        if (w < 1) continue;
        if (markers[i] === 1 && w % 2 === 0) continue;
        if (markers[i] === 2 && w % 2 === 1) continue;
        set[w] = true;
      }
    });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }

  /** 周次数组 -> "1-16周" / "1-15周(单)" / "1-4周,6-16周(双)" */
  function formatWeeks(weeks) {
    var w = (weeks || []).slice().sort(function (a, b) { return a - b; });
    if (!w.length) return '';
    var segs = [];
    var i = 0;
    while (i < w.length) {
      var j1 = i;
      while (j1 + 1 < w.length && w[j1 + 1] === w[j1] + 1) j1++;
      var j2 = i;
      while (j2 + 1 < w.length && w[j2 + 1] === w[j2] + 2) j2++;
      if (j2 - i >= 2 && j2 - i > j1 - i) {
        segs.push({ a: w[i], b: w[j2], p: w[i] % 2 ? '单' : '双' });
        i = j2 + 1;
      } else {
        segs.push({ a: w[i], b: w[j1] });
        i = j1 + 1;
      }
    }
    var hasParity = segs.some(function (x) { return x.p; });
    var text = segs.map(function (x) {
      var r = x.a === x.b ? String(x.a) : x.a + '-' + x.b;
      if (!hasParity) return r;
      return r + '周' + (x.p ? '(' + x.p + ')' : '');
    });
    return hasParity ? text.join(',') : text.join(',') + '周';
  }

  /**
   * 从字符串中找出节次，如 "[01-02节]"、"(3-4节)"、"第5,6节"、"1-2"、"第一大节"
   * 返回 {start, end} 或 null
   */
  function parsePeriods(str, opts) {
    var s = toHalfWidth(str);
    var m = s.match(/(?:第)?\s*(\d+(?:\s*[-,、~]\s*\d+)*)\s*(?:小)?节/);
    if (!m && opts && opts.loose) m = s.match(/(\d+(?:\s*[-,、~]\s*\d+)*)/);
    if (m) {
      var nums = m[1].match(/\d+/g).map(Number);
      var a = Math.min.apply(null, nums);
      var b = Math.max.apply(null, nums);
      if (a >= 1 && b <= 30) return { start: a, end: b };
    }
    // 中文数字："第一节"、"第十一节"、"第三大节"
    var c = s.match(/第?([一二三四五六七八九十]+)\s*(大)?节/);
    if (c) {
      var n = cnToInt(c[1]);
      if (n >= 1) {
        if (c[2]) return { start: n * 2 - 1, end: n * 2, big: true };
        return { start: n, end: n };
      }
    }
    return null;
  }

  var DAY_PATTERNS = [
    [1, /星期一|周一|礼拜一|^一$|mon/i],
    [2, /星期二|周二|礼拜二|^二$|tue/i],
    [3, /星期三|周三|礼拜三|^三$|wed/i],
    [4, /星期四|周四|礼拜四|^四$|thu/i],
    [5, /星期五|周五|礼拜五|^五$|fri/i],
    [6, /星期六|周六|礼拜六|^六$|sat/i],
    [7, /星期日|星期天|周日|周天|礼拜日|礼拜天|^日$|^天$|sun/i]
  ];

  function parseDay(str) {
    var s = clean(str);
    if (/^[1-7]$/.test(s)) return parseInt(s, 10);
    for (var i = 0; i < DAY_PATTERNS.length; i++) {
      if (DAY_PATTERNS[i][1].test(s)) return DAY_PATTERNS[i][0];
    }
    return 0;
  }

  /* ------------------------------------------------------------------ */
  /* 课程规范化与合并                                                      */
  /* ------------------------------------------------------------------ */

  function normalizeCourse(c) {
    var day = typeof c.day === 'number' ? c.day : parseDay(c.day);
    var start = parseInt(c.start, 10);
    var end = parseInt(c.end, 10) || start;
    if (end < start) { var t = end; end = start; start = t; }
    var weeks = Array.isArray(c.weeks) ? c.weeks.map(Number).filter(function (w) { return w >= 1 && w <= MAX_WEEK; }) : parseWeeks(c.weeks || '');
    return {
      name: clean(c.name),
      teacher: clean(c.teacher),
      room: clean(c.room),
      day: day,
      start: start,
      end: end,
      weeks: weeks.sort(function (a, b) { return a - b; })
    };
  }

  function isValidCourse(c) {
    return !!(c.name && c.day >= 1 && c.day <= 7 && c.start >= 1 && c.end >= c.start);
  }

  /**
   * 合并重复项：
   *  - 完全相同（课名/老师/教室/星期/节次）的条目合并周次
   *  - 同一门课连续的节次（每节一行、没有 rowspan 的表格）合并成一段
   */
  function mergeCourses(list) {
    var byKey = {};
    var order = [];
    list.forEach(function (c) {
      var key = [c.name, c.teacher, c.room, c.day, c.start, c.end].join('|');
      if (byKey[key]) {
        var set = {};
        byKey[key].weeks.concat(c.weeks).forEach(function (w) { set[w] = true; });
        byKey[key].weeks = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
      } else {
        byKey[key] = { name: c.name, teacher: c.teacher, room: c.room, day: c.day, start: c.start, end: c.end, weeks: c.weeks.slice() };
        order.push(key);
      }
    });
    var merged = order.map(function (k) { return byKey[k]; });
    merged.sort(function (a, b) { return a.day - b.day || a.start - b.start || (a.name < b.name ? -1 : 1); });
    var out = [];
    merged.forEach(function (c) {
      for (var i = out.length - 1; i >= 0; i--) {
        var p = out[i];
        if (p.day !== c.day) break;
        if (p.end + 1 === c.start && p.name === c.name && p.teacher === c.teacher && p.room === c.room &&
            p.weeks.join(',') === c.weeks.join(',')) {
          p.end = c.end;
          return;
        }
      }
      out.push(c);
    });
    return out;
  }

  function finalize(list) {
    return mergeCourses(list.map(normalizeCourse).filter(isValidCourse));
  }

  /* ------------------------------------------------------------------ */
  /* 正方教务（新版 jwglxt）JSON                                            */
  /* ------------------------------------------------------------------ */

  /** 解析正方 kbcx/xskbcx_cxXsgrkb.html 返回的 JSON */
  function parseZhengfangJson(json) {
    if (typeof json === 'string') json = JSON.parse(json);
    var list = (json && json.kbList) || [];
    var courses = list.map(function (k) {
      var p = parsePeriods(String(k.jcs || k.jc || '') + '节') || { start: 0, end: 0 };
      return {
        name: k.kcmc,
        teacher: k.xm,
        room: k.cdmc,
        day: parseInt(k.xqj, 10),
        start: p.start,
        end: p.end,
        weeks: parseWeeks(k.zcd || '')
      };
    });
    var semester = '';
    if (json && json.xsxx) semester = [json.xsxx.XNMC, json.xsxx.XQMMC].filter(Boolean).join(' 第') + (json.xsxx.XQMMC ? '学期' : '');
    return { courses: finalize(courses), source: '正方教务', semester: semester };
  }

  function looksLikeZhengfangJson(obj) {
    return !!(obj && Array.isArray(obj.kbList));
  }

  /* ------------------------------------------------------------------ */
  /* 表格解析（强智 / 正方网页 / URP / 其它）                                 */
  /* ------------------------------------------------------------------ */

  // 把 table 展开为二维矩阵（处理 rowspan / colspan）
  function buildGrid(table) {
    var rows = [];
    var trs = table.rows;
    for (var r = 0; r < trs.length; r++) {
      rows[r] = rows[r] || [];
      var c = 0;
      var cells = trs[r].cells;
      for (var i = 0; i < cells.length; i++) {
        while (rows[r][c]) c++;
        var cell = cells[i];
        var rs = Math.max(1, parseInt(cell.getAttribute('rowspan'), 10) || 1);
        var cs = Math.max(1, parseInt(cell.getAttribute('colspan'), 10) || 1);
        for (var dr = 0; dr < rs; dr++) {
          rows[r + dr] = rows[r + dr] || [];
          for (var dc = 0; dc < cs; dc++) {
            rows[r + dr][c + dc] = { el: cell, origin: dr === 0 && dc === 0, r: r, c: c, rowSpan: rs };
          }
        }
        c += cs;
      }
    }
    return rows;
  }

  function textOf(el) {
    return clean(el ? el.textContent : '');
  }

  // innerHTML -> 文本行
  function htmlToLines(html) {
    return String(html)
      .replace(/<(br|hr)\b[^>]*>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
      .split('\n')
      .map(clean)
      .filter(Boolean);
  }

  var WEEK_RE = /\d+\s*(?:-\s*\d+)?\s*(?:\(\s*周\s*\)|周)|周次|第\s*\d+\s*(?:-\s*\d+)?\s*周|\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*\s*\((?:单|双)?周?\)/;
  var ROOM_RE = /楼|室|馆|教|区|厅|场|房|实验|机房|中心|校区|^[A-Z]{1,3}\s*-?\s*\d|\d{3,}|room|lab/i;
  var LABELS = [
    ['teacher', /^(?:任课)?(?:教师|老师|授课教师|主讲)\s*[:：]\s*/],
    ['room', /^(?:上课)?(?:地点|教室|场地)\s*[:：]\s*/],
    ['weeks', /^(?:上课)?(?:周次|时间|节\/周)\s*[:：]\s*/],
    ['name', /^(?:课程名称|课程|课名)\s*[:：]\s*/]
  ];
  var JUNK_RE = /^(?:学分|课程号|课序号|教学班|选课|考核|课程性质|课程类别|总学时|学时|上课人数|备注|◆|★)/;

  // 解析单个课程块（文本行 + 可选的 DOM）
  function parseBlock(lines, el) {
    var c = { name: '', teacher: '', room: '', weeksText: '' };
    // "编译原理 1-8周 黄老师 信息楼C201"：一行里用空格分隔
    if (lines.length === 1 && / /.test(lines[0]) && WEEK_RE.test(lines[0])) {
      lines = lines[0].split(' ').filter(Boolean);
    }
    if (el && el.querySelectorAll) {
      // 强智：<font title="老师">；正方网页版：<span title="教师"> 等
      var titled = el.querySelectorAll('[title]');
      for (var i = 0; i < titled.length; i++) {
        var t = titled[i].getAttribute('title');
        var node = titled[i];
        var v = textOf(node);
        if (!v && node.parentNode) v = textOf(node.parentNode);
        if (!v) continue;
        if (/老师|教师/.test(t) && !c.teacher) c.teacher = v;
        else if (/教室|地点|场地/.test(t) && !c.room) c.room = v;
        else if (/周次|节\/周|周\/节|时间/.test(t) && !c.weeksText) c.weeksText = v;
      }
      var title = el.querySelector('.title, .kcmc');
      if (title) c.name = textOf(title);
    }
    var rest = [];
    lines.forEach(function (line) {
      for (var i = 0; i < LABELS.length; i++) {
        if (LABELS[i][1].test(line)) {
          var key = LABELS[i][0];
          var val = line.replace(LABELS[i][1], '');
          if (key === 'weeks') { if (!c.weeksText) c.weeksText = val; } else if (!c[key]) c[key] = val;
          return;
        }
      }
      rest.push(line);
    });
    var used = {};
    [c.name, c.teacher, c.room, c.weeksText].forEach(function (v) { if (v) used[v] = true; });
    rest = rest.filter(function (l) { return !used[l] && !JUNK_RE.test(l); });
    if (!c.name && rest.length) c.name = rest.shift();
    if (!c.weeksText) {
      for (var j = 0; j < rest.length; j++) {
        if (WEEK_RE.test(rest[j])) { c.weeksText = rest.splice(j, 1)[0]; break; }
      }
    }
    // 周次行里可能顺带写了教室，如 "1-16周 A101"
    if (c.weeksText && !c.room) {
      var tail = clean(c.weeksText.replace(/.*(?:周|节\)|节\]|\))/, ''));
      if (tail && ROOM_RE.test(tail)) c.room = tail;
    }
    rest.forEach(function (l) {
      if (!c.room && ROOM_RE.test(l)) { c.room = l; return; }
      if (!c.teacher && /^[一-龥·]{2,5}(?:[,，、][一-龥·]{2,5})*(?:\s*(?:老师|教授|讲师|副教授))?$/.test(l)) { c.teacher = l; return; }
      if (!c.teacher && l.length <= 12 && !/\d/.test(l)) { c.teacher = l; return; }
      if (!c.room) c.room = l;
    });
    c.name = c.name.replace(/[◆★●■▲※☆]+/g, '').replace(/\s*\((?:[A-Z]*\d{4,}[^)]*)\)$/, '').trim();
    c.teacher = c.teacher.replace(/\s*\((?:讲师|教授|副教授|助教|未评级)\)/g, '').trim();
    return c;
  }

  // 一个单元格 -> 多个课程块
  function splitCell(cell) {
    var blocks = [];
    // 正方网页版
    var zf = cell.querySelectorAll('.timetable_con');
    if (zf.length) {
      for (var i = 0; i < zf.length; i++) blocks.push({ el: zf[i], lines: htmlToLines(zf[i].innerHTML) });
      return blocks;
    }
    // 强智：.kbcontent 为详细版（.kbcontent1 为简略版）
    var root = cell.querySelector('.kbcontent') || cell;
    var html = root.innerHTML;
    var pieces = html.split(/<hr\b[^>]*>|-{5,}|={5,}|_{5,}/i);
    pieces.forEach(function (piece) {
      var lines = htmlToLines(piece);
      if (!lines.length) return;
      if (lines.length === 1 && /^(?:&nbsp;|无|-|\s)*$/.test(lines[0])) return;
      var holder = (cell.ownerDocument || document).createElement('div');
      holder.innerHTML = piece;
      // 同一块里出现多个周次行，且行数能整除，按等长切分（某些系统没有分隔线）
      var weekLines = lines.filter(function (l) { return WEEK_RE.test(l); }).length;
      var hasTitled = holder.querySelector('[title]');
      if (weekLines > 1 && !hasTitled && lines.length % weekLines === 0) {
        var size = lines.length / weekLines;
        for (var k = 0; k < lines.length; k += size) blocks.push({ el: null, lines: lines.slice(k, k + size) });
      } else {
        blocks.push({ el: holder, lines: lines });
      }
    });
    return blocks;
  }

  function scoreTable(table) {
    var text = table.textContent || '';
    var score = 0;
    for (var i = 0; i < DAY_PATTERNS.length; i++) if (DAY_PATTERNS[i][1].source.split('|').slice(0, 3).some(function (p) { return text.indexOf(p) >= 0; })) score++;
    if (/节/.test(text)) score += 1;
    if (WEEK_RE.test(text)) score += 2;
    return score;
  }

  function parseTable(table) {
    var grid = buildGrid(table);
    if (grid.length < 2) return [];
    // 找表头行
    var headerRow = -1;
    var dayCols = {};
    for (var r = 0; r < Math.min(grid.length, 4) && headerRow < 0; r++) {
      var found = {};
      var count = 0;
      (grid[r] || []).forEach(function (cell, c) {
        if (!cell || !cell.origin) return;
        var t = textOf(cell.el);
        if (t.length > 12) return;
        var d = parseDay(t);
        if (d) { found[c] = d; count++; }
      });
      if (count >= 5) { headerRow = r; dayCols = found; }
    }
    if (headerRow < 0) return [];
    var firstDayCol = Math.min.apply(null, Object.keys(dayCols).map(Number));

    // 每行对应的节次
    var rowPeriods = [];
    var anyNumbered = false;
    for (var r2 = headerRow + 1; r2 < grid.length; r2++) {
      var head = '';
      for (var c2 = 0; c2 < firstDayCol; c2++) {
        var hc = grid[r2] && grid[r2][c2];
        if (!hc) continue;
        // 跨行的“上午/下午”不算，取当前行自己的单元格
        if (hc.rowSpan > 1 && !hc.origin && c2 < firstDayCol - 1) continue;
        head += ' ' + textOf(hc.el);
      }
      var p = parsePeriods(head) || parsePeriods(head.replace(/上午|下午|晚上|中午|\d{1,2}:\d{2}/g, ''), { loose: true });
      if (p) anyNumbered = true;
      rowPeriods[r2] = p;
    }
    if (!anyNumbered) {
      var n = 1;
      for (var r3 = headerRow + 1; r3 < grid.length; r3++) { rowPeriods[r3] = { start: n, end: n }; n++; }
    }

    var out = [];
    Object.keys(dayCols).forEach(function (colKey) {
      var col = Number(colKey);
      var day = dayCols[colKey];
      for (var r4 = headerRow + 1; r4 < grid.length; r4++) {
        var cell = grid[r4] && grid[r4][col];
        if (!cell || !cell.origin) continue;
        var text = textOf(cell.el);
        if (!text || text === '无') continue;
        var lastRow = r4 + cell.rowSpan - 1;
        var ps = rowPeriods[r4];
        var pe = rowPeriods[Math.min(lastRow, grid.length - 1)] || ps;
        splitCell(cell.el).forEach(function (b) {
          var info = parseBlock(b.lines, b.el);
          if (!info.name) return;
          var explicit = info.weeksText ? parsePeriods(info.weeksText) : null;
          if (!explicit) {
            for (var i = 0; i < b.lines.length && !explicit; i++) {
              if (/节/.test(b.lines[i]) && b.lines[i] !== info.name) explicit = parsePeriods(b.lines[i]);
            }
          }
          var range = explicit || (ps ? { start: ps.start, end: (pe || ps).end } : null);
          if (!range) return;
          var weeks = parseWeeks(info.weeksText || '');
          out.push({
            name: info.name,
            teacher: info.teacher,
            room: info.room,
            day: day,
            start: range.start,
            end: range.end,
            weeks: weeks
          });
        });
      }
    });
    return out;
  }

  /** 在一个或多个 Document 中查找课表并解析 */
  function parseDocuments(docs) {
    var tables = [];
    docs.forEach(function (doc) {
      var list = doc.querySelectorAll('table');
      for (var i = 0; i < list.length; i++) tables.push(list[i]);
    });
    // 跳过嵌套在其他候选表格里的外层布局表
    var scored = tables
      .map(function (t) { return { t: t, s: scoreTable(t) }; })
      .filter(function (x) { return x.s >= 6; })
      .sort(function (a, b) { return b.s - a.s; });
    var best = null;
    for (var i = 0; i < scored.length; i++) {
      var courses = finalize(parseTable(scored[i].t));
      if (courses.length && (!best || courses.length > best.length)) best = courses;
    }
    if (!best) return { courses: [], source: '' };
    var html = docs.map(function (d) { return d.documentElement ? d.documentElement.innerHTML.slice(0, 20000) : ''; }).join('');
    var source = /强智|jsxsd|kbcontent/.test(html) ? '强智教务' : /timetable_con|jwglxt|正方/.test(html) ? '正方教务（网页）' : /URP|urp/.test(html) ? 'URP 教务' : '网页表格';
    // 没有周次信息的课，默认全学期（留空，导入时补全）
    return { courses: best, source: source };
  }

  /** 解析 HTML 字符串（PWA 中粘贴网页源码时使用） */
  function parseHtml(html) {
    var doc = new DOMParser().parseFromString(String(html), 'text/html');
    return parseDocuments([doc]);
  }

  /* ------------------------------------------------------------------ */
  /* 在教务系统页面内运行：先尝试 API，再解析 DOM                               */
  /* ------------------------------------------------------------------ */

  function collectDocuments(win) {
    var docs = [];
    (function walk(w, depth) {
      try {
        if (!w.document) return;
        docs.push(w.document);
      } catch (e) { return; } // 跨域 iframe
      if (depth > 4) return;
      for (var i = 0; i < w.frames.length; i++) {
        try { walk(w.frames[i], depth + 1); } catch (e) { /* ignore */ }
      }
    })(win, 0);
    return docs;
  }

  function guessZhengfangTerm(doc, now) {
    var xnm = doc.querySelector('#xnm');
    var xqm = doc.querySelector('#xqm');
    if (xnm && xnm.value && xqm && xqm.value) return { xnm: xnm.value, xqm: xqm.value };
    var d = now || new Date();
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    // 正方：xqm=3 第一学期，12 第二学期，16 第三学期
    if (m >= 8) return { xnm: String(y), xqm: '3' };
    if (m <= 1) return { xnm: String(y - 1), xqm: '3' };
    return { xnm: String(y - 1), xqm: '12' };
  }

  function zhengfangBase(loc) {
    var path = loc.pathname;
    var i = path.indexOf('/kbcx/');
    if (i >= 0) return loc.origin + path.slice(0, i + 1);
    var j = path.indexOf('/jwglxt/');
    if (j >= 0) return loc.origin + path.slice(0, j + 8);
    return null;
  }

  async function fetchZhengfang(win) {
    var base = zhengfangBase(win.location);
    if (!base) return null;
    var docs = collectDocuments(win);
    var term = null;
    for (var i = 0; i < docs.length && !term; i++) {
      if (docs[i].querySelector('#xnm')) term = guessZhengfangTerm(docs[i]);
    }
    term = term || guessZhengfangTerm(win.document);
    var endpoints = ['kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151', 'kbcx/xskbcx_cxXsKb.html?gnmkdm=N2151'];
    for (var k = 0; k < endpoints.length; k++) {
      try {
        var res = await fetch(base + endpoints[k], {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: 'xnm=' + encodeURIComponent(term.xnm) + '&xqm=' + encodeURIComponent(term.xqm) + '&kzlx=ck&xsdm='
        });
        if (!res.ok) continue;
        var json = await res.json();
        if (looksLikeZhengfangJson(json)) {
          var r = parseZhengfangJson(json);
          r.source = '正方教务（接口）';
          r.term = term;
          if (r.courses.length) return r;
        }
      } catch (e) { /* 尝试下一个 */ }
    }
    return null;
  }

  /** 在当前窗口中尽力获取课表 */
  async function extractFromWindow(win) {
    var api = await fetchZhengfang(win);
    if (api && api.courses.length) return api;
    return parseDocuments(collectDocuments(win));
  }

  root.CourseParsers = {
    toHalfWidth: toHalfWidth,
    cnToInt: cnToInt,
    parseWeeks: parseWeeks,
    formatWeeks: formatWeeks,
    parsePeriods: parsePeriods,
    parseDay: parseDay,
    normalizeCourse: normalizeCourse,
    mergeCourses: mergeCourses,
    finalize: finalize,
    parseZhengfangJson: parseZhengfangJson,
    looksLikeZhengfangJson: looksLikeZhengfangJson,
    parseTable: parseTable,
    parseDocuments: parseDocuments,
    parseHtml: parseHtml,
    collectDocuments: collectDocuments,
    zhengfangBase: zhengfangBase,
    extractFromWindow: extractFromWindow
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
