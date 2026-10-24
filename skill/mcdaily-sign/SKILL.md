---
name: mcdaily-sign
description: 麦门今日签 —— 根据 MBTI 人格 × 当天天气 × 节气/节日，结合麦当劳 MCP 的真实菜单、活动与优惠券，抽取一张"今日签"（主推套餐+人格化签文+券后价），并支持真实下单闭环（下单→用户支付→订单状态→取餐码）。当用户提到"今天吃什么/麦当劳吃什么/麦门/抽签/推荐套餐/1+1 随心配/帮我在麦当劳下单/我的订单状态"时使用本技能。
agent_created: true
---

# 麦门今日签（mcdaily-sign）

根据用户 MBTI 人格 + 当天天气 + 节气/节日，调用麦当劳 MCP 生成个性化"今日签"推荐，并可代用户完成下单闭环。核心理念：**同一份汉堡，16 型人格收到 16 种命**。

## 前置条件

- 麦当劳 MCP Token 已配置在 `~/.workbuddy/mcp.json`（`mcpServers["mcd-mcp"].headers.Authorization`），CLI 会自动读取；也可用环境变量 `MCD_TOKEN` 覆盖。
- Node ≥ 18。

## 命令速查（脚本位于 `scripts/cli.js`）

```bash
# 1. 抽签推荐（默认自动领券；--budget 限制预算；--json 输出结构化结果）
node scripts/cli.js recommend --mbti INTJ --city 厦门 [--keyword 观音山] [--budget 20] [--no-claim] [--json]

# 2. 领取全部可用优惠券
node scripts/cli.js coupons

# 3. 真实下单（⚠️ 必须先向用户展示订单预览并获得明确确认后才能执行）
node scripts/cli.js order --payload <order-payload.json>

# 4. 查询订单状态 / 取餐码
node scripts/cli.js poll [--order <orderId>]

# 5. 取消订单
node scripts/cli.js cancel --order <orderId>
```

## 标准工作流

1. **确认 MBTI**：用户已知 MBTI 则直接用；不知道则用 6 题快测（见 `scripts/mcd-core/profiles.js` 的 QUIZ/scoreQuiz，可口头逐题问用户，每题二选一）。
2. **确认城市**：问用户所在城市（必须）；可选给地标关键词（如"观音山""软件园"）帮助选门店。**不要猜城市**——门店搜索依赖 city+keyword。
3. **抽签**：运行 `recommend`，向用户展示主推签（签位/商品/价格/签文）与备选，附上下单编码。
4. **下单前预览（必须）**：用户说要下单后，先构造 payload 并向用户展示订单预览（门店/商品/金额/用餐方式），**获得明确同意后**才运行 `order`。
5. **交付支付链接**：下单成功后把 `payH5Url` 发给用户，提示"发到微信文件传输助手打开即可微信支付"。**AI 不得代付**。
6. **闭环确认**：用户说"付完了"，运行 `poll`，报告状态与取餐码。

## payload 构造规则（order 命令）

```json
{
  "storeCode": "1410511",
  "orderType": 1,
  "beType": 1,
  "takeWayCode": "eat-in",
  "items": [
    {
      "productCode": "9900015568",
      "quantity": 1,
      "roundList": [
        { "round": "1", "comboItemList": [{ "code": "521316", "quantity": 1 }] },
        { "round": "2", "comboItemList": [{ "code": "3071", "quantity": 1 }] }
      ],
      "couponId": "...", "couponCode": "..."
    }
  ]
}
```

- `roundList` 仅套餐/随心配需要，子项来自 `query-meal-detail` 的 rounds（蓝区=主食，粉区=饮料甜品）。
- 下单前先用 `calculate-price` 验证价格（入参与 payload 的 storeCode/items 一致）。

## 1+1 随心配玩法（省钱首选）

- 门店菜单里搜"随心配"（如 精选超值随心配 ¥13.9 / 人气经典随心配 ¥14.9）。
- 用 `query-meal-detail`（入参 `code`，**不是** productCode）查看两个 round。
- 用户任选 1 主 + 1 副 → 填入 roundList 下单。组合按 MBTI 人格口味匹配（T 型选性价比、F 型选甜品）。

## 重要边界与坑（必读，详见 references/mcp-notes.md）

- **下单是真实交易**：同一 payload 重复执行会重复下单。禁止重试 `order`；失败先 `poll` 检查是否已建单，多余待支付订单用 `cancel` 清理。
- **券匹配**：按 `query-store-coupons` 返回的 `products[].productCode` 匹配，不要按券名猜商品。
- 推荐结果里没有 1+1 池商品时，主动向省钱用户提示随心配玩法。
- 签文已在推荐结果中生成，转述时保留人格腔调，不要改写成通用文案。

## 文件结构

```
scripts/cli.js            # CLI 入口（recommend/coupons/order/poll/cancel）
scripts/mcd-core/         # 共享内核（Skill 与 Web 页面共用）
  ├── engine.js           # 推荐引擎：人格(0.5)+天气(0.2)+优惠(0.15)+节气(0.15)
  ├── profiles.js         # 16 型麦门人格档案 + 签文腔调 + 6 题快测
  ├── mcd-client.js       # 麦当劳 MCP 客户端与响应解析
  ├── solarterms.js       # 24 节气 + 节日表
  └── weather.js          # Open-Meteo 天气 + 中国城市坐标表
references/mcp-notes.md   # MCP 实战笔记（响应解析、参数细节、踩坑记录）
```
