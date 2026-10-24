// 麦门今日签 Web 服务端：静态页 + API（Token 只在服务端，前端不暴露）
// 启动：node web/server.js  [默认 http://localhost:8787]
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { homedir, networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { recommend } from "../skill/mcdaily-sign/scripts/mcd-core/engine.js";
import { resolveDate } from "../skill/mcdaily-sign/scripts/mcd-core/solarterms.js";
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

// 网络定位兜底缓存（同 NAT 出口设备共用，10 分钟）
let ipCache = null, ipCacheAt = 0;
let myIpCache = null, myIpAt = 0;

const handler = async (req, res) => {
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };
  try {
    // 卡牌游戏用：今日节气/节日（北京时间）
    if (req.url === "/api/dateinfo" && req.method === "GET") {
      const d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
      const di = resolveDate(d);
      return json(200, { date: d, term: di.term ?? null, festival: di.festival ?? null });
    }
    // 出口公网 IP（用于卡牌唯一码：设备码+IP+时间戳 保证每张卡全球唯一）
    if (req.url === "/api/myip" && req.method === "GET") {
      if (myIpCache && Date.now() - myIpAt < 60000) return json(200, { ip: myIpCache });
      try {
        const r = await fetch("http://ip-api.com/json/?fields=status,query");
        const j = await r.json();
        if (j.status === "success" && j.query) { myIpCache = String(j.query); myIpAt = Date.now(); return json(200, { ip: myIpCache }); }
      } catch { /* fallthrough */ }
      return json(200, { ip: (req.socket.remoteAddress || "").replace(/^::ffff:/, "") || "unknown" });
    }
    if (req.method === "GET") return serveStatic(req, res);

    // 网络定位兜底（浏览器无 geolocation API 时，如 http 内网环境）：用出口公网 IP 粗定位
    if (req.url === "/api/iploc" && req.method === "POST") {
      if (ipCache && Date.now() - ipCacheAt < 600000) return json(200, ipCache);
      const r = await fetch("http://ip-api.com/json/?lang=zh-CN&fields=status,city,regionName,lat,lon");
      const j = await r.json();
      if (j.status !== "success") return json(502, { error: "网络定位失败" });
      ipCache = { city: String(j.city || j.regionName || "").replace(/市$/, ""), raw: j.city || j.regionName, lat: j.lat, lon: j.lon };
      ipCacheAt = Date.now();
      return json(200, ipCache);
    }

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
        salt: body.salt, // 设备级个人盐：保证每人签不同
        prefs: body.prefs && (body.prefs.like?.length || body.prefs.dislike?.length) ? body.prefs : undefined,
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
};

// —— 自签名证书（首次启动自动生成）：内网 HTTPS 是定位/摇一摇权限的前提 ——
const CERT_DIR = join(__dirname, "cert");
function ensureCert() {
  const key = join(CERT_DIR, "key.pem"), crt = join(CERT_DIR, "cert.pem");
  if (existsSync(key) && existsSync(crt)) return { key: readFileSync(key), cert: readFileSync(crt) };
  mkdirSync(CERT_DIR, { recursive: true });
  console.log("首次启动：生成自签名证书（手机访问 https 地址时需在浏览器里点\"继续访问\"）…");
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=mcdaily.local" -keyout "${key}" -out "${crt}"`);
  return { key: readFileSync(key), cert: readFileSync(crt) };
}

const HTTPS_PORT = process.env.HTTPS_PORT ?? 8788;
const lanIps = (() => { try {
  return Object.values(networkInterfaces()).flat().filter(n => n && n.family === "IPv4" && !n.internal).map(n => n.address);
} catch { return []; } })();

createServer(handler).listen(PORT, () => {
  console.log(`麦门今日签 Web 已启动: http://localhost:${PORT}`);
  for (const ip of lanIps) console.log(`内网可访问: http://${ip}:${PORT}  （无定位/摇一摇权限）`);
});

try {
  createHttpsServer(ensureCert(), handler).listen(HTTPS_PORT, () => {
    console.log(`内网 HTTPS（手机请用这个，才有定位/摇一摇权限）:`);
    for (const ip of lanIps) console.log(`  https://${ip}:${HTTPS_PORT}  （首次打开点\"高级→继续访问\"）`);
  });
} catch (e) {
  console.warn("HTTPS 未启用:", e.message);
}
