# 架构与规则

实现依据：[设计 issue #1](https://github.com/zhangzqs-vibecoding/compose-sit/issues/1)。

`game-client → game-runtime → game-core` 为共享游戏的单向依赖。host-web 和微信宿主实现 client 的小契约，应用入口装配宿主与 client。core/runtime 的生产 TypeScript 配置没有 DOM/Node/微信全局类型；真实 Planck 模拟可直接在 Node 测试。

core 提供配置校验、固定等级数据、种子随机、生成序列、稳定配对、计分及偏好数据校验。runtime 独占 Planck World，step 后收集有效接触、稳定排序并消费配对，最后判越线。刚体位置只由物理拥有，画面使用只读快照。client 的单一固定步长循环驱动 World 和显式 Pixi 渲染，无自动 ticker。

每局可通过 `Game.exportReplay()` 导出可序列化的排查记录：规则版本、Planck 版本、种子、完整规则参数、初始实体、结束 tick，以及实际执行的投放逻辑坐标与 tick/顺序号。Web 页面在开发者控制台可运行 `JSON.stringify(window.__composeSitReplay())` 获取当前局记录。暂停前被取消的投放不会进入记录。使用相同版本和参数创建 `GameSession`，在对应 tick 的 `step()` 前提交投放，即可重现同版本物理结果；重开会开启新记录。修改玩法语义时递增 `RULES_VERSION`，Planck 版本常量由测试对照依赖声明。版本或 JS 引擎不同不保证逐位一致，记录不包含视觉特效与跨版本物理存档。

720×1280 逻辑空间，100 像素/米；物理坐标 Y 向上，显示坐标 Y 向下。底面 1130、预览 235、危险线 350。物理步长 1/60 秒，每帧最多补 5 步，超过积压丢弃完整 tick 并记录。后台/暂停重置时间累积。冷却 60 tick，30 tick 后显示下一颗；封顶庆祝锁输入 180 tick。

默认重力 `-9 m/s²` 对应旧版全局 `-300 px/s²` 与物体重力倍率 3 的有效值；旧版参数和行为变化详见 [手感对照](HANDFEEL.md)。

开局 `[0,0,0,1,2,2,3]`，之后种子随机取 `0..4`。目标是合成第 10 级的上应大校徽；同级合成加 `level+1`，9→10 额外加100并显示目标达成。达成后仍可继续本局。接触底面/其他物体后，上沿连续越线180 tick判负；离开重置，先合成后判断。结算按存活实体每颗 `level+1` 一次性加分。

物理模块不直接使用外部时钟或随机数。粒子不影响随机生成。输入取消不投放。手动/宿主暂停按原因独立记录；恢复宿主可见性不解除手动暂停。控制命令不被暂停的物理队列阻塞。

后续 Tauri/在线功能/Wasm 按需求单独接入，本次无第二渲染或物理后端。完整进度与外部条件见 `VALIDATION.md`。

微信入口的 environment.ts 必须在 Pixi 主入口求值之前设置 DOMAdapter：Pixi 8.22 的视频纹理模块在导入时会检测 Safari。为此 Vite 的单一 alias 仅指向锁定 Pixi 包内的 environment/adapter.mjs，TS 路径对应同一文件。该内部路径是明确的兼容维护点，升级 Pixi 必须运行 IIFE 无 DOM smoke 和真机验收。Canvas 只补 Pixi 所需的宽高/getContext/上下文事件接口，不伪造 window/document/navigator。共享 renderer 关闭自动环境扩展导入，微信图像直接通过宿主 ImageSource 加载，Web 的 Assets 加载仍使用浏览器机制。
