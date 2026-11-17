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

const results = await Promise.allSettled(SYMBOLS.map(fetchOne));
const items = results.map((r, i) => {
  if (r.status === "fulfilled") return r.value;
  console.warn("실패:", r.reason.message);
  return { ...SYMBOLS[i], close: null };
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
