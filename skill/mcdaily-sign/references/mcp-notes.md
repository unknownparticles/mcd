# 麦当劳 MCP 实战笔记（2026-10-24 实测）

Server: `https://mcp.mcd.cn`（streamablehttp，Bearer Token，**无状态**——无需 session id，每次 tools/call 独立请求）。共 35 个工具。

## 响应解析（最大的坑）

工具返回的是 markdown 文本：先一大段字段说明，再内嵌 JSON，JSON 后面可能还有 markdown 尾巴；说明部分还可能内嵌**示例假 JSON**。

解析规则：用括号配平提取所有完整 JSON 对象（处理字符串转义），取**最后一个** `success` 为 boolean 的对象。已实现在 `scripts/mcd-core/mcd-client.js` 的 `extractJsonObjects()`。

## 已验证的关键入参

| 工具 | 关键点 |
|---|---|
| `query-nearby-stores` | `city` 用"深圳/厦门"，**不要带"市"字**；`searchType=2` 按城市搜，需 `keyword`；返回含 storeCode/beCode/distance/businessStatus |
| `query-meals` | 入参 `storeCode, orderType=1, beType=1`；返回 categories[].meals[].code + meals map（name/currentPrice/originalPrice/tags/image） |
| `query-meal-detail` | 入参是 **`code`**（不是 productCode），传 productCode 会报 "codemust not be blank"；返回 `rounds[]`（随心配的蓝区/粉区，choices 含 isDefault） |
| `calculate-price` | 入参同 create-order 的 storeCode/items；返回 price（单位分）/discount/`takeWayList[]`（eat-in/locker-in，create-order 必需） |
| `create-order` | items 支持 `roundList:[{round:"1", comboItemList:[{code,quantity}]}]` 传套餐/随心配子项；返回 orderId/payId/payH5Url/orderDetail |
| `auto-bind-coupons` | 一键领取全部可领券；返回 markdown 列表（couponId/couponCode/title）；重复调用幂等（已领过则返回无新券） |
| `query-store-coupons` | 返回指定门店+订单类型下**当前可用**的券（含有效期 tradeDateTime、适用商品 products[].productCode）——券与商品必须按 productCode 匹配，不能按名字猜 |
| `cancel-order` | 入参 orderId + cancelReasonCode（"1"） |
| `query-order` | 返回 orderDetail（orderStatus 文本、pickupCode 取餐码、realTotalAmount） |
| `now-time-info` | 服务器北京时间，节气/日期判断以此为准 |
| `campaign-calendar` | 当月营销活动日历（含往期/未来） |
| `list-nutrition-foods` | 餐品营养数据（热量/蛋白质/脂肪等）——T 型人格"热量最优解"推荐用 |

## 订单状态机

1待支付 → 2配餐中-已支付 / 10配餐中-餐厅确认配餐中 → 6已完成（另有 4配送中 / 7已取消 / 8已评价）

## 支付

- `payH5Url`（`https://m.mcd.cn/mcp/scanToPay?orderId=...`）是微信 H5 支付页（加载 jweixin）。
- 最佳路径：把链接发到微信「文件传输助手」→ 点开 → 拉起微信支付。
- 普通浏览器打开会要求登录（与下单账号同手机号），或引导去 App——**这是设计而非故障**：AI 只下单，支付必须由用户本人完成。

## 优惠券语义（实测）

- 券有有效期窗口（如"麦麦省周周领"），不在有效期时 calculate-price 报 600012"此卡券不在使用日期内"。
- 单堡可能不单独售卖（如麦辣鸡腿堡只有四件套）——券的适用商品必须用 query-store-coupons 的 products[] 校验。

## 其他可玩能力（P2 候选）

积分抽奖 `draw-lottery`、积分商城 `mall-points-products`/`mall-create-order`、麦麦派对预订 `party-order-create`、营养查询 `list-nutrition-foods`、外送 `delivery-*` 系列。

## 环境注意

- 沙箱内 Node fetch 偶发瞬时失败（"fetch failed"），重试一次即可；open-meteo 对中文城市名支持不稳定，内置坐标表（weather.js CITY_COORDS）为主，英文 geocoding 兜底。
