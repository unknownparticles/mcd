// 麦门今日签 Web 服务端：静态页 + API（Token 只在服务端，前端不暴露）
// 启动：node web/server.js  [默认 http://localhost:8787]
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { recommend } from "../skill/mcdaily-sign/scripts/mcd-core/engine.js";
import { createMcdClient, extractJsonObjects } from "../skill/mcdaily-sign/scripts/mcd-core/mcd-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "public");
const PORT = process.env.PORT ?? 8787;

function getToken() {
  if (process.env.MCD_TOKEN) return process.env.MCD_TOKEN;
  const cfgPath = join(homedir(), ".workbuddy", "mcp.json");
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
      const m = cfg?.mcpServers?.["mcd-mcp"]?.headers?.Authorization?.match(/Bearer\s+(\S+)/);
      if (m) return m[1];
    } catch { /* ignore */ }
  }
  throw new Error("未找到 MCP Token");
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

function serveStatic(req, res) {
  let path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const file = join(PUBLIC, path);
  if (!file.startsWith(PUBLIC) || !existsSync(file)) {
    res.writeHead(404); res.end("Not Found"); return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

const server = createServer(async (req, res) => {
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === "GET") return serveStatic(req, res);

    if (req.url === "/api/recommend" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.mbti || !body.city) return json(400, { error: "缺少 mbti 或 city" });
      const r = await recommend({
        token: getToken(),
        mbti: body.mbti,
        city: body.city,
        keyword: body.keyword,
        budget: body.budget ? Number(body.budget) : undefined,
        claimCoupons: body.claimCoupons !== false,
      });
      return json(200, r);
    }

    if (req.url === "/api/order" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.payload) return json(400, { error: "缺少 payload（下单前必须在页面向用户二次确认）" });
      const mcd = createMcdClient(getToken());
      const r = await mcd.createOrder(body.payload);
      const d = extractJsonObjects(r.text).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean).reverse().find((o) => o.data?.orderId)?.data;
      if (!d) return json(502, { error: "下单失败：" + r.text.slice(0, 200) });
      writeFileSync(join(__dirname, "last-order.json"), JSON.stringify(d, null, 2));
      return json(200, { orderId: d.orderId, payH5Url: d.payH5Url, amount: d.orderDetail?.realTotalAmount, store: d.orderDetail?.storeName, status: d.orderDetail?.orderStatus });
    }

    if (req.url === "/api/poll" && req.method === "POST") {
      const body = await readBody(req);
      const orderId = body.orderId ?? (() => { try { return JSON.parse(readFileSync(join(__dirname, "last-order.json"))).orderId; } catch { return null; } })();
      if (!orderId) return json(400, { error: "缺少 orderId" });
      const mcd = createMcdClient(getToken());
      const r = await mcd.queryOrder(orderId);
      const d = r.data?.data?.orderDetail ?? r.data?.data;
      if (!d) return json(502, { error: r.text.slice(0, 200) });
      return json(200, { orderId: d.orderId ?? orderId, status: d.orderStatus ?? d.status, amount: d.realTotalAmount ?? d.totalAmount, pickupCode: d.pickupCode ?? d.takeFoodCode ?? null });
    }

    if (req.url === "/api/cancel" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.orderId) return json(400, { error: "缺少 orderId" });
      const mcd = createMcdClient(getToken());
      const r = await mcd.call("cancel-order", { orderId: body.orderId, cancelReasonCode: "1" });
      const ok = extractJsonObjects(r.text).map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean).reverse().some((o) => o.success);
      if (!ok) return json(502, { error: "取消失败：" + r.text.slice(0, 160) });
      return json(200, { canceled: true });
    }

    json(404, { error: "Not Found" });
  } catch (e) {
    json(500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`麦门今日签 Web 已启动: http://localhost:${PORT}`));
