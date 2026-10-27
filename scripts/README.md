# 构建与隔离验收脚本

`start-preview.ps1` / `stop-preview.ps1` 启停仅绑定本机的隔离内存预览，默认端口19999（后端）、18888（Web）、18890（H5）。先完成后端打包并安装两套前端依赖。重启清空测试数据，不影响正式文件数据库。

`prepare-community-fixture.py` 读取本地 `.cache/membership-preview/runtime.json`，在新预览中初始化两名测试会员；`prepare-phase2-fixture.py` 追加明确标注的相册、商品、活动、论坛、聊天数据。仅在隔离预览使用。固定密码为合成验收凭据，正式启动采用用户自设密码。

`node scripts/test-request-scopes.cjs` 使用已有前端依赖运行5个异步响应场景。

`browser-*.js` 是 Playwright CLI 的 `run-code --filename` 输入，不是直接由node执行的文件。从 `CropDiseasesDetection_vue` 目录运行，截图写入根目录 `output/playwright`。脚本按阶段顺序操作同一预览，部分依赖前面流程的会员、会话和楼层状态；重复执行前检查前置状态。早期脚本保留作验收记录，二期主要使用 `browser-phase2-*`、`browser-final-management.js`、`browser-final-matrix.js`。

```powershell
npx --yes --package @playwright/cli playwright-cli -s=shuyang open http://127.0.0.1:18888 --browser=msedge
npx --yes --package @playwright/cli playwright-cli -s=shuyang run-code --filename=../scripts/browser-phase2-smoke.js
```

`package-release.ps1` 打包已构建产物；`verify-release.py` 校验文件集、哈希、ZIP一致性、关键后端类及测试凭据隔离。每次使用新包名避免覆盖。一次性源码改造脚本移入本地archives，不参与发布。

语音验收：新预览先执行prepare-community-fixture.py和prepare-forum-audio-fixture.py，再执行browser-forum-audio-web.js、browser-forum-audio-mobile.js。后者打开文件选择器，用CLI upload选择output/forum-audio/tone.wav，再执行browser-forum-audio-reply.js。音频为合成提示音。
