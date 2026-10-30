# 构建与隔离验收脚本

`start-preview.ps1` / `stop-preview.ps1` 启停仅绑定本机的隔离内存预览，默认端口19999（后端）、18888（Web）、18890（H5）。先完成后端打包并安装两套前端依赖。重启清空测试数据，不影响正式文件数据库。

`prepare-community-fixture.py` 读取本地 `.cache/membership-preview/runtime.json`，在新预览中初始化两名测试会员；`prepare-phase2-fixture.py` 追加明确标注的相册、商品、活动、论坛、聊天数据。仅在隔离预览使用。固定密码为合成验收凭据，正式启动采用用户自设密码。

`node scripts/test-request-scopes.cjs` 使用已有前端依赖运行5个异步响应场景。

2026-10-30 三角色审查新增 `test-audit-regressions.cjs`，包含15个账号切换、旧响应、重复提交和订单校验场景。移动环境扩展新增 `test-mobile-environments.cjs` 的31个场景。在 `CropDiseasesDetection_vue` 运行 `npm run test:regression` 可统一执行63个逻辑场景（5个原有业务、12个天气、15个审查回归、31个移动环境）。`npm run test:mobile` 可单独运行移动环境逻辑测试，无需启动服务。

新增浏览器回归：`browser-audit-shop.js`（Web订单、异常恢复、键盘弹窗）、`browser-audit-mobile.js`（H5慢网络、订单校验与布局）、`browser-audit-navigation.js`（16个会员导航页面与聊天发送／撤回）。先按本文件步骤启动隔离预览并执行两份 community/phase2 数据准备脚本，分别打开 Web 或 H5 预览，再从前端目录使用 `playwright-cli run-code --filename=../scripts/文件名` 运行。新脚本沿用浏览器当前的本机来源，支持独立预览端口；仅对隔离测试数据运行。截图输出到 `output/playwright/audit-*`。

`browser-*.js` 是 Playwright CLI 的 `run-code --filename` 输入，不是直接由node执行的文件。从 `CropDiseasesDetection_vue` 目录运行，截图写入根目录 `output/playwright`。脚本按阶段顺序操作同一预览，部分依赖前面流程的会员、会话和楼层状态；重复执行前检查前置状态。早期脚本保留作验收记录，二期主要使用 `browser-phase2-*`、`browser-final-management.js`、`browser-final-matrix.js`。

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

从 `CropDiseasesDetection_vue` 运行（标准隔离预览使用18890；本轮独立预览替换为28890）：

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
