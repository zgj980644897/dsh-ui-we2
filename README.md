# dsh-ui-we2 · WE2 CONSOLE

中文 | [English](README.en.md)

**米白 / 墨黑 · 硬核科幻控制台皮肤** — DeepSeek Harness Web 客户端插件。
以《流浪地球 2》里那套「纸白面板 + 墨黑机箱 + 信号红 + 细发丝线 + 等宽读数」的计算机界面语言重绘对话页：
纸色正文区、墨黑侧栏（悬停反相为纸白）、墨黑色代码舱与操作员消息块、发丝级硬边框、零圆角、屏幕边框与刻度尺 HUD。

> An off-white and ink console skin for the DeepSeek Harness web UI: paper canvas, ink rail with
> inverted hover, ink code decks, hairline rules, zero radii, a scrolling status reel, a centred
> approval dialog, and a bezel HUD. Pure client plugin — no runtime dependencies, no network access,
> no build toolchain beyond Node.

![preview](preview/shot.png)

![approval dialog](preview/approval.png)

---

## 它改了什么

| 层 | 效果 |
|---|---|
| **色板** | 把 `--dsw-*` 语义 token 整体换成「纸 / 墨」两色系：纸白 `#fdfcf8`、画布 `#f8f5ed`、墨黑 `#111110`、信号红 `#b2352a`、数据青 `#2b6771`。浅色、深色两种系统主题下都锁成同一套纸色，切主题不会花掉。 |
| **几何** | 全部圆角归零（`--dsw-radius-*: 0`），浮层阴影改成 1px 墨线 + 1px 硬偏移，菜单改为不透明纸面、去毛玻璃。 |
| **字体** | 正文走 Bahnschrift（Windows 自带的 DIN 风技术字）+ 微软雅黑；代码、时间戳、计数走 Cascadia Mono / JetBrains Mono。 |
| **侧栏** | 墨黑机箱；鼠标悬停（以及当前选中的会话 / 面板）整行反相为**纸白底 + 墨黑字**；行内操作按钮在纸白行上再反相成墨黑底 + 纸白图标。 |
| **侧栏状态字幕** | 会话列表下方的空白处是一条**实时日志流**：每行以 `HH:MM:SS` 时间戳开头，接着是行首状态灯、`SYS.xx` 计数器与正文。正文**逐字敲出**，写完后句尾省略号**闪烁一段随机时长**模拟指令执行耗时，闪烁结束状态灯才从**红色**转**绿色**，停一拍再**向上滚一行**写下一条；字速、执行时长、间隔每行都不同。**背景完全透明、`pointer-events: none`**，不遮挡也不拦截任何操作；列表占满或侧栏收成图标栏时自动隐藏。 |
| **对话** | 操作员消息 = 墨黑面板 + 信号红左边条；代码块 = 墨黑舱体 + 红点标题栏 + 专属低饱和语法色；行内代码 = 墨黑小章；标题带红色索引竖条；引用、表格、分隔线全部硬边化。 |
| **授权弹窗** | 从输入区接管条改成**屏幕居中的墨黑对话框**：顶部**居中的「请求授权」**标题条（16px、字距加宽、红色刃口），中部是可滚动的请求内容，选项在最下方**竖直排列**（拒绝为描边、允许一次为纸白实心）。 |
| **代码背景** | 新会话页的滚动代码墙（`dsh-hero-code-backdrop`）由 96s / 138s 加速到 **42s / 60s**，读起来像实时控制台而不是静止画面。 |
| **HUD** | 固定屏幕边框、四角括号、左右刻度尺、顶部铭牌（`WE2 // OPS CONSOLE · 550W · 实时时钟`）、极低强度的扫描线与纸张颗粒。全部 `pointer-events: none`，不挡点击。 |

插件是**纯覆盖层**：只写 `--dsw-*` token 与 CSS，不改 React 组件、不发请求、不写会话。

## 稳定性与版本兼容

设计、构建与验收都对着 **DeepSeek Harness 0.2.1-rc.3（Electron 44.7.0 / Node 24）** 完成，实测结论：

