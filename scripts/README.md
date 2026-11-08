# 构建与隔离验收脚本

## v1.10.0 AI 助手与会员二维码

`node scripts/test-ai-assistant.cjs` 检查15项对话、同意、重复提交、失败重试和身份隔离场景；`node scripts/test-member-card.cjs` 检查13项二维码生成、过期、权限、迟到响应和绘制边界，均已纳入 `npm --prefix frontend run test:regression`。`node scripts/test-demo-runtime.mjs` 检查浏览器样例数据及新增 AI／会员码分支。后端 `mvnw.cmd test` 包括本机 HTTP 模型协议测试 AiAssistantTests 和内存数据库核验测试 MemberCardTests，不需要真实模型密钥。

先构建 `npm --prefix frontend run build:demo`，再执行 `node scripts/test-demo-browser.cjs` 验收 Pages 子路径、AI 示例、会员二维码、拍照与身份切换。浏览器驱动可用 `SHUYANG_PLAYWRIGHT_MODULE` 指向已安装的 Playwright。部署与边界见[功能文档](../docs/AI助手与会员二维码-v1.10.0.md)。

## v1.7.0 置顶、热帖与广播回归

从根目录运行 `node scripts/test-broadcast-forum.cjs`，共 21 项，已纳入 Web 的 `npm run test:regression`。在 backend 目录运行 `mvnw.cmd -Dtest=BroadcastForumTests test`，共 14 项；发布前运行完整 `mvnw.cmd package`。覆盖权限、板块边界、隐藏清理、时间边界、音频归属与访问、并发版本冲突、重复提交及 H5／小程序音频生命周期。

两端类型检查、Web／H5／小程序生产构建后，在隔离内存预览验证：管理员置顶与设为热帖 → 会员筛选 → 创建文字加语音 → 保存草稿／预约／发布 → 访客收听 → 关闭后编辑版本重新出现 → 手机撤下 → 公开音频不可访问。检查 1440、390、320px，使用 Chromium 和 WebKit；微信文件选择、音频及后台切换仍需真机验收。使用方法、规则和结果见[功能交付记录](../docs/置顶热帖与文字语音广播-v1.7.0.md)。

## 通用构建与隔离预览

在根目录运行 `node scripts/measure-web-bundle.cjs <新标签>`，用原 Web 生产构建测量首屏／全部 JS、CSS 与完整 dist 的原始字节及 gzip 估算。每次输出到全新的 `output/bundle-size/<标签>/`，已有标签不会覆盖。逐项基线与测量口径见[包体积优化报告](../docs/前端包体积优化-v1.6.1.md)。

`start-preview.ps1` / `stop-preview.ps1` 启停仅绑定本机的隔离内存预览，默认端口19999（后端）、18888（Web）、18890（H5）。先完成后端打包并安装两套前端依赖。重启清空测试数据，不影响正式文件数据库。

`prepare-community-fixture.py` 读取本地 `.cache/membership-preview/runtime.json`，在新预览中初始化两名测试会员；`prepare-phase2-fixture.py` 追加明确标注的相册、商品、活动、论坛、聊天数据。仅在隔离预览使用。固定密码为合成验收凭据，正式启动采用用户自设密码。

`node scripts/test-request-scopes.cjs` 使用已有前端依赖运行5个异步响应场景。

在 `frontend` 运行 `npm run test:regression` 统一执行160个逻辑场景：5个原有业务、12个天气、15个审查回归、31个移动环境、5个照片队列、78个模块／功能设计回归以及14个表情包场景。`npm run test:mobile`、`npm run test:modules` 和 `npm run test:stickers` 可分别运行对应测试，无需启动服务。

## v1.4.0 聊天表情包回归

`browser-chat-stickers.js` 在 Web18888 进入，使用 community/phase2 合成账号与会话，覆盖两端互发、附文字、撤回、失败重试和七种尺寸，共76项／内核。请使用专用 CLI 会话；脚本会关闭该会话其他页签，并清空两端登录存储。截图输出 `output/playwright/chat-stickers-*`。完整功能及限制见[表情包说明](../docs/聊天表情包.md)。

