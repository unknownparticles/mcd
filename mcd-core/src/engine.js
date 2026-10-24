// 推荐引擎：MBTI(0.5) × 天气(0.2) × 优惠(0.15) × 节气/活动(0.15)
import { createMcdClient, parseMeals, parseStores, parseCoupons } from "./mcd-client.js";
import { PROFILES, TONES } from "./profiles.js";
import { resolveDate } from "./solarterms.js";
import { getWeather, geocode } from "./weather.js";

// ---- 商品特征识别（名称关键词） ----
const FEATS = {
  spicy: ["辣", "藤椒", "花椒"],
  beef: ["巨无霸", "牛肉", "安格斯", "板烧"],
  chicken: ["鸡"],
  fish: ["鳕鱼", "麦香鱼"],
  sweet: ["甜", "枫糖", "蜜", "草莓", "巧克力", "蓝莓"],
  ice: ["圆筒", "圣代", "冰淇淋", "冰", "雪糕", "冰炫", "冰咖啡"],
  hotDrink: ["咖啡", "拿铁", "热", "豆浆", "红茶", "奶茶"],
  fries: ["薯条", "薯"],
  breakfast: ["早晨", "松饼", "猪柳蛋", "吉士蛋"],
  share: ["分享", "全家桶", "任选", "桶"],
  combo: ["三件套", "套餐", "四件套"],
  drink: ["可乐", "汽水", "零度", "雪碧", "果汁"],
};

function features(meal) {
  const s = meal.name + (meal.tags ?? []).join("");
  const f = {};
  for (const [k, words] of Object.entries(FEATS)) f[k] = words.some((w) => s.includes(w));
  return f;
}

// ---- 各因子打分（0~1） ----
function mbtiScore(profile, f, meal) {
  let s = 0.5; // 基线
  const like = profile.like ?? [];
  const dislike = profile.dislike ?? [];
  const nameTags = meal.name + meal.tags.join("");
  for (const w of like) if (nameTags.includes(w)) s += 0.15;
  for (const w of dislike) if (nameTags.includes(w)) s -= 0.2;
  if (profile.nutritionNerd && f.combo) s += 0.08; // 数据党爱成套配平
  return clamp01(s);
}

function weatherScore(wcode, f) {
  switch (wcode) {
    case "hot": return clamp01(0.6 + (f.ice ? 0.35 : 0) + (f.drink ? 0.15 : 0) - (f.hotDrink ? 0.2 : 0));
    case "cold": return clamp01(0.6 + (f.hotDrink ? 0.3 : 0) + (f.combo ? 0.1 : 0) - (f.ice ? 0.3 : 0));
    case "rain": return clamp01(0.55 + (f.fries ? 0.2 : 0) + (f.hotDrink ? 0.15 : 0) + (f.sweet ? 0.1 : 0));
    case "snow": return clamp01(0.55 + (f.hotDrink ? 0.3 : 0) + (f.combo ? 0.15 : 0) - (f.ice ? 0.4 : 0));
    case "cool": return clamp01(0.5 + (f.combo ? 0.1 : 0) + (f.hotDrink ? 0.1 : 0));
    default: return 0.5;
  }
}

function couponScore(meal, coupons) {
  // 券标题与商品名互相包含关键词即视为可用
  const hits = coupons.filter((c) => {
    const t = c.title.replace(/(\d+(\.\d+)?)元|免费/g, "");
    const key = ["麦辣鸡腿堡", "炸鸡", "薯饼", "汉堡", "套餐"].find((k) => c.title.includes(k));
    return key && (meal.name.includes(key) || meal.tags.join("").includes(key));
  });
  if (!hits.length) return { score: 0.3, coupon: null };
  const c = hits[0];
  return { score: 0.9, coupon: c };
}

