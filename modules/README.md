# Surge 模块

## 常用 App 去开屏（保守版）

安装地址：`https://raw.githubusercontent.com/yesanshao007/surge-ios-config/main/modules/startup-ads-lite.sgmodule`

当前覆盖 AcFun、AppSo、贝壳找房、菜鸟、豆瓣、拼多多、淘宝、途家、闲鱼的 9 类启动阶段广告候选接口。其余 8 款 App 使用精确 URL Rewrite `reject`；菜鸟根据 2026-11-07 的设备抓包，针对 `netflow-mtop.cainiao.com` 上的 `ads.show.cn` 响应运行仓库内的透明脚本，仅移除 `data.result` 中带 `materialContentMapper.adProperties.splashAdCategory` 标记的条目，保留同接口非开屏条目。模块不处理菜鸟首页、支付宝小程序或跨 App 的共享广告主机；没有通用广告域拦截、宽泛主机名或得物相关主机名。所需 MITM 主机名均为明确列出的请求主机。模块只适用于 iOS。

其余接口线索来自 [墨鱼 StartUpAds](https://github.com/ddgksf2013/ddgksf2013) 的历史公开规则，经 [Walvez 2026-08-29 转换快照](https://github.com/Walvez/surge-startup-ads) 交叉核对后逐条收窄改写。菜鸟旧版误写为 `cn-acs.m.cainiao.com` 且直接拒绝整条请求；两次设备抓包证实未命中，现改为实际请求主机并按响应字段过滤。[墨鱼菜鸟专项规则](https://github.com/ddgksf2013/Rewrite/blob/master/AdBlock/CainiaoAds.conf) 还覆盖首页和小程序，本模块未引入。它不是上游的完整转换版，也不承诺覆盖 400 款 App。接口可能随 App 更新而改变；菜鸟的新实现已通过离线响应回放，设备端去除效果仍需更新模块后验证，其余 App 也尚无设备端验收证据。

启用前先停用原墨鱼/Script Hub 去开屏模块。旧模块若继续启用，其得物重写与 `app.dewu.com` MITM 仍然存在。随后在 Surge iOS 从 URL 安装本模块，确认 MITM 已开启、证书已信任，彻底退出目标 App 后重新打开。先核对得物可正常使用，再逐个检查需要去开屏的 App；若有异常，先关闭本模块并重试。详情见本地 `docs/IOS_SETUP.md`。