在 Chromium 和 WebKit 分别执行该脚本，重定向到 `output/sticker-browser.log`、`output/sticker-webkit-browser.log`；再打开 H518890，分别执行下文的 `browser-mobile-environments.js`，日志保存为 `output/sticker-mobile-matrix.log`、`output/sticker-webkit-matrix.log`。在根目录运行 `python scripts/summarize-chat-stickers.py` 检查四份日志，必须全部通过。测试不连接正式环境，原始日志和缓存不提交。

新增浏览器回归：`browser-audit-shop.js`（Web订单、异常恢复、键盘弹窗）、`browser-audit-mobile.js`（H5慢网络、订单校验与布局）、`browser-audit-navigation.js`（17个会员导航页面与聊天发送／撤回）。先按本文件步骤启动隔离预览并执行两份 community/phase2 数据准备脚本，分别打开 Web 或 H5 预览，再从前端目录使用 `playwright-cli run-code --filename=../scripts/文件名` 运行。新脚本沿用浏览器当前的本机来源，支持独立预览端口；仅对隔离测试数据运行。截图输出到 `output/playwright/audit-*`。

## v1.3.0 全模块与功能设计回归

`test-module-regressions.cjs` 通过Vue编译器加载真实组件和共享逻辑，覆盖六个业务组件及Web/H5顶层的身份隔离、卸载、重复提交、重试、详情竞争、确认框、表单保护、过期令牌公开浏览和活动筛选／报名时间边界，共78项。

`browser-module-flows.js` 只能在标准隔离端口18888／18890／19999执行，需先运行community、phase2，以及 `browser-engagement.js`、`browser-support-mobile.js`、`browser-support-complete.js`。执行入口为Web18888，覆盖资源双方确认、互助审核与隐私、管理检索和日志、铁路发布撤下、双端活动筛选及六类模块重试，共21项。账号每15分钟限制10次登录，避免同时反复运行带登录的流程。

`browser-photo-web.js` 默认使用 `prepare-photo-fixture.py` 的专用账号；要复用community验收环境，先在浏览器打开 `http://127.0.0.1:18888/?fixture=community`，并提供 `output/photo-fixtures` 的合成图片。不要在community环境再次运行会修改管理员密码的照片账号准备脚本。

`browser-session-recovery.js` 要求同一浏览器的Web和H5均已登录，执行真实注销并复用已失效令牌，验证两端仍能公开浏览。应在其他依赖登录的用例之后运行。二维码验收 `browser-phase2-checkin.js` 则要求Web管理员、H5会员已报名且尚未签到，活动仍在签到时间窗口内。

本轮日志统一重定向到 `output/module-audit/<名称>.log`，名称见 `summarize-module-audit.py` 的13项清单。在根目录运行 `python scripts/summarize-module-audit.py`，只在所有日志含成功JSON结果、无脚本错误或页面异常时通过。完整模块覆盖与真机限制见[全模块报告](../docs/全模块测试与优化-2026-10-31.md)。

`browser-*.js` 是 Playwright CLI 的 `run-code --filename` 输入，不是直接由node执行的文件。从 `frontend` 目录运行，截图写入根目录 `output/playwright`。脚本按阶段顺序操作同一预览，部分依赖前面流程的会员、会话和楼层状态；重复执行前检查前置状态。早期脚本保留作验收记录，二期主要使用 `browser-phase2-*`、`browser-final-management.js`、`browser-final-matrix.js`。

```powershell
npx --yes --package @playwright/cli playwright-cli -s=shuyang open http://127.0.0.1:18888 --browser=msedge
npx --yes --package @playwright/cli playwright-cli -s=shuyang run-code --filename=../scripts/browser-phase2-smoke.js
```

`package-release.ps1` 按根目录VERSION打包已构建产物，默认包名 `shuyang-home-v<版本号>`；`verify-release.py` 校验版本、文件集、哈希、ZIP一致性、关键后端类及测试凭据隔离。已有交付包不会覆盖。版本递增使用 `python scripts/version.py bump patch|minor|major`，填写CHANGELOG后运行 `python scripts/version.py check`。详见[版本发布规范](../docs/版本发布规范.md)。一次性源码改造脚本移入本地archives，不参与发布。

语音验收：新预览先执行prepare-community-fixture.py和prepare-forum-audio-fixture.py，再执行browser-forum-audio-web.js、browser-forum-audio-mobile.js。后者打开文件选择器，用CLI upload选择output/forum-audio/tone.wav，再执行browser-forum-audio-reply.js。音频为合成提示音。

