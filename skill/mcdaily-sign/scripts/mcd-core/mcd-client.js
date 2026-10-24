// 麦当劳 MCP 客户端（streamablehttp，服务端无状态）
const MCD_URL = "https://mcp.mcd.cn";

let idSeq = 1;

// 从 markdown 文本中按括号配平提取完整 JSON 对象（正确处理字符串与转义）
export function extractJsonObjects(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}" && --depth === 0) { end = j; break; }
      }
    }
    if (end > 0) {
      out.push(text.slice(i, end + 1));
      i = end;
    }
  }
  return out;
}

export function createMcdClient(token) {
  if (!token) throw new Error("缺少 MCD_TOKEN");

  async function rpc(method, params) {
    const res = await fetch(MCD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: idSeq++, method, params }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`MCP HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    if (json.error) throw new Error(`MCP error: ${json.error.message}`);
    const content = json.result?.content ?? [];
    const text = content.map((c) => c.text ?? "").join("\n");
    return { text, raw: json.result };
  }

  // 调用工具并从返回 markdown 中提取内嵌 JSON
  // 说明：返回文本的说明部分可能内嵌示例 JSON，且真实 JSON 后可能还有 markdown 尾巴
  //       —— 用括号配平找到每个完整 JSON 对象，取最后一个 success=true 的
  async function call(name, args = {}) {
    const { text } = await rpc("tools/call", { name, arguments: args });
    const objs = extractJsonObjects(text);
    for (let i = objs.length - 1; i >= 0; i--) {
      try {
        const data = JSON.parse(objs[i]);
        if (typeof data.success === "boolean") return { kind: "json", data, text };
      } catch {
        /* try previous */
      }
    }
    return { kind: "text", data: text, text };
  }

  return {
    call,
    listTools: async () => (await rpc("tools/list", {})).text,
    // ---- 业务封装 ----
    now: () => call("now-time-info"),
    calendar: () => call("campaign-calendar"),
    account: () => call("query-my-account"),
    stores: (city, keyword) =>
      call("query-nearby-stores", { beType: 1, searchType: 2, city, keyword: keyword ?? "麦当劳" }),
    meals: (storeCode, orderType = 1, beType = 1) =>
      call("query-meals", { storeCode, orderType, beType }),
    price: (storeCode, items) =>
      call("calculate-price", { storeCode, orderType: 1, beType: 1, items }),
    claimCoupons: () => call("auto-bind-coupons"),
    storeCoupons: (storeCode, orderType = 1, beType = 1) =>
      call("query-store-coupons", { storeCode, orderType, beType }),
    mealDetail: (storeCode, orderType, beType, productCode) =>
      call("query-meal-detail", { storeCode, orderType, beType, productCode }),
    createOrder: (payload) => call("create-order", payload),
    queryOrder: (orderId) => call("query-order", { orderId }),
  };
}

// ---- 响应解析辅助 ----

// 菜单 → 平铺商品列表 [{code,name,price,origPrice,tags}]
export function parseMeals(resp) {
  if (resp.kind !== "json" || !resp.data?.data) return [];
  const { categories = [], meals = {} } = resp.data.data;
  const flat = [];
  for (const cat of categories) {
    for (const entry of cat.meals ?? []) {
      const detail = meals[entry.code];
      if (!detail) continue;
      flat.push({
        code: entry.code,
        name: detail.name,
        price: Number(detail.currentPrice ?? detail.originalPrice ?? 0),
        origPrice: Number(detail.originalPrice ?? detail.currentPrice ?? 0),
        tags: [...(entry.tags ?? []), ...(detail.tags ?? [])],
        category: cat.name,
        image: detail.image,
        canWithOrder: detail.canWithOrder,
      });
    }
  }
  return flat;
}

// 门店 → [{storeCode, storeName, address, distance, beCode}]
export function parseStores(resp) {
  if (resp.kind !== "json") return [];
  return (resp.data?.data ?? []).map((s) => ({
    storeCode: s.storeCode,
    storeName: s.storeName,
    address: s.address,
    distance: s.distance,
    beCode: s.beCode,
    open: s.businessStatus,
  }));
}

// 领券结果 → [{couponId, couponCode, title}]
export function parseCoupons(resp) {
  const text = resp.text ?? "";
  const out = [];
  const blocks = text.split(/####\s*/).slice(1);
  for (const b of blocks) {
    const title = b.split("\n")[0].trim();
    const couponId = b.match(/couponId[：:]\s*([A-Z0-9]+)/)?.[1];
    const couponCode = b.match(/couponCode[：:]\s*([A-Z0-9]+)/)?.[1];
    if (couponId && couponCode) out.push({ couponId, couponCode, title });
  }
  return out;
}
