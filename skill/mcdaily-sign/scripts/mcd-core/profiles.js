// 16 型「麦门人格档案」——产品灵魂
// 每个 MBTI：人格定位 + 口味关键词偏好（名称匹配加分）+ 签文腔调 + 点餐行为
// like 里的词会在商品名/tags 中匹配，权重见 engine.js

export const PROFILES = {
  INTJ: {
    persona: "效率军师",
    tone: "tactician",
    like: ["三件套", "咖啡", "牛肉", "巨无霸", "板烧"],
    dislike: ["分享桶", "甜品站"],
    behavior: "固定套餐、按性价比与营养算最优解，不犹豫",
    nutritionNerd: true,
  },
  INTP: {
    persona: "理性拆解者",
    tone: "analyst",
    like: ["麦乐鸡", "薯条", "玉米杯", "单点"],
    dislike: ["双人餐", "全家桶"],
    behavior: "拒绝套餐溢价，自己拼装最优组合",
    nutritionNerd: true,
  },
  ENTJ: {
    persona: "指挥官",
    tone: "commander",
    like: ["巨无霸", "双层的", "安格斯", "大份"],
    dislike: [],
    behavior: "直接下单最大份，决策成本为零",
  },
  ENTP: {
    persona: "尝鲜躁徒",
    tone: "troller",
    like: ["新", "辣", "限定", "脆汁鸡"],
    dislike: ["经典"],
    behavior: "看到'限时''新品'就走不动路",
  },
  INFJ: {
    persona: "治愈系",
    tone: "healer",
    like: ["拿铁", "热", "汤", "麦香鱼", "粥"],
    dislike: ["辣"],
    behavior: "一人食，安静吃完，桌位靠窗",
  },
  INFP: {
    persona: "氛围诗人",
    tone: "poet",
    like: ["圆筒", "圣代", "薯条", "草莓", "巧克力"],
    dislike: [],
    behavior: "看心情点单，今天和昨天可以完全不同",
  },
  ENFJ: {
    persona: "聚餐搭子",
    tone: "host",
    like: ["分享", "全家桶", "任选", "麦乐鸡"],
    dislike: [],
    behavior: "替全桌点，记住每个人的忌口",
  },
  ESFP: {
    persona: "派对动物",
    tone: "party",
    like: ["可乐", "冰淇淋", "圆筒", "派", "脆汁鸡"],
    dislike: ["沙拉"],
    behavior: "越花哨越好，买的是快乐",
  },
  ISTJ: {
    persona: "秩序践行者",
    tone: "tactician",
    like: ["三件套", "汉堡", "经典"],
    dislike: ["新品", "限定"],
    behavior: "只吃验证过的经典，周三也吃和周一一样的",
  },
  ISFJ: {
    persona: "温柔老好人",
    tone: "healer",
    like: ["热", "麦香鱼", "薯条", "豆浆"],
    dislike: ["辣"],
    behavior: "点熟悉的，帮同事也带一份",
  },
  ESTJ: {
    persona: "执行主管",
    tone: "commander",
    like: ["三件套", "巨无霸", "牛肉"],
    dislike: [],
    behavior: "12:00:00 准时下单，误差不超过 30 秒",
  },
  ESFJ: {
    persona: "氛围组组长",
    tone: "host",
    like: ["分享", "任选", "麦乐鸡", "派"],
    dislike: [],
    behavior: "点单前先发群里投票",
  },
  ISTP: {
    persona: "沉默工匠",
    tone: "analyst",
    like: ["板烧", "麦香鱼", "薯条", "咖啡"],
    dislike: ["花哨", "联名"],
    behavior: "话最少，点得最快，吃相最稳",
  },
  ISFP: {
    persona: "氛围艺术家",
    tone: "poet",
    like: ["圆筒", "圣代", "派", "草莓"],
    dislike: ["重辣"],
    behavior: "先看图片再点，颜值即正义",
  },
  ESTP: {
    persona: "极限尝鲜家",
    tone: "troller",
    like: ["辣", "炸鸡", "脆汁鸡", "新品"],
    dislike: ["沙拉"],
    behavior: "点单 10 秒完成，吃得比谁都快",
  },
  ENFP: {
    persona: "快乐小狗",
    tone: "party",
    like: ["可乐", "冰淇淋", "麦乐鸡", "薯条", "派"],
    dislike: [],
    behavior: "点单像抽卡，永远期待惊喜",
  },
};

