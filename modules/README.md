# Surge 模块

## 常用 App 去开屏（保守版）

安装地址：`https://raw.githubusercontent.com/yesanshao007/surge-ios-config/main/modules/startup-ads-lite.sgmodule`

当前覆盖 AcFun、AppSo、贝壳找房、菜鸟、豆瓣、拼多多、淘宝、途家、闲鱼、Jump 游戏玩家社区的 10 类启动阶段广告候选接口。7 款 App 使用 URL Rewrite `reject`。闲鱼与 Jump 使用 Surge `[Map Local]` 返回 HTTP 200 和单个空格，恢复旧墨鱼规则经 Script Hub 转换的响应语义：闲鱼保留历史 `mtop.*splash.ads` 匹配范围，并扩展到 `g-acs` 网关与 `splash.async.ads`；Jump 同时匹配 `getlaunchad` 与 `recommend/ad_conf`。后者是推荐广告配置接口，会影响应用内推荐广告。菜鸟仅通过仓库内响应脚本移除 `ads.show.cn` 中带 `splashAdCategory` 标记的条目。模块不处理菜鸟首页、支付宝小程序或跨 App 的共享广告主机，不含得物相关主机。模块只适用于 iOS。

历史闲鱼与 Jump 正则可见于 [StartUpAds 转换快照](https://github.com/Walvez/surge-startup-ads/blob/main/dist/StartUpAds_Selected.sgmodule)；[Script Hub 的 Surge 转换器](https://github.com/Script-Hub-Org/Script-Hub/blob/main/Rewrite-Parser.js)将 QX `reject-200` 转成 `[Map Local] data-type=text data=" " status-code=200`。原先本模块误改为直接 `reject`，且删去了 Jump 的推荐配置分支，现已恢复。闲鱼 `g-acs` 与异步接口的扩展参考[近期公开抓包模块](https://github.com/atopsecret/SurgeScripts/blob/main/xianyu/xianyu-ad-block.sgmodule)。2026-11-08 用户 HAR 中，Jump 的 `getlaunchad/v2` 和 `recommend/ad_conf` 均出现；前者响应本身没有开屏广告，后者返回广告配置。闲鱼在该 HAR 有启动流量，但没有任何匹配本模块闲鱼开屏正则的请求。菜鸟脚本有 2 次调用，但返回中没有带开屏标记的条目。因此本次迁移仍需在设备上验证，不承诺三款 App 的广告已消失；若仍出现，需结合同时刻截图与流量确定来源。

启用前先停用原墨鱼/Script Hub 去开屏模块。旧模块若继续启用，其得物重写与 `app.dewu.com` MITM 仍然存在。随后在 Surge iOS 从 URL 安装本模块，确认 MITM 已开启、证书已信任，彻底退出目标 App 后重新打开。先核对得物可正常使用，再逐个检查需要去开屏的 App；若有异常，先关闭本模块并重试。详情见本地 `docs/IOS_SETUP.md`。