| 检查项 | 结果 |
|---|---|
| 运行时依赖 / peer 依赖 | **零**（`dependencies` 与 `peerDependencies` 都不声明），不存在依赖版本冲突面 |
| 客户端契约 | `window.__ModuleLoader__.load({ id, factory })`；`id` 与包名一致；整个包只注册一次 |
| Host 半边 | 只导出 `name` + 空 `apply`，**没有任何 import**，不会因缺少服务而卡在 PENDING |
| 注入的服务 | 不注入任何 Cordis 服务（不写 `inject`），只在 `ctx.effect` 里挂 DOM |
| 设计 token | 运行时已核对：`--dsw-radius-panel`、`--dsw-menu-surface-fill`、`--dsw-elevation-soft`、`--dsw-specific-*`、`--dsw-alias-*`、`--shiki-*` 全部存在于本机 `ui-theme` / `ui-sidebar` 构建中 |
| 类名钩子 | `sidebarCol`、`userStack` / `userRow`、`md-code-block`、`[data-code-block-banner]`、`composerSeat` / `composerStack` 全部存在于本机 `ui-layout` / `ui-chat` / `ui-conversation` 构建中 |
| 失败姿态 | 每一层挂载都有 try/catch：DOM 异常只记一条 warn，返回空清理函数，**不会抛进 Cordis fiber** |
| 重复加载 | 挂载前清理同标识旧节点，HMR 重载不会叠层 |
| 条目失败 | 挂载行是可选条目（未标 `required`），导入失败只会在启动日志里留一条告警，不会阻止应用启动 |

已用无头 Chromium 对**构建产物本身**跑过验收：挂载（样式 19,739 字节 / 46 条规则 / HUD / 时钟）→ 重复挂载（仍只有 1 份）→ 全部卸载（节点、属性、背景色归零）→ 合成 DOM 故障（不抛出，记 2 条告警）→ 重新挂载。

> **关于 2026-10-28 的三次启动崩溃**：原因是 profile 的 `package.json` 带 UTF-8 BOM（`Unexpected token '﻿'`），
> 不是皮肤代码。Windows PowerShell 5.1 的 `Set-Content -Encoding utf8` 会写 BOM，本仓库早期安装脚本正是这么写的。
> 现在的 `install.ps1` 用 `UTF8Encoding($false)` 写文件，写前备份、写后校验 JSON 并断言无 BOM；
> 当前 profile 的 `package.json` 与 `cordis.patch.yml` 均确认无 BOM。

## 安装

需要 DeepSeek Harness Desktop / Web（按 `0.2.1-rc.3` 的 UI 结构适配）。

### 方式一：脚本（推荐）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1        # desktop profile
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Profile web
```

脚本会：

1. 把包复制到 `<DSH_HOME>/profiles/<profile>/node_modules/dsh-ui-we2`；
2. 在该 profile 的 `package.json` 里声明 `dsh-ui-we2` 依赖（Loader 只解析 profile 已声明的包）；
3. 在该 profile 的 `cordis.patch.yml` 末尾追加带标记的挂载块；
4. 两个文件改动前各自备份 `.bak`，写入为**无 BOM UTF-8**，写后校验 JSON 并断言无 BOM。

**重启 DeepSeek Harness** 后生效（新增 Loader 条目在启动时读取）。

卸载：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall
```

### 分享给别人（GitHub）

本目录可以直接作为 GitHub 仓库的根目录推送：插件没有 npm 依赖、没有构建步骤，
`lib/client.js` 与预览图都已提交，克隆下来即可安装。

```powershell
git clone https://github.com/zgj980644897/dsh-ui-we2.git
cd dsh-ui-we2
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

也可以在 [github.com/zgj980644897/dsh-ui-we2](https://github.com/zgj980644897/dsh-ui-we2) 选 **Code → Download ZIP**，解压后运行 `install.ps1`。

- 安装脚本只适用于 Windows（PowerShell）。macOS / Linux 用户改用下面的「方式二：手动」，
  把 `link:` 换成本机上的绝对路径即可，效果完全一样。
- 插件没有发布到 npm，所以不能用 `dsh plugin add dsh-ui-we2` 按名字安装，只能按路径安装。
- `git pull` 拉到新版本后，重新运行一次 `install.ps1`（它会把 `lib/client.js` 重新复制进 profile），再重启应用。
- 兼容性：按 DeepSeek Harness `0.2.1-rc.3` 的 UI 结构适配。其他版本同样能装、能卸载，
  `--dsw-*` token 层会继续跟随；若某个类名钩子（`sidebarCol`、`sessionRow`、`md-code-block`、
  `[data-approval-key]` 等）在新版本里改了名，对应那一小块装饰会退回默认样式，
  但**不会影响应用启动或对话功能**。

### 方式二：手动

```json
// <DSH_HOME>/profiles/desktop/package.json
"dependencies": {
  "dsh-ui-we2": "link:<本目录的绝对路径>"
}
```

```yaml
# <DSH_HOME>/profiles/desktop/cordis.patch.yml 末尾
- insert:
    - id: ui-we2
      name: dsh-ui-we2
