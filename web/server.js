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

/* ================= 奇门心态（源自 dweb-channel/magical-door 的奇门遁甲思路：时家奇门转盘简化排盘） ================= */
const QM = (() => {
  const GAN = "甲乙丙丁戊己庚辛壬癸", ZHI = "子丑寅卯辰巳午未申酉戌亥";
  const CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const JDN = (y, m, d) => { const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3; return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045; };
  const dayGZ = (y, m, d) => ((JDN(y, m, d) - JDN(2000, 1, 7)) % 60 + 60) % 60; // 0=甲子（锚：2000-01-07 甲子日，与 1949-10-01 甲子日互验）
  const gzName = i => GAN[i % 10] + ZHI[i % 12];
  const JU_TABLE = { 冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6], 立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4], 春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8], 立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9], 夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4], 立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6], 秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2], 立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1] };
  const YANG_TERMS = new Set(["冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种"]);
  const YI_ORDER = ["戊", "己", "庚", "辛", "壬", "癸", "丁", "丙", "乙"];
  const XUN_NAMES = ["甲子", "甲戌", "甲申", "甲午", "甲辰", "甲寅"];
  const PALACE = { 1: { star: "天蓬", gate: "休门", bagua: "坎", dir: "北方" }, 2: { star: "天芮", gate: "死门", bagua: "坤", dir: "西南" }, 3: { star: "天冲", gate: "伤门", bagua: "震", dir: "东方" }, 4: { star: "天辅", gate: "杜门", bagua: "巽", dir: "东南" }, 5: { star: "天禽", gate: "死门", bagua: "中", dir: "寄坤二宫" }, 6: { star: "天心", gate: "开门", bagua: "乾", dir: "西北" }, 7: { star: "天柱", gate: "惊门", bagua: "兑", dir: "西方" }, 8: { star: "天任", gate: "生门", bagua: "艮", dir: "东北" }, 9: { star: "天英", gate: "景门", bagua: "离", dir: "南方" } };
  const GATE_MIND = {
    开门: { kw: "开拓启程", text: "宜启程、谈判、见重要的人", taboo: "忌拖延观望" },
    休门: { kw: "休整蓄力", text: "宜休息、复盘、养足精神", taboo: "忌硬拼硬扛" },
    生门: { kw: "生长创造", text: "宜开工、推进新事、谈钱", taboo: "忌守成不动" },
    伤门: { kw: "收着冲劲", text: "宜运动宣泄、干点体力活", taboo: "忌争执、签重要合约" },
    杜门: { kw: "闭关沉淀", text: "宜专注单点、隐藏实力", taboo: "忌硬闯社交场" },
    景门: { kw: "表达展示", text: "宜汇报、发内容、社交亮相", taboo: "忌空想不落地" },
    死门: { kw: "断舍整理", text: "宜清理、收尾、了结旧事", taboo: "忌开启新局" },
    惊门: { kw: "谨慎言行", text: "宜核对信息、多听少说", taboo: "忌轻信、卷入口舌" },
  };
  const shift = (ds, n) => { const t = new Date(ds + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  return function qimen(now = new Date()) {
    const bj = new Date(now.getTime() + 8 * 3600e3);
    const y = bj.getUTCFullYear(), mo = bj.getUTCMonth() + 1, d = bj.getUTCDate(), hh = bj.getUTCHours();
    const dateStr = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dz = dayGZ(y, mo, d);                                    // 日干支
    const hZhi = Math.floor(((hh + 1) % 24) / 2);                  // 时支（23-1 点为子时）
    const hGan = ((dz % 10) * 2 + hZhi) % 10;                      // 五鼠遁
    let hIdx = 0; for (let i = 0; i < 60; i++) { if (i % 10 === hGan && i % 12 === hZhi) { hIdx = i; break; } }
    // 节气 + 三元（静态表按日回溯，±1 天误差黑客松可接受）
    const term = resolveDate(dateStr).term;
    let daysIn = 0;
    if (term) { let cur = dateStr; for (let i = 0; i < 20; i++) { const prev = shift(cur, -1); if (resolveDate(prev).term === term) { daysIn++; cur = prev; } else break; } }
    const yuan = Math.min(2, Math.floor(daysIn / 5));
    const yang = term ? YANG_TERMS.has(term) : true;
    const ju = term ? JU_TABLE[term][yuan] : 1;
    // 地盘三奇六仪（阳顺阴逆，戊起局数宫）
    const diPan = {};
    for (let i = 0; i < 9; i++) {
      const p = yang ? ((ju - 1 + i) % 9) + 1 : ((ju - 1 - i) % 9 + 9) % 9 + 1;
      diPan[YI_ORDER[i]] = p;
    }
    // 旬首 → 值符星 / 值使门
    const xunIdx = hIdx - hIdx % 10;
    const xunName = XUN_NAMES[xunIdx / 10];
    const zhiFuGong0 = diPan[YI_ORDER[xunIdx / 10]];
    const zhiFuGong = zhiFuGong0 === 5 ? 2 : zhiFuGong0;           // 天禽寄坤二
    const gate = PALACE[zhiFuGong].gate;
    const star = PALACE[zhiFuGong].star;
    // 值使落宫：阳顺阴逆飞八宫（跳中五）
    const n = hIdx - xunIdx;
    const cyc = yang ? [1, 2, 3, 4, 6, 7, 8, 9] : [9, 8, 7, 6, 4, 3, 2, 1];
    const fallen = cyc[(cyc.indexOf(zhiFuGong) + n) % 8];
    const mind = GATE_MIND[gate];
    return {
      ju: `${yang ? "阳" : "阴"}遁${CN_NUM[ju]}局`, term, yuan: ["上", "中", "下"][yuan] + "元",
      dayGZ: gzName(dz), timeGZ: gzName(hIdx), xun: xunName + "旬",
      zhiFuStar: star, zhiShi: gate, palace: fallen,
      bagua: PALACE[fallen].bagua, dir: PALACE[fallen].dir,
      kw: mind.kw, text: mind.text, taboo: mind.taboo,
    };
  };
})();
let qimenCache = null, qimenKey = "";

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
    // 奇门心态（时家奇门，按北京时辰每 2 小时一变）
    if (req.url === "/api/qimen" && req.method === "GET") {
      const d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 13);
      if (qimenKey !== d) { qimenCache = QM(); qimenKey = d; }
      return json(200, qimenCache);
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
