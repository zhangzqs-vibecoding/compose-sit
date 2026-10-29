# 旧版手感参数对照

以下数据来自旧版提交 [`6eea41d`](https://github.com/zhangzqs/Zhangzqs.github.io/tree/6eea41d163b7bef7c34067adbb0ede0a2497e581/tools/composeSit) 的导出脚本和资源。数值对齐是自动检查的基线；实际手感仍需玩家在设备上比较。

| 项目         | 旧版                                                                | 当前规则                              |
| ------------ | ------------------------------------------------------------------- | ------------------------------------- |
| 重力         | 全局 `-300 px/s²`，物体预制体 `_gravityScale: 3`，实际 `-900 px/s²` | `-9 m/s²` × `100 px/m` = `-900 px/s²` |
| 投放初速度   | `-800 px/s`                                                         | `-8 m/s` = `-800 px/s`                |
| 合成后初速度 | `-100 px/s`                                                         | `-1 m/s` = `-100 px/s`                |
| 摩擦、弹性   | 物体预制体 `_friction: 1`、`_restitution: 0.1`                      | `1`、`0.1`                            |
| 下一颗       | 投放后 `0.5s` 创建，再用 `0.5s` 缩放动画                            | 30 tick 后显示预览，60 tick 后可投放  |

旧版重力的两处配置分别见 [全局物理初始化](https://github.com/zhangzqs/Zhangzqs.github.io/blob/6eea41d163b7bef7c34067adbb0ede0a2497e581/tools/composeSit/src/project.js#L1398) 和 [物体预制体](https://github.com/zhangzqs/Zhangzqs.github.io/blob/6eea41d163b7bef7c34067adbb0ede0a2497e581/tools/composeSit/res/import/0a/0ab855d50.json)。预制体 UUID `e3bjxRnSFHlIo730zmJ05G` 位于该资源包的第 74 项（从 0 计），其刚体 `_gravityScale` 为 3。旧版的 [投放/下一颗](https://github.com/zhangzqs/Zhangzqs.github.io/blob/6eea41d163b7bef7c34067adbb0ede0a2497e581/tools/composeSit/src/project.js#L1609) 与 [合成速度](https://github.com/zhangzqs/Zhangzqs.github.io/blob/6eea41d163b7bef7c34067adbb0ede0a2497e581/tools/composeSit/src/project.js#L1225) 可直接核对。

此前仅按全局重力设置 `-3 m/s²`，忽略了预制体的倍率；现修正为 `-9 m/s²` 并将规则版本升到 2。真实 Planck 测试验证一秒自由落体位置，回放记录包含完整物理参数。不同物理引擎的接触求解仍可能产生手感差异，因此没有宣称逐帧还原。

合成视觉效果有明确变化：旧版有短暂汇聚、缩放及碎片粒子；新版在接触后的同一物理 tick 完成合成，显示约 0.6 秒的光圈和加分提示。失败判定也从旧版的入堆计时改为连续越线 3 秒。两项变化留待实玩时核对节奏，不用动画回调控制规则结果。