export const TONES = {
  tactician: {
    style: "冷静精算体",
    grade: ["最优解签", "次优解签", "保底方案签"],
    make: (c) =>
      [
        `经测算，${c.weatherLine}${c.termLine}你的最优摄入方案为：${c.product}。原价 ${c.origPrice}，现价 ${c.price}${c.couponLine}。效率已最大化，勿念。`,
        `${c.termLine}本军师遍历 ${c.menuCount} 件在售餐品，锁定 ${c.product}（¥${c.price}${c.couponLine}）。${c.weatherLine}决策完成，去取餐。`,
      ][c.pick % 2],
  },
  analyst: {
    style: "拆解测评体",
    grade: ["结构优良签", "参数达标签", "可接受签"],
    make: (c) =>
      [
        `拆解结论：${c.product}，价格 ${c.origPrice}→${c.price}${c.couponLine}，性价比符合预期。${c.weatherLine}${c.termLine}无更优解，建议执行。`,
        `别问玄学，问数据：${c.product}，实付 ¥${c.price}${c.couponLine}。${c.weatherLine}${c.termLine}本拆解者已验算两遍，没错。`,
      ][c.pick % 2],
  },
  commander: {
    style: "号令体",
    grade: ["必胜签", "进攻签", "执行签"],
    make: (c) =>
      [
        `签已下：${c.product}，¥${c.price}${c.couponLine}。${c.weatherLine}${c.termLine}犹豫就会败北，下单，去取餐，这就是命令。`,
        `${c.termLine}本指挥官批准今日军粮：${c.product}（¥${c.price}${c.couponLine}）。${c.weatherLine}执行吧，士兵。`,
      ][c.pick % 2],
  },
  troller: {
    style: "整活玩梗体",
    grade: ["麦门保佑签", "上上大吉签", "整点新活签"],
    make: (c) =>
      [
        `麦门！${c.termLine}${c.weatherLine}老天爷都暗示你吃 ${c.product} 了（¥${c.price}${c.couponLine}），不点对不起这份天意。i麦门人做e麦门事！`,
        `今日麦门认证：${c.product}，¥${c.price}${c.couponLine}。${c.weatherLine}别人抽卡你抽签，抽中就吃，这就是麦门的世界线收束。`,
      ][c.pick % 2],
  },
  healer: {
    style: "温柔絮语体",
    grade: ["治愈签", "温暖签", "小确幸签"],
    make: (c) =>
      [
        `${c.termLine}${c.weatherLine}今天适合对自己好一点：${c.product}，¥${c.price}${c.couponLine}。慢慢吃，别着急，你已经很棒了。`,
        `给你抽到一张温柔的签：${c.product}（¥${c.price}${c.couponLine}）。${c.weatherLine}${c.termLine}热乎的，趁早吃，世界偶尔也要抱抱你。`,
      ][c.pick % 2],
  },
  poet: {
    style: "诗化emo体",
    grade: ["人间值得签", "微光签", "雾里看花签"],
    make: (c) =>
      [
        `${c.termLine}薯条会凉，但快乐不会。今日签文指向 ${c.product}，¥${c.price}${c.couponLine}。${c.weatherLine}把它吃掉，把今天过成散文诗。`,
        `在 ${c.menuCount} 件餐品里，命运替你翻牌了 ${c.product}（¥${c.price}${c.couponLine}）。${c.weatherLine}${c.termLine}甜味是世界的临时解药。`,
      ][c.pick % 2],
  },
  host: {
    style: "社牛招呼体",
    grade: ["全员满意签", "气氛担当签", "团建必胜签"],
    make: (c) =>
      [
        `家人们！今日签来了：${c.product}，¥${c.price}${c.couponLine}！${c.weatherLine}${c.termLine}这个配置发群里，没人会反对。`,
        `${c.termLine}占卜结果：${c.product}（¥${c.price}${c.couponLine}）${c.weatherLine}，闭眼冲，不好吃算我输，麦门担保！`,
      ][c.pick % 2],
  },
  party: {
    style: "发疯快乐体",
    grade: ["狂喜签", "蹦跳签", "快乐加倍签"],
    make: (c) =>
      [
        `啊啊啊啊抽到了！${c.product}！¥${c.price}${c.couponLine}！${c.weatherLine}${c.termLine}这不得立刻炫掉？麦门永恒！ 🍟`,
        `叮咚——今日快乐已发货：${c.product}（¥${c.price}${c.couponLine}）。${c.weatherLine}${c.termLine}签都不用看第二种，就是它，冲！`,
      ][c.pick % 2],
  },
};

// 6 题快测：不记得 MBTI 时的兜底
export const QUIZ = [
  {
    q: "中午下班铃响，你的第一反应是？",
    options: [
      { text: "吃什么？我 11:50 就想好了", dim: "J" },
      { text: "到时候看心情", dim: "P" },
    ],
  },
  {
    q: "店里出了个没吃过的新品，你？",
    options: [
      { text: "立刻试，不好吃就当踩雷", dim: "P2" },
      { text: "先看评价，稳妥起见点老款", dim: "S" },
    ],
  },
  {
    q: "同事问你'中午一起？'，你？",
    options: [
      { text: "好啊好啊，人多吃得香", dim: "E" },
      { text: "想一个人安静吃会儿", dim: "I" },
    ],
  },
  {
    q: "点单时你更在意？",
    options: [
      { text: "价格/热量/性价比，要算明白", dim: "T" },
      { text: "看着开心吃着舒服就行", dim: "F" },
    ],
  },
  {
    q: "雨天外卖 40 分钟才到，你？",
    options: [
      { text: "有点丧，需要甜品安慰", dim: "F2" },
      { text: "正常，物流就是这样", dim: "T2" },
    ],
  },
  {
    q: "吃汉堡你的隐藏仪式感是？",
    options: [
      { text: "拉上全桌拼单才有氛围", dim: "E2" },
      { text: "一人一堡，专注干饭", dim: "I2" },
    ],
  },
];

// 快测计分：E/I、S/N、T/F、J/P 各两题，票数多者胜
export function scoreQuiz(answers) {
  const tally = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  answers.forEach((idx, qi) => {
    const dim = QUIZ[qi]?.options[idx]?.dim;
    if (dim) {
      if (dim === "P2") tally.P++;
      else if (dim === "T2") tally.T++;
      else if (dim === "F2") tally.F++;
      else if (dim === "E2") tally.E++;
      else if (dim === "I2") tally.I++;
      else tally[dim]++;
    }
  });
  return (
    (tally.E >= tally.I ? "E" : "I") +
    (tally.S >= tally.N ? "S" : "N") +
    (tally.T >= tally.F ? "T" : "F") +
    (tally.J >= tally.P ? "J" : "P")
  );
}
