#!/usr/bin/env node
// 麦门今日签 CLI —— 供 WorkBuddy Skill 调用
// Token 自动从 ~/.workbuddy/mcp.json 的 mcd-mcp 配置读取（也可用 MCD_TOKEN 环境变量覆盖）
// 命令：
//   recommend --mbti INTJ --city 厦门 [--keyword 观音山] [--budget 20] [--no-claim]
//   order     --payload order-payload.json   （真正创建订单，谨慎调用）
//   poll      [--order <orderId>]            （默认读 order-info.json）
//   cancel    --order <orderId>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recommend } from "./mcd-core/engine.js";
import { createMcdClient, parseCoupons } from "./mcd-core/mcd-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getToken() {
  if (process.env.MCD_TOKEN) return process.env.MCD_TOKEN;
  const cfgPath = join(homedir(), ".workbuddy", "mcp.json");
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
      const auth = cfg?.mcpServers?.["mcd-mcp"]?.headers?.Authorization ?? "";
      const m = auth.match(/Bearer\s+(\S+)/);
      if (m) return m[1];
    } catch { /* ignore */ }
  }
  throw new Error("未找到 MCP Token：请配置 ~/.workbuddy/mcp.json 或设置 MCD_TOKEN");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1] ?? true;
  }
  return args;
}

function printSign(r) {
  const line = "=".repeat(52);
  console.log(line);
  console.log(`【麦门今日签】${r.mbti} · ${r.persona}（${r.toneStyle}）`);
  console.log(`${r.date} ${r.term ?? ""} ${r.festival ?? ""} | ${r.weather.line}`);
  console.log(`门店：${r.store.storeName}`);
  console.log(`地址：${r.store.address}`);
  console.log("-".repeat(52));
  for (const s of [r.sign, ...r.alternatives]) {
    console.log(`[${s.grade}] ${s.product}`);
    console.log(`  ¥${s.price}（原价 ¥${s.origPrice}）${s.coupon ? ` | 可用券：${s.coupon.title}` : ""}`);
    console.log(`  签文：${s.fortune}`);
    if (s === r.sign) console.log(`  下单编码：${s.code}`);
  }
  console.log(line);
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
const token = getToken();

try {
  if (cmd === "recommend") {
    const r = await recommend({
      token,
      mbti: args.mbti,
      city: args.city,
      keyword: args.keyword,
      budget: args.budget ? Number(args.budget) : undefined,
      claimCoupons: args["no-claim"] ? false : true,
    });
    if (args.json) console.log(JSON.stringify(r, null, 2));
    else printSign(r);
  } else if (cmd === "coupons") {
    const mcd = createMcdClient(token);
    const claimed = parseCoupons(await mcd.claimCoupons());
    console.log(claimed.length ? claimed.map((c) => `${c.title} (${c.couponCode})`).join("\n") : "暂无可领新券");
  } else if (cmd === "order") {
    // 真实下单：必须显式提供 payload 文件；单次执行完成 create+extract，防重复下单
    if (!args.payload) throw new Error("用法：order --payload <order-payload.json>");
    const payload = JSON.parse(readFileSync(resolve(args.payload), "utf8"));
    const mcd = createMcdClient(token);
    const r = await mcd.createOrder(payload);
    const ok = (r.text.match(/\{"success"[\s\S]*/g) ?? [])
      .map((s) => { try { return JSON.parse(s); } catch { return null; } })
      .filter(Boolean).reverse().find((o) => o.data?.orderId);
    if (!ok) throw new Error("下单失败：" + r.text.slice(0, 300));
    const d = ok.data;
    const info = {
      orderId: d.orderId,
      payId: d.payId,
      payH5Url: d.payH5Url,
      product: (d.orderDetail?.orderProductList ?? []).map((p) => `${p.productName} x${p.quantity}`).join(", "),
      amount: d.orderDetail?.realTotalAmount,
      store: d.orderDetail?.storeName,
    };
    const infoPath = resolve(args.payload, "../order-info.json");
    writeFileSync(infoPath, JSON.stringify(info, null, 2));
    console.log(`✅ 订单已创建（待支付）`);
    console.log(`订单号：${info.orderId}`);
    console.log(`商品：${info.product} | 实付 ¥${info.amount} | ${info.store}`);
    console.log(`支付链接：${info.payH5Url}`);
    console.log(`⚠️ 请把支付链接发给用户，由用户本人完成支付（AI 不得代付）`);
  } else if (cmd === "poll") {
    const mcd = createMcdClient(token);
    const orderId = args.order ?? JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "order-info.json"), "utf8")).orderId;
    const r = await mcd.queryOrder(orderId);
    const d = r.data?.data?.orderDetail ?? r.data?.data;
    if (!d) throw new Error("查询失败：" + r.text.slice(0, 300));
    console.log(`订单 ${d.orderId ?? orderId}`);
    console.log(`状态：${d.orderStatus ?? d.status}`);
    console.log(`实付：¥${d.realTotalAmount ?? d.totalAmount ?? "?"}`);
    if (d.pickupCode ?? d.takeFoodCode) console.log(`取餐码：${d.pickupCode ?? d.takeFoodCode}`);
  } else if (cmd === "cancel") {
    if (!args.order) throw new Error("用法：cancel --order <orderId>");
    const mcd = createMcdClient(token);
    const r = await mcd.call("cancel-order", { orderId: args.order, cancelReasonCode: "1" });
    console.log(r.text.includes('"success":true') ? "✅ 已取消" : "取消失败：" + r.text.slice(0, 200));
  } else {
    console.log("麦门今日签 CLI\n命令：recommend | coupons | order --payload <file> | poll [--order <id>] | cancel --order <id>");
  }
} catch (e) {
  console.error("FAIL:", e.message);
  process.exit(1);
}
