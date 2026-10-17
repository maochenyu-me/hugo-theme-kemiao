// 欢迎来访者卡（首页右栏与文章侧栏共用）：IP 定位 + 距离 + 城市彩蛋 + 时段问候
// 1:1 移植源站 traffic-overview 中的 welcome 逻辑，数据源换成 configurable IP API。

// 国家/地区引语（源站 o）
const COUNTRY_QUOTES = {日本:`よろしく，一起去看樱花吗`,美国:`Let us live in peace!`,英国:`想同你一起夜乘伦敦眼`,俄罗斯:`干了这瓶伏特加！`,法国:`C'est La Vie`,德国:`Die Zeit verging im Fluge.`,澳大利亚:`一起去大堡礁吧！`,加拿大:`拾起一片枫叶赠予你`};

// 省份引语（源站 s）
const PROVINCE_QUOTES = {北京:`北——京——欢迎你~~~`,天津:`讲段相声吧`,河北:`山势巍巍成壁垒，天下雄关铁马金戈由此向，无限江山`,山西:`展开坐具长三尺，已占山河五百余`,内蒙古:`天苍苍，野茫茫，风吹草低见牛羊`,辽宁:`我想吃烤鸡架！`,吉林:`状元阁就是东北烧烤之王`,黑龙江:`很喜欢哈尔滨大剧院`,上海:`众所周知，中国只有两个城市`,安徽:`蚌埠住了，芜湖起飞`,福建:`井邑白云间，岩城远带山`,江西:`落霞与孤鹜齐飞，秋水共长天一色`,山东:`遥望齐州九点烟，一泓海水杯中泻`,湖南:`74751，长沙斯塔克`,广西:`桂林山水甲天下`,海南:`朝观日出逐白浪，夕看云起收霞光`,四川:`康康川妹子`,贵州:`茅台，学生，再塞200`,云南:`玉龙飞舞云缠绕，万仞冰川直耸天`,西藏:`躺在茫茫草原上，仰望蓝天`,陕西:`来份臊子面加馍`,甘肃:`羌笛何须怨杨柳，春风不度玉门关`,青海:`牛肉干和老酸奶都好好吃`,宁夏:`大漠孤烟直，长河落日圆`,新疆:`驼铃古道丝绸路，胡马犹闻唐汉风`,台湾:`我在这头，大陆在那头`,香港:`永定贼有残留地鬼嚎，迎击光非岁玉`,澳门:`性感荷官，在线发牌`};

// 省份下城市彩蛋（源站 c）
const CITY_QUOTES = {江苏:{南京:`这是我挺想去的城市啦`,苏州:`上有天堂，下有苏杭`},浙江:{杭州:`东风渐绿西湖柳，雁已还人未南归`},河南:{郑州:`豫州之域，天地之中`,信阳:`品信阳毛尖，悟人间芳华`,南阳:`臣本布衣，躬耕于南阳此南阳非彼南阳！`,驻马店:`峰峰有奇石，石石挟仙气嵖岈山的花很美哦！`,开封:`刚正不阿包青天`,洛阳:`洛阳牡丹甲天下`},湖北:{黄冈:`红安将军县！辈出将才！`,武汉:`你想去长江游泳嘛？`},广东:{广州:`看小蛮腰，喝早茶了嘛~`,深圳:`今天你逛商场了嘛~`,阳江:`阳春合水！博主家乡~ 欢迎来玩~`}};

// 省份兜底引语（源站 l）
const PROVINCE_EXTRA = {江苏:`散装是必须要散装的`,浙江:`望海楼明照曙霞，护江堤白蹋晴沙`,河南:`可否带我品尝河南烩面啦？`,湖北:`来碗热干面~`,广东:`来两斤福建人~`};

// 英文国家名 → 中文（60s/ip.sb 返回英文；港澳台按中国特别行政区显示）
const COUNTRY_NAMES = {
  China: "中国", "Hong Kong": "中国香港", Hongkong: "中国香港", Taiwan: "中国台湾",
  Macao: "中国澳门", Macau: "中国澳门", Japan: "日本", "United States": "美国",
  "United Kingdom": "英国", Russia: "俄罗斯", France: "法国", Germany: "德国",
  Australia: "澳大利亚", Canada: "加拿大", Singapore: "新加坡", Malaysia: "马来西亚",
  Thailand: "泰国", Korea: "韩国", "South Korea": "韩国", India: "印度",
  Netherlands: "荷兰", Switzerland: "瑞士", Sweden: "瑞典", Norway: "挪威",
  Italy: "意大利", Spain: "西班牙", Brazil: "巴西", Mexico: "墨西哥",
  "New Zealand": "新西兰", Vietnam: "越南", Philippines: "菲律宾", Indonesia: "印度尼西亚",
};

const CACHE_KEY = "welcome-ip-v1";
const DEFAULT_TTL = 3600;
const TIMEOUT = 8000;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function escapeHtml(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function readCache(ttlSeconds) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== "number" || !parsed.data) return null;
    if (Date.now() - parsed.ts > ttlSeconds * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // 存储失败仅作渐进增强
  }
}