## 移动端环境回归

`browser-mobile-environments.js` 在 Chromium / WebKit 中分别运行7种环境：320px小屏、360px安卓尺寸、390px深色与减少动画偏好、412px微信UA、844px横屏、768px英文与纽约时区平板、390×420键盘高度模拟。每种环境检查 Web 和 H5 的首页、商品、订单、会员中心、聊天，并检测订单提交及聊天输入／发送按钮的可达性，共112项检查／内核。聊天检查只滚动用户可滚动的区域，检测控件是否被父容器或导航遮挡。

`browser-mobile-resilience.js` 检查空响应、HTML网关错误、断网导航、订单重试幂等、摄像头降级和登录过期。脚本会在隔离数据库创建一笔测试订单；再次运行前保证测试商品有库存，可在测试账号中取消此前的验收订单，或重新初始化隔离预览。不会发生支付。WebKit运行时缺少摄像头API时，会明确记录权限拒绝用例跳过，继续检查图片扫码降级。

先启动本文件开头的隔离内存预览，在**新预览**执行 `prepare-community-fixture.py` 和 `prepare-phase2-fixture.py`，准备测试会员、唯一的“验收特产 · 不销售”和已接受的聊天会话。不要对同一数据库重复造同名数据。两个浏览器脚本只接受本机H5的18890或28890端口；配对Web端口为H5端口减2。本次实测使用独立的28888／28890／29999预览。

从 `frontend` 运行（标准隔离预览使用18890；本轮独立预览替换为28890）：

```powershell
New-Item -ItemType Directory -Force ../output/playwright, ../output/mobile-environments | Out-Null
npx.cmd --yes --package @playwright/cli playwright-cli install-browser webkit
npx.cmd --yes --package @playwright/cli playwright-cli -s=mobile-env open http://127.0.0.1:18890 --browser=msedge --mobile
npx.cmd --yes --package @playwright/cli playwright-cli -s=mobile-env run-code --filename=../scripts/browser-mobile-environments.js > ../output/mobile-environments/chromium-matrix.log
npx.cmd --yes --package @playwright/cli playwright-cli -s=mobile-env run-code --filename=../scripts/browser-mobile-resilience.js > ../output/mobile-environments/chromium-resilience.log
npx.cmd --yes --package @playwright/cli playwright-cli -s=mobile-webkit open http://127.0.0.1:18890 --browser=webkit --mobile
npx.cmd --yes --package @playwright/cli playwright-cli -s=mobile-webkit run-code --filename=../scripts/browser-mobile-environments.js > ../output/mobile-environments/webkit-matrix.log
npx.cmd --yes --package @playwright/cli playwright-cli -s=mobile-webkit run-code --filename=../scripts/browser-mobile-resilience.js > ../output/mobile-environments/webkit-resilience.log
python ../scripts/summarize-mobile-environments.py
```

CLI即使脚本失败也可能返回退出码0，需以汇总脚本为结果门禁：缺失日志、脚本未完成、断言失败或页面异常均返回非零退出码。汇总兼容PowerShell的UTF-16日志，输出 `output/mobile-environments/*.json`；截图在 `output/playwright/mobile-env-*`。这些原始文件由Git忽略，验收结论和关键截图保存在 `docs/移动端多环境测试-2026-10-30.md` 及 `docs/screenshots/`。

实际微信容器、iOS Safari、系统软键盘、刘海安全区、相机和GPS需要真机验证。微信UA、短视口和Windows WebKit仅用于模拟对应条件；微信小程序目前覆盖uni接口契约和构建，不代表已完成真机验收。


## v1.5.0 文件与 Element 界面验收

先完成三端依赖安装和当前版本后端打包，再启动独立内存预览。依次执行社区、第二阶段和业务文件数据准备脚本；同一预览实例只准备一次，重启实例后再重新准备。禁止对生产数据库执行。

