# Surge 策略组图标

为当前 40 个策略组精选的 PNG 图标。配置通过各组的 `icon-url` 引用 `policy/` 下的稳定路径；`surge-icon.json` 可作为 Surge 图标订阅索引。改动图标时需同步检查配置引用和清单。所有当前图标均已在浅色卡片和深色卡片上逐项检查。

## 来源与许可

- [Oasisic-Icons](https://github.com/Hawaiine/Oasisic-Icons/tree/f0f3bc2a44616885682ee5f0e5921540b964e2d8)：MIT；原样收录品牌、地区及系统图标。保留 [许可证](licenses/Oasisic-Icons-MIT.txt)。
- [Tabler Icons](https://github.com/tabler/tabler-icons/tree/ed177a085b652fe04ec4f37ced867c94621e7840)：MIT；从 SVG 调整描边颜色和粗细，渲染为 256×256 PNG，用于通用组。保留 [许可证](licenses/Tabler-Icons-MIT.txt)。
- [Simple Icons](https://github.com/simple-icons/simple-icons/tree/90646e4bf7f3b89df6c37e65baf3e7bc759a517c)：CC0；使用 DMM 与 Netflix 的矢量图形。保留 [许可证](licenses/Simple-Icons-CC0.md)。

逐个文件的上游路径、固定提交与 SHA-256 见 [manifest.json](manifest.json)。四个有自带底色的新图标同时提供 [SVG 源文件](vector/)；一个 PNG 适配深色与浅色外观，无需主题切换参数。品牌图标的商标权仍归各品牌所有；本仓库只将它们用于识别对应服务，不表示关联或背书。

## 近似对应

- `Gemini` 使用 Oasisic 的 GoogleAI；`Claude` 使用 Anthropic。
- `JumpDesktop` 使用通用桌面图标；`IPQualityTest` 使用通用心跳图标。

这些近似项在显示验收后可替换为许可明确、对应更精确的素材。

## 深浅外观修正

`DMM` 已从错误的 DMM TV 图案换成通用 DMM 标志。`AdBlock`、`Netflix`、`Amazon` 原图在深色卡片上过暗，现改为有固定底色的图标。新图使用 `*-dual.png` 路径，让客户端绕过旧 URL 的图标缓存；旧 PNG 路径暂留作尚未加载新配置的设备兼容资源，不再出现在图标索引中。
