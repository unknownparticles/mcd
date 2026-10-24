# workbuddy.md — WorkBuddy 开发对话记录

本项目全程使用 **WorkBuddy** 开发，本文档为开发对话记录的说明与归档索引。

## 开发过程实录（按时间线）

### Phase 1 · 构思与 PRD（10/23 晚）
- 与 WorkBuddy 对话确定参赛构思：「麦门今日签」—— MBTI × 天气 × 节气 × 真实优惠券的麦当劳求签点餐应用
- 拉取麦当劳大赛仓库要求对齐评审标准，产出 PRD（含 16 型麦门人格档案、双形态架构、冲刺排期、砍单原则）

### Phase 2 · MCP Token 配置与实测（10/23 晚）
- 用户在 open.mcd.cn/mcp 申请 Token，WorkBuddy 写入 `~/.workbuddy/mcp.json` 连接器配置
- 直连实测 7 个只读工具：`now-time-info` / `campaign-calendar` / `query-my-account` / `query-nearby-stores` / `query-meals` / `calculate-price` / `auto-bind-coupons`，全部返回真实数据
- 实测领券：`auto-bind-coupons` 一次领取 3 张真实优惠券

### Phase 3 · mcd-core 推荐引擎（10/23 深夜）
- WorkBuddy 编写共享内核：16 型人格档案 + 加权打分引擎（人格 0.5 / 天气 0.2 / 优惠 0.15 / 节气 0.15）+ 节气表 + 天气接入
- 端到端实测：INTJ → 巨无霸三件套（军师体签文）、INFP → 甜品（诗人体签文），差异化生效
- 踩坑与修复：MCP 返回内嵌假 JSON → 括号配平解析法

### Phase 4 · 下单闭环真实联调（10/23 深夜）
- 门店定位纠偏（用户真实位置：厦门思明区观音山）
- **真实下单**：1+1 随心配（高达吉士双牛堡 + 无糖可乐中杯）¥13.9，`create-order` 成功
- **真实支付**：用户本人通过 H5 链接微信支付
- **状态流转**：`query-order` 轮询确认「待支付 → 餐厅配餐中 → 订单已完成」+ 取餐码
- 期间踩到并修复：重复下单问题（无幂等键，cancel-order 补救）→ 固化防重设计

### Phase 5 · Skill 壳 + Web 壳（10/23 深夜）
- 按 WorkBuddy 官方 skill-creator 规范构建 `mcdaily-sign` Skill，官方校验打包通过
- Web 版：Node 原生 http 薄服务端代理 MCP（Token 不出服务端）+ 单页求签前端
- UI 迭代：从表单风重做为「庙宇求签 × 麦当劳品牌」设计（签筒摇签动画、签纸卡、下单状态步进条、取餐码大字展示）

## 对话记录文件

完整对话记录（`workbuddy-conversation.md`）随本仓库一同提交；亦可参见 `skill/mcdaily-sign/references/mcp-notes.md`——它是从开发对话中沉淀出的 MCP 实战笔记，直接内置于 Skill 中供 Agent 运行时参考。
