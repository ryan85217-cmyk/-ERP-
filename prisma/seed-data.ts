/**
 * Pure, dependency-free demo data generator.
 * Produces deterministic (seeded RNG) data relative to `now`, so the
 * dashboard always has "today" / "this week" activity after seeding.
 */
import { classifyMember } from "../src/lib/segments";

type CountStatus = "DRAFT" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
type LocationType = "SHELF" | "DISPLAY" | "CHILLED" | "FROZEN" | "BACKROOM";
type VarianceReason =
  | "DAMAGED"
  | "EXPIRED"
  | "THEFT"
  | "MISCOUNT"
  | "SYSTEM_ERROR"
  | "UNRECORDED_SALE"
  | "SUPPLIER_SHORTAGE"
  | "OTHER";

const DAY = 86_400_000;
const TZ = 8 * 3_600_000;

// ───────── deterministic RNG ─────────
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261011);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
function weightedPick<T>(items: readonly T[], weights: readonly number[], total: number) {
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
function localStartOfDay(d: Date) {
  const l = new Date(d.getTime() + TZ);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - TZ);
}
function ymd(d: Date) {
  const l = new Date(d.getTime() + TZ);
  return `${l.getUTCFullYear()}${pad(l.getUTCMonth() + 1)}${pad(l.getUTCDate())}`;
}

// ───────── master data ─────────
export const CATEGORIES = [
  "生鮮蔬果",
  "肉品海鮮",
  "乳製品蛋品",
  "冷凍食品",
  "米麵雜糧",
  "調味醬料",
  "零食點心",
  "飲品",
] as const;

export const CATEGORY_I18N: { en: string; ja: string }[] = [
  { en: "Fresh Produce", ja: "青果" },
  { en: "Meat & Seafood", ja: "精肉・鮮魚" },
  { en: "Dairy & Eggs", ja: "乳製品・卵" },
  { en: "Frozen Foods", ja: "冷凍食品" },
  { en: "Rice & Grains", ja: "米・麺・穀物" },
  { en: "Sauces & Seasonings", ja: "調味料" },
  { en: "Snacks", ja: "スナック・菓子" },
  { en: "Beverages", ja: "飲料" },
];

/** One zone per category (A–H) plus a backroom zone R. */
const CATEGORY_ZONES: { zone: string; type: LocationType; capacity: number }[] = [
  { zone: "A", type: "DISPLAY", capacity: 120 },
  { zone: "B", type: "CHILLED", capacity: 80 },
  { zone: "C", type: "CHILLED", capacity: 100 },
  { zone: "D", type: "FROZEN", capacity: 90 },
  { zone: "E", type: "SHELF", capacity: 200 },
  { zone: "F", type: "SHELF", capacity: 160 },
  { zone: "G", type: "SHELF", capacity: 160 },
  { zone: "H", type: "CHILLED", capacity: 150 },
];

export const SUPPLIERS = [
  { name: "青田有機農場", contactName: "林志明", phone: "03-958-1122", email: "sales@qingtian-farm.tw", address: "宜蘭縣三星鄉三星路二段 88 號", note: "有機認證蔬果，每週一、四到貨" },
  { name: "海港鮮物股份有限公司", contactName: "陳美玲", phone: "07-821-3456", email: "order@harbor-fresh.tw", address: "高雄市前鎮區漁港中二路 3 號", note: "冷鏈配送，需提前 2 天叫貨" },
  { name: "牧場之家乳品", contactName: "張家豪", phone: "049-266-7788", email: "service@ranchhome.tw", address: "南投縣埔里鎮中山路四段 120 號", note: "" },
  { name: "金穗米業", contactName: "黃淑芬", phone: "05-582-9900", email: "rice@goldenear.tw", address: "雲林縣西螺鎮延平路 256 號", note: "月結 30 天" },
  { name: "老順香食品", contactName: "吳俊賢", phone: "02-2298-6655", email: "contact@laoshunxiang.tw", address: "新北市新莊區五工路 45 號", note: "醬料、調味品主力廠商" },
  { name: "好日子冷凍食品", contactName: "李佩珊", phone: "04-2359-1234", email: "b2b@goodday-frozen.tw", address: "台中市西屯區工業區一路 77 號", note: "" },
  { name: "森活飲品", contactName: "王建宏", phone: "02-8792-3344", email: "sales@senhuo-drinks.tw", address: "台北市內湖區瑞光路 513 號", note: "夏季需增加安全庫存" },
  { name: "甜蜜時光食品", contactName: "許雅婷", phone: "06-298-5566", email: "hello@sweettime.tw", address: "台南市永康區中正南路 300 號", note: "" },
] as const;

