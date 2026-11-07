# Surge 策略组图标

当前索引为 39 个图标，分别对应 39 个现用策略组；`policy/` 共 53 个 PNG，其中 14 个是历史兼容资源。`Meta.png` 对应整合后的 Meta 服务组；旧 `Facebook.png` 已删除。配置通过各组的 `icon-url` 引用 `policy/` 下的路径；`surge-icon.json` 可作为 Surge 图标订阅索引。新增或替换图标按 [图标规范](STANDARD.md) 执行，逐项结果见 [审计记录](AUDIT-2026-11-01.md)。维护 GitHub 图标前，先核对并更新仓库内全部 README。

## 来源与许可

- [Oasisic-Icons](https://github.com/Hawaiine/Oasisic-Icons/tree/f0f3bc2a44616885682ee5f0e5921540b964e2d8)：MIT；收录品牌及系统图标。`Meta.png` 从原图制作透明圆角底板。保留 [许可证](licenses/Oasisic-Icons-MIT.txt)。
- [Tabler Icons](https://github.com/tabler/tabler-icons/tree/ed177a085b652fe04ec4f37ced867c94621e7840)：MIT；从 SVG 调整描边颜色和粗细，渲染为 256×256 PNG，用于通用组。保留 [许可证](licenses/Tabler-Icons-MIT.txt)。
- [Simple Icons](https://github.com/simple-icons/simple-icons/tree/90646e4bf7f3b89df6c37e65baf3e7bc759a517c)：CC0；使用 Netflix 的矢量图形。保留 [许可证](licenses/Simple-Icons-CC0.md)。
- [flag-icons](https://github.com/lipis/flag-icons/tree/ac7e0eb3259eb62aa6100c435607e2fe03896a97)：MIT；区域组选用同系列 4:3 旗帜，并加细边框使白底旗帜在浅色外观中可见。保留 [许可证](licenses/Flag-Icons-MIT.txt)。
- [Jump Desktop](https://apps.apple.com/us/app/jump-desktop-rdp-vnc-fluid/id364876095)：以 App Store 的 512×512 产品图标为原图，按规范裁出透明圆角。图像权利归 Phase Five Systems 所有，不受上述开源图标许可覆盖；仅用于识别 Jump Desktop 策略组。原始图像地址与成品校验值见 [清单](manifest.json)。
- `AdBlock-clear.svg` 是本仓库用基本几何图形和文字制作的禁用广告图案；`Microsoft-rounded.svg` 依据已收录的四色标志重绘圆角底板。`Apple-centered.png` 从仓库保留的原图提取黑色标志并向右平移 6 px。处理方式与校验值见 [清单](manifest.json)。

逐个文件的上游路径、固定提交与 SHA-256 见 [manifest.json](manifest.json)。部分图标同时提供 [SVG 源文件](vector/)；一个 PNG 适配深色与浅色外观，无需主题切换参数。品牌图标的商标权仍归各品牌所有；本仓库只将它们用于识别对应服务，不表示关联或背书。

## 区域图标规则

国家或地区策略组优先使用准确旗帜；没有合适旗帜时，再使用具有地域代表性的图案。`HK`、`SG`、`JP`、`US`、`TW`、`KR` 使用同系列旗帜；`TW` 按用户指定使用中国国旗（上游 `cn.svg`）。`OverseasOnly` 和 `Rest` 没有单一对应旗帜，继续使用通用图标。图标只用于显示，组名、节点筛选和分流语义由配置另行定义。

## 近似对应

- `Gemini` 使用 Oasisic 的 GoogleAI；`Claude` 使用 Anthropic。
- `IPQualityTest` 使用通用心跳图标。

这些近似项在显示验收后可替换为许可明确、对应更精确的素材。

## 深浅外观修正

`AdBlock`、`Netflix`、`Amazon` 原图在深色卡片上过暗，现改为有固定底色的图标。新图使用 `*-dual.png` 路径，让客户端绕过旧 URL 的图标缓存；旧 PNG 路径暂留作尚未加载新配置的设备兼容资源，不再出现在图标索引中。

六个旗帜图标使用新的 `*-flag.png` 路径；旧区域 PNG 暂留给仍在使用旧配置的设备，不再出现在图标索引中。

`JumpDesktop` 已从通用显示器图案改为产品图标，并修正官方图原有的方形直角。现用 `JumpDesktop-rounded.png`；`JumpDesktop-official.png` 和更早的 `JumpDesktop.png` 暂留给仍在使用旧配置的设备，不再出现在图标索引中。

`Microsoft` 改用白色透明圆角底板，保留四色标志；`Apple` 在原白色圆角底板内微调黑色标志的视觉位置；`AdBlock` 改用更清楚的禁用广告图案。三者采用新文件名绕开旧图标缓存，原路径暂留供旧配置使用，不再进入现用索引。图标修改只影响策略组显示，不改变分流。
