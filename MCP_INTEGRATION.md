# MCP_INTEGRATION.md — 麦当劳 MCP 集成说明

本项目**全链路真实调用麦当劳 MCP**（无任何硬编码菜单/价格/门店数据）。本文档说明集成方式、调用的工具、调用链路，以及开发过程中真实踩到的坑。

## 1. 接入方式

- **端点**：`https://mcp.mcd.cn`（Streamable HTTP，JSON-RPC 2.0）
- **认证**：`Authorization: Bearer <MCP_TOKEN>`，Token 在 [open.mcd.cn/mcp](https://open.mcd.cn/mcp) 用手机号登录申请
- **会话**：服务端无状态，无需维护 session（`initialize` 后即可直接调用工具）
- **客户端实现**：`skill/mcdaily-sign/scripts/mcd-core/mcd-client.js`（约 60 行，无第三方依赖，兼容任意 Node 18+ / 浏览器代理场景）

```js
// 请求示例
POST https://mcp.mcd.cn
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer $MCD_TOKEN

{ "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": { "name": "query-meals", "arguments": { "storeCode": "1410511", "orderType": 1, "beType": 1 } } }
```

## 2. 调用的 MCP 工具（真实使用清单）

| 工具 | 用途 | 在项目中的位置 |
|---|---|---|
| `now-time-info` | 服务器时间（北京时间），决定节气/节日/时段 | `engine.js` 求签前调用 |
| `campaign-calendar` | 麦麦日历，获取真实在进行的活动 | 签卡活动彩蛋 |
| `query-my-account` | 账户信息校验 Token/登录态 | 启动自检 |
| `auto-bind-coupons` | 一键领取账号可领的全部优惠券 | 求签时自动领券（可用 `--no-claim` 关闭） |
| `query-nearby-stores` | 按城市+关键词搜真实门店 | `engine.js` 门店定位 |
| `query-meals` | 门店实时菜单（含现价/原价/官方标签） | 打分池数据源 |
| `query-meal-detail` | 商品详情（1+1 随心配的蓝区/粉区子项） | 随心配组合 |
| `query-store-coupons` | 门店当前可用券（含适用商品 productCode） | 券后价匹配 |
| `calculate-price` | 实时计价（支持叠加券） | 签卡价格确认 |
| `create-order` | 创建真实待支付订单 | 用户二次确认后调用 |
| `query-order` | 订单状态/取餐码轮询 | 支付后状态流转 |
| `cancel-order` | 取消待支付订单 | Web 版"取消这单" |

## 3. 核心调用链（真实闭环）

```
now-time-info ──▶ 节气/节日判定 ──▶ Open-Meteo 天气 ──▶ 16型人格档案
                                                        │
query-nearby-stores ──▶ query-meals(实时菜单+官方tags) ──┤
                                                        ▼
auto-bind-coupons ──▶ query-store-coupons ──▶ 加权打分 ──▶ 「今日签」
                                                        │
                                        用户二次确认 ◀──┘
                                                        ▼
                              calculate-price(券后试算) ──▶ create-order
                                                        ▼
                              用户本人支付(微信/H5) ──▶ query-order 轮询
                                                        ▼
                                            状态流转 + 取餐码 pickupCode
```

**实测记录**（2026-10-23，真实账号真实订单）：

- 精选超值随心配 1+1：高达吉士双牛堡 + 无糖可口可乐中杯 = **¥13.9**
- 全链路：求签 → 计价 → 下单 → 微信支付 → 状态「待支付→餐厅配餐中→订单已完成」→ 取餐码

## 4. 1+1 随心配下单机制（重点）

1+1 在菜单里是两个"池子"商品（精选超值 ¥13.9 / 人气经典 ¥14.9），子项通过 `query-meal-detail` 的 `rounds` 拿到（蓝区=主食 / 粉区=饮料小食），下单时用 `roundList` 传入：

```js
{
  storeCode: "1410511", orderType: 1, beType: 1, takeWayCode: "eat-in",
  items: [{
    productCode: "9900015568",           // 精选超值随心配池
    quantity: 1,
    roundList: [
      { round: "1", comboItemList: [{ code: "521316", quantity: 1 }] },  // 蓝区：高达吉士双牛堡
      { round: "2", comboItemList: [{ code: "3071",  quantity: 1 }] },   // 粉区：无糖可口可乐中杯
    ],
  }],
}
```

## 5. 真实踩坑记录（对后来者最有价值的部分）

1. **返回文本里内嵌"示例假 JSON"**
   工具返回是 markdown：说明部分内嵌示例 JSON，真实 JSON 后面又跟 markdown 尾巴。简单正则会匹配到假数据或解析失败。
   ✅ 解法：匹配所有 `{"success"` 起始候选，用**括号配平**算法逐段提取，取**最后一个**可解析的响应体（`mcd-client.js` 的 `extractJsonObjects`）。

2. **`query-meal-detail` 的入参是 `code`，不是 `productCode`**——与 `query-meals` 返回的字段名不一致。

3. **门店搜索城市名**：用「厦门」而不是「厦门」，带"市"字返回为空；必须带 `keyword` 地标词。

4. **优惠券匹配不能靠名字猜**：某门店"麦辣鸡腿堡"单堡不单独售卖（只有四件套），券必须按 `query-store-coupons` 返回的**适用商品 productCode** 精确匹配。券过期时 `calculate-price` 会返回语义明确的报错（如"此卡券不在使用日期内"），可直接用于引导用户重新领券。

5. **下单必须防重**：`create-order` 没有幂等键，同一载荷重复调用会生成多个真实待支付订单（我们实际踩到，靠 `cancel-order` 补救）。
   ✅ 解法：Web/Skill 中"创建订单 + 解析结果"必须原子执行；UI 层下单按钮在请求期间禁用。

6. **支付边界**：`create-order` 返回 `payH5Url`（微信 JS-SDK H5 收银台），支付必须由用户本人完成——AI 只下单不碰钱。`query-order` 返回 `pickupCode`（取餐码），是闭环的终点信号。

7. **中文城市地理编码**：Open-Meteo 对中文城市名支持不稳定，内置 45+ 中国城市坐标表 + 拼音回退（`weather.js`）。

## 6. 完整工具面

麦当劳 MCP 共提供 **35 个工具**（含积分抽奖、积分商城、麦麦派对等），本项目 P0 使用其中 12 个，其余工具在 `SKILL.md` 的扩展路线中规划（如"抽签附带积分抽奖彩蛋"）。