interface ProductDef {
  name: string;
  cat: number;
  price: number;
  origin: string;
  sup: number;
  ingredients: string;
  cooking?: string;
  recipe?: string;
  pop: number; // popularity weight
}

const P = (
  name: string,
  cat: number,
  price: number,
  origin: string,
  sup: number,
  ingredients: string,
  pop: number,
  cooking?: string,
  recipe?: string,
): ProductDef => ({ name, cat, price, origin, sup, ingredients, pop, cooking, recipe });

export const PRODUCT_DEFS: ProductDef[] = [
  // 生鮮蔬果
  P("有機高麗菜", 0, 89, "台灣・宜蘭", 0, "高麗菜", 9, "清炒、水煮、涼拌", "蒜炒高麗菜：蒜末爆香後下高麗菜大火快炒，加鹽調味即可。"),
  P("牛番茄 (500g)", 0, 75, "台灣・嘉義", 0, "牛番茄", 8, "生食、燉煮", "番茄炒蛋：蛋液炒至半熟盛起，番茄炒軟後加入蛋與少許糖鹽拌勻。"),
  P("台農香蕉 (1 串)", 0, 65, "台灣・屏東", 0, "香蕉", 10, "直接食用、打果昔"),
  P("日本富士蘋果 (4 入)", 0, 199, "日本・青森", 0, "蘋果", 6, "直接食用、烘烤"),
  P("有機菠菜", 0, 59, "台灣・宜蘭", 0, "菠菜", 6, "汆燙、清炒"),
  P("紅蘿蔔 (600g)", 0, 49, "台灣・雲林", 0, "紅蘿蔔", 5, "燉煮、榨汁"),
  P("鮮香菇 (200g)", 0, 85, "台灣・南投", 0, "香菇", 5, "煎烤、煮湯", "奶油煎香菇：奶油融化後放入香菇兩面煎香，撒黑胡椒與鹽。"),
  P("酪梨 (2 入)", 0, 139, "台灣・台南", 0, "酪梨", 4, "生食、做醬", "酪梨醬：酪梨壓泥，拌入檸檬汁、洋蔥丁、番茄丁與鹽。"),
  // 肉品海鮮
  P("台灣豬五花肉片 (300g)", 1, 159, "台灣・雲林", 1, "豬五花", 8, "火鍋、燒烤、熱炒", "回鍋肉：五花肉片煎出油脂，加入高麗菜、辣豆瓣醬拌炒。"),
  P("去骨雞腿排 (2 片)", 1, 189, "台灣・彰化", 1, "雞腿肉", 9, "香煎、氣炸", "香煎雞腿排：雞皮朝下小火煎 8 分鐘至金黃，翻面再煎 5 分鐘。"),
  P("澳洲穀飼牛排 (200g)", 1, 389, "澳洲", 1, "牛肋眼", 4, "煎烤", "牛排：室溫回溫 20 分鐘，熱鍋每面煎 2 分鐘，靜置 5 分鐘後切片。"),
  P("挪威鮭魚切片 (250g)", 1, 299, "挪威", 1, "大西洋鮭魚", 6, "香煎、烤", "鹽烤鮭魚：表面抹鹽靜置 10 分鐘，200°C 烤 12 分鐘。"),
  P("白蝦 (500g)", 1, 329, "台灣・屏東", 1, "白蝦", 5, "鹽烤、汆燙、熱炒", "蒜蓉蒸蝦：開背鋪蒜蓉，大火蒸 5 分鐘淋上蔥油。"),
  P("台灣鯛魚片", 1, 169, "台灣・高雄", 1, "台灣鯛", 4, "清蒸、香煎"),
  P("豬絞肉 (400g)", 1, 139, "台灣・屏東", 1, "豬前腿肉", 7, "炒、蒸、做餡", "肉燥：絞肉炒散加入紅蔥酥、醬油、冰糖與五香粉，小火燉 40 分鐘。"),
  // 乳製品蛋品
  P("鮮乳 936ml", 2, 98, "台灣・南投", 2, "生乳", 10, "直接飲用、料理"),
  P("無糖優格 450g", 2, 89, "台灣・南投", 2, "生乳、乳酸菌", 6, "直接食用、搭配水果"),
  P("動物性鮮奶油 200ml", 2, 115, "紐西蘭", 2, "乳脂", 3, "烘焙、燉飯"),
  P("切達起司片 (12 片)", 2, 135, "澳洲", 2, "牛乳、食鹽、乳化劑", 5, "三明治、焗烤"),
  P("放牧雞蛋 (10 入)", 2, 99, "台灣・彰化", 2, "雞蛋", 10, "煎、煮、蒸", "溏心蛋：滾水煮 6.5 分鐘後冰鎮，浸泡醬汁一晚。"),
  P("無鹽奶油 200g", 2, 145, "法國", 2, "乳脂", 3, "烘焙、煎炒"),
  // 冷凍食品
  P("高麗菜豬肉水餃 (40 入)", 3, 199, "台灣・台中", 5, "麵粉、豬肉、高麗菜、蔥", 8, "水煮、煎", "水煮：滾水下鍋，浮起後加冷水兩次，再滾即可。"),
  P("冷凍青花菜 (500g)", 3, 79, "厄瓜多", 5, "青花菜", 4, "汆燙、炒"),
  P("經典瑪格麗特披薩", 3, 229, "義大利", 5, "麵粉、番茄醬、莫札瑞拉起司、羅勒", 5, "烤箱 220°C 烤 12 分鐘"),
  P("鮮蝦燒賣 (12 入)", 3, 169, "台灣・台中", 5, "蝦仁、豬肉、麵皮", 4, "蒸 8 分鐘"),
  P("冷凍薯條 (1kg)", 3, 139, "美國", 5, "馬鈴薯、植物油", 6, "氣炸 200°C 15 分鐘"),
  P("香草冰淇淋 (473ml)", 3, 189, "台灣", 5, "鮮奶油、牛乳、糖、香草", 4, "直接食用"),
  // 米麵雜糧
  P("西螺濁水米 (3kg)", 4, 299, "台灣・雲林", 3, "白米", 7, "電鍋：米水比 1:1", "白飯：洗米兩次，米水 1:1 浸泡 30 分鐘後炊煮。"),
  P("台灣糙米 (2kg)", 4, 219, "台灣・花蓮", 3, "糙米", 3, "浸泡 2 小時後炊煮"),
  P("義大利直麵 500g", 4, 89, "義大利", 3, "杜蘭小麥粉", 6, "滾水煮 9 分鐘", "蒜香辣椒義大利麵：橄欖油爆香蒜片與辣椒，拌入麵條與少許煮麵水。"),
  P("關廟麵 (4 入)", 4, 79, "台灣・台南", 3, "麵粉、鹽", 5, "滾水煮 3 分鐘"),
  P("燕麥片 (800g)", 4, 159, "澳洲", 3, "全穀燕麥", 4, "沖泡、煮粥"),
  P("全麥吐司", 4, 75, "台灣", 3, "全麥麵粉、酵母、鹽", 7, "烤、做三明治"),
  // 調味醬料
  P("純釀醬油 (1L)", 5, 189, "台灣・雲林", 4, "黑豆、鹽、糖", 5, "滷、炒、沾"),
  P("初榨橄欖油 (500ml)", 5, 329, "西班牙", 4, "橄欖", 4, "涼拌、低溫烹調"),
  P("沙茶醬 (250g)", 5, 99, "台灣・台南", 4, "扁魚、蝦米、花生、大蒜", 4, "火鍋沾醬、熱炒"),
  P("味噌 (500g)", 5, 129, "日本", 4, "黃豆、米麴、鹽", 3, "煮湯、醃漬", "味噌湯：昆布高湯加入豆腐、海帶芽，關火後拌入味噌。"),
  P("義式番茄紅醬", 5, 149, "義大利", 4, "番茄、洋蔥、橄欖油、羅勒", 4, "義大利麵、燉菜"),
  P("海鹽 (500g)", 5, 59, "台灣・台南", 4, "海鹽", 3, "各式調味"),
  P("咖哩塊 (中辣)", 5, 89, "日本", 4, "小麥粉、油脂、香辛料", 5, "燉煮", "咖哩飯：炒香洋蔥、紅蘿蔔、馬鈴薯與肉，加水煮滾後放入咖哩塊。"),
  // 零食點心
  P("海苔脆片", 6, 59, "台灣", 7, "海苔、芝麻、鹽", 6, "直接食用"),
  P("綜合堅果 (300g)", 6, 259, "美國", 7, "杏仁、腰果、核桃", 5, "直接食用、拌優格"),
  P("鳳梨酥 (10 入)", 6, 320, "台灣・台中", 7, "鳳梨、奶油、麵粉、蛋", 4, "直接食用"),
  P("黑巧克力 72%", 6, 129, "比利時", 7, "可可塊、可可脂、糖", 4, "直接食用、烘焙"),
  P("洋芋片 (原味)", 6, 49, "台灣", 7, "馬鈴薯、植物油、鹽", 8, "直接食用"),
  P("手工蛋捲", 6, 199, "台灣・台南", 7, "雞蛋、麵粉、奶油、糖", 3, "直接食用"),
  // 飲品
  P("無糖綠茶 (600ml)", 7, 29, "台灣", 6, "綠茶", 10, "冰鎮飲用"),
  P("冷萃咖啡 (300ml)", 7, 65, "台灣", 6, "咖啡豆、水", 7, "冰鎮飲用"),
  P("100% 柳橙汁 (1L)", 7, 129, "美國", 6, "柳橙", 5, "冰鎮飲用"),
  P("氣泡水 (6 入)", 7, 149, "台灣", 6, "碳酸水", 6, "冰鎮飲用、調飲"),
  P("無加糖豆漿 (936ml)", 7, 55, "台灣", 6, "非基改黃豆、水", 7, "冷熱皆宜"),
  P("椰子水 (330ml)", 7, 59, "泰國", 6, "椰子水", 4, "冰鎮飲用"),
];