```powershell
python scripts/prepare-community-fixture.py
python scripts/prepare-phase2-fixture.py
python scripts/prepare-business-files-fixture.py
node scripts/test-business-files.cjs
cd frontend
npx.cmd --yes --package @playwright/cli playwright-cli -s=files-chromium open http://127.0.0.1:18888 --browser chrome
npx.cmd --yes --package @playwright/cli playwright-cli -s=files-chromium run-code --filename=../scripts/browser-business-files.js > ../output/files-browser-chromium.log
npx.cmd --yes --package @playwright/cli playwright-cli -s=files-chromium run-code --filename=../scripts/browser-element-ui.js > ../output/element-browser-chromium.log
npx.cmd --yes --package @playwright/cli playwright-cli -s=files-webkit open http://127.0.0.1:18888 --browser webkit
npx.cmd --yes --package @playwright/cli playwright-cli -s=files-webkit run-code --filename=../scripts/browser-business-files.js > ../output/files-browser-webkit.log
npx.cmd --yes --package @playwright/cli playwright-cli -s=files-webkit run-code --filename=../scripts/browser-element-ui.js > ../output/element-browser-webkit.log
cd ..
python scripts/summarize-business-files.py
```

顺序运行浏览器脚本，避免同时修改同一合成会员。需安装对应 Playwright 浏览器；Chrome 可使用本机安装。从 frontend 目录创建专用浏览器会话并运行，截图及下载文件保存在工作区 output。汇总要求完整的 CLI Result、零失败和实际 Excel 行数；安装 pypdf 后另外验证 PDF 内包含全部 25 个订单号。未安装 pypdf 时明确报告 PDF 内容检查未执行。

Element 界面每个内核 58 项，文件流程每个内核至少 48 项（首次导入与重复导入的检查数略有差异）；实际通过数从日志读取，不预填成功。浏览器模拟不能替代手机软键盘、微信容器和物理打印机真机验收。

### v1.5.1 回归补充

本轮新增取消／读取失败后保留导入预览、会员搜索忽略首尾空格与编号大小写的检查。当前界面脚本每内核60项，文件脚本至少50项；支持Web18888或28888，配对H5端口加2。文件数据准备脚本会生成用于验证错误格式的 `unsupported.csv`。

为避免混用历史日志，将六份结果保存为 `output/<本轮前缀>-<element|files|mobile>-<chromium|webkit>.log`，其中mobile来自 `browser-mobile-environments.js`。从根目录执行：

```powershell
python scripts/summarize-business-files.py --run-prefix retest-20261102
```

汇总检查本轮界面、文件及7环境移动矩阵的完整结果、失败项、页面异常，并核对下载的Excel和打印PDF；详情见[问题与修复记录](../docs/回归测试与问题修复-20261102.md)。

## v1.8.0 换肤、拍照与在线体验

`node scripts/test-appearance-camera.cjs`验证12项主题偏好和相机生命周期场景，已加入前端`test:regression`。`node scripts/test-demo-runtime.mjs`验证独立演示数据层11项场景。

执行`npm --prefix frontend run build:demo`后运行`node scripts/test-demo-browser.cjs`，脚本启动本机静态服务器，按GitHub Pages仓库子路径验收实际演示包，不需要业务后端。它使用合成摄像头和新的浏览器上下文，检查界面操作、刷新、隔离、重置、320／390px布局以及业务请求不外发。默认使用前端Playwright；`SHUYANG_PLAYWRIGHT_MODULE`可指定已有Playwright模块路径。结果和截图保存在被Git忽略的`output/demo-browser`。

手机／微信真实摄像头仍需设备验收，详情见[本轮功能与验证记录](../docs/换肤拍照与在线演示-v1.8.0.md)。

## v1.10.2 首页素材与布局

先构建Web演示和H5，再运行 `node scripts/test-home-materials.cjs`。脚本使用隔离静态服务器与演示数据，检查三套主题、1440／390／320px、素材载入与署名、公告过滤、轮播控制条和移动swiper高度，不需要业务后端。结果与截图保存在Git忽略的 `output/home-materials`。

默认使用前端安装的Playwright及其Chromium。`SHUYANG_PLAYWRIGHT_MODULE`可指定模块路径；`SHUYANG_CHROMIUM_PATH`可指定本机Chromium可执行文件。`SHUYANG_BROWSER=webkit`改用WebKit，`SHUYANG_WEBKIT_PATH`可指定已安装内核，输出写入独立的 `output/home-materials-webkit`。`test-demo-browser.cjs`也支持 `SHUYANG_CHROMIUM_PATH`。
