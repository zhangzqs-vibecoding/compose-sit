# 合成上应大

[打开游戏](https://zhangzqs-vibecoding.github.io/compose-sit/)

拖动学校徽章、选择落点，让相同徽章碰撞升级，最终合成上海应用技术大学校徽。11 级物理合成游戏，采用 **PixiJS 8 + Planck.js + TypeScript + pnpm + Vite 8**。设计与规则见 [issue #1](https://github.com/zhangzqs-vibecoding/compose-sit/issues/1)。

## 开发

需要 Node 24（精确版本见 `.node-version`）、pnpm 12.16.1。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

鼠标/单指拖动后释放投放；左右键调整位置、空格投放、P/Escape 暂停、M 静音。页面和游戏内都有暂停/声音/重开入口。后台恢复不会补算物理时间。

```sh
pnpm check
pnpm test
pnpm build:web
pnpm exec playwright install chromium webkit
pnpm test:e2e
pnpm bench
```

## 平台构建

- Web：`pnpm build:web`，产物 `apps/web/dist`。默认相对资源路径，支持 GitHub Pages 子目录；也可通过 `BASE_PATH=/compose-sit/ pnpm build:web` 指定。
- 微信小游戏：`pnpm build:wechat`，用微信开发者工具导入 `apps/wechat/dist`。`touristappid` 仅供访客调试；实际 AppID 在开发者工具中设置。单 IIFE `game.js`、本地资源及独立环境适配，无 HTML 入口。
- Android/iOS：`pnpm build:mobile` 后在 `apps/mobile` 执行 `pnpm exec cap add android` / `pnpm exec cap add ios`（平台目录若已存在则跳过），随后根目录执行 `pnpm mobile:sync`、`pnpm --dir apps/mobile exec cap open android`。需 Android SDK/JDK；iOS 需 macOS/Xcode。CI 的 `android` job 会编译 Debug APK，可从运行记录下载 `compose-sit-android-debug-apk` artifact；`Validate Android emulator` 会安装 APK 并检查实际加载和触摸投放，`Validate iOS simulator` 可按需编译模拟器应用。模拟器结果只供测试，真机运行仍需验收。

平台支持证据和未验证项目见 [docs/VALIDATION.md](docs/VALIDATION.md)。

## 结构

- `packages/game-core`：纯规则、随机序列、计分与数据校验。
- `packages/game-runtime`：真实 Planck 物理、会话、接触合成、快照、事件与按 tick 记录的投放；无需浏览器。
- `packages/game-client`：Pixi 画面、固定步长循环、统一交互与宿主契约。
- `packages/host-web`：Web 与 WebView 共用的输入、音频、存储、资源及生命周期。
- `apps/web`、`apps/wechat`、`apps/mobile`：薄入口与对应构建配置。

[架构与规则](docs/ARCHITECTURE.md) · [旧版手感参数对照](docs/HANDFEEL.md) · [资源来源与学校映射](docs/ASSETS.md)