// 两点间球面距离（km）
function distanceKm(lng1, lat1, lng2, lat2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = { x: Math.cos(rad(lat1)) * Math.cos(rad(lng1)), y: Math.cos(rad(lat1)) * Math.sin(rad(lng1)), z: Math.sin(rad(lat1)) };
  const b = { x: Math.cos(rad(lat2)) * Math.cos(rad(lng2)), y: Math.cos(rad(lat2)) * Math.sin(rad(lng2)), z: Math.sin(rad(lat2)) };
  return Math.round((Math.asin(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) / 2) * 2 * 6371) || 0);
}

function countryName(country) {
  if (!country) return "远方";
  return COUNTRY_NAMES[country] || country;
}

// 位置文案：中国 → 省/市；其他 → 国家名
function locationText(info) {
  const { country, prov, city } = info.data;
  if (country === "中国" || country === "China") {
    if (prov && city && prov !== city) return `中国 ${prov} ${city}`;
    if (prov) return `中国 ${prov}`;
    if (city) return `中国 ${city}`;
    return "中国";
  }
  return countryName(country);
}

// 城市彩蛋引语
function cityQuote(info) {
  const { country, prov, city } = info.data;
  if (country === "中国" || country === "China") {
    return (CITY_QUOTES[prov] && CITY_QUOTES[prov][city]) || PROVINCE_QUOTES[prov] || PROVINCE_EXTRA[prov] || "带我去你的城市逛逛吧！";
  }
  const name = countryName(country);
  // 港澳台在源站省份彩蛋表里以短名（香港/澳门/台湾）存在，优先命中
  const short = name.replace(/^中国/, "");
  return PROVINCE_QUOTES[name] || PROVINCE_QUOTES[short] || COUNTRY_QUOTES[name] || "带我去你的国家逛逛吧";
}

// 时段问候
function greeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "🌤️ 早上好，快趁机多睡点懒觉！";
  if (hour >= 11 && hour < 13) return "☀️ 中午好，记得午休喔~";
  if (hour >= 13 && hour < 17) return "🕞 下午好，饮茶先啦！";
  if (hour >= 17 && hour < 19) return "🚶‍♂️ 下班啦！主打一个不听老板话~";
  if (hour >= 19) return "🌙 晚上好，来一起熬夜吧呜😭";
  return "夜深了，早点休息，少熬夜呀";
}

function normalize(payload) {
  const raw = payload?.data ?? {};
  const lng = Number(raw.lng ?? raw.longitude);
  const lat = Number(raw.lat ?? raw.latitude);
  return {
    ip: raw.ip || "",
    data: {
      country: raw.country || "",
      prov: raw.prov || raw.province || "",
      city: raw.city || "",
      lng: Number.isFinite(lng) ? lng : 0,
      lat: Number.isFinite(lat) ? lat : 0,
    },
  };
}

function render(box, info, origin) {
  const parts = [
    `<p class="welcome-location">嗷嗷！来自<strong>${escapeHtml(locationText(info))}</strong>的朋友！</p>`,
    "<p>泥嚎！微我五十！</p>",
    `<p>${escapeHtml(cityQuote(info))} 🍂</p>`,
  ];
  // 博主坐标未配置（0）时不显示距离
  if (origin.lat && origin.lng && (info.data.lat || info.data.lng)) {
    const km = distanceKm(origin.lng, origin.lat, info.data.lng, info.data.lat);
    parts.push(`<p>你目前距博主约 <strong>${km}</strong> 公里。</p>`);
  }
  parts.push(`<p>你的网络 IP 为：<span class="welcome-ip">${escapeHtml(info.ip || "未知")}</span></p>`);
  parts.push(`<p class="welcome-greeting">${escapeHtml(greeting())}</p>`);
  box.innerHTML = parts.join("");
}

function renderError(box) {
  box.innerHTML = "";
  const wrap = el("div", "welcome-error");
  const icon = el("i", "fa-regular fa-face-frown");
  icon.setAttribute("aria-hidden", "true");
  wrap.append(icon, el("span", "", "位置 API 请求失败，请刷新重试呀。"));
  box.append(wrap);
}

async function fetchIp(box, signal) {
  const api = box.dataset.api;
  const ttl = Number(box.dataset.cacheTtl) || DEFAULT_TTL;
  const cached = readCache(ttl);
  if (cached) return cached;
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), TIMEOUT);
  const abortAll = () => timeout.abort();
  signal?.addEventListener("abort", abortAll, { once: true });
  try {
    const res = await fetch(api, { headers: { Accept: "application/json" }, signal: timeout.signal });
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", abortAll);
    if (!res.ok) throw new Error(`ip api failed: ${res.status}`);
    const info = normalize(await res.json());
    writeCache(info);
    return info;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", abortAll);
  }
}

export async function initWelcomeInfo(signal) {
  const box = document.getElementById("welcome-info");
  if (!(box instanceof HTMLElement) || box.dataset.loaded === "true") return;
  box.dataset.loaded = "true";
  const origin = {
    lat: Number(box.dataset.originLat) || 0,
    lng: Number(box.dataset.originLng) || 0,
  };
  try {
    const info = await fetchIp(box, signal);
    if (signal?.aborted) return;
    render(box, info, origin);
  } catch (err) {
    if (signal?.aborted) return;
    renderError(box);
  }
}
