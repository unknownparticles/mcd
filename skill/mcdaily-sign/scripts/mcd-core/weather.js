// 天气：Open-Meteo 免费接口（无 key）
// 返回 {tempC, weatherLine, code}
//   code: 'hot' | 'warm' | 'cool' | 'cold' | 'rain' | 'snow'

export async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code`;
  const res = await fetch(url);
  const j = await res.json();
  const tempC = Math.round(j.current?.temperature_2m ?? 20);
  const wcode = j.current?.weather_code ?? 0;

  let code = "warm";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(wcode)) code = "rain";
  else if ([71, 73, 75, 77, 85, 86].includes(wcode)) code = "snow";
  else if (tempC >= 28) code = "hot";
  else if (tempC <= 5) code = "cold";
  else if (tempC <= 15) code = "cool";

  const lines = {
    hot: "外面热得像烤炉",
    warm: "天气不冷不热",
    cool: "外面有点凉",
    cold: "寒气逼人",
    rain: "外面雨声淅沥",
    snow: "外面落雪无声",
  };
  return { tempC, wcode, code, weatherLine: `${lines[code]}（${tempC}℃）` };
}

// 城市名 → 经纬度：优先内置坐标表（Open-Meteo 对中文城市名不稳定），回退英文 geocoding
const CITY_COORDS = {
  "北京": [39.9042, 116.4074], "上海": [31.2304, 121.4737], "广州": [23.1291, 113.2644],
  "深圳": [22.5431, 114.0579], "厦门": [24.4798, 118.0894], "福州": [26.0745, 119.2965],
  "泉州": [24.8741, 118.6757], "杭州": [30.2741, 120.1551], "南京": [32.0603, 118.7969],
  "苏州": [31.2989, 120.5853], "成都": [30.5728, 104.0668], "重庆": [29.5630, 106.5516],
  "武汉": [30.5928, 114.3055], "长沙": [28.2282, 112.9388], "郑州": [34.7466, 113.6254],
  "青岛": [36.0671, 120.3826], "济南": [36.6512, 117.1201], "天津": [39.3434, 117.3616],
  "西安": [34.3416, 108.9398], "合肥": [31.8206, 117.2272], "南昌": [28.6820, 115.8579],
  "昆明": [25.0460, 102.7097], "贵阳": [26.6477, 106.6302], "南宁": [22.8170, 108.3665],
  "哈尔滨": [45.8038, 126.5350], "长春": [43.8171, 125.3235], "沈阳": [41.8057, 123.4315],
  "大连": [38.9140, 121.6147], "石家庄": [38.0428, 114.5149], "太原": [37.8706, 112.5489],
  "宁波": [29.8683, 121.5440], "温州": [27.9938, 120.6994], "无锡": [31.4912, 120.3119],
  "常州": [31.8105, 119.9740], "东莞": [23.0430, 113.7633], "佛山": [23.0219, 113.1219],
  "珠海": [22.2707, 113.5767], "中山": [22.5158, 113.3926], "惠州": [23.1115, 114.4162],
  "烟台": [37.4638, 121.4479], "绍兴": [30.0302, 120.5804], "海口": [20.0442, 110.1999],
  "三亚": [18.2528, 109.5119], "汕头": [23.3540, 116.6820], "漳州": [24.5128, 117.6471],
  "莆田": [25.4541, 119.0078], "泉州晋江": [24.7814, 118.5747], "昆山": [31.3865, 120.9553],
};

const CITY_PINYIN = {
  "厦门": "Xiamen", "广州": "Guangzhou", "深圳": "Shenzhen", "福州": "Fuzhou", "泉州": "Quanzhou",
  "杭州": "Hangzhou", "南京": "Nanjing", "苏州": "Suzhou", "成都": "Chengdu", "重庆": "Chongqing",
  "武汉": "Wuhan", "长沙": "Changsha", "郑州": "Zhengzhou", "青岛": "Qingdao", "济南": "Jinan",
  "天津": "Tianjin", "西安": "Xi'an", "合肥": "Hefei", "南昌": "Nanchang", "昆明": "Kunming",
  "贵阳": "Guiyang", "南宁": "Nanning", "哈尔滨": "Harbin", "长春": "Changchun", "沈阳": "Shenyang",
  "大连": "Dalian", "石家庄": "Shijiazhuang", "太原": "Taiyuan", "宁波": "Ningbo", "温州": "Wenzhou",
  "无锡": "Wuxi", "常州": "Changzhou", "东莞": "Dongguan", "佛山": "Foshan", "珠海": "Zhuhai",
  "中山": "Zhongshan", "惠州": "Huizhou", "烟台": "Yantai", "绍兴": "Shaoxing", "海口": "Haikou",
  "三亚": "Sanya", "汕头": "Shantou", "漳州": "Zhangzhou", "莆田": "Putian", "北京": "Beijing",
  "上海": "Shanghai",
};

export async function geocode(city) {
  const clean = (city ?? "").replace(/(市|区|县)$/, "");
  if (CITY_COORDS[clean]) {
    const [lat, lon] = CITY_COORDS[clean];
    return { lat, lon, source: "builtin" };
  }
  for (const name of [city, clean, CITY_PINYIN[clean] ?? city]) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh`;
    try {
      const res = await fetch(url);
      const j = await res.json();
      const hit = j.results?.[0];
      if (hit) return { lat: hit.latitude, lon: hit.longitude, source: "open-meteo" };
    } catch { /* try next */ }
  }
  throw new Error(`无法定位城市: ${city}（可在 weather.js 的 CITY_COORDS 里补充坐标）`);
}