/** [English, Japanese] names, same order as PRODUCT_DEFS */
const PRODUCT_I18N: [string, string][] = [
  ["Organic Cabbage", "有機キャベツ"],
  ["Beefsteak Tomatoes (500g)", "大玉トマト (500g)"],
  ["Taiwan Bananas (1 bunch)", "台湾バナナ (1 房)"],
  ["Fuji Apples (4 pcs)", "青森ふじりんご (4 個)"],
  ["Organic Spinach", "有機ほうれん草"],
  ["Carrots (600g)", "にんじん (600g)"],
  ["Fresh Shiitake (200g)", "生しいたけ (200g)"],
  ["Avocados (2 pcs)", "アボカド (2 個)"],
  ["Sliced Pork Belly (300g)", "台湾産豚バラスライス (300g)"],
  ["Boneless Chicken Thighs (2 pcs)", "骨なし鶏もも肉 (2 枚)"],
  ["Australian Grain-fed Steak (200g)", "豪州産穀物肥育牛ステーキ (200g)"],
  ["Norwegian Salmon Fillet (250g)", "ノルウェー産サーモン切り身 (250g)"],
  ["Whiteleg Shrimp (500g)", "バナメイエビ (500g)"],
  ["Taiwan Tilapia Fillet", "台湾産ティラピア切り身"],
  ["Ground Pork (400g)", "豚ひき肉 (400g)"],
  ["Fresh Milk 936ml", "牛乳 936ml"],
  ["Plain Yogurt 450g", "無糖ヨーグルト 450g"],
  ["Fresh Cream 200ml", "生クリーム 200ml"],
  ["Cheddar Slices (12)", "チェダースライスチーズ (12 枚)"],
  ["Free-range Eggs (10)", "平飼い卵 (10 個)"],
  ["Unsalted Butter 200g", "無塩バター 200g"],
  ["Pork & Cabbage Dumplings (40)", "豚肉キャベツ水餃子 (40 個)"],
  ["Frozen Broccoli (500g)", "冷凍ブロッコリー (500g)"],
  ["Classic Margherita Pizza", "マルゲリータピザ"],
  ["Shrimp Shumai (12)", "エビ焼売 (12 個)"],
  ["Frozen French Fries (1kg)", "冷凍フライドポテト (1kg)"],
  ["Vanilla Ice Cream (473ml)", "バニラアイスクリーム (473ml)"],
  ["Xiluo Zhuoshui Rice (3kg)", "西螺濁水米 (3kg)"],
  ["Taiwan Brown Rice (2kg)", "台湾玄米 (2kg)"],
  ["Spaghetti 500g", "スパゲッティ 500g"],
  ["Guanmiao Noodles (4)", "関廟麺 (4 玉)"],
  ["Rolled Oats (800g)", "オートミール (800g)"],
  ["Whole Wheat Bread", "全粒粉食パン"],
  ["Naturally Brewed Soy Sauce (1L)", "本醸造醤油 (1L)"],
  ["Extra Virgin Olive Oil (500ml)", "エクストラバージンオリーブオイル (500ml)"],
  ["Shacha Sauce (250g)", "沙茶醤 (250g)"],
  ["Miso (500g)", "味噌 (500g)"],
  ["Italian Tomato Sauce", "イタリアントマトソース"],
  ["Sea Salt (500g)", "海塩 (500g)"],
  ["Curry Roux (Medium Hot)", "カレールウ (中辛)"],
  ["Crispy Seaweed Snack", "のりチップス"],
  ["Mixed Nuts (300g)", "ミックスナッツ (300g)"],
  ["Pineapple Cakes (10)", "パイナップルケーキ (10 個)"],
  ["Dark Chocolate 72%", "ダークチョコレート 72%"],
  ["Potato Chips (Original)", "ポテトチップス (うすしお)"],
  ["Handmade Egg Rolls", "手作りエッグロール"],
  ["Unsweetened Green Tea (600ml)", "無糖緑茶 (600ml)"],
  ["Cold Brew Coffee (300ml)", "コールドブリューコーヒー (300ml)"],
  ["100% Orange Juice (1L)", "100% オレンジジュース (1L)"],
  ["Sparkling Water (6)", "炭酸水 (6 本)"],
  ["Unsweetened Soy Milk (936ml)", "無調整豆乳 (936ml)"],
  ["Coconut Water (330ml)", "ココナッツウォーター (330ml)"],
];