```

并把本目录复制到 `<DSH_HOME>/profiles/desktop/node_modules/dsh-ui-we2`，然后重启。

### 方式三：作为 bundle 安装

`package.json` 里已声明 `dsh.bundle.patch → ./cordis.patch.yml`。把包加进 profile 的
`dsh.profile.bundles` 即可由 bundle 机制自动挂载（不要再手写 `insert`，否则 id 重复）。

## 开发

```powershell
node scripts/build.mjs      # src/theme.css + src/client.js  →  lib/client.js
node scripts/check.mjs      # 校验清单、注册契约、Host 半边无 import
node scripts/restore-source.mjs  # 从已安装产物反推源码（灾难恢复用）
```

`preview/index.html` 与 `preview/approval.html` 是纯静态设计预览（引用同一份 `src/theme.css`），
用浏览器直接打开即可对照色彩、悬停填充与授权弹窗；`preview/shot.png`、`preview/approval.png` 是它们的截图。

- `src/theme.css` — 全部视觉规则，唯一需要改的地方。
- `src/client.js` — 浏览器半边：挂载样式表与 HUD、时钟、清理、异常兜底。
- `index.js` — Host 半边空插件（Loader 需要一个合法条目）。
- `lib/client.js` — 构建产物，**不要手改**。

改色板：`src/theme.css` 顶部 `--we2-paper-*` / `--we2-ink-*` / `--we2-signal` 一组变量，
改完全局一致；改完重新 `build.mjs` 并重启应用。

## 结构

```
dsh-ui-we2/
├─ package.json            清单：dsh.client、bundle patch、导出映射（零依赖）
├─ index.js                Host 空插件（无 import）
├─ cordis.patch.yml        bundle 挂载补丁
├─ install.ps1             安装 / 卸载（无 BOM 写入 + 校验）
├─ README.md               中文说明
├─ README.en.md            英文说明
├─ LICENSE                 MIT
├─ .gitignore
├─ src/
│  ├─ theme.css            视觉系统（token 覆盖 + 组件细化 + HUD）
│  └─ client.js            浏览器插件工厂体（带异常兜底）
├─ scripts/
│  ├─ build.mjs            零依赖打包（把 CSS 内联进 __ModuleLoader__ 工厂）
│  ├─ check.mjs            静态契约自检
│  └─ restore-source.mjs   从安装产物反推源码
├─ preview/
│  ├─ index.html           静态设计预览（对话页 + 悬停/选中态）
│  ├─ approval.html        授权弹窗预览
│  ├─ shot.png             对话页截图
│  └─ approval.png         授权弹窗截图
└─ lib/client.js           构建产物（安装的正是这一份）
```

## 兼容与代价

- **选择器基于 `--dsw-*` token**，绝大多数样式随产品更新自然跟随；少数针对语义类名片段的细化，
  在 UI 大改后需要重新核对：`userStack`、`bubble`、`markdown`、`md-code-block`、
  `[data-code-block-banner]`，侧栏悬停用的 `panelRow` / `sessionRow` / `projectRow` /
  `searchResultRow` / `newSession` / `iconButton`，以及授权弹窗的 `[data-approval-key]`。
- 侧栏描边与状态字幕依赖左栏容器的 `sidebarCol` 类名，以及 `footArea`（页脚高度）、
  `sessionRow` / `projectRow` / `panelRow`（已占用的最低点）。找不到这些钩子时字幕不显示，
  侧栏仍按 `--dsw-*` 正常上色。
- 字幕每次布局只做一次 `getBoundingClientRect` 测量（rAF 合帧 + `ResizeObserver` + 滚动捕获），
  空闲时不跑计时器；1.5 秒一次的廉价重挂载检查负责在侧栏被整体替换后接回去。
- 打字机的逐字、执行闪烁、换行计时器全部登记在同一个集合里，插件卸载时统一 `clearTimeout`；
  `prefers-reduced-motion: reduce` 下不启动逐字与闪烁动画，直接铺满静态行。
- 授权弹窗用 `[data-approval-key]` 做全屏定位（`position: fixed`）。若将来该面板被放进带
  `transform` / `backdrop-filter` 的容器，定位会改为相对那个容器。
- 代码墙加速规则（`.dsh-hcb-track`）在未安装 `dsh-hero-code-backdrop` 时是惰性的。
- profile 里的依赖写成 `link:<本目录>`；如果移动或删除本目录，重新跑一次 `install.ps1` 即可自愈。
- 只影响浏览器外观：会话日志、模型输入、工具行为全部不变。

## License

MIT
