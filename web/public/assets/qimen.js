/* 时家奇门简版排盘（前端版，供 GitHub Pages 静态演示使用）
   与 web/server.js 里的 QM 同源同算法：日干支(JDN 锚点)/五鼠遁/节气三元阴阳遁/地盘三奇六仪/值符值使/八门心态映射。
   2026 年节气表为静态近似（±1 天），与 mcd-core/solarterms.js 保持一致。 */

const TERMS = [
  ["2026-01-05", "小寒"], ["2026-01-20", "大寒"], ["2026-02-04", "立春"], ["2026-02-19", "雨水"],
  ["2026-03-05", "惊蛰"], ["2026-03-20", "春分"], ["2026-04-05", "清明"], ["2026-04-20", "谷雨"],
  ["2026-05-05", "立夏"], ["2026-05-21", "小满"], ["2026-06-05", "芒种"], ["2026-06-21", "夏至"],
  ["2026-07-07", "小暑"], ["2026-07-23", "大暑"], ["2026-08-07", "立秋"], ["2026-08-23", "处暑"],
  ["2026-09-08", "白露"], ["2026-09-23", "秋分"], ["2026-10-08", "寒露"], ["2026-10-23", "霜降"],
  ["2026-11-07", "立冬"], ["2026-11-22", "小雪"], ["2026-12-07", "大雪"], ["2026-12-22", "冬至"],
];

export function termOf(dateStr) {
  const d = (dateStr ?? "").slice(0, 10);
  let cur = null;
  for (const [date, name] of TERMS) if (d >= date) cur = name;
  return cur;
}

const GAN = "甲乙丙丁戊己庚辛壬癸", ZHI = "子丑寅卯辰巳午未申酉戌亥";
const CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const JDN = (y, m, d) => {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
};
const dayGZ = (y, m, d) => ((JDN(y, m, d) - JDN(2000, 1, 7)) % 60 + 60) % 60; // 锚：2000-01-07 甲子日
const gzName = i => GAN[i % 10] + ZHI[i % 12];

const JU_TABLE = {
  冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6], 立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
  春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8], 立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
  夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4], 立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6],
  秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2], 立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1],
};
const YANG_TERMS = new Set(["冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种"]);
const YI_ORDER = ["戊", "己", "庚", "辛", "壬", "癸", "丁", "丙", "乙"];
const XUN_NAMES = ["甲子", "甲戌", "甲申", "甲午", "甲辰", "甲寅"];
const PALACE = {
  1: { star: "天蓬", gate: "休门", bagua: "坎", dir: "北方" },
  2: { star: "天芮", gate: "死门", bagua: "坤", dir: "西南" },
  3: { star: "天冲", gate: "伤门", bagua: "震", dir: "东方" },
  4: { star: "天辅", gate: "杜门", bagua: "巽", dir: "东南" },
  5: { star: "天禽", gate: "死门", bagua: "中", dir: "寄坤二宫" },
  6: { star: "天心", gate: "开门", bagua: "乾", dir: "西北" },
  7: { star: "天柱", gate: "惊门", bagua: "兑", dir: "西方" },
  8: { star: "天任", gate: "生门", bagua: "艮", dir: "东北" },
  9: { star: "天英", gate: "景门", bagua: "离", dir: "南方" },
};
const GATE_MIND = {
  开门: { kw: "开拓启程", text: "宜启程、谈判、见重要的人", taboo: "忌拖延观望" },
  休门: { kw: "休整蓄力", text: "宜休息、复盘、养足精神", taboo: "忌硬拼硬扛" },
  生门: { kw: "生长创造", text: "宜开工、推进新事、谈钱", taboo: "忌守成不动" },
  伤门: { kw: "收着冲劲", text: "宜运动宣泄、干点体力活", taboo: "忌争执、签重要合约" },
  杜门: { kw: "关门专注", text: "宜闭门做事、写代码、读书", taboo: "忌到处社交" },
  景门: { kw: "表达展示", text: "宜汇报、发内容、社交亮相", taboo: "忌空想不落地" },
  死门: { kw: "断舍整理", text: "宜清理、收尾、了结旧事", taboo: "忌开启新局" },
  惊门: { kw: "谨慎言行", text: "宜核对信息、多听少说", taboo: "忌轻信、卷入口舌" },
};

const shift = (ds, n) => { const t = new Date(ds + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

export function qimen(now = new Date()) {
  const bj = new Date(now.getTime() + 8 * 3600e3);
  const y = bj.getUTCFullYear(), mo = bj.getUTCMonth() + 1, d = bj.getUTCDate(), hh = bj.getUTCHours();
  const dateStr = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dz = dayGZ(y, mo, d);
  const hZhi = Math.floor(((hh + 1) % 24) / 2);
  const hGan = ((dz % 10) * 2 + hZhi) % 10;
  let hIdx = 0;
  for (let i = 0; i < 60; i++) if (i % 10 === hGan && i % 12 === hZhi) { hIdx = i; break; }
  const term = termOf(dateStr);
  let daysIn = 0;
  if (term) {
    let cur = dateStr;
    for (let i = 0; i < 20; i++) {
      const prev = shift(cur, -1);
      if (termOf(prev) === term) { daysIn++; cur = prev; } else break;
    }
  }
  const yuan = Math.min(2, Math.floor(daysIn / 5));
  const yang = term ? YANG_TERMS.has(term) : true;
  const ju = term ? JU_TABLE[term][yuan] : 1;
  const diPan = {};
  for (let i = 0; i < 9; i++) {
    const p = yang ? ((ju - 1 + i) % 9) + 1 : ((ju - 1 - i) % 9 + 9) % 9 + 1;
    diPan[YI_ORDER[i]] = p;
  }
  const xunIdx = hIdx - (hIdx % 10);
  const xunName = XUN_NAMES[xunIdx / 10];
  const zhiFuGong0 = diPan[YI_ORDER[xunIdx / 10]];
  const zhiFuGong = zhiFuGong0 === 5 ? 2 : zhiFuGong0;
  const gate = PALACE[zhiFuGong].gate, star = PALACE[zhiFuGong].star;
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
}
