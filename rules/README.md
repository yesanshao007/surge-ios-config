# 规则集格式（ruleset-v1）

本目录的 `.list` 文件一文件一目的，不写策略名。主配置负责把文件绑定到策略组。2026-11-01 已统一全部 32 个文件的格式。

```text
# NAME: Service Name
# PURPOSE: service-specific routing
# FORMAT: ruleset-v1
# UPDATED: 2026-11-01
# SOURCE: https://service.example.com/network-requirements

DOMAIN,api.service.example
DOMAIN-SUFFIX,service.example
IP-CIDR,192.0.2.0/24,no-resolve
```

- 五个头字段必填，顺序如上；`UPDATED` 是文件修改日，不等于服务实际流量通过验收。`SOURCE` 标明官方要求或候选来源。聚合规则只能提供候选，不能单独证明域名归属。
- 每条规则先确认与本文件服务的关系。母公司、共用 CDN、云厂商、通用验证或统计服务不自动归属该服务。第三方依赖只收官方明确要求或真实请求证明的精确主机，不扩展为整个第三方域。
- 优先服务专属域名。`DOMAIN-SUFFIX` 已覆盖的精确项不重复写；不使用 `DOMAIN-KEYWORD`。IP/ASN 只在直接连接 IP 且有当前服务方清单时收录，使用 `no-resolve`，并在清单变更或异常时复查。
- 按 `PROCESS-NAME`、`DOMAIN`、`DOMAIN-SUFFIX`、`DOMAIN-WILDCARD`、`IP-ASN`、`IP-CIDR`、`IP-CIDR6` 排列，同类按值排序。域名小写、无末尾句点，不留重复项。
- 修改前检查主配置优先级；具体服务要先于通用服务，直连保护要先于广告拦截。平台独有的进程规则写明适用平台。
- 验证至少运行本地 `scripts/validate.py` 与 Surge 配置同步校验；推送后确认 GitHub Raw 与本地一致，再部署。静态验证不代表 iPhone 已重载或服务真实流量命中。

本轮的重要依据：[Apple](https://support.apple.com/101555)、[Google FCM](https://firebase.google.com/docs/cloud-messaging/network-configuration)、[Netflix](https://openconnect.netflix.com/mobiledeliverydomains.txt)、[Telegram](https://core.telegram.org/resources/cidr.txt)、[OpenAI](https://help.openai.com/en/articles/9247338-network-recommendations-for-chatgpt-errors-on-web-and-apps)、[GitHub](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference)、[Steam](https://help.steampowered.com/en/faqs/view/2EA8-4D75-DA21-31EB)、[OneDrive](https://learn.microsoft.com/en-us/sharepoint/required-urls-and-ports)。其余 `SOURCE` 若指向第三方规则仓库，代表待持续核对的候选，不是官方确认。
