// 전날 종가(한국·미국 증시)를 모아 data/market.json 으로 저장 (Node 18+, 외부 패키지 없음)
// 실행: node scripts/fetch_market.mjs
import { writeFile, mkdir } from "node:fs/promises";

const SYMBOLS = [
  { symbol: "^KS11", name: "코스피", group: "kr" },
  { symbol: "^KQ11", name: "코스닥", group: "kr" },
  { symbol: "005930.KS", name: "삼성전자", group: "kr" },
  { symbol: "000660.KS", name: "SK하이닉스", group: "kr" },
  { symbol: "^DJI", name: "다우존스", group: "us" },
  { symbol: "^IXIC", name: "나스닥", group: "us" },
  { symbol: "^GSPC", name: "S&P 500", group: "us" },
  { symbol: "SOXL", name: "SOXL", group: "us" },
];

async function fetchOne(s) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.symbol)}?range=10d&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${s.symbol}: HTTP ${res.status}`);
  const r = (await res.json()).chart.result[0];
  const closes = r.indicators.quote[0].close;
  const marketOpenNow = Date.now() / 1000 < r.meta.currentTradingPeriod.regular.end
    && Date.now() / 1000 > r.meta.currentTradingPeriod.regular.start;
  // 확정된 종가만 사용: 장중이면 오늘 막대는 제외
  const bars = r.timestamp
    .map((t, i) => ({ t, close: closes[i] }))
    .filter((b) => b.close != null)
    .filter((b) => !(marketOpenNow && b.t >= r.meta.currentTradingPeriod.regular.start));
  if (bars.length < 2) throw new Error(`${s.symbol}: 데이터 부족`);
  const last = bars.at(-1), prev = bars.at(-2);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: r.meta.exchangeTimezoneName }).format(new Date(last.t * 1000));
  return {
    ...s,
    currency: r.meta.currency,
    close: last.close,
    change: last.close - prev.close,
    changePct: ((last.close - prev.close) / prev.close) * 100,
    date,
  };
}

// ---------- 코인: 업비트 원화 가격, 전날 밤 12시(KST) 기준 ----------
const COINS = [
  { symbol: "KRW-BTC", name: "비트코인", group: "crypto" },
  { symbol: "KRW-ETH", name: "이더리움", group: "crypto" },
  { symbol: "KRW-XRP", name: "리플", group: "crypto" },
];

// 가장 최근 지나간 KST 자정 (UTC로는 전날 15:00)
function lastKstMidnight() {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const midnightKstAsUtc = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  return new Date(midnightKstAsUtc - 9 * 3600 * 1000);
}

async function fetchCoin(c) {
  const midnight = lastKstMidnight();
  const to = midnight.toISOString().replace(".000Z", "Z");
  const url = `https://api.upbit.com/v1/candles/minutes/60?market=${c.symbol}&to=${to}&count=25`;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${c.symbol}: HTTP ${res.status}`);
  const candles = await res.json(); // 최신순: [0] = 23:00~24:00 KST
  if (candles.length < 25) throw new Error(`${c.symbol}: 데이터 부족`);
  const close = candles[0].trade_price, prev = candles[24].trade_price;
  // 자정 직전 날짜 (예: 11/18 00:00 → "2026-11-17")
  const date = candles[0].candle_date_time_kst.slice(0, 10);
  return { ...c, currency: "KRW", close, change: close - prev, changePct: ((close - prev) / prev) * 100, date };
}

const ALL = [...SYMBOLS, ...COINS];
const results = await Promise.allSettled([...SYMBOLS.map(fetchOne), ...COINS.map(fetchCoin)]);
const items = results.map((r, i) => {
  if (r.status === "fulfilled") return r.value;
  console.warn("실패:", r.reason.message);
  return { ...ALL[i], close: null };
});
items.forEach((x) => console.log(x.name.padEnd(8), x.date ?? "-", x.close?.toFixed(2) ?? "실패", x.changePct?.toFixed(2) ?? ""));

if (!items.some((x) => x.close != null)) {
  console.error("시세를 하나도 가져오지 못했어요. 기존 market.json을 유지합니다.");
  process.exit(1);
}

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/market.json", import.meta.url),
  JSON.stringify({ updated: new Date().toISOString(), items }, null, 2) + "\n",
);
console.log("market.json 저장 완료");
