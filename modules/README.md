# Surge 模块

## 常用 App 去开屏（保守版）

安装地址：`https://raw.githubusercontent.com/yesanshao007/surge-ios-config/main/modules/startup-ads-lite.sgmodule`

当前覆盖 AcFun、AppSo、贝壳找房、菜鸟、豆瓣、飞猪、京东、拼多多、淘宝、途家、闲鱼、Jump 游戏玩家社区、铁路 12306 的 13 类启动阶段广告候选接口。7 款 App 使用 URL Rewrite `reject`。飞猪、闲鱼与 Jump 使用 Surge `[Map Local]` 返回 HTTP 200 和单个空格，恢复旧墨鱼规则经 Script Hub 转换的响应语义：飞猪仅匹配 `acs.m.taobao.com` 上 `mtop.fliggy.crm.screen.allresource` 与 `mtop.fliggy.crm.screen.availablesplashstrategies` 两个历史开屏接口；闲鱼保留历史 `mtop.*splash.ads` 匹配范围，并扩展到 `g-acs` 网关与 `splash.async.ads`；Jump 同时匹配 `getlaunchad` 与 `recommend/ad_conf`。后者是推荐广告配置接口，会影响应用内推荐广告。京东脚本仅修改 `functionId=start` 响应中带 `showTimes` 的开屏图片条目；菜鸟脚本仅移除 `ads.show.cn` 中带 `splashAdCategory` 标记的条目。爱奇艺已迁入独立模块，不含得物相关主机。模块只适用于 iOS。

历史飞猪、闲鱼与 Jump 正则可见于 [StartUpAds 转换快照](https://github.com/Walvez/surge-startup-ads/blob/main/dist/StartUpAds_Selected.sgmodule)；[Script Hub 的 Surge 转换器](https://github.com/Script-Hub-Org/Script-Hub/blob/main/Rewrite-Parser.js)将 QX `reject-200` 转成 `[Map Local] data-type=text data=" " status-code=200`。飞猪两条规则是历史候选，尚无本次冷启动 HAR，不能确认新版飞猪仍请求这些接口或已有开屏缓存。原先本模块误改闲鱼与 Jump 为直接 `reject`，且删去了 Jump 的推荐配置分支，现已恢复。闲鱼 `g-acs` 与异步接口的扩展参考[近期公开抓包模块](https://github.com/atopsecret/SurgeScripts/blob/main/xianyu/xianyu-ad-block.sgmodule)。2026-11-08 用户 HAR 中，Jump 的 `getlaunchad/v2` 和 `recommend/ad_conf` 均出现；前者响应本身没有开屏广告，后者返回广告配置。闲鱼在该 HAR 有启动流量，但没有任何匹配本模块闲鱼开屏正则的请求。菜鸟脚本有 2 次调用，但返回中没有带开屏标记的条目。因此本次迁移仍需在设备上验证，不承诺飞猪、菜鸟、闲鱼或 Jump 的广告已消失；若仍出现，需结合同时刻截图与流量确定来源。

铁路 12306 的历史规则仅针对 `ad.12306.cn/ad/ser/getAdList`，见 [StartUpAds 转换快照](https://github.com/Walvez/surge-startup-ads/blob/main/dist/StartUpAds_Selected.sgmodule)及[墨鱼原脚本](https://github.com/ddgksf2013/Scripts/blob/master/12306.js)。原脚本依据请求 JSON 的 `placementNo` 区分 `0007` 和 `G0054` 两个广告位；Surge 的[响应脚本输入](https://manual.nssurge.com/scripting/http-response.html)不提供请求体，因此本模块改用同一路径上的请求脚本，在这两个已知广告位返回原规则对应的 HTTP 200 JSON，其余广告位、非 POST 和无法解析的请求原样放行。现无 12306 冷启动 HAR，尚不能确认新版 App 的接口是否仍相同，也不能据此宣称设备已去广告。

京东主 App 的历史 `functionId=start` 与 `queryMaterialAdverts` 规则见 [StartUpAds 转换快照](https://github.com/Walvez/surge-startup-ads/blob/main/dist/StartUpAds_Selected.sgmodule)。[另一份公开规则](https://github.com/ihxperfect/loon-plugin/blob/main/startingad.plugin)明确警告整组拦截会使京东比价失效，因此本模块不移植该组直接拦截，也不处理京东健康、京喜、京东金融。京东脚本参考 [blackmatrix7 的开屏响应处理](https://github.com/blackmatrix7/ios_rule_script/blob/master/script/startup/startup.js)，只对 `api.m.jd.com/client.action?functionId=start` 响应中带 `showTimes` 的图片条目禁用展示，保留其余响应；未知结构原样放行。没有本次京东冷启动 HAR，不能确认新版京东仍使用该接口或该字段，设备效果待验证。

启用前先停用原墨鱼/Script Hub 去开屏模块。旧模块若继续启用，其得物重写与 `app.dewu.com` MITM 仍然存在。随后在 Surge iOS 从 URL 安装本模块，确认 MITM 已开启、证书已信任，彻底退出目标 App 后重新打开。先核对得物可正常使用，再逐个检查需要去开屏的 App；若有异常，先关闭本模块并重试。详情见本地 `docs/IOS_SETUP.md`。

## 爱奇艺去广告（独立版）

安装地址：`https://raw.githubusercontent.com/yesanshao007/surge-ios-config/main/modules/iqiyi-ads.sgmodule`

2026-11-08 用户 HAR 中，`t7z.cupid.iqiyi.com` 和 `kjp.cupid.iqiyi.com` 的 10 次 `/mixer` 响应全部命中旧保守版 `iqiyi-splash-clean`，Surge 记录脚本修改了响应；本次冷启动未见开屏广告。这只证明该捕获窗口的脚本执行，不能证明未来开屏广告均被去除。独立版保留相同的开屏处理。

同一 HAR 中，`cards.iqiyi.com/views_home/3.0/qy_home` 两次响应各有 6 张卡，其中一张顶部焦点卡的全部 3 个区块均有明确“广告”按钮和广告统计字段，另一张卡的类型与样式为原生视频广告；这两次响应当时未被脚本修改。`iqiyi-home-clean.js` 仅在这些标记同时满足时移除相应卡片，保留其他卡及响应字段；未知结构、非法 JSON 原样放行。首页实际画面与设备端效果仍需截图和更新模块后的复测核对。本模块不处理播放贴片或一般视频请求，且可独立停用。

请先更新保守版模块，让旧爱奇艺脚本从中移除，再安装并启用独立版；若还启用了其他爱奇艺去广告模块，请检查脚本冲突。Surge 对同一响应只执行首个匹配脚本。不要同时启用旧墨鱼广覆盖模块，以免得物问题再次出现。
