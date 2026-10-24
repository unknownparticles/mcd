# 🍟 麦门今日签 · McDaily Sign

> **"今天吃什么"不该是选择题，是一次抽签。**
> 你的 MBTI，决定你在麦门的命。

「麦门今日签」是一个基于 **麦当劳 MCP** 的 AI 求签点餐应用：用户抽出自己的 MBTI 人格，系统结合**当天天气、节气节日、附近真实门店、实时菜单与真实优惠券**，抽出一张「今日签」——

- 🎋 **一个签位**（如「上上签 · 麦辣鸡腿堡四件套」）
- 💬 **一段人格化签文**（INTJ 收到的是精算军师体，INFP 收到的是诗化emo体，同一份套餐，两种命运）
- 💰 **一个真实券后价**（领券、计价全部走麦当劳 MCP 真实接口）
- 🍔 **一键真实下单**（下单 → 用户本人扫码支付 → 状态轮询 → 取餐码，闭环）

## ✨ 为什么好玩 / 实用

| 痛点 | 麦门今日签的解法 |
|---|---|
| 每天中午"吃什么"决策疲劳 | 求一签，3 秒出答案，还带仪式感 |
| 推荐结果千篇一律 | 16 型 MBTI 人格档案 × 4 种签文腔调，推荐+文案因人而异 |
| 优惠券一大堆不知道用哪张 | 引擎自动领券、按门店匹配券后最优价 |
| 省钱想吃好 | 内置 1+1 随心配玩法：¥13.9 按人格配出堡+饮料 |

## 🧬 16 型麦门人格档案（节选）

| MBTI | 人格 | 推荐口味倾向 | 签文腔调 |
|---|---|---|---|
| INTJ | 效率军师 | 高蛋白/热量最优解/性价比极值 | 冷静精算体："此签为最优解，勿念" |
| INFP | 氛围诗人 | 甜品/饮品/治愈系 | 诗化emo体："薯条会凉，但快乐不会" |
| ENFP | 快乐小狗 | 新品/冰淇淋/分享装 | 发疯快乐体 |
| ESTJ | 执行官 | 正餐全家桶/效率套餐 | 布置任务体 |
| … | 16 型全部实现 | 见 `skill/mcdaily-sign/scripts/mcd-core/profiles.js` | |

## 🏗️ 架构

```
                    ┌──────────────────────────────┐
  天气 Open-Meteo ─▶ │                              │
  节气节日表 ───────▶ │   mcd-core 推荐引擎（共享内核） │
  麦当劳 MCP ───────▶ │  人格档案 × 打分模型 × 签文生成  │
                    └──────────┬───────────────────┘
                       ┌───────┴────────┐
                       ▼                ▼
              WorkBuddy Skill      Web 应用（Node 薄服务端 + 单页前端）
              （对话里直接求签）      （可视化求签 + 下单闭环演示）
```

- **`skill/mcdaily-sign/`** — WorkBuddy Skill（参赛主形态，含完整 mcd-core 内核）
- **`web/`** — Web 版（Node 原生 http 服务端代理 MCP，Token 不出服务端）
- **`skill/mcdaily-sign/scripts/mcd-core/`** — 共享引擎：`profiles.js`（16 型人格档案）、`engine.js`（推荐打分）、`mcd-client.js`（MCP 客户端）、`solarterms.js`（节气）、`weather.js`（天气）

## 🚀 快速开始

### Web 版

```bash
# 1. 配置麦当劳 MCP Token（https://open.mcd.cn/mcp 申请）
export MCD_TOKEN="你的token"
# 或写入 ~/.workbuddy/mcp.json 的 mcd-mcp 配置（服务端会自动读取）

# 2. 启动（零第三方依赖，Node 18+）
node web/server.js
# 打开 http://localhost:8787
```

### WorkBuddy Skill 版

把 `skill/mcdaily-sign/` 安装到 WorkBuddy 技能目录（`~/.workbuddy/skills/`），在对话里直接说：

> "我是 INTJ，今天中午在厦门观音山，帮我抽个麦当劳签"

Skill 会输出：签位 + 签文 + 真实券后价 + 是否下单（下单前强制二次确认）。

## 🔒 安全设计

- **AI 不碰钱**：AI 只生成待支付订单，支付永远由用户本人在微信/官方渠道完成
- **下单二次确认**：页面上必须确认后才会调 `create-order`
- **Token 隔离**：Web 版 Token 仅存服务端（环境变量或 WorkBuddy 配置），不进前端

## 📄 文档

- [MCP_INTEGRATION.md](./MCP_INTEGRATION.md) — 麦当劳 MCP 集成详解（真实踩坑记录）
- [CONTEST_DECLARATION.md](./CONTEST_DECLARATION.md) — 参赛声明
- [workbuddy.md](./workbuddy.md) — WorkBuddy 开发对话记录

---

麦门！🍅