const SKU_PREFIX = ["VEG", "MEA", "DAI", "FRZ", "GRA", "SAU", "SNK", "DRK"];

const LAST_NAMES = "陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周徐蘇葉莊呂江何蕭羅高潘簡朱鍾彭游詹胡施沈余趙盧梁顏柯翁魏孫戴".split("");
const GIVEN = ["怡君", "雅婷", "志豪", "俊傑", "淑芬", "家豪", "美玲", "冠宇", "佩珊", "建宏", "宜蓁", "承翰", "欣怡", "宗翰", "詩涵", "柏翰", "思妤", "彥廷", "雅雯", "冠廷", "郁婷", "子軒", "品妍", "宇翔", "佳穎", "明哲", "惠如", "信宏", "筱涵", "家瑋"];
const OPERATORS = ["王店長", "陳副店長", "林小美", "張大偉", "李佳穎"];
const PAYMENTS = ["CASH", "CARD", "LINE_PAY", "EASY_CARD"] as const;
const PAYMENT_WEIGHTS = [35, 30, 25, 10];

// ───────── generator ─────────
export function generateSeedData(now: Date = new Date()) {
  const today = localStartOfDay(now);
  const HISTORY_DAYS = 760;
  const firstDay = new Date(today.getTime() - HISTORY_DAYS * DAY);

  const categories = CATEGORIES.map((name, i) => ({
    id: `cat_${i + 1}`,
    name,
    nameEn: CATEGORY_I18N[i].en,
    nameJa: CATEGORY_I18N[i].ja,
    sortOrder: i,
  }));

  // ── storage locations: zones A–H (2 aisles × 3 levels each) + backroom R ──
  const locations: {
    id: string;
    code: string;
    zone: string;
    aisle: number;
    level: number;
    type: LocationType;
    capacity: number;
    sortOrder: number;
    note: string | null;
    isActive: boolean;
  }[] = [];
  const zoneDefs = [...CATEGORY_ZONES, { zone: "R", type: "BACKROOM" as LocationType, capacity: 500 }];
  zoneDefs.forEach((z, zi) => {
    for (let aisle = 1; aisle <= 2; aisle++) {
      for (let level = 1; level <= 3; level++) {
        const code = `${z.zone}-${pad(aisle)}-${pad(level)}`;
        const isRepair = code === "R-02-03";
        locations.push({
          id: `loc_${code}`,
          code,
          zone: z.zone,
          aisle,
          level,
          type: z.type,
          capacity: z.capacity,
          sortOrder: zi * 100 + aisle * 10 + level,
          note: z.zone === "R" ? (isRepair ? "冷氣維修中，暫停使用" : "後場備貨區") : null,
          isActive: !isRepair,
        });
      }
    }
  });
  const suppliers = SUPPLIERS.map((s, i) => ({ id: `sup_${i + 1}`, ...s, note: s.note || null }));

  const skuCounters = new Array(CATEGORIES.length).fill(0);
  const products = PRODUCT_DEFS.map((p, i) => {
    skuCounters[p.cat] += 1;
    // n-th product of the category goes to the n-th slot of the category zone (wrapping after 6)
    const slot = (skuCounters[p.cat] - 1) % 6;
    const locationId = `loc_${CATEGORY_ZONES[p.cat].zone}-${pad(Math.floor(slot / 3) + 1)}-${pad((slot % 3) + 1)}`;
    return {
      id: `prd_${pad(i + 1, 3)}`,
      sku: `${SKU_PREFIX[p.cat]}-${pad(skuCounters[p.cat], 4)}`,
      name: p.name,
      nameEn: PRODUCT_I18N[i][0],
      nameJa: PRODUCT_I18N[i][1],
      locationId,
      categoryId: categories[p.cat].id,
      imageUrl: null as string | null,
      ingredients: p.ingredients,
      price: p.price,
      origin: p.origin,
      supplierId: suppliers[p.sup].id,
      recipe: p.recipe ?? null,
      cookingMethod: p.cooking ?? null,
      // a couple of delisted products for demo
      isActive: i !== 13 && i !== 46,
      createdAt: new Date(firstDay.getTime() - randInt(10, 60) * DAY),
    };
  });
  const productPop = PRODUCT_DEFS.map((p) => p.pop);
  const activeProducts = products.filter((p) => p.isActive);
  const activeWeights = activeProducts.map((p) => productPop[products.indexOf(p)]);
  const activeWeightTotal = activeWeights.reduce((a, b) => a + b, 0);

  // ── members ──
  interface MemberGen {
    id: string;
    memberNumber: string;
    name: string;
    phone: string;
    email: string | null;
    joinedAt: Date;
    churnAt: Date; // stops buying after this
    loyalty: number; // 0..1 probability multiplier
  }
  const members: MemberGen[] = [];
  const MEMBER_COUNT = 900;
  const usedPhones = new Set<string>();
  for (let i = 0; i < MEMBER_COUNT; i++) {
    // ~10% joined within the last 30 days
    const joinedAt =
      i >= MEMBER_COUNT - 70
        ? new Date(today.getTime() - randInt(0, 29) * DAY + randInt(9, 20) * 3_600_000)
        : new Date(firstDay.getTime() + rand() * (HISTORY_DAYS - 30) * DAY);
    const churnRoll = rand();
    const churnAt =
      churnRoll < 0.38
        ? new Date(joinedAt.getTime() + randInt(20, 360) * DAY) // churned customers
        : new Date(now.getTime() + 365 * DAY);
    let phone = "";
    do phone = `09${randInt(10, 99)}${pad(randInt(0, 999), 3)}${pad(randInt(0, 999), 3)}`;
    while (usedPhones.has(phone));
    usedPhones.add(phone);
    const name = pick(LAST_NAMES) + pick(GIVEN);
    members.push({
      id: `mem_${pad(i + 1, 4)}`,
      memberNumber: `M${pad(i + 1, 6)}`,
      name,
      phone,
      email: rand() < 0.75 ? `member${pad(i + 1, 4)}@example.com` : null,
      joinedAt,
      churnAt,
      loyalty: Math.pow(rand(), 1.6), // skewed: few very loyal members
    });
  }

  // ── orders ──
  const orders: {
    id: string;
    orderNumber: string;
    memberId: string | null;
    orderedAt: Date;
    total: number;
    itemCount: number;
    paymentMethod: string;
  }[] = [];
  const orderItems: {
    id: string;
    orderId: string;
    productId: string;
    productName: string;
    categoryName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[] = [];
  const unitsSold = new Map<string, number>();
  const HOUR_WEIGHTS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 5, 7, 10, 8, 5, 5, 6, 9, 11, 9, 6, 3, 0, 0];
  const HOURS = HOUR_WEIGHTS.map((_, h) => h);
  const HOUR_TOTAL = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  const nowLocalHour = new Date(now.getTime() + TZ).getUTCHours();

  let itemSeq = 0;
  for (let d = 0; d <= HISTORY_DAYS; d++) {
    const dayStart = new Date(firstDay.getTime() + d * DAY);
    const local = new Date(dayStart.getTime() + TZ);
    const dow = local.getUTCDay();
    const month = local.getUTCMonth();
    const growth = 0.75 + 0.45 * (d / HISTORY_DAYS);
    const weekend = dow === 0 || dow === 6 ? 1.35 : dow === 5 ? 1.15 : 1;
    const season = month === 0 || month === 1 ? 1.25 : month === 11 ? 1.15 : month >= 6 && month <= 7 ? 1.08 : 1;
    const noise = 0.8 + rand() * 0.4;
    const count = Math.round(26 * growth * weekend * season * noise);
    const isToday = d === HISTORY_DAYS;
    let seq = 0;
    for (let o = 0; o < count; o++) {
      const hour = weightedPick(HOURS, HOUR_WEIGHTS, HOUR_TOTAL);
      if (isToday && hour > nowLocalHour) continue;
      const orderedAt = new Date(dayStart.getTime() + hour * 3_600_000 + randInt(0, 3599) * 1000);
      if (orderedAt > now) continue;

      // ~62% of orders belong to members
      let memberId: string | null = null;
      if (rand() < 0.62) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const m = members[Math.floor(rand() * members.length)];
          if (m.joinedAt <= orderedAt && m.churnAt > orderedAt && rand() < 0.08 + m.loyalty) {
            memberId = m.id;
            break;
          }
        }
      }

      seq += 1;
      const orderId = `ord_${d}_${seq}`;
      const lines = randInt(1, 5) + (rand() < 0.2 ? 2 : 0);
      const chosen = new Set<string>();
      let total = 0;
      let itemCount = 0;
      for (let l = 0; l < lines; l++) {
        const p = weightedPick(activeProducts, activeWeights, activeWeightTotal);
        if (chosen.has(p.id)) continue;
        chosen.add(p.id);
        const qty = rand() < 0.7 ? 1 : randInt(2, 4);
        const subtotal = qty * p.price;
        total += subtotal;
        itemCount += qty;
        unitsSold.set(p.id, (unitsSold.get(p.id) ?? 0) + qty);
        itemSeq += 1;
        orderItems.push({
          id: `oit_${itemSeq}`,
          orderId,
          productId: p.id,
          productName: p.name,
          categoryName: CATEGORIES[PRODUCT_DEFS[products.indexOf(p)].cat],
          quantity: qty,
          unitPrice: p.price,
          subtotal,
        });
      }
      orders.push({
        id: orderId,
        orderNumber: `SO${ymd(orderedAt)}${pad(seq, 4)}`,
        memberId,
        orderedAt,
        total,
        itemCount,
        paymentMethod: weightedPick(PAYMENTS, PAYMENT_WEIGHTS, 100),
      });
    }
  }

  // ── member aggregates ──
  const stats = new Map<string, { count: number; total: number; last: Date | null }>();
  for (const o of orders) {
    if (!o.memberId) continue;
    const s = stats.get(o.memberId) ?? { count: 0, total: 0, last: null };
    s.count += 1;
    s.total += o.total;
    if (!s.last || o.orderedAt > s.last) s.last = o.orderedAt;
    stats.set(o.memberId, s);
  }
  const memberRows = members.map((m) => {
    const s = stats.get(m.id) ?? { count: 0, total: 0, last: null };
    return {
      id: m.id,
      memberNumber: m.memberNumber,
      name: m.name,
      phone: m.phone,
      email: m.email,
      joinedAt: m.joinedAt,
      lastPurchaseAt: s.last,
      purchaseCount: s.count,
      totalSpent: s.total,
      avgOrderValue: s.count ? Math.round(s.total / s.count) : 0,
      segment: classifyMember({ joinedAt: m.joinedAt, lastPurchaseAt: s.last, purchaseCount: s.count }, now),
      createdAt: m.joinedAt,
    };
  });

  // ── inventory ──
  const inventories = products.map((p, i) => {
    const pop = productPop[i];
    const safetyStock = 8 + pop * 2;
    let posStock = randInt(Math.round(safetyStock * 0.4), safetyStock * 5);
    if (i % 9 === 0) posStock = randInt(0, Math.max(1, safetyStock - 3)); // below safety stock
    if (i % 13 === 5) posStock = safetyStock * randInt(5, 8); // overstock
    const mismatch = rand() < 0.3;
    const storeStock = mismatch ? Math.max(0, posStock - randInt(-3, 6)) : posStock;
    return {
      id: `inv_${pad(i + 1, 3)}`,
      productId: p.id,
      posStock,
      storeStock,
      warehouseStock: randInt(0, 1) === 0 ? randInt(40, 400) : randInt(100, 900),
      safetyStock,
      lastSyncedAt: new Date(now.getTime() - randInt(5, 240) * 60_000),
    };
  });

  // ── inventory count sessions ──
  const sessions: {
    id: string;
    code: string;
    countDate: Date;
    operator: string;
    status: CountStatus;
    note: string | null;
    zones: string[];
    countedCount: number;
    uncountedCount: number;
    totalVariance: number;
    startedAt: Date | null;
    pausedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }[] = [];
  const countItems: {
    id: string;
    sessionId: string;
    productId: string;
    locationId: string;
    locationCode: string;
    posQty: number;
    actualQty: number | null;
    variance: number | null;
    reason: VarianceReason | null;
    note: string | null;
    countedAt: Date | null;
  }[] = [];
  const REASONS: VarianceReason[] = ["DAMAGED", "EXPIRED", "THEFT", "MISCOUNT", "SYSTEM_ERROR", "UNRECORDED_SALE", "SUPPLIER_SHORTAGE"];
  const REASON_W = [20, 25, 10, 20, 10, 10, 5];
  // product-specific "shrink-prone" factor so the variance ranking is meaningful
  const shrink = products.map((_, i) => (i % 7 === 2 ? 3 : i % 5 === 1 ? 2 : 1));

  const sessionPlan: { daysAgo: number; status: CountStatus; progress: number }[] = [
    { daysAgo: 150, status: "COMPLETED", progress: 1 },
    { daysAgo: 120, status: "COMPLETED", progress: 1 },
    { daysAgo: 90, status: "COMPLETED", progress: 1 },
    { daysAgo: 60, status: "COMPLETED", progress: 1 },
    { daysAgo: 30, status: "COMPLETED", progress: 1 },
    { daysAgo: 2, status: "PAUSED", progress: 0.45 },
    { daysAgo: 0, status: "IN_PROGRESS", progress: 0.2 },
  ];
  sessionPlan.forEach((plan, si) => {
    const countDate = new Date(today.getTime() - plan.daysAgo * DAY);
    const startedAt = new Date(countDate.getTime() + (plan.daysAgo === 0 ? Math.min(nowLocalHour, 8) : 8) * 3_600_000);
    const id = `ics_${si + 1}`;
    // the paused count is a chilled / frozen zone count; the others cover the whole store
    const zones = plan.status === "PAUSED" ? ["B", "C", "D"] : [];
    const scope = zones.length
      ? activeProducts.filter((p) => zones.includes(p.locationId.slice(4, 5)))
      : activeProducts;
    let counted = 0;
    let totalVar = 0;
    scope.forEach((p, pi) => {
      const posQty = randInt(5, 80);
      const isCounted = plan.progress >= 1 || pi / scope.length < plan.progress;
      let actualQty: number | null = null;
      let variance: number | null = null;
      let reason: VarianceReason | null = null;
      let note: string | null = null;
      if (isCounted) {
        const pIdx = products.indexOf(p);
        const hasVar = rand() < 0.18 * shrink[pIdx];
        const diff = hasVar ? (rand() < 0.85 ? randInt(1, 3 * shrink[pIdx]) : -randInt(1, 3)) : 0;
        actualQty = Math.max(0, posQty - diff);
        variance = posQty - actualQty;
        if (variance !== 0) {
          reason = weightedPick(REASONS, REASON_W, 100);
          if (rand() < 0.3) note = reason === "DAMAGED" ? "外包裝破損" : reason === "EXPIRED" ? "已下架報廢" : "已複盤確認";
        }
        counted += 1;
        totalVar += variance;
      }
      countItems.push({
        id: `ici_${si + 1}_${pi + 1}`,
        sessionId: id,
        productId: p.id,
        locationId: p.locationId,
        locationCode: p.locationId.slice(4),
        posQty,
        actualQty,
        variance,
        reason,
        note,
        countedAt: isCounted ? new Date(startedAt.getTime() + pi * 90_000) : null,
      });
    });
    const completedAt = plan.status === "COMPLETED" ? new Date(startedAt.getTime() + scope.length * 90_000 + 600_000) : null;
    sessions.push({
      id,
      code: `IC${ymd(countDate)}-${pad(si + 1, 2)}`,
      countDate,
      operator: OPERATORS[si % OPERATORS.length],
      status: plan.status,
      note: plan.status === "PAUSED" ? "冷藏冷凍區盤點，午間尖峰暫停，下午繼續" : si === 0 ? "季度全面盤點" : null,
      zones,
      countedCount: counted,
      uncountedCount: scope.length - counted,
      totalVariance: totalVar,
      startedAt,
      pausedAt: plan.status === "PAUSED" ? new Date(startedAt.getTime() + 3 * 3_600_000) : null,
      completedAt,
      createdAt: startedAt,
    });
  });

  return {
    categories,
    locations,
    suppliers,
    products,
    inventories,
    members: memberRows,
    orders,
    orderItems,
    sessions,
    countItems,
  };
}
