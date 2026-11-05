# 课表 · 无广告的课程表 PWA

[![Test & Deploy](https://github.com/qlsalj/course/actions/workflows/deploy.yml/badge.svg)](https://github.com/qlsalj/course/actions/workflows/deploy.yml)

一个**纯前端、零依赖、无广告**的课程表 Web App。添加到 iPhone 主屏幕后就能当 App 用，支持从教务系统 / WakeUp 课程表导入课表，还能导出 [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) 脚本，做成 iOS 桌面和锁屏小组件。不需要 99 美元的开发者账号。

**👉 直接使用：<https://qlsalj.github.io/course/>**

> 起因：受够了某课程表 App 的开屏广告 🙃

<p>
  <img src="docs/screenshots/today.png" width="250" alt="今天">
  <img src="docs/screenshots/week.png" width="250" alt="本周课表">
  <img src="docs/screenshots/import.png" width="250" alt="导入课表">
</p>

<p>
  <img src="docs/screenshots/widget-small.png" width="260" alt="小号组件">
  <img src="docs/screenshots/widget-medium.png" width="260" alt="中号组件">
  <img src="docs/screenshots/widget-lock.png" width="260" alt="锁屏组件">
</p>
<p>
  <img src="docs/screenshots/widget-large.png" width="260" alt="大号组件">
  <img src="docs/screenshots/widget-week.png" width="260" alt="大号组件 · 整周">
</p>

## 功能

- **今天**：当前第几周、正在上的课（带进度条）、下一节倒计时、今天和明天的课程
- **周课表**
  - 跟手左右拖动切换周次；点标题可以跳到任意一周
  - 单双周、非本周的课程用灰色显示
  - 点空白格添加课程，点课程查看、编辑、删除；同一时间有多门课时显示 +n
- **导入**
  - 教务系统：用快捷指令或书签脚本，在已登录的教务页面一键识别。正方会自动调用课表接口；强智和大多数表格形式的课表都能识别；课表嵌在校园门户里也能处理
  - 能从课表里读出每节课的上课时间，导入时可以顺便更新作息时间
  - WakeUp 课程表导出的 `.wakeup_schedule` 文件：课程、颜色、作息时间、开学日期一起导入
  - CSV（WakeUp 模板格式）、本应用的 JSON 备份、分享链接、保存下来的课表网页
- **导出**：Scriptable 小组件脚本、分享链接、系统日历（`.ics`）、JSON 备份、CSV
- **iOS 小组件**（基于 Scriptable）
  - 小 / 中 / 大号组件，大号整周视图，锁屏圆形 / 矩形 / 单行组件，自动适配深色模式
  - 已经上完的课会自动隐藏，只显示接下来的课
  - 点击小组件打开网页版，查看完整课表
- 自定义作息时间（可以一键生成）、学期周数、周末显示、深色模式、离线可用，有过渡动画（系统开启「减弱动态效果」时会自动关闭）
- 数据只保存在本机浏览器里，没有服务器、没有统计、没有广告

## 使用

### 1. 添加到主屏幕

用 **Safari** 打开 <https://qlsalj.github.io/course/> → 点「分享」→「添加到主屏幕」。之后就能像普通 App 一样全屏使用，也能离线打开。

> 主屏幕上的 App 更新后，完全关掉再重新打开一次，就会加载新版本。

### 2. 导入课表

打开 App →「设置」→「导入课表」。

#### 从教务系统导入（iPhone / iPad）

1. 添加 [「导入课表」快捷指令](https://www.icloud.com/shortcuts/48bc18b94a7e4d46a095c80b31ea3036)
2. 在 Safari 里登录教务系统（或校园门户），打开「个人课表 / 学期课表」页面
3. 点 Safari 的分享按钮 → 选「导入课表」。第一次运行会询问是否允许访问该网站，选「允许」
4. **运行后不会直接复制**：网页上会弹出「课表导入助手」窗口，列出识别到的课程。确认无误后，点里面的「复制课表数据」
5. 回到课表 App，点「从剪贴板粘贴」，选择「这周是第几周」，确认导入

整个过程都在你自己的浏览器里完成，课表数据不会经过任何第三方服务器。

- **校园门户**：如果课表是嵌在门户页面里的另一个网站，导入助手会列出这些嵌套的页面。点「打开」单独打开它，再运行一次导入即可。
- **电脑浏览器**：在「导入课表」里把「导入课表」按钮拖到书签栏，在课表页面点这个书签。iPhone 也可以用书签，但必须从书签列表（📖）里点。在地址栏输入或搜索书签名会被 iOS 拦截，提示「无法运行脚本」。

| 教务系统 | 支持情况 |
| --- | --- |
| 正方教务（新版 `jwglxt`） | ✅ 自动调用课表接口，最准确；支持 webvpn |
| 正方教务（网页课表） | ✅ |
| 强智教务（`jsxsd`） | ✅ |
| 其它以表格显示的课表（URP、金智、自研系统……） | ⚠️ 通用表格识别，支持「课程名[班号] 周次 (节次) 教师 地点」等常见写法，个别学校需要适配 |

识别不出来或识别错误？在导入助手里点「复制页面源码」，**删掉学号、姓名等个人信息**后到 [Issues](../../issues) 反馈，或者直接提 PR 改进 [`jw/parsers.js`](jw/parsers.js)。

#### 从 WakeUp 课程表迁移

WakeUp → 右上角菜单 →「导出」→「导出为 WakeUp 课程表文件」，把文件存到「文件」App，再在本 App「导入课表」→「选择文件」。

### 3. 桌面 / 锁屏小组件（Scriptable）

1. App Store 安装免费的 [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)
2. 课表 App →「设置」→「iOS 桌面小组件」，预览各个尺寸的效果，点「复制 Scriptable 脚本」
3. 打开 Scriptable → 右上角 `+` 新建脚本 → 粘贴 → 保存（可以把脚本名改成「课表」）
4. 桌面长按 → 添加小组件 → Scriptable → 选尺寸；长按小组件 →「编辑小组件」→ **Script** 选择刚才的脚本

| 尺寸 | 显示内容 |
| --- | --- |
| 小号 | 接下来的两节课 |
| 中号 | 日期、周数，以及接下来的三节课（今天上完后显示明天的） |
| 大号 | 今天还没上的课 + 明天的课，按屏幕大小尽量排满；或者整周课表 |
| 锁屏 · 圆形 | 当前第几周 |
| 锁屏 · 长条 | 下一节课的课程名、时间和教室（仿系统「日历」样式） |
| 锁屏 · 单行（时间上方） | 下一节课的时间、课程名、教室 |

已经上完的课会自动隐藏。小组件会在每节课开始和结束时自动刷新，具体时间由 iOS 决定，可能差几分钟。

**同时要「今日」和「整周」两个大号组件？** 不用新建脚本。在桌面添加两个大号 Scriptable 组件，都选同一个脚本，其中一个的 **Parameter** 填 `week` 即可。Scriptable 目前不支持最大的那一档尺寸，所以整周课表放在大号里。也可以在导出页把「大号组件默认显示」改成「整周课表」，这样不填 Parameter 就是整周。

Parameter 可选值：

- `week`：大号显示整周课表
- `today`：大号显示今日课程（导出时默认选了整周也能用它切回来）
- `tomorrow`：显示明天的课程

> **小组件里的课表是导出那一刻的副本。** 修改课表后，需要重新复制脚本，在 Scriptable 里覆盖原内容。桌面上已经添加的小组件不用删，会自动用上新脚本。

#### 点击小组件会打开 Safari

iOS 不允许通过链接直接唤起添加到主屏幕的 Web App，所以点击小组件会用 **Safari** 打开网页版。Safari 和主屏幕 App 的存储是分开的，所以小组件的链接里带了一份压缩后的课表数据，在 Safari 里打开也能看到完整课表：

- Safari 里没有课表，或者链接里是同一份课表的更新版本：自动采用
- 链接里是别人分享的另一份课表：先弹出确认，不会直接覆盖你的课表

### 4. 导出

「设置」里可以导出到系统日历、备份为 JSON、导出 CSV。iPhone 上会弹出系统分享面板（主屏幕 App 不支持直接下载文件）。

导出到系统日历时，在分享面板选「存储到文件」，再到「文件」App 里打开它，点「添加全部」。

## 常见问题

**快捷指令运行后没反应？**
- 确认快捷指令里的操作写的是「在**快捷指令输入**上运行 JavaScript」，而不是灰色的「网页」
- 要在 Safari 的分享菜单里运行，在快捷指令 App 里点 ▶ 是没有网页可以处理的
- 如果提示不允许运行脚本，打开系统「设置」→「快捷指令」→「高级」→「允许运行脚本」
- 自己建快捷指令时，可以在最后加一个「显示结果」操作，失败时会显示原因

**显示的周数不对？** 到「设置」→「当前周」选一下，会自动推算开学日期。

**作息时间和学校不一样？** 「设置」→「作息时间」可以逐节修改，也可以用「快速生成」。从教务系统导入时，如果课表里写了上课时间，也可以勾选自动更新。

## 隐私

- 所有课表数据只保存在你设备的浏览器里
- 导入脚本只在你主动运行时执行。它读取当前页面的内容，或者用你自己的登录状态请求教务系统的课表接口（正方），识别结果只会复制到剪贴板
- 分享链接 / 小组件链接把课表数据放在 URL 的 `#` 之后，**不会发送给服务器**；但请不要把链接分享给不信任的人

## 自己部署

1. Fork 本仓库
2. 仓库 **Settings → Pages → Build and deployment**，Source 选 **GitHub Actions**
3. 推送到 `main` 后，[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 会先跑全部测试，测试通过后自动部署到 `https://<用户名>.github.io/<仓库名>/`

本项目没有构建步骤，任何静态文件服务器都能部署（Vercel、Netlify、Cloudflare Pages、自己的服务器……）。注意以下几点：

- 必须是 **HTTPS**（PWA、剪贴板等功能都需要）
- `.js` 文件要以 UTF-8 编码返回，并允许跨域读取（GitHub Pages 默认如此）。导入脚本会被注入到 GBK 编码、可能带安全策略的教务页面里，编码不对会报错；跨域读不到则无法使用备用加载方式
- 上面分享的快捷指令加载的是 `qlsalj.github.io/course` 上的脚本。自己部署的站点里，App 只会显示「手动创建快捷指令」的步骤，按步骤用 App 里复制的代码自己建一个即可

## 开发

```bash
npm start          # 本地静态服务器（tools/serve.mjs，行为接近 GitHub Pages）：http://localhost:8080
npm test           # 单元测试（Node 18+，无依赖）
npm run e2e        # 端到端测试（需要先 npm start，并且能 require('playwright')）
npm run icons      # 由 icons/icon.svg 重新生成 PNG 图标（需要 playwright）
```

没有框架、没有打包，原生 ES Modules，改完刷新就能看到效果。

```
index.html               入口
css/app.css              样式与动画（自动深色模式）
js/
  app.js                 启动、路由、处理链接中的数据
  store.js               数据模型、本地存储、颜色分配、课程块布局
  time.js                日期 / 周次计算
  importers.js           导入格式识别（WakeUp / CSV / JSON / HTML / 链接）
  exporters.js           导出（ICS / CSV / JSON / 小组件脚本 / 分享链接）
  share.js               课表数据 <-> URL（deflate + base64url）
  widget-preview.js      Scriptable API 的迷你模拟实现：App 内预览 + 测试
  views/                 今天 / 课表 / 设置
  sheets/                课程编辑、导入、小组件导出弹层
jw/
  parsers.js             教务系统课表解析（普通脚本，PWA 和教务页面共用）
  importer.js            注入教务页面的「课表导入助手」界面
scriptable/widget.js     Scriptable 小组件模板（导出时填入数据）
sw.js                    Service Worker（线上缓存优先、整体更新；本地开发网络优先）
tools/serve.mjs          本地 / CI 用的静态服务器
tools/build-site.mjs     生成部署目录：写入版本号和文件清单到 sw.js，加 modulepreload
tests/                   单元测试、端到端测试、各教务系统的样例页面
```

### 适配新的教务系统

1. 把课表页面的 HTML 存到 `tests/fixtures/xxx.html`（删除个人信息）
2. 改进 `jw/parsers.js` 里的通用表格解析，或者新增专用解析函数（参考 `parseZhengfangJson`）
3. 在 `tests/e2e.mjs` 的「网页课表解析」里加上逐字段的断言，跑 `npm run e2e`；纯文本逻辑（周次、节次等）的测试放在 `tests/parsers.test.js`

### 修改小组件

`scriptable/widget.js` 是一个完整的 Scriptable 脚本，`/*@DATA*/null` 这样的标记会在导出时被替换成真实数据。改完后在 App 的「iOS 桌面小组件」里就能看到预览。预览基于 `js/widget-preview.js` 对 Scriptable 布局的近似模拟，最终效果以真机为准。

## License

[MIT](LICENSE)
