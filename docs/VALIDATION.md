# 验证记录

日期：2026-10-30。方案实现依据 issue #1，平台未验证部分保留为待验收项目。

## 已验证

- Node 24.19.0、pnpm 12.16.1、Vite 8.3.5、PixiJS 8.22.0、Planck 1.5.1、Biome 2.6.4。
- TypeScript 固定为 **5.9.3**：候选 7.0.2 的编译器 API 与 dependency-cruiser 17.3.3 不兼容，M0 安装/检查发现后选择兼容版本。
- `pnpm check`：格式/lint、完整 TS、无 DOM/Node 类型的 core/runtime、独立微信类型检查、依赖方向和循环依赖。
- `pnpm test`：21 项测试，包括真实 Planck 掉落/合成/三体接触/封顶奖励/越线结算、旧版有效重力、暂停原因、带版本与输入记录的同版本重放、200 个有效初始圆体、固定步长/DPR 和微信 Canvas 契约。
- Web 生产构建：桌面与手机视口中实际显示徽章、位图文字、分数和最终目标，确认真实物理合成、拖动、暂停与重开。
- Playwright 的桌面 Chrome、手机视口 Chrome、WebKit 共15项浏览器 E2E 覆盖投放合成、最终校徽达成提示、暂停、布局调整、重开、存储不可用、必要资源加载失败重试；另用独立构建的真实物理场景验证失败结算、最高分与画布重开。本地已验证 Chrome 的 10 项，完整 WebKit 验证以 CI 为准。测试按固定时钟推进，不依赖软件 GPU 达到60FPS；WebKit仍不等于iPhone实机。
- 微信 IIFE 在无 window/document/navigator 的 VM 宿主中执行，确认 bootstrap 到达预期的缺少 GPU 错误；这是导入顺序 smoke，不代表真实微信 GPU 验收。
- 微信产物为独立 IIFE game.js、game.json、开发者工具配置及包内资源。依赖扫描不包含 Planck testbed/stage-js。
- Capacitor Android 和 iOS 原生工程已生成并同步本地前端资源，包含 App/Preferences 插件，无远端 server.url。
- CI 使用 JDK 21 和 Android SDK 编译 Debug APK，并检查 APK 内含 `assets/public/index.html` 和游戏资源；产物作为 `compose-sit-android-debug-apk` artifact 上传，供后续真机验收。
- Android 15/API 35 x86_64 模拟器 CI 安装 Debug APK，关闭 Wi-Fi 与移动数据后启动本地游戏；WebView 调试接口确认加载状态消失、画布为 1、规则版本为 2，一次 `adb input tap` 使有效投放输入从 0 变为 1 且 tick 前进。随后退回桌面，检查页面隐藏且游戏 tick 停止；返回应用后检查页面可见、tick 继续且投放记录未丢失。截图核对了校徽、棋盘与最终目标；该工作流上传截图、结果 JSON 和 logcat。模拟器结果不能替代真机测试。
- macOS CI 使用 Xcode 26.6 编译无签名的 iOS 模拟器应用，并检查应用包内含游戏入口、校徽、字体与音效；产物作为 `compose-sit-ios-simulator` artifact 上传。这证明模拟器目标可编译，不代表 iPhone 真机运行。

## 当前环境未验证

- 微信开发者工具和微信 iOS/Android 真机运行：本环境无对应 AppID/工具/真机。Canvas 适配单测与 IIFE 构建不能替代实机验证。
- Android APK 的真机安装与运行：当前没有连接 Android 设备。本地仅有 platform-tools，APK 编译已在 CI 的完整 SDK 环境完成。CI Debug APK 用于测试，不是正式签名发布包。
- iOS 真机安装与运行：当前没有 iPhone、签名环境或现场测试。CI 的模拟器编译不等于可安装的 IPA，也未验证真机 WebGL 和生命周期。一次 macOS 26 CI 模拟器启动尝试中，系统首次启动迁移约耗时 6 分钟，安装/启动步骤在 8 分钟上限内未结束，未取得应用运行画面；常规 CI 保留可靠的编译和资源验证。
- 中档 Android/iPhone 的帧率、GPU 内存、音频后台恢复及最低基础库验收；桌面软件 WebGL 的测试不能外推到真机性能。
- 桌面 Tauri 属于 issue 指定的后续按需目标，当前不提供第二套原生容器。

## 手工验收清单

1. `pnpm build:wechat` 后导入小游戏目录，设置真实 AppID；检查编号/校徽、有限字形、触摸、音频、存储、前后台及窗口变化；重开 20 次无重复监听/帧循环。
2. `pnpm build:mobile && pnpm mobile:sync`，用 Android Studio/Xcode 构建本地安装包；断网首次打开应能启动游戏。
3. 切后台 30 秒再恢复不补算；手动暂停后切后台再恢复仍暂停；音频恢复不抢占游戏控制。
4. 不同 DPR、安全区及横竖屏下，同一落点对应同一逻辑 X；画面缩放不改变堆叠位置。
5. 连续越线3秒判负、结算一次、最高分跨进程保留；关闭音频或禁用存储仍可完成游戏。
6. 11 级名称与原始徽章对应；最终目标明确为合成上应大校徽。确认素材使用范围后再正式分发。

## 性能样例（开发机 Node，非手机指标）

`pnpm bench` 的 3600 tick 合成压力场景：100 初始物体 p50约1.35ms/p95约2.27ms；200 初始物体 p50约7.88ms/p95约9.86ms。该脚本故意制造重叠密集物体，包含激烈接触求解；不作为常规局面60FPS已达成的证明。当前 Web / 微信 / 移动前端产物目录分别约 1.72 / 1.66 / 1.72 MB（未压缩）。详细数据可重复运行取得，不能与真实 GPU/真机帧率混为一谈。

生产 Web 构建的 Chromium 资源压力测试先执行一次真实重开，再连续重开 40 次并在第 20/40 次后采样：本地 Chrome 样本中的 DOM 节点为 144→144、事件监听器为 57→57，随后仍可投放；每次采样前触发垃圾回收，JS 堆使用量约 6.59→7.01 MiB。该测试在 CI 中检查节点和监听器不持续增加，并输出三次采样；堆大小只记录观察值，不以单次浏览器样本推断 GPU 内存或真机泄漏。
