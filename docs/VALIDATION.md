# 验证记录

日期：2026-10-29。方案实现依据 issue #1，平台未验证部分保留为待验收项目。

## 已验证

- Node 24.19.0、pnpm 12.16.1、Vite 8.3.5、PixiJS 8.22.0、Planck 1.5.1、Biome 2.6.4。
- TypeScript 固定为 **5.9.3**：候选 7.0.2 的编译器 API 与 dependency-cruiser 17.3.3 不兼容，M0 安装/检查发现后选择兼容版本。
- `pnpm check`：格式/lint、完整 TS、无 DOM/Node 类型的 core/runtime、独立微信类型检查、依赖方向和循环依赖。
- `pnpm test`：19 项测试，包括真实 Planck 掉落/合成/三体接触/封顶奖励/越线结算、暂停原因、同种子重放、200 个有效初始圆体、固定步长/DPR 和微信 Canvas 契约。
- Web 生产构建：桌面与手机视口中实际显示徽章、位图文字、分数和图鉴，确认真实物理合成、拖动、暂停与重开。
- Playwright 使用系统 Chrome 完成桌面/移动视口的投放合成、暂停、布局调整、重开、存储不可用测试（6 项，包括必要资源加载失败的重试入口）；测试按固定时钟推进，不依赖软件 GPU 达到 60 FPS。
- 微信 IIFE 在无 window/document/navigator 的 VM 宿主中执行，确认 bootstrap 到达预期的缺少 GPU 错误；这是导入顺序 smoke，不代表真实微信 GPU 验收。
- 微信产物为独立 IIFE game.js、game.json、开发者工具配置及包内资源。依赖扫描不包含 Planck testbed/stage-js。
- Capacitor Android 和 iOS 原生工程已生成并同步本地前端资源，包含 App/Preferences 插件，无远端 server.url。

## 当前环境未验证

- 微信开发者工具和微信 iOS/Android 真机运行：本环境无对应 AppID/工具/真机。Canvas 适配单测与 IIFE 构建不能替代实机验证。
- Android APK 编译/安装与真机：当前仅有 platform-tools，缺少完整 Android SDK/platforms/build-tools。
- iOS 编译/安装与真机：需要 macOS/Xcode。
- 中档 Android/iPhone 的帧率、GPU 内存、音频后台恢复及最低基础库验收；桌面软件 WebGL 的测试不能外推到真机性能。
- 桌面 Tauri 属于 issue 指定的后续按需目标，当前不提供第二套原生容器。

## 手工验收清单

1. `pnpm build:wechat` 后导入小游戏目录，设置真实 AppID；检查编号/校徽、有限字形、触摸、音频、存储、前后台及窗口变化；重开 20 次无重复监听/帧循环。
2. `pnpm build:mobile && pnpm mobile:sync`，用 Android Studio/Xcode 构建本地安装包；断网首次打开应能启动游戏。
3. 切后台 30 秒再恢复不补算；手动暂停后切后台再恢复仍暂停；音频恢复不抢占游戏控制。
4. 不同 DPR、安全区及横竖屏下，同一落点对应同一逻辑 X；画面缩放不改变堆叠位置。
5. 连续越线3秒判负、结算一次、最高分跨进程保留；关闭音频或禁用存储仍可完成游戏。
6. 图鉴名称与11枚原始徽章对应；确认素材使用范围后再正式分发。

## 性能样例（开发机 Node，非手机指标）

`pnpm bench` 的 3600 tick 合成压力场景：100 初始物体 p50约0.043ms/p95约0.37ms；200 初始物体 p50约13.38ms/p95约20.10ms。该脚本故意制造重叠密集物体，包含激烈接触求解；不作为常规局面60FPS已达成的证明。详细输出可重复运行取得，不能与真实 GPU/真机帧率混为一谈。