function termScore(dateInfo, f) {
  let s = 0.4;
  const term = dateInfo.term ?? "";
  const line = (dateInfo.termLine ?? "") + (dateInfo.festivalLine ?? "");
  if (/寒|冬|冷|雪/.test(term) && (f.hotDrink || f.combo)) s += 0.25;
  if (/夏|暑|热/.test(term) && f.ice) s += 0.25;
  if (/凉|爽/.test(term) && f.ice) s += 0.1;
  if (dateInfo.festival === "程序员节" && f.combo) s += 0.2; // 配平梗
  if (line.includes("热乎") || line.includes("热饮")) { if (f.hotDrink) s += 0.15; }
  if (line.includes("透心凉") || line.includes("冰")) { if (f.ice) s += 0.15; }
  return clamp01(s);
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// ---- 私人订制口味（用户在设置里选的"爱吃/不吃"）----
// prefs: { like: ["牛肉","咖啡",...], dislike: ["辣","猪肉",...] }，关键词对商品名+标签做 includes 匹配
function tasteHits(meal, words) {
  if (!words?.length) return [];
  const nameTags = meal.name + (meal.tags ?? []).join("");
  return words.filter((w) => nameTags.includes(w));
}
function tasteDislikeHit(meal, prefs) {
  return tasteHits(meal, prefs?.dislike);
}

// 专属签：date+mbti+城市+口味+个人盐 的确定性哈希微扰
// → 同一天同一人结果稳定可复现，次日自动换签（回访钩子）；不同人/不同城市/不同口味各得专属签
function daySeed(dateStr, mbti, code, personal = "") {
  let h = 2166136261;
  const s = `${dateStr}|${(mbti ?? "").toUpperCase()}|${code}|${personal}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

// ---- 主流程 ----
// opts: { token, mbti, city, keyword?, orderType?, beType?, claimCoupons? }
export async function recommend(opts) {
  const { token, mbti, city } = opts;
  const mcd = createMcdClient(token);
  const profile = PROFILES[mbti?.toUpperCase()];
  if (!profile) throw new Error(`未知 MBTI: ${mbti}`);

  // 1. 服务器时间（北京时间，节气/节日判断依据）
  const nowResp = await mcd.now();
  const dateStr = nowResp.text.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
  const dateInfo = resolveDate(dateStr);

  // 2. 天气
  const { lat, lon } = await geocode(city);
  const weather = await getWeather(lat, lon);

  // 3. 门店 + 菜单
  const storesResp = await mcd.stores(city, opts.keyword);
  const stores = parseStores(storesResp).filter((s) => s.open);
  if (!stores.length) throw new Error(`城市「${city}」没找到营业中的麦当劳门店`);
  const store = stores[0];
  const mealsResp = await mcd.meals(store.storeCode, opts.orderType ?? 1, opts.beType ?? 1);
  const meals = parseMeals(mealsResp).filter((m) => m.price > 0);
  const mealsFinal0 = opts.budget ? meals.filter((m) => m.price <= opts.budget) : meals;
  if (!mealsFinal0.length) throw new Error(`预算 ¥${opts.budget} 内没有可用餐品`);
  // 私人订制：「不吃」的商品直接排除（除非排除后全空，则保留但重罚）
  const noDis = mealsFinal0.filter((m) => !tasteDislikeHit(m, opts.prefs).length);
  const excluded = noDis.length ? true : false;
  const mealsFinal = noDis.length ? noDis : mealsFinal0;

  // 4. 优惠券（可选：自动领取）
  let coupons = [];
  if (opts.claimCoupons !== false) {
    try {
      coupons = parseCoupons(await mcd.claimCoupons());
    } catch { /* 领券失败不阻塞推荐 */ }
  }

  // 5. 打分（叠加每日确定性微扰与私人订制口味，人格/天气仍主导）
  const personalKey = [opts.city ?? "", opts.salt ?? "", (opts.prefs?.like ?? []).join(","), (opts.prefs?.dislike ?? []).join(",")].join("|");
  const scored = mealsFinal.map((meal, i) => {
    const f = features(meal);
    const mbtiS = mbtiScore(profile, f, meal);
    const wS = weatherScore(weather.code, f);
    const { score: cS, coupon } = couponScore(meal, coupons);
    const tS = termScore(dateInfo, f);
    const seed = daySeed(dateStr, mbti, meal.code, personalKey);
    const likeHit = tasteHits(meal, opts.prefs?.like);
    const prefS = Math.min(0.4, likeHit.length * 0.2); // 每命中一个"爱吃"+0.2，封顶 +0.4 —— 显式偏好应压过人格默认
    const total = 0.5 * mbtiS + 0.2 * wS + 0.15 * cS + 0.15 * tS + prefS + (seed - 0.5) * 0.04;
    return { meal, features: f, coupon, total, seed, likeHit, parts: { mbti: mbtiS, weather: wS, coupon: cS, term: tS, pref: prefS }, idx: i };
  });
  scored.sort((a, b) => b.total - a.total);
  const top = scored.slice(0, 3);

  // 6. 签卡（含推荐理由）
  const tone = TONES[profile.tone];
  const wReason = {
    hot: "天气炎热，冰爽单品此时最对味",
    cold: "天气转凉，热乎的更抚人",
    rain: "下雨天，炸物和热饮是绝配",
    snow: "落雪天要吃热乎的正餐",
    cool: "天气凉爽，正是好好吃顿正餐的时候",
  }[weather.code];
  const results = top.map((s, rank) => {
    const c = {
      product: s.meal.name,
      price: s.meal.price.toFixed(1),
      origPrice: s.meal.origPrice.toFixed(1),
      couponLine: s.coupon ? `，持「${s.coupon.title}」更省` : "",
      weatherLine: weather.weatherLine,
      termLine: dateInfo.festival ? `今日${dateInfo.festival}，${dateInfo.festivalLine}。` : (dateInfo.term ? `${dateInfo.term}时节，${dateInfo.termLine}。` : ""),
      menuCount: meals.length,
      pick: s.seed < 0.5 ? 0 : 1,
    };
    // 推荐理由（用户要求：必须给出选择的理由）
    const reasons = [];
    const nameTags = s.meal.name + s.meal.tags.join("");
    const matched = (profile.like ?? []).filter((w) => nameTags.includes(w));
    if (s.likeHit?.length) reasons.unshift(`私人订制：你爱吃「${s.likeHit.slice(0, 2).join("、")}」，专属加成`);
    if (matched.length) reasons.push(`${profile.persona}偏爱「${matched.slice(0, 2).join("、")}」，与本品高度契合`);
    else reasons.push(`${profile.persona}的点餐哲学：${profile.behavior}`);
    if (excluded && opts.prefs?.dislike?.length) reasons.push(`已按你的口味排除「${opts.prefs.dislike.slice(0, 2).join("、")}」类商品`);
    if (s.parts.weather >= 0.6 && wReason) reasons.push(wReason);
    if (s.coupon) reasons.push(`自动匹配到优惠券「${s.coupon.title}」`);
    if (dateInfo.festival) reasons.push(`今天${dateInfo.festival}，节点氛围加成`);
    else if (dateInfo.term && s.parts.term >= 0.5) reasons.push(`${dateInfo.term}时节，${dateInfo.termLine}`);
    if (s.meal.origPrice > s.meal.price) reasons.push(`现价 ¥${s.meal.price}（原价 ¥${s.meal.origPrice}），相当于 ${Math.round((1 - s.meal.price / s.meal.origPrice) * 100)} 折`);
    return {
      rank,
      grade: tone.grade[Math.min(2, rank)],
      product: s.meal.name,
      price: s.meal.price,
      origPrice: s.meal.origPrice,
      coupon: s.coupon,
      image: s.meal.image,
      code: s.meal.code,
      tags: s.meal.tags,
      score: Number(s.total.toFixed(3)),
      parts: s.parts,
      reasons,
      limited: dateInfo.festival ?? dateInfo.term ?? null, // 节气/节日限定签（收集图鉴）
      fortune: tone.make(c),
    };
  });

  return {
    mbti,
    persona: profile.persona,
    toneStyle: tone.style,
    date: dateStr,
    term: dateInfo.term,
    festival: dateInfo.festival,
    personalized: true, // 专属签：按人（MBTI+城市+口味+设备盐）定制，每日刷新
    weather: { tempC: weather.tempC, code: weather.code, line: weather.weatherLine },
    store: { storeCode: store.storeCode, storeName: store.storeName, address: store.address },
    sign: results[0],
    alternatives: results.slice(1),
    couponsCount: coupons.length,
  };
}
